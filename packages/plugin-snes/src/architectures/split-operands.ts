import { parseExpressionNode } from "@uttori/asm-core";

/**
 * Operand-list splitters used by architecture registration and encoders.
 * 65816 keeps the rest of the line as one operand. Super FX splits on every
 * comma. SPC700 splits on commas outside `()`.
 */

/**
 * 65816 keeps the rest of the line as a single operand (`LDA $12,x` is one form,
 * not two arguments). Splitting on commas would break indexed modes.
 * @param text Rest-of-line operand text.
 * @returns One entry, or an empty list when `text` is empty.
 */
export const splitSingleOperand = (text: string): string[] => (text ? [text] : []);

/**
 * Extract symbolic expressions without resolving them. The expression grammar cannot parse the
 * comma in `((Table & $FFFF),x)`, so navigation must remove only 65816 addressing wrappers first.
 */
export function referenceExpressions65816(operand: string, depth = 0): string[] {
  const text = operand.trim().replace(/^#\s*/, "");
  if (!text || depth > 32 || /^[asxy]$/i.test(text)) {
    return [];
  }
  const expression = parseExpressionNode(text);
  // Addressing wrappers are not expression grammar. Portable diagnostics and unbound
  // fragments still require the architecture's delimiter extraction for tooling.
  if (expression.type !== "raw" && expression.type !== "error" && expression.type !== "template") {
    return [text];
  }
  const parts: string[] = [];
  let nesting = 0,
    start = 0,
    outerEnd = -1;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    // Quoted operands are data, not pointer expressions. Do not guess reference spans inside them.
    if (character === '"' || character === "'") {
      return [];
    }
    if (character === "(" || character === "[") {
      nesting++;
    }
    if (character === ")" || character === "]") {
      nesting--;
      if (nesting === 0 && outerEnd === -1) {
        outerEnd = index;
      }
      if (nesting < 0) {
        return [];
      }
    }
    if (character === "," && nesting === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  if (nesting !== 0) {
    return [];
  }
  if (parts.length) {
    parts.push(text.slice(start));
    return parts.flatMap((part) => referenceExpressions65816(part, depth + 1));
  }
  const wrapped =
    (text.startsWith("(") && text.endsWith(")")) || (text.startsWith("[") && text.endsWith("]"));
  return wrapped && outerEnd === text.length - 1
    ? referenceExpressions65816(text.slice(1, -1), depth + 1)
    : [];
}

/**
 * Super FX `MOVE Rn, Rm` style: commas are always operand separators.
 * @param text Rest-of-line operand text.
 * @returns Trimmed operands. Empty input yields `[]`.
 */
export const splitCommaOperands = (text: string): string[] =>
  text ? text.split(",").map((operand) => operand.trim()) : [];

/**
 * SPC700 `MOV A,($12+X)` - commas inside parentheses are addressing syntax,
 * not argument splits. Bracket forms are rare here. Only `()` depth is tracked.
 * @param text Rest-of-line operand text.
 * @returns Top-level comma-separated operands.
 */
export const splitTopLevelCommaOperands = (text: string): string[] => {
  const operands: string[] = [];
  let level = 0;
  let current = "";
  for (const character of text) {
    if (character === "(") {
      level++;
    }
    if (character === ")") {
      level--;
    }
    if (character === "," && level === 0) {
      operands.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) {
    operands.push(current.trim());
  }
  return operands;
};
