import { setCommandKind, type NormalizedCommand } from "../ir/normalized-command.js";

export interface StructDefinition {
  name: string;
  /** The SNES start address for the struct. */
  base: number;
  /** Running offset as member commands are processed. */
  offset: number;
  /** Final size (after alignment, etc.) */
  size: number;
  /** Mapping from member name (without the leading dot) to its offset. */
  labels: Map<string, number>;
  /** Optional alignment (if specified in endstruct). */
  align?: number;
  /** If this struct extends a parent. */
  parent?: string;
  /** Cached maximum child extension size, or zero when there are no extensions. */
  extensionSize: number;
}

export type StructHost = {
  currentStruct: StructDefinition | null;
  structs: Map<string, StructDefinition>;
  operandResolver: { getnum(input: string): number };
  enterStructDefinition(base: number): void;
  restoreStructDefinition(): void;
  recordSymbolDefinition(
    kind: "struct" | "structMember",
    name: string,
    options?: { value?: number | string; containerName?: string },
  ): void;
};

export class StructEngine {
  constructor(readonly host: StructHost) {}

  /**
   * Handles a struct mode command.
   * @param {NormalizedCommand} command The command to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleStructMode(command: NormalizedCommand): boolean {
    const currentStruct = this.host.currentStruct;
    if (!currentStruct) {
      return false;
    }

    const { words } = command;
    const keyword = words[0] ?? "";

    if (keyword.startsWith(".")) {
      const hasColon = keyword.endsWith(":");
      const labelName = keyword.replace(/:$/, "").substring(1);
      currentStruct.labels.set(labelName, currentStruct.offset);
      this.host.recordSymbolDefinition("structMember", labelName, {
        value: currentStruct.offset,
        containerName: currentStruct.name,
      });

      if (words[1]?.toLowerCase() === "skip") {
        if (words.length !== 3) {
          throw new Error(
            `skip directive in struct requires exactly one parameter: ${words.length}`,
          );
        }
        const skipAmount = this.host.operandResolver.getnum(words[2]);
        currentStruct.offset += skipAmount;
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
  handleStruct(words: readonly string[]): void {
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
      const parentStruct = this.host.structs.get(parent);
      if (!parentStruct) {
        throw new Error(`Parent struct '${parent}' not defined.`);
      }
      base = parentStruct.base;
    } else {
      base = this.host.operandResolver.getnum(words[2]);
      if (base < 0 || base > 0xffffff) {
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
      extensionSize: 0,
    };
    this.host.recordSymbolDefinition("struct", structName, { value: base });
  }

  /**
   * Handles an endstruct command.
   * @param {string[]} words The words of the command.
   */
  handleEndStruct(words: readonly string[]): void {
    const currentStruct = this.host.currentStruct;
    if (!currentStruct) {
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

    let finalSize = currentStruct.offset;
    if (align !== undefined) {
      finalSize = Math.ceil(finalSize / align) * align;
      currentStruct.align = align;
    }
    currentStruct.size = finalSize;

    if (currentStruct.parent) {
      const parentName = currentStruct.parent;
      const parentStruct = this.host.structs.get(parentName);
      if (!parentStruct) {
        throw new Error(`Parent struct '${parentName}' not defined.`);
      }
      const extSize = currentStruct.size;
      if (extSize > parentStruct.extensionSize) {
        parentStruct.extensionSize = extSize;
      }
      this.host.structs.set(`${parentName}.${currentStruct.name}`, currentStruct);
      this.host.structs.set(currentStruct.name, currentStruct);
    } else {
      this.host.structs.set(currentStruct.name, currentStruct);
    }

    this.host.restoreStructDefinition();

    this.host.currentStruct = null;
  }

  /**
   * Checks whether a reference starts with a known struct name.
   * @param {string} labelRef The reference to inspect.
   * @returns {boolean} Whether the reference belongs to a known struct.
   */
  hasStructReference(labelRef: string): boolean {
    // oxlint-disable-next-line security/detect-unsafe-regex -- Anchored segments use non-overlapping separators.
    if (!/^[A-Z_a-z]\w*(?:\[-?\d+])?(?:\.[A-Z_a-z]\w*(?:\[-?\d+])?)*$/.test(labelRef)) {
      return false;
    }
    if (this.host.structs.has(labelRef)) {
      return true;
    }
    const dotIndex = labelRef.indexOf(".");
    const bracketIndex = labelRef.indexOf("[");
    let rootEnd = Math.min(dotIndex, bracketIndex);
    if (dotIndex === -1) {
      rootEnd = bracketIndex;
    } else if (bracketIndex === -1) {
      rootEnd = dotIndex;
    }
    const root = rootEnd === -1 ? labelRef : labelRef.slice(0, rootEnd);
    return root.length > 0 && this.host.structs.has(root);
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
      const parentDef = this.host.structs.get(parentName);
      if (parentDef) {
        const extensionDef = this.host.structs.get(labelRef);
        if (extensionDef?.parent === parentName) {
          return parentDef.base + parentDef.size;
        }
      }
    }

    const directStruct = this.host.structs.get(labelRef);
    if (directStruct) {
      return directStruct.base;
    }

    let arrayIndex = 0;
    let candidate = labelRef;
    let extraMember = "";
    const arrayMatch = candidate.match(/^(.*?)\[(-?\d+)](.*)$/);
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
      if (!def) {
        continue;
      }
      const memberPart = parts.slice(i).join(".");
      const memberName = memberPart + (extraMember ? (memberPart ? "." : "") + extraMember : "");

      const baseStructSize = def.size;
      let effectiveSize = baseStructSize;
      if (def.align) {
        effectiveSize = Math.ceil(baseStructSize / def.align) * def.align;
      }

      // Arrays of a parent struct must reserve enough room for whichever child
      // extension is largest, otherwise `parent[n].ext.member` resolves into
      // the wrong element once an extension increases the total record size.
      const maxExtensionSize = def.extensionSize;
      if (maxExtensionSize > 0) {
        effectiveSize += maxExtensionSize;
      }

      if (memberName.trim() === "") {
        if (arrayIndex !== 0) {
          return def.base + arrayIndex * effectiveSize;
        }
        return def.base;
      }

      const memberParts = memberName.split(".");
      const topLevelMember = memberParts[0];
      if (!def.labels.has(topLevelMember)) {
        const childStruct = this.host.structs.get(topLevelMember);
        if (childStruct && childStruct.parent === potential) {
          const childMemberName = memberParts.slice(1).join(".");
          // Extended members such as `obj[19].ext.index` still live inside the
          // parent array element. Reusing `ext[19].index` would scale by the
          // extension size alone and drop the parent object stride.
          const childReference = `${topLevelMember}${childMemberName ? `.${childMemberName}` : ""}`;
          const childOffset = this.resolveStructLabel(childReference) - childStruct.base;
          return def.base + arrayIndex * effectiveSize + childOffset;
        }
        throw new Error(`Member '${topLevelMember}' not defined in struct '${potential}'.`);
      }

      const offset = def.labels.get(topLevelMember);
      if (offset === undefined) {
        throw new Error(`Member '${topLevelMember}' not defined in struct '${potential}'.`);
      }
      let finalAddress: number;

      if (def.parent) {
        const parentDef = this.host.structs.get(def.parent);
        if (!parentDef) {
          throw new Error(
            `Parent struct '${def.parent}' not defined for extension '${potential}'.`,
          );
        }

        let parentSize = parentDef.size;
        if (parentDef.align) {
          parentSize = Math.ceil(parentSize / parentDef.align) * parentDef.align;
        }

        if (arrayIndex === 0) {
          finalAddress = parentDef.base + parentSize + offset;
        } else {
          finalAddress = parentDef.base + parentSize + arrayIndex * def.size + offset;
        }
      } else {
        finalAddress = def.base + arrayIndex * effectiveSize + offset;
      }

      return finalAddress;
    }

    throw new Error(`Struct not defined in reference: ${labelRef}`);
  }
}
