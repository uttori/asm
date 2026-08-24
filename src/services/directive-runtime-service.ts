import type { OperandResolver } from "../operand-resolver.js";
import type { DefineEngine } from "./define-engine.js";
import type { StructEngine } from "./struct-engine.js";
import type { SymbolScopeService } from "./symbol-scope-service.js";
import { splitRespectingFunctions } from "./command-text-service.js";

export type PushPcStackEntry = {
  currentTargetAddress: number;
  currentTargetStartAddress: number;
  currentTargetBaseAddress: number;
  currentTargetBaseStartAddress: number;
};

export interface DirectiveRuntimeHost {
  addressWidth: number;
  characterMappings: Map<string, number>;
  currentTargetAddress: number;
  currentTargetBaseAddress: number;
  currentTargetBaseStartAddress: number;
  currentTargetStartAddress: number;
  defineEngine: DefineEngine;
  isDefinitionCollectionStage: boolean;
  namespaceNestingEnabled: boolean;
  namespaceNestingPath: string[];
  namespaceStack: string[];
  operandResolver: OperandResolver;
  pushpcStack: PushPcStackEntry[];
  pushpcnum: number;
  structEngine: StructEngine;
  symbolScope: SymbolScopeService;
  addAddressToLine(address: number): void;
  resolvedefines(input: string): string;
  setWritePosition(address: number): void;
  step(count: number): void;
  write1(value: number): void;
  write2(value: number): void;
  write3(value: number): void;
  write4(value: number): void;
}

export class DirectiveRuntimeService {
  constructor(readonly host: DirectiveRuntimeHost) {}

  /**
   * Handles character mapping like `"A" = 0x42` and assigns the value to the character in `characterMappings`.
   * @param {string[]} words The character mapping command words.
   * @throws {Error} If the format is incorrect.
   */
  handleCharacterMapping(words: readonly string[]): void {
    if (words.length !== 3) {
      throw new Error("Character mapping requires format: 'char' = value");
    }
    const token = words[0];
    const quoted = /^'([\s\S])'$/.exec(token) ?? /^"([\s\S])"$/.exec(token);
    const char = quoted ? quoted[1] : token.replace(/["']/g, "");
    if (char.length !== 1) {
      throw new Error("Character mapping requires format: 'char' = value");
    }
    const value = this.host.operandResolver.getnum(words[2]);
    this.host.characterMappings.set(char, value);
  }

  /**
   * Processes a string and maps characters to their corresponding values in `characterMappings`.
   * If a character is not found in `characterMappings`, its charCode is used instead.
   * @param {string} input The string to process.
   * @returns {number[]} An array of numbers representing the mapped characters.
   */
  processStringWithMapping(input: string): number[] {
    return Array.from(input).map(
      (char) => this.host.characterMappings.get(char) ?? char.charCodeAt(0),
    );
  }

  /**
   * Handles `org`.
   * @param {string[]} params The directive parameters.
   */
  handleOrg(params: string[]): void {
    if (params.length !== 1) {
      throw new Error("ORG requires a single address parameter.");
    }

    const addressStr = params[0].trim();
    let addr: number;
    if (/^\$[\da-f]+$/i.test(addressStr)) {
      addr = parseInt(addressStr.substring(1), 16);
    } else if (/^-?\d+$/.test(addressStr)) {
      addr = parseInt(addressStr, 10);
    } else {
      try {
        // Asar accepts `org !Size-$01` and bitwise header-location math.
        // Evaluate through math so leftover junk still errors instead of
        // silently becoming 0 during definition collection.
        addr = this.host.operandResolver.deps.evaluateMath(this.host.resolvedefines(addressStr));
      } catch {
        throw new Error(`Invalid ORG address: ${params[0]}`);
      }
    }

    const maxAddress = 2 ** this.host.addressWidth - 1;
    if (Number.isNaN(addr) || addr < 0 || addr > maxAddress) {
      throw new Error(`Invalid ORG address: ${params[0]}`);
    }

    this.host.setWritePosition(addr);
  }

  /**
   * Handles data directives.
   * @param {string} type The data directive keyword.
   * @param {string[]} params The directive parameters.
   */
  handleDataDirective(type: string, params: string[]): void {
    if (!Array.isArray(params) || params.length === 0) {
      throw new Error(`${type.toUpperCase()} directive requires at least one parameter.`);
    }

    // Support SNASM-style aliases while keeping one canonical byte-width table.
    if (type.toLowerCase() === "dc.b") {
      type = "db";
    } else if (type.toLowerCase() === "dc.w") {
      type = "dw";
    } else if (type.toLowerCase() === "dc.l") {
      type = "dl";
    }

    const lengthMap: { [key: string]: number } = {
      db: 1,
      dw: 2,
      dl: 3,
      dd: 4,
    };

    const len = lengthMap[type.toLowerCase()];
    if (!len) {
      throw new Error(`Invalid data directive: ${type}`);
    }

    if (this.host.isDefinitionCollectionStage) {
      this.estimateDataDirectiveSize(len, params);
      return;
    }

    // Defines can expand to comma-separated values, so process a queue and
    // reinsert expanded tokens rather than doing a single flat pass.
    const pendingValues = splitRespectingFunctions(params.join(" "));
    while (pendingValues.length > 0) {
      let value = (pendingValues.shift() ?? "").trim();
      if (value.startsWith('"') || value.startsWith("'")) {
        // String literals go through define expansion first, then through the
        // active character mapping table one character at a time.
        const unquoted = value.slice(1, -1);
        const expandedString = this.host.defineEngine.resolveDefinesInStringLiteral(unquoted);
        const mappedChars = this.processStringWithMapping(expandedString);
        for (const charValue of mappedChars) {
          this.writeDataByLength(len, charValue);
        }
        continue;
      }

      if (value.startsWith("#")) {
        value = value.substring(1);
      }

      // Recursively resolve defines until the token stops changing. This
      // preserves existing behavior for define chains used inside data lists.
      let resolved = value;
      let previousResolved = "";
      while (resolved !== previousResolved) {
        previousResolved = resolved;
        resolved = this.host.resolvedefines(resolved);
      }

      const expandedValues = splitRespectingFunctions(resolved);
      if (expandedValues.length > 1) {
        pendingValues.unshift(...expandedValues);
        continue;
      }

      let num: number;
      // Struct member references look like labels but need struct-specific
      // indexing and extension rules before falling back to numeric parsing.
      if (this.host.structEngine.hasStructReference(resolved)) {
        const structValue = this.host.structEngine.resolveStructLabel(resolved);
        if (typeof structValue === "number" && !Number.isNaN(structValue)) {
          this.writeDataByLength(len, structValue);
          continue;
        }
        num = structValue;
      } else {
        num = this.host.operandResolver.getnum(resolved);
      }
      if (Number.isNaN(num)) {
        // As a final fallback, treat the value as a static label reference.
        num = this.host.symbolScope.getLabelValue(resolved, true);
      }
      if (Number.isNaN(num)) {
        throw new Error("Unable to determine value:");
      }
      this.writeDataByLength(len, num);
    }

    this.host.addAddressToLine(this.host.currentTargetBaseAddress & 0xffffff);
  }

  /**
   * Writes a value using the data directive byte width.
   * @param {number} len The byte width.
   * @param {number} value The value to write.
   */
  writeDataByLength(len: number, value: number): void {
    if (typeof len !== "number") {
      len = Number.parseInt(len, 10);
      if (Number.isNaN(len)) {
        throw new Error("writeDataByLength: len is NaN");
      }
    }
    switch (len) {
      case 1:
        this.host.write1(value);
        break;
      case 2:
        this.host.write2(value);
        break;
      case 3:
        this.host.write3(value);
        break;
      case 4:
        this.host.write4(value);
        break;
      default:
        throw new Error(`Unsupported data length ${len}`);
    }
  }

  /**
   * Estimates data directive size.
   * @param {number} len The len.
   * @param {string[]} params The params.
   */
  estimateDataDirectiveSize(len: number, params: string[]): void {
    const pendingValues = [...splitRespectingFunctions(params.join(" "))];
    let estimatedItems = 0;
    while (pendingValues.length > 0) {
      let value = (pendingValues.shift() ?? "").trim();
      if (!value) {
        continue;
      }

      if (value.startsWith('"') || value.startsWith("'")) {
        const unquoted = value.slice(1, -1);
        try {
          // Pass 0 needs byte counts, not final values. If defines in a string
          // are known, use the expanded length; otherwise fall back to literal
          // length so layout can keep moving.
          estimatedItems += this.host.defineEngine.resolveDefinesInStringLiteral(unquoted).length;
        } catch {
          estimatedItems += unquoted.length;
        }
        continue;
      }

      if (value.startsWith("#")) {
        value = value.substring(1);
      }

      let resolved = value;
      let previousResolved = "";
      try {
        while (resolved !== previousResolved) {
          previousResolved = resolved;
          resolved = this.host.resolvedefines(resolved);
        }
      } catch {
        // Pass 0 only needs byte counts, so unresolved symbols still consume one item.
      }

      const expandedValues = splitRespectingFunctions(resolved);
      if (expandedValues.length > 1) {
        // A define may stand in for a whole data list, so count each expanded
        // value independently.
        pendingValues.unshift(...expandedValues);
        continue;
      }

      estimatedItems += 1;
    }

    this.host.step(estimatedItems * len);
    this.host.addAddressToLine(this.host.currentTargetBaseAddress & 0xffffff);
  }

  /**
   * Pushes the current PC state.
   */
  handlePushPC(): void {
    if (this.host.pushpcnum >= 256) {
      throw new Error("PushPC stack overflow.");
    }

    // Save both logical and base cursors. `base` can decouple emitted PC from
    // the visible SNES address, so restoring only one pair would corrupt later
    // layout.
    this.host.pushpcStack.push({
      currentTargetAddress: this.host.currentTargetAddress,
      currentTargetStartAddress: this.host.currentTargetStartAddress,
      currentTargetBaseAddress: this.host.currentTargetBaseAddress,
      currentTargetBaseStartAddress: this.host.currentTargetBaseStartAddress,
    });

    this.host.pushpcnum++;
  }

  /**
   * Restores the previous PC state.
   */
  handlePullPC(): void {
    if (this.host.pushpcnum === 0) {
      throw new Error("PullPC without PushPC.");
    }

    const state = this.host.pushpcStack.pop();
    // Restore exactly the state captured by `pushpc`; directives such as
    // `incbin -> label` depend on this to resume emission at the original site.
    if (state) {
      this.host.currentTargetAddress = state.currentTargetAddress;
      this.host.currentTargetStartAddress = state.currentTargetStartAddress;
      this.host.currentTargetBaseAddress = state.currentTargetBaseAddress;
      this.host.currentTargetBaseStartAddress = state.currentTargetBaseStartAddress;
    }

    this.host.pushpcnum--;
  }
}
