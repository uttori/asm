/**
 * Operand-list splitters used by architecture registration and encoders.
 * 65816 keeps the rest of the line as one operand; Super FX splits on every
 * comma; SPC700 splits on commas outside `()`.
 */

/**
 * 65816 keeps the rest of the line as a single operand (`LDA $12,x` is one form,
 * not two arguments). Splitting on commas would break indexed modes.
 * @param {string} text Rest-of-line operand text.
 * @returns {string[]} One entry, or an empty list when `text` is empty.
 */
export const splitSingleOperand = (text: string): string[] => (text ? [text] : []);

/**
 * Super FX `MOVE Rn, Rm` style: commas are always operand separators.
 * @param {string} text Rest-of-line operand text.
 * @returns {string[]} Trimmed operands; empty input yields `[]`.
 */
export const splitCommaOperands = (text: string): string[] =>
  text ? text.split(",").map((operand) => operand.trim()) : [];

/**
 * SPC700 `MOV A,($12+X)` - commas inside parentheses are addressing syntax,
 * not argument splits. Bracket forms are rare here; only `()` depth is tracked.
 * @param {string} text Rest-of-line operand text.
 * @returns {string[]} Top-level comma-separated operands.
 */
export const splitTopLevelCommaOperands = (text: string): string[] => {
  const operands: string[] = [];
  let level = 0;
  let current = "";
  for (const character of text) {
    if (character === "(") level++;
    if (character === ")") level--;
    if (character === "," && level === 0) {
      operands.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) operands.push(current.trim());
  return operands;
};
