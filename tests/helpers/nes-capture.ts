import fs from "node:fs";
import path from "node:path";

import { captureCrc32c, type CaptureFileHeader } from "@uttori/asm-debug-adapter";
import { sourceContentHash } from "@uttori/asm-disassembler";

import { captureFixtureHeader } from "./capture-archive.js";

/** Encode ACT2's checksummed JSON envelope for a synthetic archive's durable boundaries. */
function frame(magic: string, value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value));
  const prefix = Buffer.alloc(12);
  prefix.write(magic);
  prefix.writeUInt32LE(body.length, 4);
  prefix.writeUInt32LE(captureCrc32c(body), 8);
  return Buffer.concat([prefix, body]);
}

/** Publish one complete native chunk with matching header, checkpoint and terminal counts. */
function writeArchive(file: string, header: CaptureFileHeader, chunk: Buffer): void {
  const through = String(chunk.readUInt32LE(40));
  chunk.writeUInt32LE(captureCrc32c(chunk, true), 56);
  fs.writeFileSync(
    file,
    Buffer.concat([
      frame("ACS2", header),
      chunk,
      frame("ACK2", { session: header.session, chunkThrough: "1", eventThrough: through }),
      frame("END2", {
        session: header.session,
        scope: header.scope,
        state: "complete",
        producedThrough: through,
        deliveredThrough: through,
        acceptedThrough: through,
        durableThrough: through,
        releasedThrough: through,
        chunkThrough: "1",
        producedChunks: "1",
        bufferedBytes: 0,
        allocatedBytes: header.allocatedBytes,
        clockNumerator: header.clock.numerator,
        clockDenominator: header.clock.denominator,
        throttleCount: "0",
        droppedInScope: "0",
        error: "",
      }),
    ]),
    { flag: "wx" },
  );
}

/**
 * Write a mapper-0 STA $2000 observed at CPU $8100 / PRG $100 and a verified PPU companion.
 * The caller's ROM must contain that instruction. Artifacts are synthetic and contain no game state.
 */
export function writeNesCaptureFixture(
  file: string,
  identity: { readonly sha256: string; readonly contentSha256: string },
): void {
  const header: CaptureFileHeader = {
    ...captureFixtureHeader,
    scope: "nes.2a03.instructions",
    architecture: "65xx.2a03",
    addressSpace: "nes.cpu",
    romFileSha256: identity.sha256,
    romContentSha256: identity.contentSha256,
    clock: { ...captureFixtureHeader.clock, id: "nes.master" },
  };
  // The Ricoh record adds 37 state bytes, including the PRG origin of every fetched byte.
  const chunk = Buffer.alloc(155);
  chunk.write("ACT2");
  chunk.writeUInt16LE(2, 4);
  Buffer.from(header.session, "hex").copy(chunk, 8);
  chunk.writeBigUInt64LE(1n, 24);
  chunk.writeBigUInt64LE(1n, 32);
  chunk.writeUInt32LE(1, 40);
  chunk.writeUInt32LE(64, 44);
  chunk.writeUInt32LE(91, 48);
  chunk.writeUInt32LE(91, 52);
  chunk.writeUInt16LE(1, 64);
  chunk.writeUInt16LE(1, 66);
  chunk.writeUInt32LE(91, 68);
  chunk.writeBigUInt64LE(1n, 72);
  chunk.writeUInt32LE(1, 80);
  chunk.writeUInt32LE(1, 84);
  chunk.writeBigUInt64LE(12n, 88);
  chunk.writeBigUInt64LE(1n, 96);
  chunk.writeBigUInt64LE(0x8100n, 104);
  chunk[112] = 3;
  chunk.writeUInt16LE(37, 113);
  chunk.set([0x8d, 0, 0x20], 115);
  chunk[121] = 0xfd;
  chunk[122] = 0x24;
  chunk.writeUInt16LE(0x8100, 123);
  for (let byte = 0; byte < 3; byte++) {
    chunk.writeUInt32LE(0x100 + byte, 143 + byte * 4);
  }
  writeArchive(file, header, chunk);

  const directory = `${file}.context`;
  fs.mkdirSync(directory);
  const graphics = fs.readFileSync(
    new URL("../../packages/debug-adapter/tests/fixtures/nes-ppu/ppu-bus.chunk", import.meta.url),
  );
  // Bind the shared port-access fixture to the mapper-0 ROM and observed physical instruction.
  for (let index = 0; index < graphics.readUInt32LE(40); index++) {
    const offset = 64 + index * 128;
    graphics.writeUInt16LE(0x8100, offset + 40);
    graphics.writeUInt32LE(0x100, offset + 48);
    graphics.fill(0, offset + 60, offset + 78);
    if (index === 1) {
      // Include an owned access so archive-independent queries also exercise the CPU evidence join.
      graphics[offset + 47] = 1;
      graphics.writeBigUInt64LE(1n, offset + 32);
    }
  }
  writeArchive(
    path.join(directory, "graphics.act2"),
    { ...header, scope: "nes.cpu-bus-ppu", session: graphics.toString("hex", 8, 24) },
    graphics,
  );
  const boundaries = {
    session: header.session,
    end: { eventThrough: "1" },
    graphicsWindowFrames: null,
  };
  const artifacts = {
    "start.bst": Buffer.alloc(538),
    "start-extra.bin": Buffer.alloc(38),
    "ram-start.bin": Buffer.alloc(2048),
    "ram-end.bin": Buffer.alloc(2048),
    "end-state.bin": Buffer.alloc(2048),
    "inputs.bin": Buffer.alloc(0),
    "identity.txt": Buffer.from("synthetic"),
    "machine.json": Buffer.from("{}"),
    "start-clock.txt": Buffer.from("0"),
    "end-clock.txt": Buffer.from("12"),
    "boundaries.json": Buffer.from(JSON.stringify(boundaries)),
  };
  for (const [name, bytes] of Object.entries(artifacts)) {
    fs.writeFileSync(path.join(directory, name), bytes);
  }
  const files = Object.fromEntries(
    [...Object.keys(artifacts), "graphics.act2"].map((name) => {
      const bytes = fs.readFileSync(path.join(directory, name));
      return [name, { bytes: bytes.length, sha256: sourceContentHash(bytes) }];
    }),
  );
  fs.writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      format: "uttori-capture-context",
      version: 1,
      architecture: header.architecture,
      addressSpace: header.addressSpace,
      romContentSha256: header.romContentSha256,
      romFileSha256: header.romFileSha256,
      producer: header.producer,
      archive: path.basename(file),
      scope: header.scope,
      boundaries,
      files,
    }),
  );
}
