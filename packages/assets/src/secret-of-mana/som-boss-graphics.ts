/**
 * Expand the MSB-first boss graphics mask stream used after the optional SoM LZ stage.
 * Clear bits copy the byte two outputs earlier; both history bytes start at zero.
 * Native callers round requested bytes to eight; the returned source extent excludes
 * any speculative reads or padding after the last group.
 * @param {Uint8Array} source Mask stream.
 * @param {number} size Requested output size before eight-byte rounding.
 * @returns {{data: Uint8Array, consumed: number}} Expanded bytes and the consumed source length.
 */
export function expandBossGraphics(source: Uint8Array, size: number) {
  validateSize(source, size);
  return expandBossMask(source, Math.ceil(size / 8) * 8);
}

/** Reject invalid native lengths before rounding or allocating an output buffer. */
function validateSize(source: Uint8Array, size: number) {
  if (!(source instanceof Uint8Array) || !Number.isInteger(size) || size <= 0 || size > 65535) {
    throw new Error("Boss graphics need bytes and a positive 16-bit output size.");
  }
}

/**
 * Expand exactly `size` bytes of the shared two-byte-history mask grammar. Background
 * tilemaps stop inside the final mask group, whereas the graphics uploader rounds to eight.
 * The returned extent excludes unused bits and speculative native prefetches.
 */
export function expandBossMask(source: Uint8Array, size: number) {
  // A rounded graphics request can produce 65536 bytes from its valid 16-bit count.
  if (size !== 65536) validateSize(source, size);
  else if (!(source instanceof Uint8Array)) throw new Error("Boss mask source requires bytes.");
  const data = new Uint8Array(size);
  let cursor = 0;
  for (let output = 0; output < size;) {
    if (cursor >= source.length) {
      throw new Error("Truncated boss graphics mask.");
    }
    const mask = source[cursor++];
    for (let bit = 7; bit >= 0 && output < size; bit--, output++) {
      if (mask & (1 << bit)) {
        if (cursor >= source.length) {
          throw new Error("Truncated boss graphics literal.");
        }
        data[output] = source[cursor++];
      } else if (output >= 2) {
        data[output] = data[output - 2];
      }
    }
  }
  return { data, consumed: cursor };
}

/** Encode each byte as a literal unless the game's two-byte history can reproduce it.
 * @param {Uint8Array} data Expanded bytes, a positive multiple of eight up to 65536 bytes.
 * @returns {Uint8Array} Mask stream that expands back to `data`.
 */
export function encodeBossGraphics(data: Uint8Array) {
  if (!(data instanceof Uint8Array) || !data.length || data.length % 8) {
    throw new Error("Boss graphics need a positive multiple-of-eight byte count.");
  }
  return encodeBossMask(data);
}

/** Encode an exact byte count, leaving unused low bits of the final mask clear. */
export function encodeBossMask(data: Uint8Array) {
  if (!(data instanceof Uint8Array) || !data.length || data.length > 65536) {
    throw new Error("Boss mask needs 1..65536 bytes.");
  }
  const output = [];
  for (let start = 0; start < data.length; start += 8) {
    let mask = 0;
    const literals = [];
    for (let bit = 0; bit < 8 && start + bit < data.length; bit++) {
      const index = start + bit;
      // Native history starts at zero, so the first two zero bytes need no literals either.
      const previous = index >= 2 ? data[index - 2] : 0;
      if (data[index] !== previous) {
        mask |= 1 << (7 - bit);
        literals.push(data[index]);
      }
    }
    output.push(mask, ...literals);
  }
  const encoded = Uint8Array.from(output);
  const decoded = expandBossMask(encoded, data.length);
  if (
    decoded.consumed !== encoded.length ||
    decoded.data.some((byte, index) => byte !== data[index])
  ) {
    throw new Error("Boss graphics mask inverse failed.");
  }
  return encoded;
}
