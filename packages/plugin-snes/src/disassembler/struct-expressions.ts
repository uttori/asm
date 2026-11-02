import { parseExpressionNode, type ExpressionNode } from "@uttori/asm-core";
import { getStructMetadata } from "@uttori/asm-core/frontend";

import type {
  SnesStructBinding,
  SnesStructConstant,
  SnesStructField,
  SnesStructLayout,
} from "./struct-map.js";

/** A closed expression over this map. Binding identities are retained for span ownership checks. */
export interface SnesStructExpression {
  /** Native assembly text preserving grouping for re-emission. */
  readonly expression: string;
  /** Exact safe integer after bounded evaluation. */
  readonly value: number;
  /** Bindings touched by the expression; used for span ownership checks. */
  readonly bindings: readonly SnesStructBinding[];
}

/** A contiguous part of an observed access. Missing field names deliberately represent opaque bytes. */
export interface SnesStructAccessPart {
  /** Operand fragment covering this byte range. */
  readonly expression: string;
  /** CPU bus address of the first byte in this part. */
  readonly address: number;
  /** Byte length of this contiguous slice. */
  readonly width: number;
  /** Named field when the slice lies entirely inside one layout member. */
  readonly field?: string;
}

/**
 * Reject imprecise intermediates even if later masking would make them fit an operand.
 * @param value Computed intermediate before any truncation.
 * @param expression Parenthesized native source for this subtree.
 * @returns Exact value and source, or throws on lost precision.
 */
const checked = (value: number, expression: string): { value: number; expression: string } => {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Struct expression must evaluate to exact safe integers.");
  }
  return { value, expression };
};

/**
 * Resolve a bounded subset of native assembly expressions, caching repeated expressions per map.
 * Only this map's constants/layouts/bindings participate; external defines, arbitrary calls,
 * file reads and record contents cannot affect instruction identity.
 */
export class SnesStructExpressionResolver {
  private readonly layouts: ReadonlyMap<string, SnesStructLayout>;
  private readonly bindings: ReadonlyMap<string, SnesStructBinding>;
  private readonly fields: ReadonlyMap<string, ReadonlyMap<string, SnesStructField>>;
  private readonly cache = new Map<string, SnesStructExpression>();
  private readonly constants: ReadonlyMap<string, number>;

  /** Keep resolution local to one validated map; omitted constants preserve older map behavior. */
  constructor(
    layouts: readonly SnesStructLayout[],
    bindings: readonly SnesStructBinding[],
    constants: readonly SnesStructConstant[] = [],
  ) {
    this.constants = new Map(constants.map((constant) => [constant.name, constant.value]));
    this.layouts = new Map(layouts.map((layout) => [layout.id, layout]));
    this.bindings = new Map(bindings.map((binding) => [binding.name, binding]));
    this.fields = new Map(
      layouts.map((layout) => [
        layout.id,
        new Map(layout.fields.map((field) => [field.name, field])),
      ]),
    );
  }

  /**
   * Check every intermediate value and preserve explicit grouping in the generated assembly.
   * @param input Single-line expression, at most 1,024 characters and 128 AST nodes.
   * @returns Native source and exact integer value with referenced owners.
   */
  resolve(input: unknown): SnesStructExpression {
    if (
      typeof input !== "string" ||
      !input.trim() ||
      input.length > 1024 ||
      /[\n\r#;]/.test(input)
    ) {
      throw new Error("Struct expressions require a single expression of at most 1024 characters.");
    }
    const cached = this.cache.get(input);
    if (cached) {
      return cached;
    }
    const owners = new Set<SnesStructBinding>();
    let references = 0;
    let nodes = 0;
    /**
     * Resolve only named layouts/bindings. Inherited and arbitrary symbol paths are outside this map.
     * @param node Optional record index and field under one declared root.
     * @returns Address or offset and native reference. Records its binding owner.
     */
    const reference = (node: ExpressionNode): { value: number; expression: string } => {
      let root = node;
      let fieldName: string | undefined;
      if (root.type === "member") {
        fieldName = root.property.name;
        root = root.object;
      }
      let index: number | undefined;
      if (root.type === "index") {
        index = visit(root.index).value;
        root = root.object;
      }
      if (root.type !== "identifier") {
        throw new Error("Unsupported struct reference.");
      }
      const constant = this.constants.get(root.name);
      if (constant !== undefined && fieldName === undefined && index === undefined) {
        references++;
        return checked(constant, root.name);
      }
      const binding = this.bindings.get(root.name);
      const layout = binding?.structure ?? this.layouts.get(root.name);
      if (!layout) {
        throw new Error(`Unknown struct reference '${root.name}'.`);
      }
      if (
        index !== undefined &&
        (!binding || index < binding.firstIndex || index >= binding.firstIndex + binding.count)
      ) {
        throw new Error(`Struct reference index is out of bounds for '${root.name}'.`);
      }
      references++;
      if (binding) {
        owners.add(binding);
      }
      let value = 0;
      if (binding) {
        value = binding.address + ((index ?? 0) - binding.firstIndex) * layout.size;
      }
      let expression = root.name;
      if (index !== undefined) {
        expression += `[${index}]`;
      }
      if (fieldName !== undefined) {
        const field = this.fields.get(layout.id)?.get(fieldName);
        if (!field) {
          throw new Error(`Unknown struct field '${fieldName}'.`);
        }
        value += field.offset;
        expression += `.${fieldName}`;
      }
      return checked(value, expression);
    };
    /**
     * The AST whitelist excludes macros and host-dependent functions.
     * @param node Subtree counted against the per-expression complexity limit.
     * @returns Checked integer value and source preserving operator grouping.
     */
    const visit = (node: ExpressionNode): { value: number; expression: string } => {
      if (++nodes > 128) {
        throw new Error("Struct expression exceeds 128 nodes.");
      }
      switch (node.type) {
        case "literal": {
          const value = node.value.startsWith("$")
            ? Number.parseInt(node.value.slice(1), 16)
            : Number(node.value);
          return checked(value, node.value);
        }
        case "identifier":
        case "member":
        case "index":
          return reference(node);
        case "call": {
          const name = node.callee.name;
          let callArgument = node.arguments.length === 1 ? node.arguments[0] : undefined;
          if (!callArgument) {
            throw new Error(`Struct expression ${name}() requires one argument.`);
          }
          if (name === "bank") {
            const resolved = visit(callArgument);
            return checked((resolved.value >> 16) & 0xff, `bank(${resolved.expression})`);
          }
          // Reflection slots now preserve source data explicitly; this whitelist still accepts only a single name.
          if (callArgument.type === "sourceText" && /^[A-Z_a-z]\w*$/.test(callArgument.text)) {
            callArgument = { type: "identifier", name: callArgument.value };
          }
          if (callArgument.type !== "identifier") {
            throw new Error("Struct reflection requires a layout or binding name.");
          }
          if (
            name !== "sizeof" &&
            name !== "countof" &&
            name !== "bytesof" &&
            name !== "startof" &&
            name !== "endof"
          ) {
            throw new Error(`Unsupported struct expression function '${name}'.`);
          }
          reference(callArgument);
          const binding = this.bindings.get(callArgument.name);
          const layout = binding?.structure ?? this.layouts.get(callArgument.name);
          if (!layout) {
            throw new Error(
              "Struct reflection requires a layout or binding, not a scalar constant.",
            );
          }
          const definition = {
            base: binding ? binding.address - binding.firstIndex * layout.size : 0,
            size: layout.size,
            indexRange: { first: binding?.firstIndex ?? 0, count: binding?.count ?? 1 },
          };
          const value = name === "sizeof" ? layout.size : getStructMetadata(definition, name);
          return checked(value, `${name}(${callArgument.name})`);
        }
        case "unary": {
          const arg = visit(node.argument);
          let value: number;
          switch (node.operator) {
            case "<:":
              value = arg.value >>> 16;
              break;
            case "<":
              value = arg.value & 0xff;
              break;
            case ">":
              value = (arg.value >> 8) & 0xff;
              break;
            case "^":
              value = (arg.value >> 16) & 0xff;
              break;
            case "~":
              value = ~arg.value;
              break;
            case "-":
              value = -arg.value;
              break;
            case "+":
              value = arg.value;
              break;
          }
          return checked(value, `(${node.operator}${arg.expression})`);
        }
        case "binary": {
          const left = visit(node.left);
          const right = visit(node.right);
          let value: number;
          switch (node.operator) {
            case "+":
              value = left.value + right.value;
              break;
            case "-":
              value = left.value - right.value;
              break;
            case "*":
              value = left.value * right.value;
              break;
            case "/":
              value = left.value / right.value;
              break;
            case "%":
              value = left.value % right.value;
              break;
            case "&":
              value = left.value & right.value;
              break;
            case "|":
              value = left.value | right.value;
              break;
            case "^":
              value = left.value ^ right.value;
              break;
            case "<<":
              value = left.value << right.value;
              break;
            case ">>":
              value = left.value >> right.value;
              break;
            case "**":
            case "<":
            case ">":
            case "<=":
            case ">=":
            case "==":
            case "=":
            case "!=":
            case "&&":
            case "||":
              throw new Error(`Unsupported struct expression operator '${node.operator}'.`);
          }
          return checked(value, `(${left.expression} ${node.operator} ${right.expression})`);
        }
        case "error":
        case "relativeReference":
        case "sourceText":
        case "template":
        case "defineReference":
        case "range":
        case "raw":
        case "string":
          throw new Error("Unsupported struct expression syntax.");
      }
      throw new Error("Unsupported struct expression syntax.");
    };
    const resolved = visit(parseExpressionNode(input));
    if (!references) {
      throw new Error(
        "Struct expressions must reference a layout or binding or declared constant.",
      );
    }
    const result = { ...resolved, bindings: [...owners] };
    this.cache.set(input, result);
    return result;
  }
}

/**
 * Split a CPU access across fields, opaque gaps and adjacent records of one physical binding.
 * @param binding Sole owner referenced by the target expression.
 * @param address Resolved CPU start address. Biased index-zero bases are not physical data.
 * @param width CPU access width in bytes (one or two).
 * @returns Ordered parts covering every byte exactly once.
 */
export function describeSnesStructAccess(
  binding: SnesStructBinding,
  address: number,
  width: number,
): readonly SnesStructAccessPart[] {
  const { structure } = binding;
  if (
    address < binding.address ||
    address + width > binding.address + binding.count * structure.size
  ) {
    throw new Error(`Struct observation leaves binding '${binding.name}'.`);
  }
  const parts: SnesStructAccessPart[] = [];
  for (let cursor = address; cursor < address + width;) {
    const relative = cursor - binding.address;
    const index = binding.firstIndex + Math.floor(relative / structure.size);
    const offset = relative % structure.size;
    // Binary search avoids per-byte field scans in large layouts. A hole is never assigned to its neighbor.
    let low = 0;
    let high = structure.fields.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (structure.fields[middle].offset <= offset) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    const candidate = low > 0 ? structure.fields[low - 1] : undefined;
    const field = candidate && offset < candidate.offset + candidate.size ? candidate : undefined;
    // Match generated operands: only scalar bindings use an unindexed physical record.
    const suffix = binding.count === 1 && index === 0 ? "" : `[${index}]`;
    const record = `${binding.name}${suffix}`;
    let expression = record;
    let partOffset = offset;
    let end = structure.fields[low]?.offset ?? structure.size;
    if (field) {
      expression += `.${field.name}`;
      partOffset -= field.offset;
      end = field.offset + field.size;
    }
    if (partOffset) {
      expression = `(${expression} + $${partOffset.toString(16).toUpperCase()})`;
    }
    const partWidth = Math.min(end - offset, address + width - cursor);
    parts.push({
      expression,
      address: cursor,
      width: partWidth,
      ...(field ? { field: field.name } : {}),
    });
    cursor += partWidth;
  }
  return parts;
}
