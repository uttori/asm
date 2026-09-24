import assert from "node:assert/strict";

/** Mode-dependent distance masks read by the game's $C14C30 decoder from $C14C00. */
export const DISTANCE_MASKS = [0x1f, 0x0f, 0x07, 0x03, 0x01, 0x00];

/**
 * Decode the boot/graphics LZ format, not the room tilemap codec.
 * Header: mode byte 0..5, one unused byte, big-endian uint16 output size.
 * Returns the exact encoded extent, excluding the game's speculative next-token read at completion.
 * Throws on truncated input, references before output, or runs exceeding the declared size.
 */
export function decompressSomLz(source, offset = 0, maxOutputBytes = 0xffff) {
  assert(source instanceof Uint8Array, "Expected byte input.");
  assert(
    Number.isSafeInteger(offset) && offset >= 0 && offset + 4 <= source.length,
    "Truncated LZ header.",
  );
  assert(Number.isSafeInteger(maxOutputBytes) && maxOutputBytes >= 0, "Invalid LZ output limit.");
  const mode = source[offset];
  assert(mode < DISTANCE_MASKS.length, "Invalid LZ mode.");
  const mask = DISTANCE_MASKS[mode];
  const size = (source[offset + 2] << 8) | source[offset + 3];
  assert(size <= maxOutputBytes, "LZ decoded size exceeds output limit.");
  const data = new Uint8Array(size);
  let cursor = offset + 4;
  let written = 0;
  let literalRuns = 0;
  let copyRuns = 0;
  while (written < size) {
    assert(cursor < source.length, "Truncated LZ token.");
    const token = source[cursor++];
    if (token < 0x80) {
      const length = token + 1;
      assert(cursor + length <= source.length, "Truncated LZ literal.");
      assert(written + length <= size, "LZ literal exceeds declared output size.");
      data.set(source.subarray(cursor, cursor + length), written);
      cursor += length;
      written += length;
      literalRuns++;
    } else {
      assert(cursor < source.length, "Truncated LZ distance.");
      const distance = ((token & mask) << 8) + source[cursor++] + 1;
      const length = Math.floor((token & 0x7f) / (mask + 1)) + 3;
      assert(distance <= written, "LZ reference precedes output.");
      assert(written + length <= size, "LZ copy exceeds declared output size.");
      // Forward copying deliberately permits overlap: distance 1 repeats the last byte.
      for (let i = 0; i < length; i++) {
        data[written] = data[written - distance];
        written++;
      }
      copyRuns++;
    }
  }
  return {
    data,
    mode,
    unusedHeaderByte: source[offset + 1],
    compressedBytes: cursor - offset,
    end: cursor,
    literalRuns,
    copyRuns,
  };
}

/**
 * Encode bytes for the game's $C14C30 decoder. Each mode chooses a lowest-cost
 * token parse from bounded match candidates, preferring longer runs and then
 * nearer distances on equal cost; `auto` chooses the shortest stream, then lowest mode.
 * The unused header byte is explicit because original ROM headers may differ.
 * This does not preserve an original stream's token choices.
 */
export function compressSomLz(source, options = {}) {
  assert(source instanceof Uint8Array, "Expected byte input.");
  assert(source.length <= 0xffff, "LZ decoded size exceeds 16-bit header.");
  assert(options && typeof options === "object" && !Array.isArray(options), "Invalid LZ options.");
  assert(
    Object.keys(options).every((key) => ["mode", "unusedHeaderByte"].includes(key)),
    "Unknown LZ option.",
  );
  const mode = options.mode ?? "auto";
  const unusedHeaderByte = options.unusedHeaderByte ?? 0;
  assert(
    mode === "auto" || (Number.isInteger(mode) && mode >= 0 && mode < DISTANCE_MASKS.length),
    "Invalid LZ mode.",
  );
  assert(
    Number.isInteger(unusedHeaderByte) && unusedHeaderByte >= 0 && unusedHeaderByte <= 255,
    "Invalid unused LZ header byte.",
  );
  const modes = mode === "auto" ? DISTANCE_MASKS.map((_, index) => index) : [mode];
  let best;
  for (const selectedMode of modes) {
    const encoded = encodeMode(source, selectedMode, unusedHeaderByte);
    if (!best || encoded.length < best.length) best = encoded;
  }
  return best;
}

/** Index previous triples, then choose the cheapest token sequence for this mode. */
function encodeMode(source, mode, unusedHeaderByte) {
  const mask = DISTANCE_MASKS[mode];
  const maxDistance = (mask + 1) * 256;
  const maxLength = Math.floor(0x7f / (mask + 1)) + 3;
  const seen = new Map();
  const matches = Array.from({ length: source.length }, () => new Uint16Array(maxLength + 1));
  const add = (position) => {
    if (position + 2 >= source.length) return;
    const key = (source[position] << 16) | (source[position + 1] << 8) | source[position + 2];
    const positions = seen.get(key) ?? [];
    positions.push(position);
    // Older candidates cannot become useful again; keep search work bounded.
    while (positions.length > 128 || (positions.length && position - positions[0] >= maxDistance))
      positions.shift();
    seen.set(key, positions);
  };
  for (let cursor = 0; cursor < source.length; cursor++) {
    if (cursor + 2 < source.length) {
      const key = (source[cursor] << 16) | (source[cursor + 1] << 8) | source[cursor + 2];
      const positions = seen.get(key) ?? [];
      for (let index = positions.length - 1; index >= 0; index--) {
        const candidateDistance = cursor - positions[index];
        if (candidateDistance > maxDistance) break;
        let candidateLength = 3;
        while (
          candidateLength < maxLength &&
          cursor + candidateLength < source.length &&
          source[cursor + candidateLength] === source[cursor + candidateLength - candidateDistance]
        )
          candidateLength++;
        for (let length = 3; length <= candidateLength; length++) {
          if (matches[cursor][length] === 0 || candidateDistance < matches[cursor][length]) {
            matches[cursor][length] = candidateDistance;
          }
        }
      }
    }
    add(cursor);
  }
  const cost = new Uint32Array(source.length + 1);
  const choice = new Int16Array(source.length);
  const distance = new Uint16Array(source.length);
  for (let cursor = source.length - 1; cursor >= 0; cursor--) {
    let bestCost = Number.MAX_SAFE_INTEGER;
    let bestChoice = 0;
    for (let length = 1; length <= 128 && cursor + length <= source.length; length++) {
      const candidate = 1 + length + cost[cursor + length];
      if (candidate < bestCost || (candidate === bestCost && length > bestChoice)) {
        bestCost = candidate;
        bestChoice = length;
      }
    }
    for (let length = 3; length <= maxLength && cursor + length <= source.length; length++) {
      const matchDistance = matches[cursor][length];
      if (!matchDistance) continue;
      const candidate = 2 + cost[cursor + length];
      if (candidate < bestCost || (candidate === bestCost && length > Math.abs(bestChoice))) {
        bestCost = candidate;
        bestChoice = -length;
        distance[cursor] = matchDistance;
      }
    }
    cost[cursor] = bestCost;
    choice[cursor] = bestChoice;
  }
  const output = [mode, unusedHeaderByte, source.length >>> 8, source.length & 255];
  for (let cursor = 0; cursor < source.length;) {
    const length = choice[cursor];
    if (length > 0) {
      output.push(length - 1, ...source.subarray(cursor, cursor + length));
      cursor += length;
    } else {
      const runLength = -length;
      const encodedDistance = distance[cursor] - 1;
      output.push(
        0x80 | ((runLength - 3) * (mask + 1)) | (encodedDistance >>> 8),
        encodedDistance & 255,
      );
      cursor += runLength;
    }
  }
  return Uint8Array.from(output);
}
