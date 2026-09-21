import type { DebugTraceBatch, DebugTraceInstructionDetail } from "@uttori/asm-debug-adapter";

const integer = (value: string, maximum = Number.MAX_SAFE_INTEGER): number => {
  if (!/^[\da-f]+$/i.test(value)) {throw new Error("Malformed rich trace integer.");}
  const result = Number.parseInt(value, 16);
  if (!Number.isSafeInteger(result) || result > maximum)
    {throw new Error("Rich trace integer exceeds its bound.");}
  return result;
};

/**
 * Parse bounded native execution observations.
 * @param {string} response Native RSP reply.
 * @param {number} maximum Requested event count.
 * @returns {DebugTraceBatch} Decoded execution observations.
 */
export const parseAresTraceDetails = (response: string, maximum: number): DebugTraceBatch => {
  const match = /^([01]):([\da-f]+):([\da-f]+):([\da-f]+):(.*)$/i.exec(response);
  if (!match || response.length > 0x4096)
    {throw new Error("Malformed rich instruction trace response.");}
  const rows = match[5] === "" ? [] : match[5].split(";");
  if (rows.length && rows.pop() !== "") {throw new Error("Rich trace row is unterminated.");}
  if (rows.length > maximum || rows.length > 240)
    {throw new Error("Rich trace exceeds the requested batch limit.");}
  const addresses: number[] = [];
  const details = rows.map((row): DebugTraceInstructionDetail => {
    const fields = row.split(",");
    if (
      fields.length !== 5 ||
      !/^[\da-f]{40}$/i.test(fields[1]) ||
      !/^[\da-f]{2,8}$/i.test(fields[2]) ||
      fields[2].length % 2 !== 0 ||
      fields[4].length % 21 !== 0 ||
      fields[4].length > 32 * 21
    )
      {throw new Error("Malformed rich trace instruction fields.");}
    addresses.push(integer(fields[0], 0xffffff));
    const names = ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"];
    const maxima = [65535, 65535, 65535, 65535, 65535, 255, 255, 65535, 255, 1];
    const state = Object.fromEntries(
      names.map((name, index) => [
        name,
        integer(fields[1].slice(index * 4, index * 4 + 4), maxima[index]),
      ]),
    );
    if (((state.pb << 16) | state.pc) !== addresses.at(-1))
      {throw new Error("Trace PC disagrees with captured processor state.");}
    const memoryAccesses = Array.from({ length: fields[4].length / 21 }, (_, index) => {
      const raw = fields[4].slice(index * 21, index * 21 + 21);
      const actor = (["cpu", "dma", "hdma"] as const)[integer(raw[19], 2)];
      const channel = integer(raw[20], 15);
      if ((actor === "cpu" && channel !== 15) || (actor !== "cpu" && channel > 7))
        {throw new Error("Invalid trace DMA channel.");}
      return {
        addressSpace: "snes.cpu",
        address: integer(raw.slice(0, 16), 0xffffff),
        value: integer(raw.slice(16, 18), 255),
        access: (["read", "write", "fetch"] as const)[integer(raw[18], 2)],
        width: 1,
        actor,
        ...(actor === "cpu" ? {} : { channel }),
      };
    });
    return {
      bytes: Array.from(Buffer.from(fields[2], "hex")),
      state,
      memoryAccesses,
      droppedMemoryAccesses: integer(fields[3]),
    };
  });
  const sequenceStart = integer(match[2]);
  if (sequenceStart < 1) {throw new Error("Invalid trace sequence.");}
  return {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    addresses,
    details,
    sequenceStart,
    droppedEvents: integer(match[3]),
    unattributedMemoryAccesses: integer(match[4]),
    active: match[1] === "1",
  };
};
