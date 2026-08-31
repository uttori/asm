import type { LoweredOperand, OperandResolutionContext } from "@uttori/asm-core";

/**
 * Classifies baseline 6502 syntax without importing SNES addressing policy.
 * @param {OperandResolutionContext} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Architecture-owned operand classification.
 */
export function classify65xxOperand(
  resolver: OperandResolutionContext,
  operand: string,
): LoweredOperand {
  const raw = operand.trim();
  const sizePrefix = parseCa65AddressSizePrefix(raw);
  const { expanded, length: inferredLength } = resolver.expandOperand(sizePrefix.rest);
  let length = inferredLength;
  if (sizePrefix.force === 1) length = 1;
  else if (sizePrefix.force === 2) length = Math.max(2, inferredLength);
  else if (sizePrefix.force === 3) length = Math.max(3, inferredLength);
  const normalized = expanded.trim();
  const normalizedUpper = normalized.toUpperCase();
  const compound = splitTopLevelOperands(normalized);

  let mode = "unknown";
  let baseExpression = normalized;
  let registerName: string | undefined;

  if (normalized === "") {
    mode = "implied";
  } else if (normalizedUpper === "A") {
    mode = "accumulator";
    registerName = "a";
  } else if (normalizedUpper === "Q") {
    mode = "quadAccumulator";
    registerName = "q";
  } else if (compound.length >= 2 && compound[0]?.startsWith("#")) {
    const indexedX = compound.length === 3 && compound[2]?.toUpperCase() === "X";
    const address = compound[1] ?? "";
    const addressLength = resolver.expandOperand(address).length;
    mode = `${addressLength <= 1 ? "immediateZeroPage" : "immediateAbsolute"}${indexedX ? "IndexedX" : ""}`;
    baseExpression = normalized;
  } else if (normalized.startsWith("#")) {
    mode = "immediate";
    baseExpression = normalized.slice(1).trim();
  } else {
    const indexedIndirect = normalized.match(/^\(\s*(.+?)\s*,\s*x\s*\)$/i);
    const stackRelativeIndirect = normalized.match(/^\(\s*(.+?)\s*,\s*s\s*\)\s*,\s*y$/i);
    const indirectIndexed = normalized.match(/^\(\s*(.+?)\s*\)\s*,\s*y$/i);
    const indirectIndexedZ = normalized.match(/^\(\s*(.+?)\s*\)\s*,\s*z$/i);
    const indirect = normalized.match(/^\(\s*(.+?)\s*\)$/i);
    const basePageIndirectZ = normalized.match(/^\[\s*(.+?)\s*]\s*,\s*z$/i);
    const indirectLong = normalized.match(/^\[\s*(.+?)\s*]$/i);
    const indexed = normalized.match(/^(.+?)\s*,\s*([sx-z])$/i);
    const topLevelComma = findTopLevelComma(normalized);

    if (stackRelativeIndirect) {
      mode = "stackRelativeIndirectIndexedY";
      baseExpression = stackRelativeIndirect[1].trim();
    } else if (indexedIndirect) {
      mode =
        resolver.expandOperand(indexedIndirect[1].trim()).length <= 1
          ? "indexedIndirectX"
          : "absoluteIndexedIndirect";
      baseExpression = indexedIndirect[1].trim();
    } else if (indirectIndexed && !indirectIndexed[1].includes(",")) {
      mode = "indirectIndexedY";
      baseExpression = indirectIndexed[1].trim();
    } else if (indirectIndexedZ && !indirectIndexedZ[1].includes(",")) {
      mode = "zeroPageIndirectIndexedZ";
      baseExpression = indirectIndexedZ[1].trim();
    } else if (basePageIndirectZ) {
      mode = "basePageIndirectIndexedZ";
      baseExpression = basePageIndirectZ[1].trim();
    } else if (indirectLong) {
      mode = "zeroPageIndirectLong";
      baseExpression = indirectLong[1].trim();
    } else if (indirect) {
      mode =
        resolver.expandOperand(indirect[1].trim()).length <= 1 ? "zeroPageIndirect" : "indirect";
      baseExpression = indirect[1].trim();
    } else if (indexed) {
      const register = indexed[2].toLowerCase();
      if (register === "s") mode = "stackRelative";
      // `,z` without parens/brackets is not a 65xx mode we encode.
      else if (register === "z") mode = "unknown";
      else if (length > 2 && register === "x") mode = "absoluteLongIndexedX";
      else mode = `${length <= 1 ? "zeroPage" : "absolute"}Indexed${register.toUpperCase()}`;
      baseExpression = indexed[1].trim();
    } else if (topLevelComma >= 0) {
      if (compound.length === 3) {
        mode = "blockTransfer";
      } else if (compound[0]?.toUpperCase() === "A") {
        mode = "accumulatorRelative";
      } else if (compound[1]?.startsWith("#")) {
        mode = "zeroPageImmediate";
      } else {
        mode = "zeroPageRelative";
      }
      baseExpression = normalized;
    } else {
      mode = length <= 1 ? "zeroPage" : "absolute";
    }
  }

  return {
    // Unused
    immediate: false,
    // Unused
    indirect: false,
    mode,
    baseExpression,
    registerName,
    raw,
    expanded,
    length,
    // 24-bit values are not 6502-legal; encoder can still emit long-x on 4510.
    metadata: length > 2 ? { addressOutOfRange: true } : undefined,
  };
}

/**
 * Splits commas outside parentheses/brackets for vendor compound operands.
 * @param {string} value The operand text.
 * @returns {string[]} Top-level operand components.
 */
function splitTopLevelOperands(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "(" || character === "[") depth++;
    else if (character === ")" || character === "]") depth--;
    else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

/**
 * Finds the first top-level comma in a string.
 * Same idea as SPC700: BBR/BBS `zp,target` - ignore commas inside () or [].
 * @param {string} value The string to search.
 * @returns {number} The index of the first top-level comma.
 */
function findTopLevelComma(value: string): number {
  let depth = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "(" || character === "[") depth++;
    else if (character === ")" || character === "]") depth--;
    else if (character === "," && depth === 0) return index;
  }
  return -1;
}

/**
 * Strips a ca65 address-size override (`a:` absolute, `z:` zeropage, `f:` far).
 * Zelda uses `LDA a:ObjState, Y` to force abs,y when the symbol is a zp equate.
 * @param {string} operand Raw operand text.
 * @returns {{ rest: string; force: 1 | 2 | 3 | undefined }} Remainder and forced width.
 */
function parseCa65AddressSizePrefix(operand: string): {
  rest: string;
  force: 1 | 2 | 3 | undefined;
} {
  const match = operand.match(/^([afz]):(.*)$/i);
  if (!match) {
    return { rest: operand, force: undefined };
  }
  const rest = match[2].trim();
  const key = match[1].toLowerCase();
  if (key === "z") return { rest, force: 1 };
  if (key === "a") return { rest, force: 2 };
  return { rest, force: 3 };
}
