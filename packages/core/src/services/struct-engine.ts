import { maximumAddressForWidth } from "../address-width.js";
import {
  checkedDeclaration,
  parseDeclarationNode,
  type DeclarationNode,
} from "../ir/declaration-node.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import { setCommandKind, type NormalizedCommand } from "../ir/normalized-command.js";
import type { ReferencePath } from "../ir/reference-path.js";
import { DataStructEngine, type DataStructHost } from "./data-struct-engine.js";

/** Encoding information is separate from Asar's address-only member labels. */
export interface StructField {
  /** Member label without the leading dot. */
  name: string;
  /** Byte offset from the struct base address. */
  offset: number;
  /** Storage width of one element in bytes. */
  width: number;
  /** Element count; one for scalars and skip blobs. */
  count: number;
  /** Even db[1] is an array. Skip members are opaque byte arrays. */
  array: boolean;
}

/** Mutable struct layout state accumulated while parsing struct members. */
export interface StructDefinition {
  /** Struct symbol name in the current namespace. */
  name: string;
  /** The logical start address for the struct. */
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
  /** Absent on legacy API-created definitions. Never infer types from label distances. */
  fields?: Map<string, StructField>;
  /** Optional valid logical array indexes, independent of the biased base address. */
  indexRange?: { first: number; count: number };
}

/** Session services shared by struct layout and data struct emission. */
export type StructHost = DataStructHost & {
  readonly addressWidth: number;
  currentStruct: StructDefinition | null;
  structs: Map<string, StructDefinition>;
  operandResolver: { getnum(input: string | ExpressionNode): number };
  enterStructDefinition(base: number): void;
  restoreStructDefinition(): void;
  recordSymbolDefinition(
    kind: "struct" | "structMember",
    name: string,
    options?: { value?: number | string; containerName?: string },
  ): void;
};

/** Parses struct declarations and delegates indexed rows to the data struct engine. */
export class StructEngine {
  /** Engine emitting indexed data struct tables for defined layouts. */
  readonly data: DataStructEngine;

  constructor(readonly host: StructHost) {
    this.data = new DataStructEngine(host, this);
  }

  /**
   * Handles a struct mode command.
   * @param command The command to handle.
   * @returns `true` if the command was handled, `false` otherwise.
   */
  handleStructMode(command: NormalizedCommand): boolean {
    const currentStruct = this.host.currentStruct;
    if (!currentStruct) {
      return false;
    }

    const declaration = checkedDeclaration(command.parsed.declaration);
    if (declaration?.kind === "structField") {
      const labelName = declaration.name;
      const typed = declaration.storage;
      if (typed) {
        const width = typed.width;
        const count = typed.count === undefined ? 1 : this.host.operandResolver.getnum(typed.count);
        if (!Number.isSafeInteger(count) || count < 1 || count * width > 0x10000) {
          throw new Error(`Invalid array length for '${currentStruct.name}.${labelName}'.`);
        }
        if (currentStruct.labels.has(labelName)) {
          throw new Error(`Duplicate typed field '${currentStruct.name}.${labelName}'.`);
        }
        (currentStruct.fields ??= new Map()).set(labelName, {
          name: labelName,
          offset: currentStruct.offset,
          width,
          count,
          array: typed.count !== undefined,
        });
      } else if (declaration.error) {
        throw new Error(
          `Invalid typed field '${currentStruct.name}.${labelName}': ${declaration.error}`,
        );
      }
      currentStruct.labels.set(labelName, currentStruct.offset);
      this.host.recordSymbolDefinition("structMember", labelName, {
        value: currentStruct.offset,
        containerName: currentStruct.name,
      });

      if (typed) {
        const field = currentStruct.fields!.get(labelName)!;
        currentStruct.offset += field.width * field.count;
      } else if (declaration.skip) {
        const skipAmount = this.host.operandResolver.getnum(declaration.skip);
        // Preserve skip's historical layout behavior. Initializers accept a
        // positive named skip only as an explicit list of raw bytes.
        if (Number.isSafeInteger(skipAmount) && skipAmount > 0) {
          currentStruct.fields?.set(labelName, {
            name: labelName,
            offset: currentStruct.offset,
            width: 1,
            count: skipAmount,
            array: true,
          });
        }
        currentStruct.offset += skipAmount;
      }

      setCommandKind(command, "structCommand");
      return true;
    }

    if (declaration?.kind === "endStruct") {
      this.executeEndStruct(declaration);
      setCommandKind(command, "structCommand");
      return true;
    }

    setCommandKind(command, "structCommand");
    return true;
  }

  /**
   * Handles a struct command.
   * @param words The words of the command.
   */
  handleStruct(words: readonly string[]): void {
    const node = checkedDeclaration(parseDeclarationNode(words.join(" "), words));
    if (node?.kind !== "struct") {
      throw new Error("Expected struct declaration.");
    }
    this.executeStruct(node);
  }

  /** Bind a declaration's base in the current stage, before changing struct scope. */
  executeStruct(node: Extract<DeclarationNode, { kind: "struct" }>): void {
    const structName = node.name;
    const parent = node.parent;
    let base = 0;
    if (parent !== undefined) {
      const parentStruct = this.host.structs.get(parent);
      if (!parentStruct) {
        throw new Error(`Parent struct '${parent}' not defined.`);
      }
      base = parentStruct.base;
    } else if (node.base) {
      base = this.host.operandResolver.getnum(node.base);
      if (base < 0 || base > maximumAddressForWidth(this.host.addressWidth)) {
        throw new Error(`Invalid logical address for struct: ${node.baseText}`);
      }
    }

    this.host.enterStructDefinition(base);
    this.host.currentStruct = {
      name: structName,
      base,
      offset: 0,
      size: 0,
      labels: new Map(),
      fields: new Map(),
      parent,
      extensionSize: 0,
    };
    this.host.recordSymbolDefinition("struct", structName, { value: base });
  }

  /**
   * Handles an endstruct command.
   * @param words The words of the command.
   */
  handleEndStruct(words: readonly string[]): void {
    const node = checkedDeclaration(parseDeclarationNode(words.join(" "), words));
    if (node?.kind !== "endStruct") {
      throw new Error("Expected endstruct declaration.");
    }
    this.executeEndStruct(node);
  }

  /** Resolve options in source order; finalize the layout before restoring its enclosing cursor. */
  executeEndStruct(node: Extract<DeclarationNode, { kind: "endStruct" }>): void {
    const currentStruct = this.host.currentStruct;
    if (!currentStruct) {
      throw new Error("endstruct encountered but not inside a struct definition.");
    }

    let align: number | undefined;
    let count: number | undefined;
    let first = 0;
    const seen = new Set<string>();
    for (const { name: option, expression } of node.options) {
      seen.add(option);
      const value = this.host.operandResolver.getnum(expression);
      if (!Number.isSafeInteger(value) || value < (option === "firstindex" ? 0 : 1)) {
        throw new Error(
          option === "align" ? "Alignment must be at least 1." : `Invalid endstruct ${option}.`,
        );
      }
      if (option === "align") {
        align = value;
      } else if (option === "count") {
        count = value;
      } else {
        first = value;
      }
    }
    if (seen.has("firstindex") && count === undefined) {
      throw new Error("endstruct firstindex requires count.");
    }
    if (count !== undefined) {
      if (!Number.isSafeInteger(first + count)) {
        throw new Error("Struct index range exceeds integer precision.");
      }
      currentStruct.indexRange = { first, count };
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
    }
    this.host.structs.set(currentStruct.name, currentStruct);

    this.host.restoreStructDefinition();

    this.host.currentStruct = null;
  }

  /**
   * Checks whether a reference starts with a known struct name.
   * @param labelRef The reference to inspect.
   * @returns Whether the reference belongs to a known struct.
   */
  hasStructReference(labelRef: string): boolean {
    // Indices may be decimal (`obj[2]`) or asar hex (`DMA[$00].Parameters`).
    // oxlint-disable-next-line security/detect-unsafe-regex -- Anchored segments use non-overlapping separators.
    if (!/^[A-Z_a-z]\w*(?:\[[^\]]+])?(?:\.[A-Z_a-z]\w*(?:\[[^\]]+])?)*$/.test(labelRef)) {
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

  /** Resolve a parsed path directly; index values are refreshed in the caller's active stage. */
  resolveStructPath(
    path: ReferencePath,
    evaluate: (node: ExpressionNode) => number,
  ): number | undefined {
    const names = [path.root];
    let indexNode: ExpressionNode | undefined;
    const members: string[] = [];
    for (const segment of path.segments) {
      if (segment.kind === "index") {
        if (indexNode) {
          throw new Error("Multiple struct indexes are not supported.");
        }
        indexNode = segment.expression;
      } else if (indexNode) {
        members.push(segment.name);
      } else {
        names.push(segment.name);
      }
    }
    const directName = names.join(".");
    if (!indexNode) {
      const direct = this.host.structs.get(directName);
      if (names.length === 2 && direct?.parent === names[0]) {
        const parent = this.host.structs.get(names[0]);
        if (parent) {
          return parent.base + parent.size;
        }
      }
      if (direct) {
        return direct.base;
      }
    }
    // Select the longest declared struct prefix before binding the first array index.
    for (let length = names.length; length >= 1; length--) {
      const name = names.slice(0, length).join(".");
      const def = this.host.structs.get(name);
      if (!def) {
        continue;
      }
      const index = indexNode ? evaluate(indexNode) : 0;
      const tail = [...names.slice(length), ...members];
      let stride = def.size;
      if (def.align) {
        stride = Math.ceil(stride / def.align) * def.align;
      }
      if (def.extensionSize > 0) {
        stride += def.extensionSize;
      }
      if (!tail.length) {
        return def.base + index * stride;
      }
      const member = tail[0];
      const offset = def.labels.get(member);
      if (offset === undefined) {
        const child = this.host.structs.get(member);
        if (child?.parent === name) {
          const childAddress = this.resolveStructPath(
            {
              root: member,
              segments: tail.slice(1).map((part) => ({ kind: "member", name: part })),
            },
            evaluate,
          );
          if (childAddress !== undefined) {
            return def.base + index * stride + childAddress - child.base;
          }
        }
        throw new Error(`Member '${member}' not defined in struct '${name}'.`);
      }
      if (def.parent) {
        const parent = this.host.structs.get(def.parent);
        if (!parent) {
          throw new Error(`Parent struct '${def.parent}' not defined for extension '${name}'.`);
        }
        const parentSize = parent.align
          ? Math.ceil(parent.size / parent.align) * parent.align
          : parent.size;
        return parent.base + parentSize + index * def.size + offset;
      }
      return def.base + index * stride + offset;
    }
    return undefined;
  }

  /**
   * Resolves a struct label.
   * @param labelRef The label to resolve.
   * @returns The resolved address.
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
    // First `[...]` is the array index. Hardware-register structs use hex
    // (`DMA[$00].Parameters`). Decimal `obj[2]` still works via getnum.
    const arrayMatch = candidate.match(/^(.*?)\[([^\]]+)](.*)$/);
    if (arrayMatch) {
      candidate = arrayMatch[1];
      arrayIndex = this.host.operandResolver.getnum(arrayMatch[2]);
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
