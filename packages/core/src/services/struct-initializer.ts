import { parseDirectiveExpression } from "../ir/directive-arguments.js";
import { type ExpressionNode } from "../ir/expression-node.js";

/**
 * Small, deliberately separate grammar for named records. Expressions remain
 * assembler expressions. This parser only recognizes their outer delimiters.
 * Do not use split(','): arrays and functions both contain their own commas.
 * @param text Comma-separated fields or expressions.
 * @returns Complete items with their nested expressions intact.
 */
export function splitInitializerList(text: string): string[] {
  const entries: string[] = [];
  const stack: string[] = [];
  let quote = "";
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === quote && text[index - 1] !== "\\") {
        quote = "";
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if ("([{".includes(char)) {
      stack.push(char);
    } else if (")]}".includes(char)) {
      const expected = { ")": "(", "]": "[", "}": "{" }[char];
      if (stack.pop() !== expected) {
        throw new Error("Mismatched initializer delimiters.");
      }
    } else if (char === "," && stack.length === 0) {
      const entry = text.slice(start, index).trim();
      if (!entry) {
        throw new Error("Empty initializer item.");
      }
      entries.push(entry);
      start = index + 1;
    }
  }
  if (quote || stack.length) {
    throw new Error("Unclosed initializer delimiter.");
  }
  const last = text.slice(start).trim();
  if (last) {
    entries.push(last);
  } // One trailing comma is allowed.
  return entries;
}

/** Locate the record's physical opening brace, skipping index expressions and braced defines. */
export function structInitializerStart(text: string): number {
  let depth = 0;
  let quote = "";
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === "\\") {
        index++;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "{" && depth === 0 && text[index - 1] !== "!") {
      return index;
    } else if ("([{".includes(char)) {
      depth++;
    } else if (")]}".includes(char)) {
      depth--;
    }
  }
  throw new Error("dataStruct requires a brace-delimited initializer.");
}

/**
 * Parse field names and scalar/array shapes without evaluating assembler expressions.
 * @param text One brace-delimited record literal.
 * @returns Unique names and unevaluated values.
 */
export function parseStructInitializer(
  text: string,
): Map<string, StructInitializerValue | StructInitializerValue[]> {
  return new Map(parseStructInitializerEntries(text).map((field) => [field.name, field.value]));
}

/** One scalar expression; spelling is retained only for diagnostics and field attribution. */
export type StructInitializerValue = {
  /** Original field value spelling for diagnostics. */
  text: string;
  /** Parsed initializer expression evaluated during struct emission. */
  expression: ExpressionNode;
};

/** An unevaluated field with UTF-16 offsets into the original brace-delimited literal. */
export type StructInitializerEntry = {
  /** Field path name including dotted struct members. */
  name: string;
  /** Scalar or array initializer values for the field. */
  value: StructInitializerValue | StructInitializerValue[];
  /** Start of the field identifier, including dotted field paths. */
  start: number;
  /** Scalar/array element offsets, in the same order as their expressions. */
  expressions: { text: string; start: number }[];
};

/** Parse the same record grammar as emission while retaining exact editor locations. */
export function parseStructInitializerEntries(text: string): StructInitializerEntry[] {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("dataStruct requires a named initializer: { field = value }.");
  }
  const fields: StructInitializerEntry[] = [];
  const names = new Set<string>();
  let cursor = text.indexOf("{") + 1;
  for (const entry of splitInitializerList(trimmed.slice(1, -1))) {
    const start = text.indexOf(entry, cursor);
    cursor = start + entry.length;
    const match = entry.match(/^([A-Z_a-z][\w.]*)\s*=\s*(.+)$/s);
    if (!match) {
      throw new Error(`Expected 'field = value' in initializer: ${entry}`);
    }
    const [, name, value] = match;
    if (names.has(name)) {
      throw new Error(`Duplicate initializer field '${name}'.`);
    }
    names.add(name);
    const valueStart = start + entry.length - value.length;
    if (value.startsWith("[")) {
      if (!value.endsWith("]")) {
        throw new Error(`Unclosed array initializer '${name}'.`);
      }
      let elementCursor = valueStart + 1;
      const values = splitInitializerList(value.slice(1, -1));
      const expressions = values.map((expression) => {
        const expressionStart = text.indexOf(expression, elementCursor);
        elementCursor = expressionStart + expression.length;
        return { text: expression, start: expressionStart };
      });
      fields.push({ name, value: values.map(parseInitializerValue), start, expressions });
    } else {
      fields.push({
        name,
        value: parseInitializerValue(value),
        start,
        expressions: [{ text: value, start: valueStart }],
      });
    }
  }
  return fields;
}

/** Initializer values use numeric operand semantics; record delimiters have already been removed. */
function parseInitializerValue(text: string): StructInitializerValue {
  // A define may supply commas or quoting inside a call. Bind that source fragment before
  // evaluating the resulting expression, just as numeric directive operands do.
  return { text, expression: parseDirectiveExpression(text) };
}

/**
 * Only named record statements gain implicit brace continuation, not legacy source.
 * @param text Buffered command including the current physical line.
 * @returns Whether another physical line is needed to close the literal.
 */
export function isOpenStructInitializer(text: string): boolean {
  if (!/^(?:datastruct\b|\[)/i.test(text.trimStart())) {
    return false;
  }
  let depth = 0;
  let quote = "";
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === quote && text[index - 1] !== "\\") {
        quote = "";
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
    }
  }
  return depth > 0;
}
