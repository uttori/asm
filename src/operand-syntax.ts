export type OperandSyntax = {
  raw: string;
  trimmed: string;
  normalizedUpper: string;
  immediate: boolean;
  indirect: boolean;
  indexRegister?: "x" | "y" | "s";
};

export function parseOperandSyntax(operand: string): OperandSyntax {
  const raw = operand;
  const trimmed = operand.trim();
  const normalizedUpper = trimmed.toUpperCase();
  const indexMatch = trimmed.match(/,\s*([sxy])$/i);
  const indexRegister = indexMatch ? (indexMatch[1].toLowerCase() as "x" | "y" | "s") : undefined;

  return {
    raw,
    trimmed,
    normalizedUpper,
    immediate: trimmed.startsWith("#"),
    indirect: trimmed.startsWith("(") || trimmed.startsWith("["),
    indexRegister,
  };
}
