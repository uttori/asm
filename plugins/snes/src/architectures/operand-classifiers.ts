import type { LoweredOperand, OperandResolutionContext } from "@uttori/asm-core";
import { parseOperandSyntax } from "@uttori/asm-core";

export type ClassificationInput = {
  raw: string;
  expanded: string;
  length: number;
};

/**
 * Returns true when a resolved 24-bit operand is in the current 65816 bank.
 * @param {string} expanded Expanded operand text.
 * @param {number} currentAddress Current logical address.
 * @returns {boolean} Whether the operand is in the active bank.
 */
function isSame65816Bank(expanded: string, currentAddress: number): boolean {
  // oxlint-disable-next-line security/detect-unsafe-regex -- Hex width is bounded and the suffix is anchored.
  const match = expanded.trim().match(/^\$([\da-f]{5,6})(?:\s*,\s*[xy])?$/i);
  if (!match) {
    return false;
  }
  const value = parseInt(match[1], 16);
  return ((currentAddress >>> 16) & 0xff) === ((value >>> 16) & 0xff);
}

/**
 * True for a label or label expression indexed by X rather than a numeric spelling.
 * @param {string} rawOperand Raw operand text.
 * @returns {boolean} Whether this is an X-indexed label expression.
 */
function isIndexedXLabelOperand(rawOperand: string): boolean {
  const raw = rawOperand.trim();
  if (!/,\s*x$/i.test(raw)) {
    return false;
  }
  const base = raw.replace(/,\s*x$/i, "").trim();
  return base !== "" && !/^[\d!#$%(]/.test(base) && !base.startsWith("[");
}

/**
 * Applies Asar/SNES width forcing and same-bank shortening to neutral expansion metadata.
 * @param {OperandResolutionContext} resolver Operand resolver dependency.
 * @param {string} raw Raw operand text.
 * @param {string} expanded Expanded operand text.
 * @param {number} inferredLength Target-neutral inferred byte length.
 * @returns {number} 65816-selected operand byte length.
 */
function apply65816WidthPolicy(
  resolver: OperandResolutionContext,
  raw: string,
  expanded: string,
  inferredLength: number,
): number {
  if (raw.includes("<:") || raw.includes("bank(") || raw.includes("bankbyte(")) {
    return 2;
  }

  let length = inferredLength;
  // oxlint-disable-next-line security/detect-unsafe-regex -- Hex width is bounded and the suffix is anchored.
  const explicitLongHex = /^\$[\da-f]{5,6}(?:\s*,\s*[xy])?$/i.test(raw.trim());
  if (length === 3 && !explicitLongHex && isSame65816Bank(expanded, resolver.getCurrentAddress())) {
    length = 2;
  }

  if (!isIndexedXLabelOperand(raw)) {
    return length;
  }
  // oxlint-disable-next-line security/detect-unsafe-regex -- Hex width is bounded and the suffix is anchored.
  const match = expanded.trim().match(/^\$([\da-f]+)\s*,\s*x$/i);
  if (!match) {
    return length;
  }
  const value = parseInt(match[1], 16);
  const currentBank = (resolver.getCurrentAddress() >>> 16) & 0xff;
  const targetBank = (value >>> 16) & 0xff;
  return currentBank === targetBank ? 2 : 3;
}

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
  return classifyExpanded65816Operand(resolver, resolver.expandOperand(raw));
}

/**
 * Applies 65816 policy to operand facts that core has already expanded.
 * @param {OperandResolutionContext} resolver Operand resolver dependency.
 * @param {ClassificationInput} input Expanded operand facts.
 * @returns {LoweredOperand} Classified 65816 operand.
 */
export function classifyExpanded65816Operand(
  resolver: OperandResolutionContext,
  input: ClassificationInput,
): LoweredOperand {
  const length = apply65816WidthPolicy(resolver, input.raw, input.expanded, input.length);
  return classifyGenericOperand({ ...input, length });
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
