/**
 * Parse a single numeric expression to a number.
 * Supports $hex, 0xhex, decimal. No defines or labels yet.
 * @param {string} expr The expression to parse.
 * @returns {number} The parsed number.
 */
export function parseNum(expr: string): number {
  const s = expr.trim();
  if (s.startsWith("#")) {
    return parseNum(s.slice(1));
  }
  if (s.startsWith("$")) {
    const n = Number.parseInt(s.slice(1), 16);
    if (Number.isNaN(n)) throw new Error(`Invalid hex: ${expr}`);
    return n >>> 0;
  }
  if (/^0x[\dA-Fa-f]+$/.test(s)) {
    const n = Number.parseInt(s, 16);
    return n >>> 0;
  }
  const n = Number.parseInt(s, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid number: ${expr}`);
  return n >>> 0;
}
