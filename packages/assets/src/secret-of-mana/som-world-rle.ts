/** World-map row codec used by the self-modifying $000B00 decoder, separate from room pieces. */

/**
 * Decode exactly `size` tiles. C0..FF consume a following tile and emit (token & 63)+1
 * copies. Reject a run crossing the row boundary; return the consumed extent separately.
 * @param bytes Encoded world-map row.
 * @param [size] Output tile count.
 * @returns Decoded tiles and the consumed input length.
 */
export function decodeWorldRow(bytes: Uint8Array, size = 512) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 65536) {
    throw new Error("World row size must be 1..65536 tiles.");
  }
  const data = new Uint8Array(size);
  let input = 0,
    output = 0;
  while (output < size) {
    if (input >= bytes.length) {
      throw new Error("Truncated world row token.");
    }
    const token = bytes[input++];
    let count = 1,
      tile = token;
    if (token >= 0xc0) {
      count = (token & 63) + 1;
      if (input >= bytes.length) {
        throw new Error("Truncated world row run.");
      }
      tile = bytes[input++];
    }
    if (output + count > size) {
      throw new Error("World row run crosses its output boundary.");
    }
    data.fill(tile, output, output + count);
    output += count;
  }
  return { data, consumed: input };
}

/**
 * Canonical inverse; unchanged native streams should be retained to preserve original token choices.
 * @param bytes Decoded row tiles.
 * @returns Encoded row.
 */
export function encodeWorldRow(bytes: Uint8Array) {
  if (bytes.length < 1 || bytes.length > 65536) {
    throw new Error("World row size must be 1..65536 tiles.");
  }
  const output = [];
  for (let index = 0; index < bytes.length;) {
    const tile = bytes[index];
    let count = 1;
    while (count < 64 && index + count < bytes.length && bytes[index + count] === tile) {
      count++;
    }
    // High tile values always need an escape, even for a single occurrence.
    if (count >= 3 || tile >= 0xc0) {
      output.push(0xbf + count, tile);
    } else {
      for (let i = 0; i < count; i++) {
        output.push(tile);
      }
    }
    index += count;
  }
  return Uint8Array.from(output);
}

/**
 * Each row's bank is a bit, least-significant first; there is no pointer-wrap heuristic.
 * @param bankBits Sixty-four bank-selection bytes.
 * @param row Row index, 0 through 511.
 * @returns Bank byte `$C6` or `$C7`.
 */
export function worldRowBank(bankBits: Uint8Array, row: number) {
  if (bankBits.length !== 64 || !Number.isInteger(row) || row < 0 || row >= 512) {
    throw new Error("World bank lookup requires 64 bytes and row 0..511.");
  }
  return 0xc6 | ((bankBits[row >>> 3] >>> (row & 7)) & 1);
}
