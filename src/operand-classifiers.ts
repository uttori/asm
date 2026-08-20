import type { LoweredOperand, OperandResolutionContext } from "./architecture-types.js";
import { parseOperandSyntax } from "./operand-syntax.js";

type ClassificationInput = {
  raw: string;
  expanded: string;
  length: number;
};

/**
 * Generic 65xx-style operand classifier.
 * This classifies syntax/addressing mode and keeps expression expansion in
 * OperandResolver.
 * @param {ClassificationInput} input Classifier input values.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export function classifyGenericOperand(input: ClassificationInput): LoweredOperand {
  const { raw, expanded, length } = input;
  const syntax = parseOperandSyntax(raw);
  const lowered = expanded.toLowerCase();
  const normalizedExpanded = expanded.trim();
  const normalizedUpper = normalizedExpanded.toUpperCase();
  const explicitDirectPage = /^\$[\da-f]{1,2}$/i.test(raw);
  const explicitDirectPageIndexedX = /^\$[\da-f]{1,2},x$/i.test(raw);

  let mode: LoweredOperand["mode"] = "unknown";
  let baseExpression = expanded;
  let registerName: string | undefined;

  const registerOperandMatch = normalizedUpper.match(/^(A|X|Y|YA|SP|C|R\d{1,2})$/);
  const registerIndirectMatch = normalizedUpper.match(/^\((A|X|Y|YA|SP|C|R\d{1,2})\)$/);
  const registerIndirectAutoIncrementMatch = normalizedUpper.match(
    /^\((A|X|Y|YA|SP|C|R\d{1,2})\)\+$/,
  );
  const directPageIndexedXIndirectMatch = normalizedExpanded.match(/^\(\s*(.+?)\s*\+\s*x\s*\)$/i);
  const directPageIndirectIndexedYMatch = normalizedExpanded.match(/^\(\s*(.+?)\s*\)\s*\+\s*y$/i);
  const bitAddressMatch = normalizedExpanded.match(/^(\$[\da-f]+)\.([0-7])$/i);

  if (registerOperandMatch) {
    mode = "register";
    registerName = registerOperandMatch[1].toLowerCase();
    baseExpression = normalizedExpanded;
  } else if (registerIndirectAutoIncrementMatch) {
    mode = "registerIndirectAutoIncrement";
    registerName = registerIndirectAutoIncrementMatch[1].toLowerCase();
    baseExpression = registerIndirectAutoIncrementMatch[1];
  } else if (registerIndirectMatch) {
    mode = "registerIndirect";
    registerName = registerIndirectMatch[1].toLowerCase();
    baseExpression = registerIndirectMatch[1];
  } else if (directPageIndexedXIndirectMatch) {
    mode = "directPageIndexedXIndirect";
    baseExpression = directPageIndexedXIndirectMatch[1].trim();
  } else if (directPageIndirectIndexedYMatch) {
    mode = "directPageIndirectIndexedY";
    baseExpression = directPageIndirectIndexedYMatch[1].trim();
  } else if (bitAddressMatch) {
    mode = bitAddressMatch[1].length <= 3 ? "directPageBit" : "absoluteBit";
    baseExpression = bitAddressMatch[1].toUpperCase();
  }

  if (mode === "unknown" && expanded.startsWith("#")) {
    mode = "immediate";
    baseExpression = expanded.slice(1).trim();
  } else if (mode === "unknown" && /^\$[\da-f]{6}\s*,\s*x$/i.test(expanded)) {
    mode = "absoluteLongIndexedX";
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
  } else if (mode === "unknown" && /^\$[\da-f]{4}\s*,\s*x$/i.test(expanded)) {
    mode = "absoluteIndexedX";
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
  } else if (mode === "unknown" && /^\$[\da-f]{4}\s*,\s*y$/i.test(expanded)) {
    mode = "absoluteIndexedY";
    baseExpression = expanded.replace(/\s*,\s*y$/i, "").trim();
  } else if (mode === "unknown" && /^\(\s*(.+?)\s*,\s*x\s*\)$/i.test(normalizedExpanded)) {
    mode = "indexedIndirectX";
    baseExpression = normalizedExpanded
      .replace(/^\(\s*/, "")
      .replace(/\s*,\s*x\s*\)$/i, "")
      .trim();
  } else if (mode === "unknown" && lowered.startsWith("(") && lowered.endsWith(")")) {
    mode = "directPageIndirect";
    baseExpression = expanded.slice(1, -1).trim();
  } else if (mode === "unknown" && /^\(\s*(.+?)\s*,\s*s\s*\)\s*,\s*y$/i.test(normalizedExpanded)) {
    mode = "stackRelativeIndexedIndirectY";
    baseExpression = normalizedExpanded
      .replace(/^\(\s*/, "")
      .replace(/\s*,\s*s\s*\)\s*,\s*y$/i, "")
      .trim();
  } else if (mode === "unknown" && /,\s*s$/i.test(lowered)) {
    mode = "stackRelative";
    baseExpression = expanded.replace(/\s*,\s*s$/i, "").trim();
  } else if (mode === "unknown" && /^\[\s*(.+?)\s*]\s*,\s*y$/i.test(normalizedExpanded)) {
    mode = "indirectLongIndexedY";
    baseExpression = normalizedExpanded
      .replace(/^\[\s*/, "")
      .replace(/\s*]\s*,\s*y$/i, "")
      .trim();
  } else if (mode === "unknown" && lowered.startsWith("[") && lowered.endsWith("]")) {
    mode = "indirectLong";
    baseExpression = expanded.slice(1, -1).trim();
  } else if (mode === "unknown" && /^\(\s*(.+?)\s*\)\s*,\s*y$/i.test(normalizedExpanded)) {
    mode = "indirectIndexedY";
    baseExpression = normalizedExpanded
      .replace(/^\(\s*/, "")
      .replace(/\s*\)\s*,\s*y$/i, "")
      .trim();
  } else if (mode === "unknown" && /,\s*y$/i.test(lowered)) {
    mode = "absoluteIndexedY";
    baseExpression = expanded.replace(/\s*,\s*y$/i, "").trim();
  } else if (mode === "unknown" && /,\s*x$/i.test(lowered)) {
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
    if (length >= 3) {
      mode = "absoluteLongIndexedX";
    } else if (length === 2) {
      mode = "absoluteIndexedX";
    } else {
      mode = "directPageIndexedX";
    }
  } else if (mode === "unknown" && /^\$[\da-f]{6}$/i.test(expanded)) {
    mode = "absoluteLong";
    baseExpression = expanded;
  } else if (mode === "unknown" && /^\$[\da-f]{4}$/i.test(expanded)) {
    mode = "absolute";
    baseExpression = expanded;
  }

  return {
    mode,
    baseExpression,
    registerName,
    explicitDirectPage,
    explicitDirectPageIndexedX,
    raw,
    expanded,
    length,
    indexRegister: syntax.indexRegister,
    immediate: syntax.immediate,
    indirect: syntax.indirect,
  };
}

/**
 * Classifies 65816 operands.
 * @param {OperandResolver} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export function classify65816Operand(
  resolver: OperandResolutionContext,
  operand: string,
): LoweredOperand {
  const raw = operand.trim();
  const { expanded, length } = resolver.expandOperand(raw);
  return classifyGenericOperand({ raw, expanded, length });
}

/**
 * Temporary 6502 syntax classifier. The stub backend does not encode yet, but
 * keeping classification behind its own registration avoids coupling the
 * eventual implementation to 65816 policy.
 * @param {OperandResolver} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export function classify6502Operand(
  resolver: OperandResolutionContext,
  operand: string,
): LoweredOperand {
  const raw = operand.trim();
  const { expanded, length } = resolver.expandOperand(raw);
  return classifyGenericOperand({ raw, expanded, length });
}

/**
 * Classifies SPC700 operands.
 * @param {OperandResolver} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export function classifySpc700Operand(
  resolver: OperandResolutionContext,
  operand: string,
): LoweredOperand {
  const raw = operand.trim();
  const { expanded, length } = resolver.expandOperand(raw);
  return classifyGenericOperand({ raw, expanded, length });
}

/**
 * Classifies SuperFX operands.
 * @param {OperandResolver} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export function classifySuperFxOperand(
  resolver: OperandResolutionContext,
  operand: string,
): LoweredOperand {
  const raw = operand.trim();
  const { expanded, length } = resolver.expandOperand(raw);
  return classifyGenericOperand({ raw, expanded, length });
}
