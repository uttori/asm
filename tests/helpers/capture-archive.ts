import { open } from "node:fs/promises";

import type { CaptureFileHeader } from "../../packages/debug-adapter/src/capture-file.js";
import { captureCrc32c } from "../../packages/debug-adapter/src/capture-v2.js";

/** Fixed synthetic identity shared by generated ACT2 frames. No game assets are needed. */
const session = "0123456789abcdef0123456789abcdef";
export const captureFixtureHeader: CaptureFileHeader = {
  format: "uttori-ares-capture",
  version: 2,
  session,
  scope: "snes.65816.instructions",
  ownership: "durable-prefix",
  compression: "none",
  checksum: "crc32c",
  maxChunkBytes: 262144,
  allocatedBytes: 4718656,
  clock: { id: "snes.master", numerator: "236250000", denominator: "11" },
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: "a".repeat(64),
  producer: { id: "benchmark", revision: "act2-loop-v1" },
};

/** Frame the small checksummed header/checkpoint/terminal records. */
const jsonFrame = (magic: string, value: unknown): Buffer => {
  const body = Buffer.from(JSON.stringify(value));
  const prefix = Buffer.alloc(12);
  prefix.write(magic);
  prefix.writeUInt32LE(body.length, 4);
  prefix.writeUInt32LE(captureCrc32c(body), 8);
  return Buffer.concat([prefix, body]);
};

/**
 * Write deterministic instruction frames and durable checkpoints for benchmarks and integration tests.
 * @param {string} file New temporary archive; an existing file is never overwritten.
 * @param {number} events Non-negative event count. Instructions loop over 256 PCs and 1024 A values.
 * @param {number} chunkEvents Events per frame, from 1 through the ACT2 bound of 3854.
 * @param {string} romContentSha256 Optional test-project ROM identity; no ROM bytes enter the archive.
 * @returns {Promise<void>} Complete archive, closed before readers run.
 */
export const writeCaptureFixture = async (
  file: string,
  events: number,
  chunkEvents = 1024,
  romContentSha256 = captureFixtureHeader.romContentSha256,
): Promise<void> => {
  if (
    !Number.isSafeInteger(events) ||
    events < 0 ||
    !Number.isInteger(chunkEvents) ||
    chunkEvents < 1 ||
    chunkEvents > 3854
  ) {
    throw new Error("Invalid capture fixture event count.");
  }
  const handle = await open(file, "wx");
  let chunks = 0;
  try {
    await handle.writeFile(jsonFrame("ACS2", { ...captureFixtureHeader, romContentSha256 }));
    for (let start = 0; start < events; start += chunkEvents) {
      const count = Math.min(chunkEvents, events - start);
      const bytes = Buffer.alloc(64 + count * 68);
      bytes.write("ACT2");
      bytes.writeUInt16LE(2, 4);
      Buffer.from(session, "hex").copy(bytes, 8);
      bytes.writeBigUInt64LE(BigInt(++chunks), 24);
      bytes.writeBigUInt64LE(BigInt(start + 1), 32);
      bytes.writeUInt32LE(count, 40);
      bytes.writeUInt32LE(64, 44);
      bytes.writeUInt32LE(count * 68, 48);
      bytes.writeUInt32LE(count * 68, 52);
      for (let i = 0; i < count; i++) {
        const offset = 64 + i * 68;
        const sequence = BigInt(start + i + 1);
        bytes.writeUInt16LE(1, offset);
        bytes.writeUInt16LE(1, offset + 2);
        bytes.writeUInt32LE(68, offset + 4);
        bytes.writeBigUInt64LE(sequence, offset + 8);
        bytes.writeBigUInt64LE(sequence * 6n, offset + 24);
        bytes.writeBigUInt64LE(sequence, offset + 32);
        bytes.writeBigUInt64LE(BigInt(0x808000 + ((start + i) % 256)), offset + 40);
        bytes[offset + 48] = 1;
        bytes.writeUInt16LE(16, offset + 49);
        bytes[offset + 51] = 0xea;
        bytes.writeUInt16LE((start + i) % 1024, offset + 52);
        bytes.writeUInt16LE(511, offset + 58);
        bytes[offset + 63] = 128;
        bytes.writeUInt16LE(0x8000 + ((start + i) % 256), offset + 64);
        bytes[offset + 66] = 48;
        bytes[offset + 67] = 1;
      }
      bytes.writeUInt32LE(captureCrc32c(bytes, true), 56);
      await handle.writeFile(bytes);
      await handle.writeFile(
        jsonFrame("ACK2", {
          session,
          chunkThrough: String(chunks),
          eventThrough: String(start + count),
        }),
      );
    }
    const through = String(events);
    await handle.writeFile(
      jsonFrame("END2", {
        session,
        state: "complete",
        producedThrough: through,
        deliveredThrough: through,
        acceptedThrough: through,
        durableThrough: through,
        releasedThrough: through,
        chunkThrough: String(chunks),
        producedChunks: String(chunks),
        bufferedBytes: 0,
        allocatedBytes: 4718656,
        clockNumerator: "236250000",
        clockDenominator: "11",
        throttleCount: "0",
        droppedInScope: "0",
        error: "",
      }),
    );
  } finally {
    await handle.close();
  }
};
