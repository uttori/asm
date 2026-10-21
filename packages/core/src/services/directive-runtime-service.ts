import { normalizeAddressForWidth } from "../address-width.js";
import { bindDataOperand, parseDataList } from "../ir/data-node.js";
import { parseDeclarationNode } from "../ir/declaration-node.js";
import { parseDirectiveExpression } from "../ir/directive-arguments.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import { literalDataOperands, type NumericDataStatement } from "../ir/statement-node.js";
import type { OperandResolver } from "../operand-resolver.js";
import type { DefineEngine } from "./define-engine.js";
import type { StructEngine } from "./struct-engine.js";
import type { SymbolScopeService } from "./symbol-scope-service.js";

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
  collectSourceMetadata: boolean;
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
    // This public token entry preserves its arity diagnostic before invoking the shared grammar.
    if (words.length !== 3) {
      throw new Error("Character mapping requires format: 'char' = value");
    }
    const declaration = parseDeclarationNode(words.join(" "), words);
    if (declaration?.kind === "invalid") {
      throw new Error(declaration.message);
    }
    if (declaration?.kind !== "character") {
      throw new Error("Character mapping requires format: 'char' = value");
    }
    const value = this.host.operandResolver.getnum(declaration.expression);
    this.host.characterMappings.set(declaration.character, value);
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

    this.executeOrg(parseDirectiveExpression(params[0], false), params[0]);
  }

  /** ORG uses mathematical evaluation, including grouped fractions, before checking the target range. */
  executeOrg(expression: ExpressionNode, spelling: string): void {
    let address: number;
    try {
      address = this.host.operandResolver.deps.evaluateMath(expression);
    } catch {
      throw new Error(`Invalid ORG address: ${spelling}`);
    }
    if (Number.isNaN(address) || address < 0 || address > 2 ** this.host.addressWidth - 1) {
      throw new Error(`Invalid ORG address: ${spelling}`);
    }
    this.host.setWritePosition(address);
  }

  /**
   * Handles data directives.
   * @param {string} type The data directive keyword.
   * @param {string[]} params The directive parameters.
   */
  handleDataDirective(type: string, params: string[], numeric?: NumericDataStatement): void {
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

    const lengthMap: { [key: string]: 1 | 2 | 3 | 4 | undefined } = {
      db: 1,
      dw: 2,
      dl: 3,
      dd: 4,
    };

    const len = lengthMap[type.toLowerCase()];
    if (!len) {
      throw new Error(`Invalid data directive: ${type}`);
    }

    const statement = numeric ?? {
      width: len,
      operands: parseDataList(params.join(" ")),
    };
    this.executeDataStatement(statement);
  }

  /** Resolve each element at its write cursor; sizing binds lists but never evaluates numeric values. */
  executeDataStatement(
    statement: NumericDataStatement,
    estimateOnly = this.host.isDefinitionCollectionStage,
  ): void {
    if (statement.literalData) {
      if (statement.literalData.length === 0 || statement.literalData.length % 6 !== 0) {
        throw new Error("Invalid literal data syntax.");
      }
      if (estimateOnly) {
        this.host.step((statement.literalData.length / 6) * statement.width);
      } else {
        // These nodes are parsed literal occurrences: no define/list binding or speculative reads
        // remain. Numeric observation still runs at each original write cursor through getnum.
        for (const operand of literalDataOperands(statement.literalData)) {
          this.writeDataByLength(
            statement.width,
            this.host.operandResolver.getnum(operand.expression),
          );
        }
      }
      if (this.host.collectSourceMetadata) {
        this.host.addAddressToLine(
          normalizeAddressForWidth(this.host.currentTargetBaseAddress, this.host.addressWidth),
        );
      }
      return;
    }
    if (!statement.operands.length) {
      throw new Error(
        `${(statement.emptyDirective ?? ["", "db", "dw", "dl", "dd"][statement.width]).toUpperCase()} directive requires at least one parameter.`,
      );
    }
    let estimatedItems = 0;
    const pending = [...statement.operands].toReversed();
    while (pending.length) {
      const original = pending.pop()!;
      let entries: readonly (typeof original)[];
      try {
        entries = bindDataOperand(original, (fragment) =>
          this.host.defineEngine.resolveFragment(fragment),
        );
      } catch (cause) {
        if (!estimateOnly) {
          throw cause;
        }
        estimatedItems++;
        continue;
      }
      if (entries.length !== 1) {
        for (let index = entries.length - 1; index >= 0; index--) {
          pending.push(entries[index]);
        }
        continue;
      }
      const entry = entries[0];
      if (entry.expression.type === "string") {
        let value = entry.expression.value;
        try {
          value = this.host.defineEngine.resolveDefinesInStringLiteral(value);
        } catch (cause) {
          if (!estimateOnly) {
            throw cause;
          }
        }
        if (estimateOnly) {
          estimatedItems += value.length;
        } else {
          for (const character of this.processStringWithMapping(value)) {
            this.writeDataByLength(statement.width, character);
          }
        }
      } else if (estimateOnly) {
        estimatedItems++;
      } else {
        this.writeDataByLength(statement.width, this.host.operandResolver.getnum(entry.expression));
      }
    }
    if (estimateOnly) {
      this.host.step(estimatedItems * statement.width);
    }
    if (this.host.collectSourceMetadata) {
      this.host.addAddressToLine(
        normalizeAddressForWidth(this.host.currentTargetBaseAddress, this.host.addressWidth),
      );
    }
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
   * Estimates data size with the same expansion order as emission, without resolving final values.
   * @param {number} len Bytes per numeric item (1–4). String characters each occupy one item.
   * @param {string[]} params Source operands, including defines that may expand to data lists.
   */
  estimateDataDirectiveSize(len: number, params: string[]): void {
    if (len !== 1 && len !== 2 && len !== 3 && len !== 4) {
      throw new Error(`Unsupported data length ${len}`);
    }
    this.executeDataStatement({ width: len, operands: parseDataList(params.join(" ")) }, true);
  }

  /**
   * Pushes the current PC state.
   */
  handlePushPC(): void {
    if (this.host.pushpcnum >= 256) {
      throw new Error("PushPC stack overflow.");
    }

    // Save both logical and base cursors. `base` can decouple emitted PC from
    // the visible logical address, so restoring only one pair would corrupt later
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
    // Restore exactly the state captured by `pushpc`. Directives such as
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
