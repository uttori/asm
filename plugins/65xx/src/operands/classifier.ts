import type { LoweredOperand, OperandResolutionContext } from "@uttori/asm-core";
import { parseOperandSyntax } from "@uttori/asm-core";

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
  const { expanded, length } = resolver.expandOperand(raw);
  const syntax = parseOperandSyntax(raw);
  const normalized = expanded.trim();
  const normalizedUpper = normalized.toUpperCase();

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
      else if (register === "z") mode = "unknown";
      else if (length > 2 && register === "x") mode = "absoluteLongIndexedX";
      else mode = `${length <= 1 ? "zeroPage" : "absolute"}Indexed${register.toUpperCase()}`;
      baseExpression = indexed[1].trim();
    } else if (topLevelComma >= 0) {
      mode = "zeroPageRelative";
      baseExpression = normalized.slice(0, topLevelComma).trim();
    } else {
      mode = length <= 1 ? "zeroPage" : "absolute";
    }
  }

  return {
    mode,
    baseExpression,
    registerName,
    raw,
    expanded,
    length,
    indexRegister: syntax.indexRegister,
    immediate: syntax.immediate,
    indirect: syntax.indirect,
    metadata: length > 2 ? { addressOutOfRange: true } : undefined,
  };
}

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
