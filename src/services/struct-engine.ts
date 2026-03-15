import type { StructDefinition } from "../assembler.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import { parseExpressionNode } from "../ir/expression-node.js";
import { setCommandKind, type NormalizedCommand } from "../ir/normalized-command.js";

export type StructHost = {
  currentStruct: StructDefinition | null;
  structs: Map<string, StructDefinition>;
  operandResolver: { getnum(input: string): number };
  write1(value: number): void;
  readFile(filename: string): Uint8Array | string;
  recordCurrentAddress(): void;
  handlePushPC(): void;
  handlePullPC(): void;
  getLabelValue(label: string, requireStatic: boolean): number;
  evaluateRangeExpression(expression: string | ExpressionNode): number;
  enterStructDefinition(base: number): void;
  restoreStructDefinition(): void;
  setWritePosition(address: number): void;
};

export class StructEngine {
  constructor(readonly host: StructHost) {}

  /**
   * Handles a struct mode command.
   * @param {NormalizedCommand} command The command to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleStructMode(command: NormalizedCommand): boolean {
    if (!this.host.currentStruct) {
      return false;
    }

    const { words } = command;
    const keyword = words[0] ?? "";

    if (keyword.startsWith(".")) {
      const hasColon = keyword.endsWith(":");
      const labelName = keyword.replace(/:$/, "").substring(1);
      this.host.currentStruct.labels.set(labelName, this.host.currentStruct.offset);

      if (words[1]?.toLowerCase() === "skip") {
        if (words.length !== 3) {
          throw new Error(`skip directive in struct requires exactly one parameter: ${words.length}`);
        }
        const skipAmount = this.host.operandResolver.getnum(words[2]);
        this.host.currentStruct.offset += skipAmount;
      }

      void hasColon;
      setCommandKind(command, "structCommand");
      return true;
    }

    if (keyword.toLowerCase() === "endstruct") {
      this.handleEndStruct(words);
      setCommandKind(command, "structCommand");
      return true;
    }

    setCommandKind(command, "structCommand");
    return true;
  }

  /**
   * Handles a struct command.
   * @param {string[]} words The words of the command.
   */
  handleStruct(words: string[]): void {
    if (words.length < 2) {
      throw new Error("Struct definition requires at least two parameters.");
    }

    const structName = words[1];
    let base: number;
    let parent: string | undefined;

    if (words.length === 2) {
      base = 0;
    } else if (words[2].toLowerCase() === "extends") {
      if (words.length < 4) {
        throw new Error("Struct extension must specify a parent struct.");
      }
      parent = words[3];
      if (!this.host.structs.has(parent)) {
        throw new Error(`Parent struct '${parent}' not defined.`);
      }
      base = this.host.structs.get(parent).base;
    } else {
      base = this.host.operandResolver.getnum(words[2]);
      if (base < 0 || base > 0xFFFFFF) {
        throw new Error(`Invalid SNES address for struct: ${words[2]}`);
      }
    }

    this.host.enterStructDefinition(base);
    this.host.currentStruct = {
      name: structName,
      base,
      offset: 0,
      size: 0,
      labels: new Map(),
      parent,
    };
  }

  /**
   * Handles an endstruct command.
   * @param {string[]} words The words of the command.
   */
  handleEndStruct(words: string[]): void {
    if (!this.host.currentStruct) {
      throw new Error("endstruct encountered but not inside a struct definition.");
    }

    let align: number | undefined;
    if (words.length >= 2 && words[1].toLowerCase() === "align") {
      if (words.length !== 3) {
        throw new Error("endstruct align requires a single alignment parameter.");
      }
      align = this.host.operandResolver.getnum(words[2]);
      if (align < 1) {
        throw new Error("Alignment must be at least 1.");
      }
    }

    let finalSize = this.host.currentStruct.offset;
    if (align !== undefined) {
      finalSize = Math.ceil(finalSize / align) * align;
      this.host.currentStruct.align = align;
    }
    this.host.currentStruct.size = finalSize;

    if (this.host.currentStruct.parent) {
      const parentName = this.host.currentStruct.parent;
      const parentStruct = this.host.structs.get(parentName);
      const extSize = this.host.currentStruct.size;
      if (!parentStruct.extensionSize || extSize > parentStruct.extensionSize) {
        parentStruct.extensionSize = extSize;
      }
      this.host.structs.set(`${parentName}.${this.host.currentStruct.name}`, this.host.currentStruct);
      this.host.structs.set(this.host.currentStruct.name, this.host.currentStruct);
    } else {
      this.host.structs.set(this.host.currentStruct.name, this.host.currentStruct);
    }

    this.host.restoreStructDefinition();

    this.host.currentStruct = null;
  }

  /**
   * Resolves a struct label.
   * @param {string} labelRef The label to resolve.
   * @returns {number} The resolved address.
   */
  resolveStructLabel(labelRef: string): number {
    const refParts = labelRef.split(".");
    if (refParts.length === 2 && !labelRef.includes("[")) {
      const parentName = refParts[0];
      if (this.host.structs.has(parentName)) {
        const parentDef = this.host.structs.get(parentName);
        if (this.host.structs.has(labelRef) && this.host.structs.get(labelRef).parent === parentName) {
          return parentDef.base + parentDef.size;
        }
      }
    }

    if (this.host.structs.has(labelRef)) {
      return this.host.structs.get(labelRef).base;
    }

    let arrayIndex = 0;
    let candidate = labelRef;
    let extraMember = "";
    const arrayMatch = candidate.match(/^(.*?)\[(\d+)](.*)$/);
    if (arrayMatch) {
      candidate = arrayMatch[1];
      arrayIndex = Number.parseInt(arrayMatch[2], 10);
      extraMember = arrayMatch[3];
      if (extraMember.startsWith(".")) {
        extraMember = extraMember.substring(1);
      }
    }

    const parts = candidate.split(".");
    for (let i = parts.length; i >= 1; i--) {
      const potential = parts.slice(0, i).join(".");
      if (!this.host.structs.has(potential)) {
        continue;
      }

      const def = this.host.structs.get(potential);
      const memberPart = parts.slice(i).join(".");
      const memberName = memberPart + (extraMember ? (memberPart ? "." : "") + extraMember : "");

      const baseStructSize = def.size;
      let effectiveSize = baseStructSize;
      if (def.align) {
        effectiveSize = Math.ceil(baseStructSize / def.align) * def.align;
      }

      let maxExtensionSize = 0;
      for (const [, structDef] of this.host.structs.entries()) {
        if (structDef.parent === potential && structDef.size > maxExtensionSize) {
          maxExtensionSize = structDef.size;
        }
      }
      if (maxExtensionSize > 0) {
        effectiveSize += maxExtensionSize;
      }

      if (memberName.trim() === "") {
        if (arrayIndex > 0) {
          return def.base + (arrayIndex * effectiveSize);
        }
        return def.base;
      }

      const memberParts = memberName.split(".");
      const topLevelMember = memberParts[0];
      if (!def.labels.has(topLevelMember)) {
        throw new Error(`Member '${topLevelMember}' not defined in struct '${potential}'.`);
      }

      const offset = def.labels.get(topLevelMember);
      let finalAddress: number;

      if (def.parent) {
        const parentDef = this.host.structs.get(def.parent);
        if (!parentDef) {
          throw new Error(`Parent struct '${def.parent}' not defined for extension '${potential}'.`);
        }

        let parentSize = parentDef.size;
        if (parentDef.align) {
          parentSize = Math.ceil(parentSize / parentDef.align) * parentDef.align;
        }

        if (arrayIndex === 0) {
          finalAddress = parentDef.base + parentSize + offset;
        } else {
          finalAddress = parentDef.base + parentSize + (arrayIndex * def.size) + offset;
        }
      } else {
        finalAddress = def.base + (arrayIndex * effectiveSize) + offset;
      }

      return finalAddress;
    }

    throw new Error(`Struct not defined in reference: ${labelRef}`);
  }

  /**
   * Handles an incbin command.
   * @param {string[]} words The words of the command.
   */
  handleIncbin(words: string[]): void {
    let targetLocationSpecified = false;
    let targetLocation: string | null = null;
    const arrowIndex = words.indexOf("->");
    if (arrowIndex !== -1) {
      targetLocationSpecified = true;
      if (arrowIndex + 1 >= words.length) {
        throw new Error("incbin '->' syntax requires a target location.");
      }
      targetLocation = words[arrowIndex + 1];
      words = words.slice(0, arrowIndex);
    }

    const filenameWithRange = words[1];
    let filename: string;
    let rangeStr: string | null = null;
    const colonIndex = filenameWithRange.indexOf(":");
    if (colonIndex !== -1) {
      filename = filenameWithRange.substring(0, colonIndex);
      rangeStr = filenameWithRange.substring(colonIndex + 1);
    } else {
      filename = filenameWithRange;
    }
    filename = filename.replace(/^"(.*)"$/, "$1");

    const fileData = this.host.readFile(filename) as Uint8Array;
    if (!fileData) {
      throw new Error(`Failed to read file: ${filename}`);
    }

    let startOffset = 0;
    let endOffset = fileData.length;
    if (rangeStr) {
      if (rangeStr.indexOf("..") !== -1) {
        const parts = rangeStr.split("..");
        if (parts[0] === "" || parts[1] === "") {
          throw new Error(`Invalid range specification: ${rangeStr}`);
        }
        const rangeNode = parseExpressionNode(rangeStr);
        if (rangeNode.type !== "range") {
          throw new Error(`Invalid range specification: ${rangeStr}`);
        }
        startOffset = this.host.evaluateRangeExpression(rangeNode.start);
        endOffset = this.host.evaluateRangeExpression(rangeNode.end);
        if (endOffset === 0) {
          endOffset = fileData.length;
        }
      } else if (rangeStr.indexOf("-") !== -1) {
        if (rangeStr.includes("(") || rangeStr.includes(")")) {
          throw new Error("Emismatched_parentheses: Mismatched parentheses.");
        }
        const parts = rangeStr.split("-");
        if (parts[0] === "" || parts[1] === "") {
          throw new Error(`Invalid range specification: ${rangeStr}`);
        }
        startOffset = this.host.evaluateRangeExpression(parts[0]);
        endOffset = this.host.evaluateRangeExpression(parts[1]);
        if (endOffset === 0) {
          endOffset = fileData.length;
        }
      } else {
        throw new Error(`Invalid range specification: ${rangeStr}`);
      }
    }

    if (startOffset > endOffset || startOffset < 0 || startOffset > fileData.length) {
      throw new Error(`Start offset ${startOffset} out of bounds for file ${filename}`);
    }
    if (endOffset < startOffset || endOffset > fileData.length) {
      throw new Error(`End offset ${endOffset} out of bounds for file ${filename}`);
    }

    const incbinData = fileData.slice(startOffset, endOffset);

    if (targetLocationSpecified) {
      this.host.handlePushPC();

      let targetAddress: number;
      if (/^\$?[\dA-Fa-f]+$/.test(targetLocation ?? "")) {
        targetAddress = this.host.operandResolver.getnum(targetLocation ?? "");
      } else {
        targetAddress = this.host.getLabelValue(targetLocation ?? "", false);
      }
      this.host.setWritePosition(targetAddress);

      for (const byte of incbinData) {
        this.host.write1(byte);
      }

      this.host.handlePullPC();
    } else {
      for (const byte of incbinData) {
        this.host.write1(byte);
      }
    }

    this.host.recordCurrentAddress();
  }
}
