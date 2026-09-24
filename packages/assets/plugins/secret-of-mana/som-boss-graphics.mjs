/**
 * Expand the MSB-first boss graphics mask stream used after the optional SoM LZ stage.
 * Clear bits copy the byte two outputs earlier; both history bytes start at zero.
 * Native callers round requested bytes to eight; the returned source extent excludes
 * any speculative reads or padding after the last group.
 */
export function expandBossGraphics(source, size) {
  if (!(source instanceof Uint8Array) || !Number.isInteger(size) || size <= 0 || size > 65535) {
    throw new Error("Boss graphics need bytes and a positive 16-bit output size.");
  }
  const length = Math.ceil(size / 8) * 8;
  const data = new Uint8Array(length);
  let cursor = 0;
  for (let output = 0; output < length;) {
    if (cursor >= source.length) throw new Error("Truncated boss graphics mask.");
    const mask = source[cursor++];
    for (let bit = 7; bit >= 0; bit--, output++) {
      if (mask & (1 << bit)) {
        if (cursor >= source.length) throw new Error("Truncated boss graphics literal.");
        data[output] = source[cursor++];
      } else if (output >= 2) {
        data[output] = data[output - 2];
      }
    }
  }
  return { data, consumed: cursor };
}

/** Encode each byte as a literal unless the game's two-byte history can reproduce it. */
export function encodeBossGraphics(data) {
  if (!(data instanceof Uint8Array) || !data.length || data.length % 8) {
    throw new Error("Boss graphics need a positive multiple-of-eight byte count.");
  }
  const output = [];
  for (let start = 0; start < data.length; start += 8) {
    let mask = 0;
    const literals = [];
    for (let bit = 0; bit < 8; bit++) {
      const index = start + bit;
      if (index < 2 || data[index] !== data[index - 2]) {
        mask |= 1 << (7 - bit);
        literals.push(data[index]);
      }
    }
    output.push(mask, ...literals);
  }
  const encoded = Uint8Array.from(output);
  const decoded = expandBossGraphics(encoded, data.length);
  if (decoded.consumed !== encoded.length || decoded.data.some((byte, index) => byte !== data[index])) {
    throw new Error("Boss graphics mask inverse failed.");
  }
  return encoded;
}
