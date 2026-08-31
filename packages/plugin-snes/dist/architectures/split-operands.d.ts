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
export declare const splitSingleOperand: (text: string) => string[];
/**
 * Super FX `MOVE Rn, Rm` style: commas are always operand separators.
 * @param {string} text Rest-of-line operand text.
 * @returns {string[]} Trimmed operands; empty input yields `[]`.
 */
export declare const splitCommaOperands: (text: string) => string[];
/**
 * SPC700 `MOV A,($12+X)` - commas inside parentheses are addressing syntax,
 * not argument splits. Bracket forms are rare here; only `()` depth is tracked.
 * @param {string} text Rest-of-line operand text.
 * @returns {string[]} Top-level comma-separated operands.
 */
export declare const splitTopLevelCommaOperands: (text: string) => string[];
//# sourceMappingURL=split-operands.d.ts.map