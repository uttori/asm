/** Decode pointer-bounded SoM body records; no ROM reads or capture-tool dependencies. */
export function decodeBodyFrame(input) {
  if (
    (!Array.isArray(input) && !(input instanceof Uint8Array)) ||
    input.length < 2 ||
    input.length > 157 ||
    [...input].some((v) => !Number.isInteger(v) || v < 0 || v > 255)
  ) {
    throw new Error("Invalid bounded body frame bytes.");
  }
  const bytes = Uint8Array.from(input);
  const groups = bytes[0] & 15 || 1;
  const tileOffsets = [];
  let offset = 1;
  while (tileOffsets.length < groups * 4) {
    if (offset + 2 > bytes.length) {
      throw new Error("Truncated sprite tile word.");
    }
    const word = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2;
    const count = word & 0x8000 ? (word & 15) + 1 : 1;
    // The runtime caps a final run at the declared group count. Preserve its token unchanged.
    for (let i = 0; i < count && tileOffsets.length < groups * 4; i++) {
      const increment = (word & 0xc000) === 0xc000 ? i : 0;
      tileOffsets.push(((word & 0x3ff0) * 2 + increment * 32) & 65535);
    }
  }
  if (offset + groups * 2 > bytes.length) {
    throw new Error("Missing sprite block offsets.");
  }
  const signed7 = (byte) => (byte & 63) - (byte & 64);
  const coordinateOffsets = Array.from({ length: groups }, (_, i) => ({
    y: offset + i * 2,
    x: offset + i * 2 + 1,
  }));
  const blocks = coordinateOffsets.map(({ x, y }) => ({
    x: signed7(bytes[x]),
    y: signed7(bytes[y]),
    flipX: !!(bytes[x] & 128),
    priority: !!(bytes[y] & 128),
  }));
  offset += groups * 2;
  const boxes = Number(!!(bytes[0] & 0x20)) + Number(!!(bytes[0] & 0x40));
  if (bytes.length - offset !== boxes * (bytes[0] & 0x10 ? 3 : 2)) {
    throw new Error("Frame tail disagrees with header and pointer bound.");
  }
  return {
    header: bytes[0],
    groups,
    tileOffsets,
    blocks,
    coordinateOffsets,
    collisionBytes: bytes.slice(offset),
  };
}

/**
 * Patch only signed-seven-bit block coordinates; preserve every flag, run token and tail byte.
 * Edits name a native block index, never a visual occurrence or an atlas coordinate.
 */
export function patchBodyFrameCoordinates(input, edits) {
  const decoded = decodeBodyFrame(input);
  const result = Uint8Array.from(input);
  const seen = new Set();
  for (const edit of edits) {
    if (
      !Number.isInteger(edit.block) ||
      edit.block < 0 ||
      edit.block >= decoded.groups ||
      seen.has(edit.block) ||
      Object.keys(edit).some((k) => !["block", "x", "y"].includes(k))
    ) {
      throw new Error("Invalid or duplicate body block edit.");
    }
    seen.add(edit.block);
    for (const axis of ["x", "y"]) {
      if (edit[axis] === undefined) {
        continue;
      }
      if (!Number.isInteger(edit[axis]) || edit[axis] < -64 || edit[axis] > 63) {
        throw new Error("Body coordinates must be in -64..63.");
      }
      const offset = decoded.coordinateOffsets[edit.block][axis];
      result[offset] = (result[offset] & 128) | (edit[axis] & 127);
    }
  }
  return result;
}
