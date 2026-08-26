import type { LoweredOperand, OperandResolutionContext } from "@uttori/asm-core";
import { parseOperandSyntax } from "@uttori/asm-core";

/**
 * Classifies baseline 6502 syntax without inheriting 65816, SPC700, Super FX,
 * direct-page, stack-relative, or bank-width policy.
 * @param {OperandResolutionContext} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Classified 6502 operand.
 */
export function classify6502Operand(
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
  } else if (normalized.startsWith("#")) {
    mode = "immediate";
    baseExpression = normalized.slice(1).trim();
  } else if (normalized.startsWith("[") || syntax.indexRegister === "s") {
    mode = "unknown";
  } else {
    const indexedIndirect = normalized.match(/^\(\s*(.+?)\s*,\s*x\s*\)$/i);
    const indirectIndexed = normalized.match(/^\(\s*(.+?)\s*\)\s*,\s*y$/i);
    const indirect = normalized.match(/^\(\s*(.+?)\s*\)$/i);
    const indexed = normalized.match(/^(.+?)\s*,\s*([xy])$/i);

    if (indexedIndirect) {
      mode = "indexedIndirectX";
      baseExpression = indexedIndirect[1].trim();
    } else if (indirectIndexed && !indirectIndexed[1].includes(",")) {
      mode = "indirectIndexedY";
      baseExpression = indirectIndexed[1].trim();
    } else if (indirect) {
      mode = "indirect";
      baseExpression = indirect[1].trim();
    } else if (indexed) {
      const register = indexed[2].toLowerCase();
      mode = `${length <= 1 ? "zeroPage" : "absolute"}Indexed${register.toUpperCase()}`;
      baseExpression = indexed[1].trim();
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
