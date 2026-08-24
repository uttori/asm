import type { LoweredOperand } from "./architecture-types.js";
import { parseOperandSyntax } from "./operand-syntax.js";

export type ClassificationInput = {
  raw: string;
  expanded: string;
  length: number;
};

/**
 * True when the source is hex/define/numeric rather than a label or struct.
 * `!s_spr_wildcard_5_lo_dp = $76` must keep DP width; `test[1].size` → `$7` must not.
 * @param {string} raw Source operand.
 * @returns {boolean} True for numeric/define spellings.
 */
function sourceUsesNumericSpelling(raw: string): boolean {
  const base = raw.trim().replace(/\s*,\s*[sxy]$/i, "");
  if (!base) {
    return false;
  }
  if (base.startsWith("#") || base.startsWith("$")) {
    return true;
  }
  if (/^[\d!%]/.test(base)) {
    return true;
  }
  return false;
}

/**
 * Explicit DP is 1–2 digit hex in the source, or the same after define expansion.
 * Label resolution to `$7` is not explicit; that would ignore `optimize dp none`.
 * @param {string} raw Source operand.
 * @param {string} expanded Resolved operand.
 * @param {boolean} indexedX Match `$xx,x` instead of `$xx`.
 * @returns {boolean} True when DP width is spelled, not inferred from a label.
 */
function isExplicitDirectPageSpelling(raw: string, expanded: string, indexedX: boolean): boolean {
  let hexPattern = /^\$[\da-f]{1,2}$/i;
  if (indexedX) {
    hexPattern = /^\$[\da-f]{1,2}\s*,\s*x$/i;
  }
  if (hexPattern.test(raw.trim())) {
    return true;
  }
  if (!hexPattern.test(expanded.trim())) {
    return false;
  }
  return sourceUsesNumericSpelling(raw);
}

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
  const explicitDirectPage = isExplicitDirectPageSpelling(raw, normalizedExpanded, false);
  const explicitDirectPageIndexedX = isExplicitDirectPageSpelling(raw, normalizedExpanded, true);

  let mode: LoweredOperand["mode"] = "unknown";
  let baseExpression = expanded;
  let registerName: string | undefined;

  const rawUpper = raw.trim().toUpperCase();
  const registerOperandMatch =
    rawUpper.match(/^(A|X|Y|YA|SP|C|R\d{1,2})$/) ??
    normalizedUpper.match(/^(A|X|Y|YA|SP|C|R\d{1,2})$/);
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
    if (length >= 3) {
      mode = "absoluteLongIndexedX";
    } else {
      mode = "absoluteIndexedX";
    }
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
  } else if (mode === "unknown" && /^\$[\da-f]{4}\s*,\s*x$/i.test(expanded)) {
    if (length >= 3) {
      mode = "absoluteLongIndexedX";
    } else {
      mode = "absoluteIndexedX";
    }
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
  } else if (mode === "unknown" && /^\$[\da-f]+$/i.test(expanded)) {
    // Asar sizes hex by spelling: 3–4 digits are 16-bit abs (`$CF7` == `$0CF7`).
    if (length >= 3) {
      mode = "absoluteLong";
    } else if (length === 2) {
      mode = "absolute";
    }
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
