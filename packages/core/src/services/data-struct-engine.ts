import {
  checkedDeclaration,
  parseDeclarationNode,
  type DeclarationNode,
  type RecordReference,
} from "../ir/declaration-node.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import type { OutputWriterService } from "./output-writer-service.js";
import type { StructDefinition, StructEngine, StructField } from "./struct-engine.js";

export interface DataStructHost {
  structs: Map<string, StructDefinition>;
  currentTargetBaseAddress: number;
  canEmitBytes: boolean;
  operandResolver: { getnum(input: string | ExpressionNode): number };
  outputWriter: Pick<OutputWriterService, "step" | "writeBytes">;
  /** Final scalar attribution before record bytes are written; offsets are relative to the record. */
  recordStructField?(reference: string, expression: string, offset: number, width: number): void;
}

/**
 * Emits complete records through the normal writer (mapper, trace and debug
 * ownership included). The layout stage reserves the same width as emission.
 * Values and placement are checked at emission, once forward labels are known.
 * Array blocks own only sequencing state, never an independent write cursor.
 */
export class DataStructEngine {
  private table?: { name: string; next?: number; rows: number };

  constructor(
    readonly host: DataStructHost,
    readonly structs: StructEngine,
  ) {}

  get inTable(): boolean {
    return this.table !== undefined;
  }

  reset(): void {
    this.table = undefined;
  }

  finish(): void {
    if (this.table) {
      throw new Error(`Missing endDataStructs for '${this.table.name}'.`);
    }
  }

  /** Bind a row's table name while retaining its parsed field values and source ranges. */
  bindRow(
    node: Extract<DeclarationNode, { kind: "dataStructRow" }>,
  ): Extract<DeclarationNode, { kind: "dataStruct" }> {
    if (!this.table) {
      throw new Error("dataStructs accepts only indexed records: [index] = { field = value }.");
    }
    return {
      kind: "dataStruct",
      reference: {
        name: this.table.name,
        index: node.index,
        text: `${this.table.name}[${node.indexText}]`,
      },
      fields: node.fields,
    };
  }

  begin(words: readonly string[]): void {
    this.executeBegin(checkedDeclaration(parseDeclarationNode(words.join(" "), words)));
  }

  /** Enter a record table only after the referenced layout exists. */
  executeBegin(node: Exclude<DeclarationNode, { kind: "invalid" }> | undefined): void {
    if (this.table) {
      throw new Error("Nested dataStructs blocks are not supported.");
    }
    if (node?.kind !== "dataStructs" || !this.host.structs.has(node.name)) {
      throw new Error("dataStructs requires one previously defined struct name.");
    }
    this.table = { name: node.name, rows: 0 };
  }

  end(words: readonly string[]): void {
    this.executeEnd(words.length - 1);
  }

  /** Closing a table checks its row invariant before releasing sequencing state. */
  executeEnd(argumentCount: number): void {
    if (!this.table) {
      throw new Error("endDataStructs without dataStructs.");
    }
    if (argumentCount !== 0) {
      throw new Error("endDataStructs takes no arguments.");
    }
    if (this.table.rows === 0) {
      throw new Error("dataStructs must contain at least one record.");
    }
    this.table = undefined;
  }

  /**
   * Resolve an addressed record, keeping the established Asar index/stride rules.
   * @param {RecordReference} reference Previously declared name with an unevaluated logical index.
   * @returns {{ definition: StructDefinition; index: number }} Layout and checked index.
   */
  private resolveRecord(reference: RecordReference): {
    definition: StructDefinition;
    index: number;
  } {
    const definition = this.host.structs.get(reference.name);
    if (!definition) {
      throw new Error(`Unknown dataStruct record '${reference.text}'.`);
    }
    const index =
      reference.index === undefined ? 0 : this.host.operandResolver.getnum(reference.index);
    if (!Number.isSafeInteger(index) || index < 0) {
      throw new Error(`Invalid record index '${reference.text}'.`);
    }
    if (definition.indexRange) {
      const { first, count } = definition.indexRange;
      if (index < first || index >= first + count) {
        throw new Error(`Record index out of bounds: '${reference.text}'.`);
      }
    }
    return { definition, index };
  }

  private fieldsFor(definition: StructDefinition): StructField[] {
    if (definition.parent || definition.extensionSize > 0) {
      throw new Error(
        `dataStruct does not initialize extended layouts ('${definition.name}'). Use raw data directives.`,
      );
    }
    const fields = [...(definition.fields?.values() ?? [])].toSorted((a, b) => a.offset - b.offset);
    let end = 0;
    for (const field of fields) {
      if (field.offset !== end) {
        throw new Error(
          `Layout '${definition.name}' has overlapping or unnamed bytes. Name every byte before initialization.`,
        );
      }
      end += field.width * field.count;
    }
    if (definition.align && end === definition.offset && end < definition.size) {
      if (definition.labels.has("__padding")) {
        throw new Error("The alignment padding name '__padding' is reserved.");
      }
      fields.push({
        name: "__padding",
        offset: end,
        width: 1,
        count: definition.size - end,
        array: true,
      });
      end = definition.size;
    }
    if (end !== definition.size || end < 1 || end > 0x10000) {
      throw new Error(
        `Layout '${definition.name}' must describe every byte and be between 1 and 65536 bytes.`,
      );
    }
    return fields;
  }

  emit(words: readonly string[]): void {
    const node = checkedDeclaration(parseDeclarationNode(words.join(" "), words));
    if (node?.kind !== "dataStruct") {
      throw new Error("Expected dataStruct initializer.");
    }
    this.executeRecord(node);
  }

  /** Validate the entire typed record before committing bytes or field ownership. */
  executeRecord(node: Extract<DeclarationNode, { kind: "dataStruct" }>): void {
    const reference = node.reference.text;
    const { definition, index } = this.resolveRecord(node.reference);
    if (this.table?.next !== undefined && index !== this.table.next) {
      throw new Error(
        `Non-contiguous dataStructs index: expected ${this.table.next}, received ${index}.`,
      );
    }
    const layout = this.fieldsFor(definition);
    const values = new Map(node.fields.map((field) => [field.name, field.value]));
    const names = new Set(layout.map((field) => field.name));
    for (const name of values.keys()) {
      if (!names.has(name)) {
        throw new Error(`Unknown initializer field '${definition.name}.${name}'.`);
      }
    }
    const bytes: number[] = [];
    const fields: { reference: string; expression: string; offset: number; width: number }[] = [];
    for (const field of layout) {
      const value = values.get(field.name);
      const name = `${reference}.${field.name}`;
      if (value === undefined) {
        throw new Error(`Missing initializer field '${name}'.`);
      }
      if (field.array !== Array.isArray(value)) {
        throw new Error(`Field '${name}' requires ${field.array ? "an array" : "a scalar"}.`);
      }
      const items = Array.isArray(value) ? value : [value];
      if (items.length !== field.count) {
        throw new Error(
          `Field '${name}' requires ${field.count} value(s), received ${items.length}.`,
        );
      }
      if (!this.host.canEmitBytes) {
        continue;
      }
      for (const [itemIndex, item] of items.entries()) {
        const expression = item.text;
        const number = this.host.operandResolver.getnum(item.expression);
        if (!Number.isSafeInteger(number) || number < 0 || number >= 2 ** (8 * field.width)) {
          throw new Error(
            `Value '${expression}' for '${name}' does not fit an unsigned ${field.width * 8}-bit field.`,
          );
        }
        if (this.host.recordStructField) {
          fields.push({
            reference: field.array ? `${name}[${itemIndex}]` : name,
            expression,
            offset: bytes.length,
            width: field.width,
          });
        }
        for (let byte = 0; byte < field.width; byte++) {
          bytes.push(Math.floor(number / 2 ** (8 * byte)) & 0xff);
        }
      }
    }
    if (this.host.canEmitBytes) {
      const expected = definition.base + index * (definition.size + definition.extensionSize);
      if (this.host.currentTargetBaseAddress !== expected) {
        throw new Error(
          `dataStruct '${reference}' requires pc() == $${expected.toString(16).toUpperCase()}, received $${this.host.currentTargetBaseAddress.toString(16).toUpperCase()}.`,
        );
      }
      // Validate the complete record before writing any byte of it.
      for (const field of fields) {
        this.host.recordStructField?.(field.reference, field.expression, field.offset, field.width);
      }
      this.host.outputWriter.writeBytes(bytes);
    } else {
      this.host.outputWriter.step(definition.size);
    }
    if (this.table) {
      this.table.next = index + 1;
      this.table.rows++;
    }
  }
}
