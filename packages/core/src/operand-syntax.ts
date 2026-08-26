export type OperandSyntax = {
  raw: string;
  trimmed: string;
  normalizedUpper: string;
  immediate: boolean;
  indirect: boolean;
  /** Unvalidated trailing index token. Architectures decide which names are registers. */
  indexRegister?: string;
  /** Byte width explicitly spelled by a bare hexadecimal operand, when present. */
  explicitWidth?: number;
  /** True when the source begins with a numeric literal or numeric prefix. */
  numericSpelling: boolean;
};

export function parseOperandSyntax(operand: string): OperandSyntax {
  const raw = operand;
  const trimmed = operand.trim();
  const normalizedUpper = trimmed.toUpperCase();
  const indexMatch = trimmed.match(/,\s*([a-z][\da-z]*)$/i);
  const indexRegister = indexMatch?.[1].toLowerCase();
  const numericBase = trimmed
    .replace(/^#\s*/, "")
    .replace(/,\s*[a-z][\da-z]*$/i, "")
    .trim();
  const explicitHex = numericBase.match(/^\$([\da-f]+)$/i);
  const explicitWidth = explicitHex ? Math.max(1, Math.ceil(explicitHex[1].length / 2)) : undefined;

  return {
    raw,
    trimmed,
    normalizedUpper,
    immediate: trimmed.startsWith("#"),
    indirect: trimmed.startsWith("(") || trimmed.startsWith("["),
    indexRegister,
    explicitWidth,
    numericSpelling: /^[\d#$%]/.test(trimmed),
  };
}
