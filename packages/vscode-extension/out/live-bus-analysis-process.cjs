"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/vscode-extension/src/live-bus-analysis-process.ts
var live_bus_analysis_process_exports = {};
__export(live_bus_analysis_process_exports, {
  handleLiveBusProcessMessage: () => handleLiveBusProcessMessage,
  runLiveBusAnalysis: () => runLiveBusAnalysis
});
module.exports = __toCommonJS(live_bus_analysis_process_exports);
var import_promises3 = require("node:timers/promises");

// packages/debug-adapter/src/capture-v2.ts
var maxU64 = (1n << 64n) - 1n;
var captureScope = (value) => {
  if (value !== "snes.65816.instructions" && value !== "snes.cpu-bus" && value !== "snes.cpu-bus-transfers" && value !== "snes.cpu-bus-ppu")
    throw new Error("Unsupported capture scope.");
  return value;
};
var captureU64 = (value) => {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,19})$/.test(value) || BigInt(value) > maxU64)
    throw new Error("Capture counter must be a canonical unsigned 64-bit decimal string.");
  return BigInt(value);
};
var captureSession = (value) => {
  if (typeof value !== "string" || !/^[\da-f]{32}$/.test(value))
    throw new Error("Invalid capture session identity.");
  return value;
};
var validateCapturePosition = (value, session, scope) => {
  if (!value || typeof value !== "object") throw new Error("Invalid capture position.");
  const p = value;
  captureSession(p.session);
  if (session !== void 0 && p.session !== session) throw new Error("Capture session changed.");
  if (p.scope !== void 0) captureScope(p.scope);
  if (scope !== void 0 && (p.scope ?? "snes.65816.instructions") !== captureScope(scope))
    throw new Error("Capture scope changed or was not confirmed by the producer.");
  if (!["armed", "recording", "throttled", "stopping", "draining", "complete", "incomplete"].includes(
    p.state
  ))
    throw new Error("Invalid capture state.");
  const bounds = [
    p.releasedThrough,
    p.durableThrough,
    p.acceptedThrough,
    p.deliveredThrough,
    p.producedThrough
  ].map(captureU64);
  if (bounds.some((v, i) => i > 0 && v < bounds[i - 1]))
    throw new Error("Capture ownership boundaries are inconsistent.");
  if (captureU64(p.chunkThrough) > captureU64(p.producedChunks))
    throw new Error("Capture chunk boundary is inconsistent.");
  captureU64(p.throttleCount);
  if (!captureU64(p.clockNumerator) || !captureU64(p.clockDenominator))
    throw new Error("Invalid capture clock domain.");
  if (p.droppedInScope !== "0" || typeof p.error !== "string" || p.error.length > 256)
    throw new Error("Capture integrity failed.");
  if (![p.bufferedBytes, p.allocatedBytes].every(
    (v) => Number.isSafeInteger(v) && v >= 0 && v <= 64 * 1024 * 1024
  ) || p.bufferedBytes > p.allocatedBytes)
    throw new Error("Capture allocation exceeds its bounds.");
  if (p.state === "complete" && (p.error || p.bufferedBytes || new Set(bounds.map(String)).size !== 1 || p.chunkThrough !== p.producedChunks))
    throw new Error("Capture terminal totals do not reconcile.");
  return p;
};
var crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 2197175160 : 0);
  return crc >>> 0;
});
var crcSlices = [crcTable];
for (let slice = 1; slice < 8; slice++)
  crcSlices.push(
    Uint32Array.from(crcSlices[slice - 1], (crc) => crc >>> 8 ^ crcTable[crc & 255])
  );
var captureCrc32c = (bytes, zeroChecksum = false) => {
  let crc = 4294967295;
  let i = 0;
  for (; i + 8 <= bytes.length; i += 8) {
    let low = bytes[i] | bytes[i + 1] << 8 | bytes[i + 2] << 16 | bytes[i + 3] << 24;
    if (zeroChecksum && i === 56) low = 0;
    const a = crc ^ low;
    crc = crcSlices[7][a & 255] ^ crcSlices[6][a >>> 8 & 255] ^ crcSlices[5][a >>> 16 & 255] ^ crcSlices[4][a >>> 24] ^ crcSlices[3][bytes[i + 4]] ^ crcSlices[2][bytes[i + 5]] ^ crcSlices[1][bytes[i + 6]] ^ crcSlices[0][bytes[i + 7]];
  }
  for (; i < bytes.length; i++)
    crc = crc >>> 8 ^ crcTable[(crc ^ (zeroChecksum && i >= 56 && i < 60 ? 0 : bytes[i])) & 255];
  return (crc ^ 4294967295) >>> 0;
};
var captureChunkRecords = (chunk) => {
  if (chunk.scope === "snes.65816.instructions") return chunk.instructions;
  if (chunk.scope === "snes.cpu-bus") return chunk.accesses;
  return chunk.events;
};
function decodeCaptureChunk(bytes, session, scope = "snes.65816.instructions") {
  captureSession(session);
  captureScope(scope);
  if (bytes.length < 64 || bytes.length > 262144)
    throw new Error("Capture chunk length exceeds bounds.");
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.toString("ascii", 0, 4) !== "ACT2" || b.readUInt16LE(4) !== 2 || b.readUInt16LE(6) !== 0 || b.readUInt32LE(44) !== 64 || b.readUInt32LE(60) !== 0)
    throw new Error("Unsupported capture envelope.");
  if (b.toString("hex", 8, 24) !== session)
    throw new Error("Capture chunk belongs to another session.");
  if (b.readUInt32LE(48) !== bytes.length - 64 || b.readUInt32LE(52) !== bytes.length - 64)
    throw new Error("Capture payload lengths disagree.");
  if (captureCrc32c(bytes, true) !== b.readUInt32LE(56))
    throw new Error("Capture checksum mismatch.");
  const sequence = b.readBigUInt64LE(24), first = b.readBigUInt64LE(32), count = b.readUInt32LE(40);
  const through = first + BigInt(count) - 1n;
  const maxRecords = scope === "snes.65816.instructions" ? 3854 : 4095;
  if (!sequence || !first || !count || count > maxRecords || through > maxU64)
    throw new Error("Invalid capture sequence range.");
  const identity = {
    session,
    sequence: String(sequence),
    first: String(first),
    through: String(through)
  };
  if (scope === "snes.cpu-bus")
    return {
      ...identity,
      scope,
      accesses: decodeBusAccesses(b, first, count)
    };
  if (scope === "snes.cpu-bus-transfers" || scope === "snes.cpu-bus-ppu")
    return {
      ...identity,
      scope,
      events: decodeBusAccesses(b, first, count, true, scope === "snes.cpu-bus-ppu")
    };
  const instructions = [];
  let offset = 64;
  for (let i = 0; i < count; i++) {
    if (offset + 68 > b.length) throw new Error("Truncated capture record.");
    const length = b.readUInt32LE(offset + 4), n = b[offset + 48];
    const event = first + BigInt(i), ordinal = b.readBigUInt64LE(offset + 32), address = b.readBigUInt64LE(offset + 40);
    if (b.readUInt16LE(offset) !== 1 || b.readUInt16LE(offset + 2) !== 1 || b.readUInt32LE(offset + 16) !== 0 || b.readUInt32LE(offset + 20) !== 0)
      throw new Error("Unsupported required capture record.");
    if (n < 1 || n > 4 || length !== 67 + n || offset + length > b.length || b.readUInt16LE(offset + 49) !== 16)
      throw new Error("Invalid instruction record length.");
    if (b.readBigUInt64LE(offset + 8) !== event || ordinal !== event || address > 0xffffffn)
      throw new Error("Instruction identity disagrees with capture scope.");
    const r = offset + 51 + n;
    const state = {
      a: b.readUInt16LE(r),
      x: b.readUInt16LE(r + 2),
      y: b.readUInt16LE(r + 4),
      s: b.readUInt16LE(r + 6),
      d: b.readUInt16LE(r + 8),
      db: b[r + 10],
      pb: b[r + 11],
      pc: b.readUInt16LE(r + 12),
      p: b[r + 14],
      e: b[r + 15]
    };
    if (state.e > 1 || (state.pb << 16 | state.pc) !== Number(address))
      throw new Error("Captured PC/state mismatch.");
    const cycle = b.readBigUInt64LE(offset + 24);
    if (i && cycle < BigInt(instructions[i - 1].cycle))
      throw new Error("Capture clock moved backwards.");
    instructions.push({
      sequence: String(event),
      ordinal: String(ordinal),
      cycle: String(cycle),
      address: Number(address),
      detail: { bytes: [...b.subarray(offset + 51, r)], state }
    });
    offset += length;
  }
  if (offset !== b.length)
    throw new Error("Capture record count does not consume the payload exactly.");
  return {
    ...identity,
    scope,
    instructions
  };
}
var decodeBusAccesses = (b, first, count, transfers = false, ppu = false) => {
  if (!transfers && b.length !== 64 + count * 64)
    throw new Error("Invalid bus record payload length.");
  const accesses = [];
  const actors = ["cpu", "dma", "hdma"];
  const phases = ["cpu", "dma", "hdma-table", "hdma-indirect", "hdma-transfer"];
  const contexts = ["unattributed", "instruction", "interrupt", "wait", "stop"];
  let lastCycle = 0n;
  let offset = 64;
  for (let i = 0; i < count; i++) {
    if (offset + 64 > b.length) throw new Error("Truncated bus/transfer record.");
    if (transfers && b.readUInt16LE(offset) === 3) {
      const marker = decodeTransfer(b, offset, first + BigInt(i));
      if (BigInt(marker.cycle) < lastCycle) throw new Error("Capture clock moved backwards.");
      lastCycle = BigInt(marker.cycle);
      accesses.push(marker);
      offset += 80;
      continue;
    }
    const extended = ppu && b.readUInt16LE(offset + 2) === 2;
    const length = extended ? 88 : 64;
    if (b.readUInt16LE(offset) !== 2 || b.readUInt16LE(offset + 2) !== (extended ? 2 : 1) || b.readUInt32LE(offset + 4) !== length || offset + length > b.length || b.readUInt32LE(offset + 16) !== 0 || b.readUInt32LE(offset + 20) !== 0 || b.readUInt16LE(offset + 62) !== 0)
      throw new Error("Unsupported required bus capture record.");
    const event = first + BigInt(i);
    const cycle = b.readBigUInt64LE(offset + 24);
    const ordinal = b.readBigUInt64LE(offset + 32);
    const address = b.readBigUInt64LE(offset + 40);
    const pc = b.readUInt32LE(offset + 48);
    const direction = b[offset + 53], actor = b[offset + 54], channel = b[offset + 55];
    const phase = b[offset + 56], context = b[offset + 57];
    const hcounter = b.readUInt16LE(offset + 58), vcounter = b.readUInt16LE(offset + 60);
    if (b.readBigUInt64LE(offset + 8) !== event || address > 0xffffffn || pc > 16777215)
      throw new Error("Bus identity disagrees with capture scope.");
    const expectedActor = phase === 0 ? 0 : 2;
    const phaseActor = phase === 1 ? 1 : expectedActor;
    if (direction > 1 || phase >= phases.length || actor !== phaseActor || (actor === 0 ? channel !== 255 : channel > 7) || (phase === 2 || phase === 3) && direction !== 0 || context >= contexts.length || ordinal !== 0n !== (context === 1) || hcounter >= 1368 || vcounter >= 313)
      throw new Error("Invalid bus attribution or timing fields.");
    if (cycle < lastCycle) throw new Error("Capture clock moved backwards.");
    lastCycle = cycle;
    const port = Number(address) & 65535;
    const dataPort = direction === 1 && !(Number(address) & 4194304) && [8452, 8472, 8473, 8482].includes(port);
    if (ppu && extended !== dataPort) throw new Error("Missing or misplaced PPU effect.");
    accesses.push({
      ...extended ? { ppu: decodePPUEffect(b, offset, port) } : {},
      sequence: String(event),
      ordinal: String(ordinal),
      cycle: String(cycle),
      address: Number(address),
      pc,
      value: b[offset + 52],
      direction: direction === 0 ? "read" : "write",
      actor: actors[actor],
      channel: actor === 0 ? null : channel,
      phase: phases[phase],
      context: contexts[context],
      hcounter,
      vcounter
    });
    offset += length;
  }
  if (offset !== b.length)
    throw new Error("Capture record count does not consume the payload exactly.");
  return accesses;
};
var decodeTransfer = (b, offset, event) => {
  if (offset + 80 > b.length || b.readUInt16LE(offset + 2) !== 1 || b.readUInt32LE(offset + 4) !== 80 || b.readUInt32LE(offset + 16) !== 0 || b.readUInt32LE(offset + 20) !== 0 || b.readUInt32LE(offset + 76) !== 0)
    throw new Error("Unsupported transfer capture record.");
  const sequence = b.readBigUInt64LE(offset + 8), ordinal = b.readBigUInt64LE(offset + 32), transferId = b.readBigUInt64LE(offset + 40), pc = b.readUInt32LE(offset + 48);
  const boundary = b[offset + 52], actor = b[offset + 53], channel = b[offset + 54], context = b[offset + 55];
  const hcounter = b.readUInt16LE(offset + 56), vcounter = b.readUInt16LE(offset + 58), transferred = b.readUInt32LE(offset + 72);
  const owned = ordinal !== 0n;
  if (sequence !== event || pc > 16777215 || boundary > 2 || actor !== 1 && actor !== 2 || channel > 7 || context > 4 || owned !== (context === 1) || hcounter >= 1368 || vcounter >= 313 || b[offset + 71] > 15 || boundary === 0 && (transferId !== event || transferred !== 0) || boundary !== 0 && (transferId >= event || transferred < 1 || transferred > 65536) || actor === 2 && (boundary === 2 || transferred > 4))
    throw new Error("Invalid transfer boundary identity, attribution or counters.");
  return {
    kind: "transfer",
    sequence: String(sequence),
    ordinal: String(ordinal),
    cycle: String(b.readBigUInt64LE(offset + 24)),
    transferId: String(transferId),
    pc,
    boundary: ["begin", "complete", "interrupted"][boundary],
    actor: actor === 1 ? "dma" : "hdma",
    channel,
    context: ["unattributed", "instruction", "interrupt", "wait", "stop"][context],
    hcounter,
    vcounter,
    transferred,
    configuration: {
      dmap: b[offset + 60],
      bbad: b[offset + 61],
      a1t: b.readUInt16LE(offset + 62),
      a1b: b[offset + 64],
      dasb: b[offset + 65],
      das: b.readUInt16LE(offset + 66),
      a2a: b.readUInt16LE(offset + 68),
      ntlr: b[offset + 70],
      flags: b[offset + 71]
    }
  };
};
var decodePPUEffect = (b, offset, port) => {
  const target = b[offset + 64], outcome = b[offset + 65], count = b[offset + 66], flags = b[offset + 67];
  const hcounter = b.readUInt16LE(offset + 68), vcounter = b.readUInt16LE(offset + 70);
  let expectedTarget = 1;
  if (port === 8482) expectedTarget = 2;
  if (port === 8452) expectedTarget = 3;
  if (target !== expectedTarget || outcome > 2 || count > 2 || flags > 15 || (flags & 3) === 3 || target !== 1 && flags & 8 || hcounter >= 1368 || vcounter >= 313 || b.readUInt32LE(offset + 82) !== 0 || b.readUInt16LE(offset + 86) !== 0)
    throw new Error("Invalid PPU effect identity, flags or raster.");
  if (outcome === 0 && (count === 0 || target === 1 && count !== 1 || target === 2 && count !== 2) || outcome !== 0 && count !== 0 || outcome === 1 && (target !== 1 || !(flags & 2)) || outcome === 2 && (target === 1 || flags & 2))
    throw new Error("Invalid PPU effect outcome or byte count.");
  const bytes = [];
  const vramBytes = flags & 8 ? 131072 : 65536;
  for (let i = 0; i < 2; i++) {
    const address = b.readUInt32LE(offset + 72 + i * 4), value = b[offset + 80 + i];
    if (i >= count) {
      if (address || value) throw new Error("Nonzero unused PPU effect slot.");
      continue;
    }
    let bound = vramBytes;
    if (target === 2) bound = 512;
    if (target === 3) bound = 544;
    if (address >= bound || target === 1 && ((address & 1) !== (port & 1) || value !== b[offset + 52]) || target === 2 && (i === 0 ? (address & 1) !== 0 : address !== bytes[0].address + 1 || value !== (b[offset + 52] & 127)) || target === 3 && i === count - 1 && value !== b[offset + 52])
      throw new Error("Invalid PPU physical byte address or value.");
    bytes.push({ address, value });
  }
  return {
    target: ["vram", "cgram", "oam"][target - 1],
    outcome: ["written", "blocked", "latched"][outcome],
    forcedBlank: Boolean(flags & 1),
    renderingRestricted: Boolean(flags & 2),
    implementation: flags & 4 ? "accurate" : "performance",
    vramBytes: target === 1 ? vramBytes : null,
    bytes,
    hcounter,
    vcounter
  };
};

// packages/debug-adapter/src/capture-file.ts
var import_promises = require("node:fs/promises");
var import_promises2 = require("node:timers/promises");

// packages/debug-adapter/src/capture-file-reader.ts
var CaptureFrameReader = class {
  #read;
  #windowBytes;
  #buffer = Buffer.alloc(0);
  #start = 0;
  #valid = 0;
  /** Window bytes are in [1, 1048576], default 1 MiB; every component must fit.
   * The cap amortizes small metadata reads without loading an entire archive.
   */
  constructor(read, windowBytes = 1048576) {
    if (!Number.isSafeInteger(windowBytes) || windowBytes < 1 || windowBytes > 1048576)
      throw new Error("Invalid capture read-ahead window.");
    this.#read = read;
    this.#windowBytes = windowBytes;
  }
  /** Read one validated component (at most 256 KiB), bounded by a snapshot or
   * durable watermark. Short I/O is retried; premature EOF is always an error.
   * @param {number} length Component bytes, no larger than the read window.
   * @param {number} offset Absolute nonnegative file position.
   * @param {number} limit Exclusive snapshot/durable byte boundary.
   * @returns {Promise<Buffer>} Owned component bytes, valid across subsequent refills.
   */
  async read(length, offset, limit) {
    if (!Number.isSafeInteger(length) || length < 0 || length > Math.min(262144, this.#windowBytes) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || offset + length > limit)
      throw new Error("Torn capture frame or invalid component length.");
    const relative = offset - this.#start;
    let available = 0;
    if (relative >= 0 && relative <= this.#valid)
      available = Math.min(this.#valid - relative, limit - offset);
    if (available >= length) return Buffer.from(this.#buffer.subarray(relative, relative + length));
    const nextLength = Math.min(this.#windowBytes, limit - offset);
    const next = this.#buffer.length >= nextLength ? this.#buffer : Buffer.allocUnsafe(nextLength);
    if (available) this.#buffer.copy(next, 0, relative, relative + available);
    this.#buffer = next;
    this.#valid = 0;
    let got = available;
    while (got < nextLength) {
      const { bytesRead } = await this.#read(this.#buffer, got, nextLength - got, offset + got);
      if (!bytesRead) throw new Error("Torn capture frame.");
      got += bytesRead;
    }
    this.#start = offset;
    this.#valid = got;
    return Buffer.from(this.#buffer.subarray(0, length));
  }
};

// packages/debug-adapter/src/capture-file.ts
var metadataValid = (m) => {
  if (m.architecture !== "snes.65816" || m.addressSpace !== "snes.cpu" || !/^[\da-f]{64}$/.test(m.romContentSha256) || !m.producer?.id || !m.producer.revision)
    throw new Error("Capture requires 65816 CPU scope and exact ROM/producer identity.");
};
var checkCaptureSize = (size, options) => {
  const limit = options.maxBytes ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error("Capture maximum bytes must be a positive safe integer.");
  if (size > limit)
    throw new Error(
      "Capture exceeds the import byte limit; increase asm.trace.maxImportSizeMiB to import it."
    );
};
var validateCaptureFileHeader = (value) => {
  if (!value || typeof value !== "object") throw new Error("Missing capture session header.");
  const header = value;
  metadataValid(header);
  captureSession(header.session);
  captureScope(header.scope);
  if (header.clock?.id !== "snes.master" || !captureU64(header.clock.numerator) || !captureU64(header.clock.denominator))
    throw new Error("Invalid session clock domain.");
  if (header.format !== "uttori-ares-capture" || header.version !== 2 || header.ownership !== "durable-prefix" || header.compression !== "none" || header.checksum !== "crc32c" || header.maxChunkBytes !== 262144 || !Number.isSafeInteger(header.allocatedBytes) || header.allocatedBytes < 4718656 || header.allocatedBytes > 64 * 1024 * 1024)
    throw new Error("Unsupported capture session contract.");
  return header;
};
var readCaptureBytes = async (handle, length, offset) => {
  const bytes = Buffer.allocUnsafe(length);
  let got = 0;
  while (got < length) {
    const result = await handle.read(bytes, got, length - got, offset + got);
    if (!result.bytesRead) throw new Error("Torn capture frame.");
    got += result.bytesRead;
  }
  return bytes;
};
var NativeCaptureFileCursor = class _NativeCaptureFileCursor {
  header;
  #handle;
  #options;
  #identity;
  #offset;
  #chunk = 0n;
  #event = 0n;
  #cycle = 0n;
  #watermark = 0;
  #failed = false;
  #complete = false;
  constructor(handle, header, offset, identity, options) {
    this.#handle = handle;
    this.header = header;
    this.#offset = offset;
    this.#identity = identity;
    this.#options = options;
  }
  /** Open a prepared native partial file, or a completed archive for replay tests.
   * @param {string} file Native-owned append-only file path.
   * @param {CaptureFileReadOptions} options Byte budget and cancellation.
   * @returns {Promise<NativeCaptureFileCursor>} Cursor pinning the checksummed session header and inode.
   */
  static async open(file, options = {}) {
    options.signal?.throwIfAborted();
    const handle = await (0, import_promises.open)(file, "r");
    try {
      const identity = await handle.stat();
      const prefix = await readCaptureBytes(handle, 12, 0);
      const length = prefix.readUInt32LE(4);
      if (prefix.toString("ascii", 0, 4) !== "ACS2" || length > 65536)
        throw new Error("Invalid native capture header.");
      checkCaptureSize(12 + length, options);
      const body = await readCaptureBytes(handle, length, 12);
      if (captureCrc32c(body) !== prefix.readUInt32LE(8))
        throw new Error("Capture metadata checksum mismatch.");
      const header = validateCaptureFileHeader(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body))
      );
      return new _NativeCaptureFileCursor(handle, header, 12 + length, identity, options);
    } catch (error) {
      await handle.close();
      throw error;
    }
  }
  /** Byte offset includes only the header and consumed, checkpointed chunks.
   * @returns {number} Consumed file bytes, for bounded backlog accounting.
   */
  get readBytes() {
    return this.#offset;
  }
  get observedEvents() {
    return String(this.#event);
  }
  get complete() {
    return this.#complete;
  }
  /** Read at most maxChunks (default 16) from a validated native status. Growth beyond
   * that durable watermark is ignored even if an unsynced ACK2 is already visible.
   * A failure permanently poisons the cursor; callers must discard staged facts.
   * @param {NativeCaptureFilePosition} value Native producer's latest durable watermark.
   * @param {Function} accept Provisional synchronous chunk consumer; exceptions poison this cursor.
   * @param {number} maxChunks Maximum chunks per slice, in [1, 256].
   * @param {string} publishedFile Final path whose inode must agree before completion.
   * @returns {Promise<void>} Settlement of one bounded read slice.
   */
  async readThrough(value, accept, maxChunks = 16, publishedFile) {
    if (this.#failed) throw new Error("Native capture cursor failed previously.");
    try {
      this.#options.signal?.throwIfAborted();
      const position = nativePosition(value, this.header.session, this.header.scope);
      const bytes = Number(captureU64(position.fileBytes));
      if (!Number.isSafeInteger(bytes) || bytes < this.#watermark || bytes < this.#offset || !Number.isSafeInteger(maxChunks) || maxChunks < 1 || maxChunks > 256)
        throw new Error("Native capture watermark or chunk budget is invalid.");
      checkCaptureSize(bytes, this.#options);
      if (position.fileState === "incomplete") throw new Error("Native capture was interrupted.");
      if (this.#complete) {
        if (bytes !== this.#watermark || position.fileState !== "complete")
          throw new Error("Completed native capture changed.");
        return;
      }
      this.#watermark = bytes;
      const before = await this.#handle.stat();
      if (before.size < bytes)
        throw new Error("Native capture is shorter than its durable watermark.");
      const reader = new CaptureFrameReader(
        (buffer, start, length, offset) => {
          this.#options.signal?.throwIfAborted();
          return this.#handle.read(buffer, start, length, offset);
        },
        Math.min(1048576, maxChunks * 262144)
      );
      const read = async (length) => {
        this.#options.signal?.throwIfAborted();
        if (this.#offset + length > bytes)
          throw new Error("Native durable watermark splits a frame.");
        const result = await reader.read(length, this.#offset, bytes);
        this.#offset += length;
        return result;
      };
      const json = async (prefix) => {
        const length = prefix.readUInt32LE(4);
        if (length > 65536) throw new Error("Capture metadata exceeds bounds.");
        const body = await read(length);
        if (captureCrc32c(body) !== prefix.readUInt32LE(8))
          throw new Error("Capture metadata checksum mismatch.");
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
      };
      for (let count = 0; this.#offset < bytes && count < maxChunks; count++) {
        const prefix = await read(12);
        const magic = prefix.toString("ascii", 0, 4);
        if (magic === "END2") {
          const terminal = validateCapturePosition(
            await json(prefix),
            this.header.session,
            this.header.scope
          );
          if (terminal.state !== "complete" || position.fileState !== "complete" || captureU64(terminal.producedThrough) !== this.#event || captureU64(terminal.producedChunks) !== this.#chunk || position.producedThrough !== terminal.producedThrough || position.producedChunks !== terminal.producedChunks || this.#offset !== bytes)
            throw new Error("Native capture terminal disagrees with the consumed prefix.");
          const after = await this.#handle.stat();
          if (after.size !== bytes || before.size !== after.size || before.mtimeMs !== after.mtimeMs)
            throw new Error("Native capture changed during final validation.");
          if (publishedFile) {
            const published = await (0, import_promises.lstat)(publishedFile);
            if (!published.isFile() || published.dev !== this.#identity.dev || published.ino !== this.#identity.ino)
              throw new Error("Native capture publication replaced the opened file.");
          }
          this.#complete = true;
          break;
        }
        if (magic !== "ACT2") throw new Error("Native capture expected an ACT2 chunk.");
        const envelope = Buffer.concat([prefix, await read(52)]);
        const length = envelope.readUInt32LE(48);
        if (length > 262144 - 64) throw new Error("Capture chunk exceeds its bound.");
        const chunk = decodeCaptureChunk(
          Buffer.concat([envelope, await read(length)]),
          this.header.session,
          this.header.scope
        );
        const records = captureChunkRecords(chunk);
        if (captureU64(chunk.sequence) !== this.#chunk + 1n || captureU64(chunk.first) !== this.#event + 1n || captureU64(records[0].cycle) < this.#cycle || captureU64(chunk.through) > captureU64(position.durableThrough))
          throw new Error("Noncontiguous native capture history.");
        const ackPrefix = await read(12);
        if (ackPrefix.toString("ascii", 0, 4) !== "ACK2")
          throw new Error("Native capture chunk has no checkpoint.");
        const ack = await json(ackPrefix);
        if (ack.session !== this.header.session || ack.chunkThrough !== chunk.sequence || ack.eventThrough !== chunk.through)
          throw new Error("Native checkpoint disagrees with its chunk.");
        accept(chunk);
        this.#chunk = captureU64(chunk.sequence);
        this.#event = captureU64(chunk.through);
        this.#cycle = captureU64(records.at(-1).cycle);
        await (0, import_promises2.setImmediate)(void 0, { signal: this.#options.signal });
      }
      if (this.#offset === bytes && !this.#complete && position.fileState === "complete")
        throw new Error("Completed native capture has no terminal frame.");
      this.#options.onProgress?.(this.#offset, bytes);
    } catch (error) {
      this.#failed = true;
      throw error;
    }
  }
  /** Close the pinned inode; pending analysis remains caller-owned and provisional. */
  async close() {
    await this.#handle.close();
  }
};
var nativePosition = (value, session, scope) => {
  const position = validateCapturePosition(value, session, scope);
  if (!["preparing", "writing", "complete", "incomplete"].includes(position.fileState))
    throw new Error("Invalid native file state.");
  captureU64(position.fileBytes);
  captureU64(position.fileBatches);
  if (position.fileProfile) {
    for (const field of ["sealNs", "copyNs", "writeNs", "syncNs"])
      captureU64(position.fileProfile[field]);
  }
  if (position.state === "complete" !== (position.fileState === "complete"))
    throw new Error("Native file publication and producer completion disagree.");
  return position;
};

// packages/disassembler/src/canonical-json.ts
var canonicalValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value !== null && typeof value === "object") {
    const input = value;
    const result = {};
    for (const key2 of Object.keys(input).sort((a, b) => a.localeCompare(b))) {
      const entry = input[key2];
      if (entry === void 0) {
        continue;
      }
      const normalized = canonicalValue(entry);
      if (key2 === "__proto__") {
        Object.defineProperty(result, key2, {
          value: normalized,
          enumerable: true,
          writable: true,
          configurable: true
        });
      } else {
        result[key2] = normalized;
      }
    }
    return result;
  }
  return value;
};
var canonicalJson = (value) => `${JSON.stringify(canonicalValue(value), void 0, 2)}
`;

// packages/disassembler/src/sqlite-store.ts
var import_node_crypto3 = require("node:crypto");
var import_node_fs4 = __toESM(require("node:fs"), 1);
var import_node_path4 = __toESM(require("node:path"), 1);
var import_node_sqlite2 = require("node:sqlite");

// packages/disassembler/src/analysis-sources.ts
var sorted = (values) => [...new Set(values)].sort();
var key = (...values) => JSON.stringify(values);
var buildAnalysisSourceCatalog = (shards, importTimes = /* @__PURE__ */ new Map()) => {
  const sources = /* @__PURE__ */ new Map();
  const ensure = (id, name, format, sha256) => {
    let source = sources.get(id);
    if (!source) {
      source = {
        id,
        names: /* @__PURE__ */ new Set(),
        kinds: /* @__PURE__ */ new Set(),
        format,
        sha256,
        evidenceIds: [],
        reports: []
      };
      sources.set(id, source);
    }
    source.names.add(name);
    return source;
  };
  const reportSources = /* @__PURE__ */ new Map();
  for (const report of shards.imports) {
    const id = key("artifact", report.format, report.sourceSha256);
    ensure(id, report.sourceName, report.format, report.sourceSha256).reports.push(report);
    reportSources.set(report.id, id);
  }
  for (const evidence of shards.evidence) {
    const artifact = evidence.artifact;
    const legacy = !artifact ? shards.imports.filter(
      (report) => report.id === evidence.id || report.sourceSha256 === evidence.sourceId
    ) : [];
    let id = key("producer", evidence.source, evidence.sourceId);
    if (artifact) {
      id = key("artifact", artifact.format, artifact.sha256);
    } else if (legacy.length === 1) {
      id = reportSources.get(legacy[0].id);
    }
    const source = sources.get(id) ?? ensure(id, evidence.sourceId, artifact?.format, artifact?.sha256);
    source.kinds.add(evidence.source);
    source.evidenceIds.push(evidence.id);
  }
  return [...sources.values()].map((source) => ({
    ...source,
    ...source.sha256 && importTimes.has(source.sha256) ? { lastImportedAt: importTimes.get(source.sha256) } : {},
    names: sorted(source.names),
    name: sorted(source.names).join(" / "),
    kinds: [...source.kinds].sort(),
    evidenceIds: sorted(source.evidenceIds),
    reports: source.reports.sort((a, b) => a.id.localeCompare(b.id))
  })).sort(
    (a, b) => (b.lastImportedAt ?? -1) - (a.lastImportedAt ?? -1) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  );
};

// packages/disassembler/src/project-store.ts
var fs2 = __toESM(require("node:fs"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);

// packages/disassembler/src/project-transaction.ts
var import_node_crypto = require("node:crypto");

// packages/disassembler/src/project-types.ts
var ANALYSIS_PROJECT_FORMAT = "uttori-asm-analysis";
var ANALYSIS_PROJECT_SCHEMA_VERSION = 3;
var ANALYSIS_PROJECT_MANIFEST = "analysis.json";

// packages/disassembler/src/record-id-set.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_sqlite = require("node:sqlite");
var RecordIdSet = class {
  #ids = /* @__PURE__ */ new Set();
  #characters = 0;
  #directory;
  #database;
  #insert;
  /**
   * Claim an ID while keeping the in-memory prefix small.
   * @param {string} id Complete record identity.
   * @returns {boolean} False only for an exact duplicate.
   */
  add(id) {
    if (this.#insert) {
      return this.#insert.run(id).changes !== 0;
    }
    if (this.#ids.has(id)) {
      return false;
    }
    this.#ids.add(id);
    this.#characters += id.length;
    if (this.#characters > 4 * 1024 * 1024) {
      this.#spill();
    }
    return true;
  }
  #spill() {
    this.#directory = import_node_fs.default.mkdtempSync(import_node_path.default.join(import_node_os.default.tmpdir(), "uttori-record-ids-"));
    try {
      this.#database = new import_node_sqlite.DatabaseSync(import_node_path.default.join(this.#directory, "ids.sqlite"));
      this.#database.exec(
        "PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA cache_size=-4096; CREATE TABLE ids (id TEXT PRIMARY KEY) WITHOUT ROWID; BEGIN;"
      );
      this.#insert = this.#database.prepare("INSERT OR IGNORE INTO ids VALUES (?)");
      for (const id of this.#ids) {
        this.#insert.run(id);
      }
      this.#ids.clear();
    } catch (error) {
      this.close();
      throw error;
    }
  }
  /** Release both memory and any disposable database, including after a failed validation. */
  close() {
    try {
      this.#database?.close();
    } finally {
      this.#database = void 0;
      this.#insert = void 0;
      this.#ids.clear();
      if (this.#directory) {
        import_node_fs.default.rmSync(this.#directory, { recursive: true, force: true });
      }
      this.#directory = void 0;
    }
  }
};

// packages/disassembler/src/runtime-ppu.ts
var normalizeRuntimePPUEffect = (effect, access) => {
  const port = access.address & 65535;
  let target = "vram";
  if (port === 8452) {
    target = "oam";
  }
  if (port === 8482) {
    target = "cgram";
  }
  if (!effect || access.direction !== "write" || access.address & 4194304 || ![8452, 8472, 8473, 8482].includes(port) || effect.target !== target || !["written", "blocked", "latched"].includes(effect.outcome) || typeof effect.forcedBlank !== "boolean" || typeof effect.renderingRestricted !== "boolean" || effect.forcedBlank && effect.renderingRestricted || !["accurate", "performance"].includes(effect.implementation) || (target === "vram" ? ![65536, 131072].includes(effect.vramBytes ?? 0) : effect.vramBytes !== null) || !Array.isArray(effect.bytes) || effect.bytes.length > 2) {
    throw new Error("Invalid native PPU effect identity or flags.");
  }
  const count = effect.bytes.length;
  if (effect.outcome === "written" && (count === 0 || target === "vram" && count !== 1 || target === "cgram" && count !== 2) || effect.outcome !== "written" && count !== 0 || effect.outcome === "blocked" && (target !== "vram" || !effect.renderingRestricted) || effect.outcome === "latched" && (target === "vram" || effect.renderingRestricted)) {
    throw new Error("Invalid native PPU outcome or write count.");
  }
  let bound = effect.vramBytes ?? 0;
  if (target === "cgram") {
    bound = 512;
  }
  if (target === "oam") {
    bound = 544;
  }
  const bytes = effect.bytes.map((byte, i) => {
    if (!byte || !Number.isInteger(byte.address) || byte.address < 0 || byte.address >= bound || !Number.isInteger(byte.value) || byte.value < 0 || byte.value > 255 || target === "vram" && ((byte.address & 1) !== (port & 1) || byte.value !== access.value) || target === "cgram" && (i === 0 ? (byte.address & 1) !== 0 : byte.address !== effect.bytes[0].address + 1 || byte.value !== (access.value & 127)) || target === "oam" && i === count - 1 && byte.value !== access.value) {
      throw new Error("Invalid native PPU byte destination or value.");
    }
    return { address: byte.address, value: byte.value };
  });
  return {
    target: effect.target,
    outcome: effect.outcome,
    forcedBlank: effect.forcedBlank,
    renderingRestricted: effect.renderingRestricted,
    implementation: effect.implementation,
    vramBytes: effect.vramBytes,
    bytes
  };
};
var createRuntimePPUAccumulator = () => {
  let portWrites = 0, written = 0, blocked = 0, latched = 0, byteWrites = 0, renderingRestricted = 0;
  const writes = [];
  return {
    push: (access) => {
      if (!access.ppu) {
        return;
      }
      const effect = access.ppu;
      portWrites++;
      if (effect.outcome === "written") {
        written++;
      }
      if (effect.outcome === "blocked") {
        blocked++;
      }
      if (effect.outcome === "latched") {
        latched++;
      }
      if (!Number.isSafeInteger(byteWrites + effect.bytes.length)) {
        throw new Error("PPU byte count exceeds safe integer range.");
      }
      byteWrites += effect.bytes.length;
      if (effect.renderingRestricted) {
        renderingRestricted++;
      }
      if (writes.length < 64) {
        writes.push({
          sequence: access.sequence,
          actor: access.actor,
          channel: access.channel,
          port: access.address & 65535,
          ppu: {
            ...normalizeRuntimePPUEffect(effect, access),
            hcounter: effect.hcounter,
            vcounter: effect.vcounter
          }
        });
      }
    },
    finish: () => ({
      portWrites,
      written,
      blocked,
      latched,
      byteWrites,
      renderingRestricted,
      omittedWrites: portWrites - writes.length,
      writes
    })
  };
};

// packages/disassembler/src/runtime-bus-types.ts
var validateRuntimeBusFact = (fact) => {
  if (fact.addressSpace !== "snes.cpu" || !Number.isInteger(fact.address) || fact.address < 0 || fact.address > 16777215 || !Number.isInteger(fact.pc) || fact.pc < 0 || fact.pc > 16777215 || !Number.isInteger(fact.value) || fact.value < 0 || fact.value > 255 || !["read", "write"].includes(fact.direction) || !["unattributed", "instruction", "interrupt", "wait", "stop"].includes(fact.context)) {
    throw new Error("Invalid bus access coordinates, value, direction or context.");
  }
  if (fact.actor === "cpu") {
    if (fact.channel !== null || fact.phase !== "cpu") {
      throw new Error("CPU bus accesses require a null channel and CPU phase.");
    }
  } else {
    if (!Number.isInteger(fact.channel) || fact.channel === null || fact.channel < 0 || fact.channel > 7) {
      throw new Error("DMA/HDMA bus accesses require a channel in [0, 7].");
    }
    if (fact.actor === "dma") {
      if (fact.phase !== "dma") {
        throw new Error("DMA bus access has an invalid phase.");
      }
    } else if (fact.actor === "hdma") {
      if (!["hdma-table", "hdma-indirect", "hdma-transfer"].includes(fact.phase)) {
        throw new Error("HDMA bus access has an invalid phase.");
      }
      if (fact.phase !== "hdma-transfer" && fact.direction !== "read") {
        throw new Error("HDMA table and indirect phases must be reads.");
      }
    } else {
      throw new Error("Unknown bus access actor.");
    }
  }
  if (fact.ppu !== void 0) {
    return normalizeRuntimePPUEffect(fact.ppu, fact);
  }
  return void 0;
};

// packages/disassembler/src/trace-detail.ts
var isArray = (value) => Array.isArray(value);
var validateRuntimeInstructionDetails = (value, count) => {
  if (!Array.isArray(value) || value.length !== count) {
    throw new Error("Trace details must align one-to-one with instruction addresses.");
  }
  return value.map((detail) => {
    if (!detail || !isArray(detail.bytes) || detail.bytes.length < 1 || detail.bytes.length > 16 || detail.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
      throw new Error("Trace instruction bytes must contain 1\u201316 byte values.");
    }
    if (!detail.state || typeof detail.state !== "object" || isArray(detail.state) || Object.entries(detail.state).some(
      ([key2, entry]) => !key2 || !["number", "string", "boolean"].includes(typeof entry) || typeof entry === "number" && !Number.isFinite(entry)
    )) {
      throw new Error("Trace instruction state contains an invalid register value.");
    }
    if (detail.droppedMemoryAccesses !== void 0 && (!Number.isSafeInteger(detail.droppedMemoryAccesses) || detail.droppedMemoryAccesses < 0)) {
      throw new Error("Trace memory loss must be a non-negative safe integer.");
    }
    if (detail.memoryAccesses !== void 0 && (!isArray(detail.memoryAccesses) || detail.memoryAccesses.length > 256)) {
      throw new Error("Trace instruction memory accesses exceed the 256-operation bound.");
    }
    const memoryAccesses = detail.memoryAccesses?.map((access) => {
      if (!access || typeof access.addressSpace !== "string" || !access.addressSpace || !Number.isSafeInteger(access.address) || access.address < 0 || !["read", "write", "fetch"].includes(access.access) || !Number.isSafeInteger(access.width) || access.width < 1 || access.width > 8 || access.value !== void 0 && (!Number.isSafeInteger(access.value) || access.value < 0) || access.actor !== void 0 && !["cpu", "dma", "hdma"].includes(access.actor) || access.channel !== void 0 && (!Number.isInteger(access.channel) || access.channel < 0 || access.channel > 7 || !["dma", "hdma"].includes(access.actor ?? "cpu"))) {
        throw new Error("Trace contains an invalid bus operation.");
      }
      return { ...access };
    });
    return {
      bytes: [...detail.bytes],
      state: { ...detail.state },
      ...memoryAccesses === void 0 ? {} : { memoryAccesses },
      ...detail.droppedMemoryAccesses === void 0 ? {} : { droppedMemoryAccesses: detail.droppedMemoryAccesses }
    };
  });
};

// packages/disassembler/src/project-validation.ts
var validateAnalysisProjectManifest = (manifest) => {
  if (manifest.format !== ANALYSIS_PROJECT_FORMAT) {
    throw new Error(`Unsupported analysis project format '${String(manifest.format)}'.`);
  }
  if (manifest.schemaVersion !== ANALYSIS_PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported analysis project schema version ${String(manifest.schemaVersion)}.`
    );
  }
  if (!/^[\da-f]{64}$/.test(manifest.rom.sha256)) {
    throw new Error("Invalid ROM SHA-256.");
  }
  if (!/^[\da-f]{64}$/.test(manifest.rom.contentSha256)) {
    throw new Error("Invalid ROM content SHA-256.");
  }
  const addressSpaceIds = /* @__PURE__ */ new Set();
  for (const addressSpace of manifest.addressSpaces) {
    if (addressSpace.id === "" || addressSpace.name === "") {
      throw new Error("Analysis address spaces require non-empty ids and names.");
    }
    if (addressSpaceIds.has(addressSpace.id)) {
      throw new Error(`Duplicate analysis address-space id '${addressSpace.id}'.`);
    }
    if (!Number.isSafeInteger(addressSpace.addressBits) || addressSpace.addressBits <= 0 || addressSpace.addressBits > 53) {
      throw new Error(`Analysis address space '${addressSpace.id}' has invalid address bits.`);
    }
    addressSpaceIds.add(addressSpace.id);
  }
  if (manifest.db !== void 0 && manifest.db !== "analysis.sqlite") {
    throw new Error(`Unsupported analysis sqlite path '${manifest.db}'.`);
  }
  if (manifest.revision !== void 0 && (!Number.isSafeInteger(manifest.revision) || manifest.revision < 0)) {
    throw new Error("Invalid analysis sqlite revision.");
  }
  if (manifest.shards.length !== 0) {
    throw new Error("Legacy analysis shards are no longer supported; use a SQLite project.");
  }
};
var FORBIDDEN_ROM_PAYLOAD_KEYS = /* @__PURE__ */ new Set(["romBytes", "fileBytes", "contentBytes", "byteData"]);
var assertNoRomPayload = (value, location) => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      assertNoRomPayload(value[index], `${location}[${index}]`);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key2, entry] of Object.entries(value)) {
    if (FORBIDDEN_ROM_PAYLOAD_KEYS.has(key2)) {
      throw new Error(`ROM byte payload '${location}.${key2}' is forbidden in analysis projects.`);
    }
    assertNoRomPayload(entry, `${location}.${key2}`);
  }
};
var isStableId = (id) => {
  const isAlphaNumeric = (character) => {
    const code = character.charCodeAt(0);
    return code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122;
  };
  if (id.length === 0 || !isAlphaNumeric(id[0]) || !isAlphaNumeric(id.at(-1))) {
    return false;
  }
  for (let index = 0; index < id.length; index++) {
    const character = id[index];
    if (!isAlphaNumeric(character) && !"._:/-".includes(character)) {
      return false;
    }
  }
  return true;
};
var assertCodecReference = (reference, location) => {
  if (typeof reference.codecId !== "string" || !isStableId(reference.codecId)) {
    throw new Error(`${location} has an invalid codec id.`);
  }
  if (typeof reference.codecVersion !== "string" || reference.codecVersion.trim() === "") {
    throw new Error(`${location} has no codec version.`);
  }
  if (reference.provider) {
    if (typeof reference.provider.pluginId !== "string" || !isStableId(reference.provider.pluginId)) {
      throw new Error(`${location} has an invalid provider plugin id.`);
    }
    if (typeof reference.provider.pluginVersion !== "string" || reference.provider.pluginVersion.trim() === "") {
      throw new Error(`${location} has no provider plugin version.`);
    }
  }
  const visitJson = (value, current) => {
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visitJson(entry, `${current}[${index}]`));
      return;
    }
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
      Object.entries(value).forEach(([key2, entry]) => visitJson(entry, `${current}.${key2}`));
      return;
    }
    throw new Error(`${current} is not a JSON-safe codec option.`);
  };
  if (reference.options !== void 0) {
    visitJson(reference.options, `${location} options`);
  }
};
var createRuntimeRecordValidator = (project, evidence, checkDuplicateIds = true) => {
  const ids = checkDuplicateIds ? new RecordIdSet() : void 0;
  const evidenceIds = new Set(evidence.map((record) => record.id));
  const addressSpaceById = new Map(project.addressSpaces.map((space) => [space.id, space]));
  const validate = (record) => {
    if (!record || typeof record.id !== "string" || record.id === "") {
      throw new Error("Analysis shard 'runtime' contains a record without an id.");
    }
    if (ids && !ids.add(record.id)) {
      throw new Error(`Analysis shard 'runtime' contains duplicate id '${record.id}'.`);
    }
    for (const id of record.evidence ?? []) {
      if (!evidenceIds.has(id)) {
        throw new Error(`Analysis record '${record.id}' refers to missing evidence '${id}'.`);
      }
    }
    if (!Number.isSafeInteger(record.count) || record.count <= 0) {
      throw new Error(`Runtime record '${record.id}' has an invalid observation count.`);
    }
    if (record.kind === "runtime-coverage") {
      if (!Number.isSafeInteger(record.start) || !Number.isSafeInteger(record.end) || record.start < 0 || record.end <= record.start) {
        throw new Error(`Runtime coverage '${record.id}' has an invalid half-open range.`);
      }
    }
    if (record.kind === "runtime-bus-access") {
      if (record.architecture !== "snes.65816") {
        throw new Error("Bus facts require the SNES 65816 architecture.");
      }
      validateRuntimeBusFact(record);
    }
    if (record.kind === "runtime-memory-access") {
      if (record.actor !== void 0 && !["cpu", "dma", "hdma"].includes(record.actor) || record.channel !== void 0 && (!Number.isInteger(record.channel) || record.channel < 0 || record.channel > 7 || !["dma", "hdma"].includes(record.actor ?? "cpu"))) {
        throw new Error(`Runtime memory access '${record.id}' has an invalid actor/channel.`);
      }
      if (!Number.isSafeInteger(record.width) || record.width <= 0) {
        throw new Error(`Runtime memory access '${record.id}' has an invalid width.`);
      }
      if (record.value !== void 0 && (!Number.isSafeInteger(record.value) || record.value < 0)) {
        throw new Error(`Runtime memory access '${record.id}' has an invalid value.`);
      }
    }
    if (record.kind === "runtime-execution") {
      if (record.size !== void 0 && (!Number.isSafeInteger(record.size) || record.size <= 0)) {
        throw new Error(`Runtime execution '${record.id}' has an invalid instruction size.`);
      }
      if (record.opcode !== void 0 && (!Number.isInteger(record.opcode) || record.opcode < 0 || record.opcode > 255)) {
        throw new Error(`Runtime execution '${record.id}' has an invalid opcode.`);
      }
      if (record.fileOffset !== void 0 && (!Number.isSafeInteger(record.fileOffset) || record.fileOffset < 0 || record.fileOffset >= project.rom.contentSize)) {
        throw new Error(`Runtime execution '${record.id}' has an invalid ROM file offset.`);
      }
    }
    if (record.kind === "runtime-instruction") {
      validateRuntimeInstructionDetails([{ bytes: record.bytes, state: record.state }], 1);
    }
    if (record.kind === "runtime-cpu-state") {
      for (const [name, value] of Object.entries(record.state)) {
        if (name === "" || !["string", "boolean", "number"].includes(typeof value) || typeof value === "number" && !Number.isFinite(value)) {
          throw new Error(`Runtime CPU state '${record.id}' has invalid field '${name}'.`);
        }
      }
    }
    if ("addressSpace" in record) {
      const space = addressSpaceById.get(record.addressSpace);
      if (!space) {
        throw new Error(
          `Analysis record '${record.id}' refers to unknown address space '${record.addressSpace}'.`
        );
      }
      const addresses2 = record.kind === "runtime-coverage" ? [record.start, record.end - 1] : [record.address];
      if (addresses2.some(
        (address) => !Number.isSafeInteger(address) || address < 0 || address >= 2 ** space.addressBits
      )) {
        throw new Error(
          `Analysis record '${record.id}' exceeds address space '${record.addressSpace}'.`
        );
      }
    }
    let addresses = [];
    if (record.kind === "runtime-memory-access") {
      addresses = [
        [record.instructionAddressSpace, record.instructionAddress],
        [record.accessedAddressSpace, record.accessedAddress]
      ];
    } else if (record.kind === "runtime-bus-access") {
      addresses = [[record.addressSpace, record.pc]];
    } else if (record.kind === "runtime-control-target") {
      addresses = [
        [record.fromAddressSpace, record.fromAddress],
        [record.toAddressSpace, record.toAddress]
      ];
    }
    for (const [spaceId, address] of addresses) {
      const addressSpace = addressSpaceById.get(spaceId);
      if (!addressSpace) {
        throw new Error(
          `Runtime record '${record.id}' refers to unknown address space '${spaceId}'.`
        );
      }
      if (!Number.isSafeInteger(address) || address < 0 || address >= 2 ** addressSpace.addressBits) {
        throw new Error(`Runtime record '${record.id}' exceeds address space '${spaceId}'.`);
      }
    }
    assertNoRomPayload(record, `shards.runtime.${record.id}`);
  };
  return Object.assign(validate, { close: () => ids?.close() });
};
var validateRuntimeRecords = (records, project, evidence) => {
  const validate = createRuntimeRecordValidator(project, evidence);
  try {
    for (const record of records) {
      validate(record);
    }
  } finally {
    validate.close();
  }
};
var validateLoadedShards = (shards, project) => {
  const { addressSpaces } = project;
  const evidenceIds = new Set(shards.evidence.map((record) => record.id));
  for (const [kind, records] of Object.entries(shards)) {
    if (kind === "runtime") {
      continue;
    }
    const ids = /* @__PURE__ */ new Set();
    for (const record of records) {
      if (!record || typeof record.id !== "string" || record.id === "") {
        throw new Error(`Analysis shard '${kind}' contains a record without an id.`);
      }
      if (ids.has(record.id)) {
        throw new Error(`Analysis shard '${kind}' contains duplicate id '${record.id}'.`);
      }
      ids.add(record.id);
      for (const evidence of record.evidence ?? []) {
        if (!evidenceIds.has(evidence)) {
          throw new Error(
            `Analysis record '${record.id}' refers to missing evidence '${evidence}'.`
          );
        }
      }
    }
  }
  for (const evidence of shards.evidence) {
    if (!evidence.artifact) {
      continue;
    }
    if (evidence.artifact.format === "" || !/^[\da-f]{64}$/.test(evidence.artifact.sha256) || !/^[\da-f]{64}$/.test(evidence.artifact.romContentSha256)) {
      throw new Error(`Evidence '${evidence.id}' has an invalid artifact identity.`);
    }
    if (evidence.artifact.romContentSha256 !== project.rom.contentSha256) {
      throw new Error(`Evidence '${evidence.id}' belongs to a different ROM.`);
    }
    if (evidence.artifact.mapper && evidence.artifact.mapper !== project.mapping.mapper) {
      throw new Error(`Evidence '${evidence.id}' belongs to a different mapper.`);
    }
  }
  for (const interval of [...shards.annotations, ...shards.regions]) {
    if (!Number.isSafeInteger(interval.start) || !Number.isSafeInteger(interval.end) || interval.start < 0 || interval.end <= interval.start) {
      throw new Error(`Analysis interval '${interval.id}' has an invalid half-open range.`);
    }
  }
  for (const annotation of shards.annotations) {
    if (!annotation.asset) {
      continue;
    }
    if (!["asset", "compressed", "graphics", "music", "text"].includes(annotation.classification)) {
      throw new Error(
        `Analysis annotation '${annotation.id}' cannot attach an asset codec to '${annotation.classification}'.`
      );
    }
    assertCodecReference(annotation.asset, `Analysis annotation '${annotation.id}' asset codec`);
    const compression = annotation.asset.compression;
    if (!compression) {
      continue;
    }
    assertCodecReference(compression, `Analysis annotation '${annotation.id}' compression codec`);
    const rangeSize = annotation.end - annotation.start;
    const maximumSize = compression.maximumSize ?? rangeSize;
    if (!Number.isSafeInteger(maximumSize) || maximumSize <= 0 || maximumSize > rangeSize) {
      throw new Error(
        `Analysis annotation '${annotation.id}' compression maximumSize must be within its range.`
      );
    }
    const hasBankStart = compression.bankStart !== void 0;
    const hasBankEnd = compression.bankEnd !== void 0;
    if (hasBankStart !== hasBankEnd) {
      throw new Error(
        `Analysis annotation '${annotation.id}' compression bank bounds must be supplied together.`
      );
    }
    const bankStart = compression.bankStart;
    const bankEnd = compression.bankEnd;
    if (hasBankStart && (typeof bankStart !== "number" || typeof bankEnd !== "number" || !Number.isSafeInteger(bankStart) || !Number.isSafeInteger(bankEnd) || bankStart < 0 || bankEnd <= bankStart || annotation.start < bankStart || annotation.end > bankEnd)) {
      throw new Error(
        `Analysis annotation '${annotation.id}' has invalid compression bank bounds.`
      );
    }
    if (compression.fillByte !== void 0 && (!Number.isInteger(compression.fillByte) || compression.fillByte < 0 || compression.fillByte > 255)) {
      throw new Error(
        `Analysis annotation '${annotation.id}' has an invalid compression fillByte.`
      );
    }
  }
  for (const conflict of shards.analysis) {
    if (conflict.kind !== "conflict" || conflict.end === void 0) {
      continue;
    }
    if (!Number.isSafeInteger(conflict.end) || conflict.end <= conflict.address) {
      throw new Error(`Analysis conflict '${conflict.id}' has an invalid half-open range.`);
    }
  }
  const regionsById = new Map(shards.regions.map((region) => [region.id, region]));
  for (const region of shards.regions) {
    if (!region.parentRegion) {
      continue;
    }
    const parent = regionsById.get(region.parentRegion);
    if (!parent) {
      throw new Error(
        `Analysis region '${region.id}' refers to missing parent region '${region.parentRegion}'.`
      );
    }
    const visited = /* @__PURE__ */ new Set([region.id]);
    let ancestor = parent;
    while (ancestor.parentRegion) {
      if (visited.has(ancestor.id)) {
        throw new Error(`Analysis region '${region.id}' has a cyclic parent relationship.`);
      }
      visited.add(ancestor.id);
      const next = regionsById.get(ancestor.parentRegion);
      if (!next) {
        break;
      }
      ancestor = next;
    }
    if (visited.has(ancestor.id)) {
      throw new Error(`Analysis region '${region.id}' has a cyclic parent relationship.`);
    }
    if (parent.addressSpace === region.addressSpace && (region.start < parent.start || region.end > parent.end)) {
      throw new Error(
        `Analysis region '${region.id}' is not contained by parent region '${parent.id}'.`
      );
    }
  }
  for (const addressed of [...shards.labels, ...shards.comments]) {
    if (!Number.isSafeInteger(addressed.address) || addressed.address < 0) {
      throw new Error(`Analysis record '${addressed.id}' has an invalid address.`);
    }
  }
  for (const label of shards.labels) {
    if (label.sourceName !== void 0 && (typeof label.sourceName !== "string" || !/^[A-Z_a-z]\w*$/.test(label.sourceName))) {
      throw new Error(`Analysis label '${label.id}' has an invalid source name.`);
    }
    if (label.inlineComment !== void 0 && (typeof label.inlineComment !== "string" || /[\n\r\u2028\u2029]/.test(label.inlineComment))) {
      throw new Error(`Analysis label '${label.id}' requires a single-line inline comment.`);
    }
    if (label.analysisEntryPoint !== void 0 && typeof label.analysisEntryPoint !== "boolean") {
      throw new Error(`Analysis label '${label.id}' has an invalid analysisEntryPoint.`);
    }
  }
  for (const comment of shards.comments) {
    if (comment.placement !== void 0 && !["before", "inline-instruction"].includes(comment.placement)) {
      throw new Error(`Analysis comment '${comment.id}' has an invalid placement.`);
    }
    if (comment.placement === "inline-instruction" && (typeof comment.text !== "string" || /[\n\r\u2028\u2029]/.test(comment.text))) {
      throw new Error(`Analysis comment '${comment.id}' requires a single-line inline comment.`);
    }
  }
  const addressSpaceById = new Map(
    addressSpaces.map((addressSpace) => [addressSpace.id, addressSpace])
  );
  const addressedRecords = [
    ...shards.annotations,
    ...shards.labels,
    ...shards.comments,
    ...shards.regions,
    ...shards.analysis.filter(
      (record) => "addressSpace" in record
    )
  ];
  for (const record of addressedRecords) {
    const addressSpace = addressSpaceById.get(record.addressSpace);
    if (!addressSpace) {
      throw new Error(
        `Analysis record '${record.id}' refers to unknown address space '${record.addressSpace}'.`
      );
    }
    const maximum = 2 ** addressSpace.addressBits;
    const addresses = [];
    if ("start" in record) {
      addresses.push(record.start, record.end - 1);
    } else if ("address" in record) {
      addresses.push(record.address);
      if ("kind" in record && record.kind === "conflict" && record.end !== void 0) {
        addresses.push(record.end - 1);
      }
    } else {
      if ("fromAddress" in record) {
        addresses.push(record.fromAddress);
      }
      if ("toAddress" in record && record.toAddress !== void 0) {
        addresses.push(record.toAddress);
      }
      if ("targets" in record) {
        for (const target of record.targets) {
          addresses.push(target);
        }
      }
    }
    if (addresses.some(
      (address) => !Number.isSafeInteger(address) || address < 0 || address >= maximum
    )) {
      throw new Error(
        `Analysis record '${record.id}' exceeds address space '${record.addressSpace}'.`
      );
    }
  }
  validateRuntimeRecords(shards.runtime, project, shards.evidence);
  assertNoRomPayload({ ...shards, runtime: [] }, "shards");
};

// packages/disassembler/src/project-transaction.ts
var ANALYSIS_PROJECT_REVISION_FORMAT = "uttori-asm-analysis-revision";
var ANALYSIS_PROJECT_REVISION_VERSION = 1;
var AnalysisProjectStaleError = class extends Error {
  constructor(expected, actual) {
    super(
      `Analysis project changed since it was loaded (expected ${expected.manifestSha256}, found ${actual.manifestSha256}).`
    );
    this.expected = expected;
    this.actual = actual;
    this.name = "AnalysisProjectStaleError";
  }
  expected;
  actual;
};
var analysisProjectRevision = (manifest) => ({
  format: ANALYSIS_PROJECT_REVISION_FORMAT,
  version: ANALYSIS_PROJECT_REVISION_VERSION,
  manifestSha256: (0, import_node_crypto.createHash)("sha256").update(canonicalJson(manifest)).digest("hex")
});
var assertAnalysisProjectRevision = (store, expected) => {
  const actual = analysisProjectRevision(store.manifest());
  if (expected.manifestSha256 !== actual.manifestSha256) {
    throw new AnalysisProjectStaleError(expected, actual);
  }
};

// packages/disassembler/src/sqlite-payload.ts
var import_node_util = require("node:util");
var import_node_zlib = require("node:zlib");
var MAX_SQLITE_PAYLOAD_BYTES = 16 * 1024 * 1024;
var HEADER = Buffer.from([85, 65, 80, 1]);
var HEADER_BYTES = 8;
var utf8 = new import_node_util.TextDecoder("utf-8", { fatal: true });
var encodeSqlitePayload = (json) => {
  const bytes = Buffer.byteLength(json);
  if (bytes > MAX_SQLITE_PAYLOAD_BYTES) {
    throw new Error(`SQLite record exceeds the ${MAX_SQLITE_PAYLOAD_BYTES}-byte payload limit.`);
  }
  if (bytes < 256) {
    return json;
  }
  const compressed = (0, import_node_zlib.deflateSync)(json, { level: 1, chunkSize: Math.min(bytes, 16 * 1024) });
  if (compressed.length + HEADER_BYTES > bytes - Math.max(32, Math.ceil(bytes / 8))) {
    return json;
  }
  const result = Buffer.allocUnsafe(HEADER_BYTES + compressed.length);
  HEADER.copy(result);
  result.writeUInt32LE(bytes, 4);
  compressed.copy(result, HEADER_BYTES);
  return result;
};
var decodeSqlitePayload = (value) => {
  if (typeof value === "string") {
    if (Buffer.byteLength(value) > MAX_SQLITE_PAYLOAD_BYTES) {
      throw new Error("SQLite text payload exceeds the decoded size limit.");
    }
    return value;
  }
  if (!import_node_util.types.isUint8Array(value)) {
    throw new Error("Invalid SQLite payload representation.");
  }
  const encoded = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (encoded.length <= HEADER_BYTES || !encoded.subarray(0, 4).equals(HEADER)) {
    throw new Error("Unsupported or truncated SQLite payload codec.");
  }
  const bytes = encoded.readUInt32LE(4);
  if (bytes === 0 || bytes > MAX_SQLITE_PAYLOAD_BYTES) {
    throw new Error("SQLite compressed payload exceeds the decoded size limit.");
  }
  try {
    const decoded = (0, import_node_zlib.inflateSync)(encoded.subarray(HEADER_BYTES), {
      maxOutputLength: bytes,
      chunkSize: Math.max(64, Math.min(bytes, 16 * 1024))
    });
    if (decoded.length !== bytes) {
      throw new Error("Decoded payload length does not match its header.");
    }
    return utf8.decode(decoded);
  } catch (cause) {
    throw new Error("Corrupt SQLite compressed payload.", { cause });
  }
};
var sqliteRuntimeIdentity = (id) => {
  const split = id.lastIndexOf(":") + 1;
  const suffix = id.slice(split);
  return {
    prefix: id.slice(0, split),
    suffix: /^[\da-f]{64}$/.test(suffix) ? Buffer.from(suffix, "hex") : suffix
  };
};
var decodeSqliteRuntimeIdentity = (prefix, suffix) => {
  if (typeof prefix !== "string") {
    throw new Error("Invalid SQLite runtime ID prefix.");
  }
  if (typeof suffix === "string") {
    return prefix + suffix;
  }
  if (!import_node_util.types.isUint8Array(suffix) || suffix.length !== 32) {
    throw new Error("Invalid SQLite runtime ID suffix.");
  }
  return prefix + Buffer.from(suffix).toString("hex");
};

// packages/disassembler/src/sqlite-records.ts
var compareRuntimeRecordIds = (left, right) => {
  if (left.id < right.id) {
    return -1;
  }
  if (left.id > right.id) {
    return 1;
  }
  return 0;
};
var runtimeColumns = (record) => {
  switch (record.kind) {
    case "runtime-execution":
      return {
        addressSpace: record.addressSpace,
        address: record.address,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: canonicalJson({
          ...record.fileOffset === void 0 ? {} : { fileOffset: record.fileOffset },
          ...record.size === void 0 ? {} : { size: record.size },
          ...record.opcode === void 0 ? {} : { opcode: record.opcode }
        })
      };
    case "runtime-instruction":
      return {
        addressSpace: record.addressSpace,
        address: record.address,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: canonicalJson({ bytes: record.bytes, state: record.state })
      };
    case "runtime-bus-access":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        // Unowned accesses must never become instruction observations through a coordinate query.
        instructionAddressSpace: record.context === "instruction" ? record.addressSpace : null,
        instructionAddress: record.context === "instruction" ? record.pc : null,
        accessedAddressSpace: record.addressSpace,
        accessedAddress: record.address,
        coverage: null,
        payload: canonicalJson({
          ...record.ppu ? { ppu: record.ppu } : {},
          pc: record.pc,
          value: record.value,
          direction: record.direction,
          actor: record.actor,
          channel: record.channel,
          phase: record.phase,
          context: record.context
        })
      };
    case "runtime-memory-access":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: record.instructionAddressSpace,
        instructionAddress: record.instructionAddress,
        accessedAddressSpace: record.accessedAddressSpace,
        accessedAddress: record.accessedAddress,
        coverage: null,
        payload: canonicalJson({
          access: record.access,
          width: record.width,
          ...record.actor === void 0 ? {} : { actor: record.actor },
          ...record.channel === void 0 ? {} : { channel: record.channel },
          ...record.value === void 0 ? {} : { value: record.value }
        })
      };
    case "runtime-cpu-state":
      return {
        addressSpace: record.addressSpace,
        address: record.address,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: canonicalJson({ state: record.state })
      };
    case "runtime-coverage":
      return {
        addressSpace: record.addressSpace,
        address: null,
        start: record.start,
        end: record.end,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: record.coverage,
        payload: null
      };
    case "runtime-control-target":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: record.fromAddressSpace,
        fromAddress: record.fromAddress,
        toAddressSpace: record.toAddressSpace,
        toAddress: record.toAddress,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: canonicalJson({ flowKind: record.flowKind, indirect: record.indirect })
      };
  }
  throw new Error("Unsupported runtime evidence kind.");
};
var runtimeFromRow = (row) => {
  const fields = row;
  const extra = fields.payload === null || fields.payload === void 0 ? {} : JSON.parse(decodeSqlitePayload(fields.payload));
  if (typeof fields.evidence !== "string") {
    throw new Error("Missing SQLite runtime evidence dictionary entry.");
  }
  const evidence = JSON.parse(fields.evidence);
  const kind = fields.kind;
  const architecture = fields.architecture;
  const count = Number(fields.count);
  const id = fields.id_prefix === void 0 ? fields.id : decodeSqliteRuntimeIdentity(fields.id_prefix, fields.id);
  if (kind === "runtime-execution") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space,
      address: Number(fields.address),
      ...extra
    };
  }
  if (kind === "runtime-instruction") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space,
      address: Number(fields.address),
      bytes: extra.bytes,
      state: extra.state
    };
  }
  if (kind === "runtime-bus-access") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.accessed_address_space,
      address: Number(fields.accessed_address),
      ...extra.ppu === void 0 ? {} : { ppu: extra.ppu },
      pc: extra.pc,
      value: extra.value,
      direction: extra.direction,
      actor: extra.actor,
      channel: extra.channel,
      phase: extra.phase,
      context: extra.context
    };
  }
  if (kind === "runtime-memory-access") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      instructionAddressSpace: fields.instruction_address_space,
      instructionAddress: Number(fields.instruction_address),
      accessedAddressSpace: fields.accessed_address_space,
      accessedAddress: Number(fields.accessed_address),
      access: extra.access,
      width: extra.width,
      ...extra.actor === void 0 ? {} : { actor: extra.actor },
      ...extra.channel === void 0 ? {} : { channel: extra.channel },
      ...extra.value === void 0 ? {} : { value: extra.value }
    };
  }
  if (kind === "runtime-cpu-state") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space,
      address: Number(fields.address),
      state: extra.state
    };
  }
  if (kind === "runtime-coverage") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space,
      start: Number(fields.start),
      end: Number(fields.end),
      coverage: fields.coverage
    };
  }
  if (kind !== "runtime-control-target") {
    throw new Error(`Unsupported stored runtime kind '${String(kind)}'.`);
  }
  return {
    id,
    kind: "runtime-control-target",
    architecture,
    count,
    evidence,
    fromAddressSpace: fields.from_address_space,
    fromAddress: Number(fields.from_address),
    toAddressSpace: fields.to_address_space,
    toAddress: Number(fields.to_address),
    flowKind: extra.flowKind,
    indirect: Boolean(extra.indirect)
  };
};
var analysisAddress = (record) => {
  if ("addressSpace" in record && "address" in record) {
    return { addressSpace: record.addressSpace, address: record.address };
  }
  if ("addressSpace" in record && "fromAddress" in record) {
    return { addressSpace: record.addressSpace, address: record.fromAddress };
  }
  return { addressSpace: null, address: null };
};

// packages/disassembler/src/project-store.ts
var parseAnalysisProjectManifest = (input) => {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid analysis project manifest.");
  }
  const manifest = input;
  if (manifest.schemaVersion > 3) {
    throw new Error(
      `Analysis project schema ${manifest.schemaVersion} is newer than supported schema 3; refusing to downgrade.`
    );
  }
  validateAnalysisProjectManifest(manifest);
  if (manifest.db !== "analysis.sqlite") {
    throw new Error("Legacy analysis storage is no longer supported; use a SQLite project.");
  }
  return manifest;
};
var openAnalysisProjectStore = (directory) => {
  const manifest = parseAnalysisProjectManifest(
    JSON.parse(fs2.readFileSync(import_node_path2.default.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8"))
  );
  return new SqliteAnalysisStore(analysisProjectSqlitePath(directory, manifest), false);
};

// packages/disassembler/src/project-edit.ts
var sortedUnique = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right));
var evidenceReferences = (shards, evidenceId) => [
  ...shards.analysis.filter((record) => record.evidence.includes(evidenceId)).map((record) => `analysis:${record.id}`),
  ...shards.annotations.filter((record) => record.evidence.includes(evidenceId)).map((record) => `annotations:${record.id}`),
  ...shards.labels.filter((record) => record.evidence.includes(evidenceId)).map((record) => `labels:${record.id}`),
  ...shards.comments.filter((record) => record.evidence.includes(evidenceId)).map((record) => `comments:${record.id}`),
  ...shards.regions.filter((record) => record.evidence.includes(evidenceId)).map((record) => `regions:${record.id}`),
  ...shards.runtime.filter((record) => record.evidence.includes(evidenceId)).map((record) => `runtime:${record.id}`)
];
var explainProjectEvidence = (shards, shard, recordId) => {
  const records = shards[shard];
  const record = records.find(({ id }) => id === recordId);
  if (!record) {
    throw new Error(`Analysis ${shard} record '${recordId}' does not exist.`);
  }
  let evidenceIds = [];
  if (shard === "evidence") {
    evidenceIds = [record.id];
  } else if ("evidence" in record) {
    evidenceIds = record.evidence;
  }
  const evidence = evidenceIds.map((id) => {
    const found = shards.evidence.find((entry) => entry.id === id);
    if (!found) {
      throw new Error(`Analysis record '${recordId}' refers to missing evidence '${id}'.`);
    }
    return found;
  });
  const referencedBy = sortedUnique(evidenceIds.flatMap((id) => evidenceReferences(shards, id)));
  const evidenceSet = new Set(evidenceIds);
  const conflicts = shards.analysis.filter(
    (entry) => entry.kind === "conflict" && (entry.id === recordId || entry.nodes.includes(recordId) || entry.evidence.some((id) => evidenceSet.has(id)))
  ).sort((left, right) => left.id.localeCompare(right.id));
  return { shard, record, evidence, referencedBy, conflicts };
};

// packages/disassembler/src/runtime-evidence.ts
var emptyCounts = () => ({
  analysis: 0,
  annotations: 0,
  labels: 0,
  comments: 0,
  regions: 0,
  runtime: 0,
  evidence: 0,
  imports: 0
});
var sortedUnique2 = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right));
var stateValueKey = (value) => `${typeof value}:${String(value)}`;
var conflictReport = (runtime) => {
  const observations = [];
  for (const record of runtime) {
    if (record.kind === "runtime-cpu-state") {
      for (const [field, value] of Object.entries(record.state)) {
        observations.push({
          architecture: record.architecture,
          addressSpace: record.addressSpace,
          address: record.address,
          field,
          value,
          record: record.id,
          evidence: record.evidence
        });
      }
    } else if (record.kind === "runtime-execution") {
      if (record.size !== void 0) {
        observations.push({
          architecture: record.architecture,
          addressSpace: record.addressSpace,
          address: record.address,
          field: "instruction-size",
          value: record.size,
          record: record.id,
          evidence: record.evidence
        });
      }
      if (record.opcode !== void 0) {
        observations.push({
          architecture: record.architecture,
          addressSpace: record.addressSpace,
          address: record.address,
          field: "opcode",
          value: record.opcode,
          record: record.id,
          evidence: record.evidence
        });
      }
    }
  }
  const groups = /* @__PURE__ */ new Map();
  for (const observation of observations) {
    const key2 = [
      observation.architecture,
      observation.addressSpace,
      observation.address,
      observation.field
    ].join(":");
    const group = groups.get(key2);
    if (group) {
      group.push(observation);
    } else {
      groups.set(key2, [observation]);
    }
  }
  const conflicts = [];
  for (const [key2, group] of groups) {
    const byValue = /* @__PURE__ */ new Map();
    for (const observation of group) {
      const valueKey = stateValueKey(observation.value);
      const entries = byValue.get(valueKey);
      if (entries) {
        entries.push(observation);
      } else {
        byValue.set(valueKey, [observation]);
      }
    }
    if (byValue.size < 2) {
      continue;
    }
    const first = group[0];
    conflicts.push({
      id: `runtime-conflict:${key2}`,
      kind: first.field === "instruction-size" || first.field === "opcode" ? first.field : "cpu-state",
      architecture: first.architecture,
      addressSpace: first.addressSpace,
      address: first.address,
      field: first.field,
      values: [...byValue.values()].map((entries) => ({
        value: entries[0].value,
        records: sortedUnique2(entries.map((entry) => entry.record)),
        evidence: sortedUnique2(entries.flatMap((entry) => entry.evidence))
      })).sort((left, right) => stateValueKey(left.value).localeCompare(stateValueKey(right.value)))
    });
  }
  return conflicts.sort((left, right) => left.id.localeCompare(right.id));
};
var explanationReport = (shards) => {
  const runtimeEvidence = new Set(
    shards.evidence.filter((record) => record.source === "runtime").map((record) => record.id)
  );
  const explanations = [];
  for (const annotation of shards.annotations) {
    const evidence = annotation.evidence.filter((id) => runtimeEvidence.has(id));
    if (evidence.length === 0) {
      continue;
    }
    const stateFields = Object.keys(annotation.state ?? {}).sort();
    explanations.push({
      recordId: annotation.id,
      detail: stateFields.length > 0 ? `Runtime observation supplies ${stateFields.join(", ")} state.` : `Runtime observation classifies bytes as ${annotation.classification}.`,
      evidence: sortedUnique2(evidence)
    });
  }
  for (const record of shards.analysis) {
    if (record.kind !== "target-override") {
      continue;
    }
    const evidence = record.evidence.filter((id) => runtimeEvidence.has(id));
    if (evidence.length === 0) {
      continue;
    }
    explanations.push({
      recordId: record.id,
      detail: `Runtime observation resolves control flow to ${record.targets.map((target) => `$${target.toString(16).toUpperCase().padStart(6, "0")}`).join(", ")}.`,
      evidence: sortedUnique2(evidence)
    });
  }
  return explanations.sort((left, right) => left.recordId.localeCompare(right.recordId));
};
var mergeRecords = (kind, prior, incoming, added, updated, existing) => {
  const records = new Map(prior.map((record) => [record.id, record]));
  for (const record of incoming) {
    const current = records.get(record.id);
    if (!current) {
      records.set(record.id, record);
      added[kind]++;
    } else if (canonicalJson(current) === canonicalJson(record)) {
      existing[kind]++;
    } else if (kind === "analysis" && "kind" in current && "kind" in record && current.kind === "target-override" && record.kind === "target-override" && current.id.startsWith("runtime:target-override:")) {
      const left = current;
      const right = record;
      if (left.addressSpace !== right.addressSpace || left.address !== right.address) {
        throw new Error(`Runtime target override '${record.id}' changed its control-flow site.`);
      }
      const merged = {
        ...left,
        targets: [.../* @__PURE__ */ new Set([...left.targets, ...right.targets])].sort((a, b) => a - b),
        evidence: sortedUnique2([...left.evidence, ...right.evidence])
      };
      if (canonicalJson(current) === canonicalJson(merged)) {
        existing[kind]++;
      } else {
        records.set(record.id, merged);
        updated[kind]++;
      }
    } else {
      throw new Error(
        `Runtime evidence id '${record.id}' in '${kind}' changed content; use a content-derived id.`
      );
    }
  }
  return [...records.values()];
};
var mergeRuntimeEvidence = (shards, batch) => {
  const traceProfiles = /* @__PURE__ */ new Map();
  for (const report of [...shards.imports, ...batch.imports ?? []]) {
    if (report.format !== "uttori-asm-instruction-trace") {
      continue;
    }
    if (traceProfiles.has(report.sourceSha256) && traceProfiles.get(report.sourceSha256) !== report.indexProfile) {
      throw new Error(
        `Trace '${report.sourceName}' was already imported with a different index profile. Reuse that profile or import into a separate project; mixing projections would double-count observations.`
      );
    }
    traceProfiles.set(report.sourceSha256, report.indexProfile);
  }
  const added = emptyCounts();
  const updated = emptyCounts();
  const existing = emptyCounts();
  const merged = {
    analysis: mergeRecords(
      "analysis",
      shards.analysis,
      batch.analysis ?? [],
      added,
      updated,
      existing
    ),
    annotations: mergeRecords(
      "annotations",
      shards.annotations,
      batch.annotations ?? [],
      added,
      updated,
      existing
    ),
    labels: mergeRecords("labels", shards.labels, batch.labels ?? [], added, updated, existing),
    comments: mergeRecords(
      "comments",
      shards.comments,
      batch.comments ?? [],
      added,
      updated,
      existing
    ),
    regions: mergeRecords("regions", shards.regions, batch.regions ?? [], added, updated, existing),
    runtime: mergeRecords("runtime", shards.runtime, batch.runtime ?? [], added, updated, existing),
    evidence: mergeRecords(
      "evidence",
      shards.evidence,
      batch.evidence ?? [],
      added,
      updated,
      existing
    ),
    imports: mergeRecords("imports", shards.imports, batch.imports ?? [], added, updated, existing)
  };
  let conflicts;
  let explanations;
  return {
    shards: merged,
    changed: Object.values(added).some((count) => count > 0) || Object.values(updated).some((count) => count > 0),
    added,
    updated,
    existing,
    get conflicts() {
      return conflicts ??= conflictReport(merged.runtime);
    },
    get explanations() {
      return explanations ??= explanationReport(merged);
    }
  };
};
var inspectRuntimeEvidence = (shards) => ({
  conflicts: conflictReport(shards.runtime),
  explanations: explanationReport(shards)
});

// packages/disassembler/src/sqlite-annotation-query.ts
var QUERY_LAYOUT = "5";
var decode = (payload) => JSON.parse(decodeSqlitePayload(payload));
var runtimeSelect = (pairedState = false) => {
  const kind = pairedState ? "'runtime-cpu-state'" : "f.kind";
  const identity = pairedState ? "o.state_id" : "o.id";
  const prefix = pairedState ? "o.state_prefix_id" : "o.prefix_id";
  const row = pairedState ? "-o.oid" : "o.oid";
  return `SELECT ${row} AS storage_rowid,${kind} AS kind,${identity} AS id,
    p.value AS id_prefix,e.value AS evidence,o.count,f.architecture,
    f.address_space,f.address,f.start,f."end",f.from_address_space,f.from_address,
    f.to_address_space,f.to_address,f.instruction_address_space,f.instruction_address,
    f.accessed_address_space,f.accessed_address,f.coverage,
    CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
    FROM runtime_facts f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
    LEFT JOIN runtime_prefixes p ON p.id=${prefix}
    LEFT JOIN runtime_evidence e ON e.id=o.evidence_id`;
};
var PENDING_EXECUTIONS = `SELECT o.oid AS row_id,
  CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
  FROM runtime_observations o CROSS JOIN runtime_facts f ON f.fid=o.fact_id
  WHERE o.query_ready=0 AND f.kind='runtime-execution'`;
var annotationQueryIndexesReady = (database) => Boolean(
  database.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_instruction_nodes'").get()
) && database.prepare("SELECT v FROM meta WHERE k='annotation-query-layout'").get()?.v === QUERY_LAYOUT && !database.prepare("SELECT 1 FROM query_instruction_nodes WHERE ready=0 LIMIT 1").get() && !database.prepare(`${PENDING_EXECUTIONS} LIMIT 1`).get();
var ensureAnnotationQueryIndexes = (database) => {
  if (database.prepare("SELECT v FROM meta WHERE k='annotation-query-layout'").get()?.v !== QUERY_LAYOUT) {
    database.exec(`DROP TRIGGER IF EXISTS query_instruction_insert; DROP TRIGGER IF EXISTS query_instruction_delete;
      DROP TRIGGER IF EXISTS query_instruction_update; DROP TRIGGER IF EXISTS query_execution_insert;
      DROP TRIGGER IF EXISTS query_execution_delete; DROP TRIGGER IF EXISTS query_execution_update;`);
    for (const name of ["query_instruction_nodes", "query_execution_offsets"]) {
      const row = database.prepare("SELECT type FROM sqlite_schema WHERE name=?").get(name);
      if (row) {
        database.exec(`DROP ${row.type === "view" ? "VIEW" : "TABLE"} ${name}`);
      }
    }
    for (const table of ["analysis", "runtime_observations"]) {
      const columns = new Set(
        database.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name))
      );
      for (const [name, type] of [
        ["query_file_offset", "INTEGER"],
        ["query_size", "INTEGER"],
        ["query_data", "TEXT"],
        ["query_ready", "INTEGER NOT NULL DEFAULT 0"]
      ]) {
        if (!columns.has(name)) {
          database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
        }
      }
    }
    database.exec("UPDATE analysis SET query_ready=0 WHERE kind='cfg-node'");
    database.exec(
      "UPDATE runtime_observations SET query_ready=1 WHERE fact_id IN (SELECT fid FROM runtime_facts WHERE kind!='runtime-execution') AND query_ready=0"
    );
    database.exec(`CREATE INDEX IF NOT EXISTS analysis_location ON analysis(kind,address_space,address);
      CREATE INDEX IF NOT EXISTS query_instruction_pending ON analysis(query_ready) WHERE kind='cfg-node' AND query_ready=0;
      CREATE INDEX IF NOT EXISTS query_execution_output ON runtime_observations(query_file_offset) WHERE query_file_offset IS NOT NULL;
      CREATE INDEX IF NOT EXISTS query_execution_pending ON runtime_observations(query_ready) WHERE query_ready=0;
      CREATE VIEW query_instruction_nodes AS SELECT rowid AS row_id,query_file_offset AS file_offset,query_size AS size,query_data AS data,query_ready AS ready FROM analysis WHERE kind='cfg-node';
      CREATE VIEW query_execution_offsets AS SELECT rowid AS row_id,query_file_offset AS file_offset,query_size AS size,query_ready AS ready FROM runtime WHERE kind='runtime-execution';
      CREATE TRIGGER query_instruction_insert AFTER INSERT ON analysis WHEN NEW.kind='cfg-node' BEGIN UPDATE analysis SET query_ready=0 WHERE rowid=NEW.rowid; END;
      CREATE TRIGGER query_instruction_update AFTER UPDATE OF id,kind,address_space,address,payload ON analysis BEGIN UPDATE analysis SET query_ready=0 WHERE rowid=NEW.rowid; END;
      CREATE TRIGGER query_execution_update AFTER UPDATE OF fact_id ON runtime_observations BEGIN UPDATE runtime_observations SET query_ready=0 WHERE oid=NEW.oid; END;
`);
  }
  for (const table of ["analysis", "runtime"]) {
    const pendingSql = table === "runtime" ? PENDING_EXECUTIONS : "SELECT rowid AS row_id,payload FROM analysis WHERE kind='cfg-node' AND query_ready=0";
    const pending = database.prepare(`${pendingSql} LIMIT 1024`);
    const update = database.prepare(
      // Execution rows always have a positive physical observation ID. Updating the compatibility
      // union view here would also search its virtual-state branch once for every execution row.
      `UPDATE ${table === "runtime" ? "runtime_observations" : table} SET query_file_offset=?,query_size=?,query_ready=1 WHERE ${table === "runtime" ? "oid" : "rowid"}=?`
    );
    const exportData = table === "analysis" ? database.prepare("UPDATE analysis SET query_data=? WHERE rowid=?") : void 0;
    for (let rows = pending.all(); rows.length; rows = pending.all()) {
      for (const row of rows) {
        const record = row.payload === null ? {} : decode(row.payload);
        const offset = record.fileOffset;
        if (offset !== void 0 && (!Number.isSafeInteger(offset) || offset < 0)) {
          throw new Error("Invalid persisted instruction output offset.");
        }
        update.run(offset ?? null, record.size ?? null, row.row_id);
        if (exportData) {
          const {
            id,
            kind,
            addressSpace,
            address,
            fileOffset,
            size,
            opcode,
            specificationId,
            incomingState,
            evidence
          } = record;
          exportData.run(
            encodeSqlitePayload(
              JSON.stringify({
                id,
                kind,
                addressSpace,
                address,
                fileOffset,
                size,
                opcode,
                specificationId,
                incomingState,
                evidence
              })
            ),
            row.row_id
          );
        }
      }
    }
  }
  if (database.prepare("SELECT v FROM meta WHERE k='annotation-query-layout'").get()?.v !== QUERY_LAYOUT) {
    database.exec(
      "DROP INDEX IF EXISTS query_instruction_output; CREATE INDEX query_instruction_output ON analysis(query_file_offset,id) WHERE kind='cfg-node'"
    );
  }
  database.prepare("INSERT OR REPLACE INTO meta(k,v) VALUES('annotation-query-layout',?)").run(QUERY_LAYOUT);
};
var readSqliteAnnotationView = (database, manifest, ranges) => {
  if (!annotationQueryIndexesReady(database)) {
    throw new Error("Analysis query indexes changed; refresh the annotation view.");
  }
  if (ranges.length > 2e3) {
    throw new Error("At most 2000 visible source ranges may be projected per request.");
  }
  for (const range of ranges) {
    if (!range.addressSpace || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end <= range.start || (range.outputStart !== void 0 || range.outputEnd !== void 0) && (!Number.isSafeInteger(range.outputStart) || !Number.isSafeInteger(range.outputEnd) || range.outputStart < 0 || range.outputEnd <= range.outputStart)) {
      throw new Error("Invalid instruction annotation range.");
    }
  }
  const fileSpaces = manifest.addressSpaces.filter((space) => space.kind === "file").map((space) => space.id);
  const analysis = /* @__PURE__ */ new Map();
  const locations = /* @__PURE__ */ new Map();
  const offsets = /* @__PURE__ */ new Set();
  let limited = false;
  const locate = (space, address) => {
    const key2 = `${space}:${address}`;
    if (locations.size < 2e3 || locations.has(key2)) {
      locations.set(key2, { space, address });
    } else {
      limited = true;
    }
  };
  const nodes = database.prepare(
    "SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address>=? AND address<? LIMIT ?"
  );
  const outputNodes = database.prepare(
    "SELECT payload FROM analysis INDEXED BY query_instruction_output WHERE kind='cfg-node' AND query_file_offset>=? AND query_file_offset<? LIMIT ?"
  );
  const addNodes = (rows) => {
    for (const row of rows) {
      if (analysis.size >= 8192) {
        limited = true;
        break;
      }
      const record = decode(row.payload);
      analysis.set(record.id, record);
      if (record.kind === "cfg-node") {
        locate(record.addressSpace, record.address);
        if (record.fileOffset !== void 0) {
          offsets.add(record.fileOffset);
        }
      }
    }
  };
  const pointLocations = database.prepare(
    "SELECT DISTINCT address FROM runtime_facts WHERE kind=? AND address_space=? AND address>=? AND address<? LIMIT 2001"
  );
  const pairedLocations = database.prepare(
    `SELECT DISTINCT f.address FROM runtime_facts f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
      WHERE f.kind='runtime-instruction' AND f.address_space=? AND f.address>=? AND f.address<? AND o.state_id IS NOT NULL LIMIT 2001`
  );
  const memoryLocations = database.prepare(
    "SELECT DISTINCT instruction_address AS address FROM runtime_facts WHERE kind='runtime-memory-access' AND instruction_address_space=? AND instruction_address>=? AND instruction_address<? LIMIT 2001"
  );
  const opcodeLocations = database.prepare(
    "SELECT DISTINCT start AS address FROM annotations WHERE classification='opcode' AND address_space=? AND start>=? AND start<? LIMIT 2001"
  );
  const commentLocations = database.prepare(
    "SELECT DISTINCT address FROM comments WHERE address_space=? AND address>=? AND address<? LIMIT 2001"
  );
  const executionOutputs = database.prepare(
    // Joining the compatibility view to itself materialized every execution for each source line.
    // Start at the physical output-offset index and fetch only each matching observation's fact.
    `SELECT DISTINCT f.address_space,f.address,o.query_file_offset AS file_offset
      FROM runtime_observations o CROSS JOIN runtime_facts f ON f.fid=o.fact_id
      WHERE o.query_file_offset>=? AND o.query_file_offset<? AND f.kind='runtime-execution' LIMIT 2001`
  );
  for (const range of ranges) {
    addNodes(
      nodes.iterate(range.addressSpace, range.start, range.end, Math.max(1, 8193 - analysis.size))
    );
    const queries = [{ space: range.addressSpace, start: range.start, end: range.end }];
    if (range.outputStart !== void 0 && range.outputEnd !== void 0) {
      addNodes(
        outputNodes.iterate(range.outputStart, range.outputEnd, Math.max(1, 8193 - analysis.size))
      );
      let outputCount = 0;
      for (const row of executionOutputs.iterate(range.outputStart, range.outputEnd)) {
        if (++outputCount > 2e3) {
          limited = true;
          break;
        }
        locate(String(row.address_space), Number(row.address));
        offsets.add(Number(row.file_offset));
      }
      for (const space of fileSpaces) {
        queries.push({ space, start: range.outputStart, end: range.outputEnd });
      }
    }
    for (const { space, start, end } of queries) {
      for (const kind of ["runtime-execution", "runtime-cpu-state"]) {
        for (const row of pointLocations.iterate(kind, space, start, end)) {
          locate(space, Number(row.address));
        }
      }
      for (const query of [pairedLocations, memoryLocations, opcodeLocations, commentLocations]) {
        for (const row of query.iterate(space, start, end)) {
          locate(space, Number(row.address));
        }
      }
    }
  }
  for (const row of database.prepare("SELECT payload FROM analysis WHERE kind='summary'").iterate()) {
    const record = decode(row.payload);
    analysis.set(record.id, record);
  }
  const runtime = /* @__PURE__ */ new Map();
  const executionCounts = /* @__PURE__ */ new Map();
  const point = database.prepare(
    `${runtimeSelect()} WHERE f.kind=? AND f.address_space=? AND f.address=? ORDER BY o.oid LIMIT ?`
  );
  const pairedState = database.prepare(
    `${runtimeSelect(true)} WHERE f.kind='runtime-instruction' AND f.address_space=? AND f.address=? AND o.state_id IS NOT NULL ORDER BY o.oid DESC LIMIT ?`
  );
  const memory = database.prepare(
    `${runtimeSelect()} WHERE f.kind='runtime-memory-access' AND f.instruction_address_space=? AND f.instruction_address=? ORDER BY o.oid LIMIT ?`
  );
  const executionCount = database.prepare(
    `SELECT COALESCE(SUM(o.count),0) AS n FROM runtime_facts f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
      WHERE f.kind='runtime-execution' AND f.address_space=? AND f.address=?`
  );
  function* stateRows(space, address, limit) {
    let remaining = limit;
    for (const row of pairedState.iterate(space, address, remaining)) {
      yield row;
      remaining--;
    }
    if (remaining > 0) {
      yield* point.iterate("runtime-cpu-state", space, address, remaining);
    }
  }
  const addRuntime = (rows, limit) => {
    let count = 0;
    for (const row of rows) {
      if (++count > limit) {
        limited = true;
        break;
      }
      const record = runtimeFromRow(row);
      runtime.set(record.id, record);
      if (record.kind === "runtime-execution" && record.fileOffset !== void 0) {
        offsets.add(record.fileOffset);
      }
    }
  };
  for (const [key2, { space, address }] of locations) {
    executionCounts.set(key2, Number(executionCount.get(space, address)?.n ?? 0));
    for (const kind of ["runtime-execution", "runtime-cpu-state"]) {
      const minimum = kind === "runtime-execution" ? 1 : 0;
      const budget2 = Math.min(64, Math.max(minimum, 8192 - runtime.size));
      const rows = kind === "runtime-cpu-state" ? stateRows(space, address, budget2 + 1) : point.iterate(kind, space, address, budget2 + 1);
      addRuntime(rows, budget2);
    }
    const budget = Math.min(64, Math.max(0, 8192 - runtime.size));
    addRuntime(memory.iterate(space, address, budget + 1), budget);
  }
  const annotations = /* @__PURE__ */ new Map();
  const comments = /* @__PURE__ */ new Map();
  const intervals = database.prepare(
    'SELECT payload FROM annotations WHERE address_space=? AND start<=? AND "end">? LIMIT 1025'
  );
  const comment = database.prepare(
    "SELECT payload FROM comments WHERE address_space=? AND address=? LIMIT 1025"
  );
  const coverage = database.prepare(
    `${runtimeSelect()} WHERE f.kind='runtime-coverage' AND f.address_space=? AND f.address IS NULL AND f.start<=? AND f."end">? LIMIT 1025`
  );
  const coordinates = new Map(locations);
  for (const offset of offsets) {
    for (const space of fileSpaces) {
      coordinates.set(`${space}:${offset}`, { space, address: offset });
    }
  }
  for (const { space, address } of coordinates.values()) {
    let intervalCount = 0;
    for (const row of intervals.iterate(space, address, address)) {
      if (++intervalCount > 1024 || annotations.size >= 8192) {
        limited = true;
        break;
      }
      const record = decode(row.payload);
      annotations.set(record.id, record);
    }
    let commentCount = 0;
    for (const row of comment.iterate(space, address)) {
      if (++commentCount > 1024 || comments.size >= 8192) {
        limited = true;
        break;
      }
      const record = decode(row.payload);
      comments.set(record.id, record);
    }
    addRuntime(
      coverage.iterate(space, address, address),
      Math.min(1024, Math.max(0, 16384 - runtime.size))
    );
  }
  return {
    shards: {
      analysis: [...analysis.values()],
      annotations: [...annotations.values()],
      comments: [...comments.values()],
      evidence: [...database.prepare("SELECT payload FROM evidence").iterate()].map(
        (row) => decode(row.payload)
      ),
      labels: [],
      regions: [],
      imports: [],
      runtime: [...runtime.values()]
    },
    executionCounts,
    limited
  };
};

// packages/disassembler/src/sqlite-query-cache.ts
var QUERY_CACHE_SCHEMA = "CREATE TABLE IF NOT EXISTS query_cache (name TEXT PRIMARY KEY, signature TEXT NOT NULL, payload TEXT NOT NULL)";
var upgradeQueryCacheStorage = (db) => {
  const schema = db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='query_cache'").get();
  if (!schema || !/without\s+rowid/i.test(String(schema.sql))) {
    return;
  }
  db.exec(`CREATE TEMP TABLE query_cache_upgrade AS SELECT * FROM main.query_cache;
    DROP TABLE main.query_cache;
    ${QUERY_CACHE_SCHEMA};
    INSERT INTO main.query_cache SELECT * FROM temp.query_cache_upgrade;
    DROP TABLE temp.query_cache_upgrade;`);
};
var installQueryCache = (db, key2, dependencies) => {
  if (!/^[\d_a-z]+$/.test(key2)) {
    throw new Error("Invalid internal query cache key.");
  }
  if (dependencies.some(
    (table) => ![
      "analysis",
      "annotations",
      "labels",
      "comments",
      "regions",
      "imports",
      "evidence",
      "runtime"
    ].includes(table)
  )) {
    throw new Error("Invalid query dependency.");
  }
  db.exec(QUERY_CACHE_SCHEMA);
  for (const table of dependencies.flatMap(
    (name) => name === "runtime" ? ["runtime_facts", "runtime_observations"] : [name]
  )) {
    for (const event of ["INSERT", "UPDATE", "DELETE"]) {
      const update = table === "runtime_observations" && event === "UPDATE" ? "UPDATE OF fact_id,prefix_id,id,evidence_id,count,state_prefix_id,state_id" : event;
      db.exec(`CREATE TRIGGER IF NOT EXISTS cache_${key2}_${table}_${event} AFTER ${update} ON ${table} BEGIN
      DELETE FROM query_cache WHERE name='${key2}'; END`);
    }
  }
};
var readQueryCache = (db, key2, signature) => {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_cache'").get()) {
    return void 0;
  }
  const row = db.prepare("SELECT payload FROM query_cache WHERE name=? AND signature=?").get(key2, signature);
  return row ? JSON.parse(String(row.payload)) : void 0;
};
var writeQueryCache = (db, key2, signature, value) => {
  db.prepare("INSERT OR REPLACE INTO query_cache VALUES(?,?,?)").run(
    key2,
    signature,
    JSON.stringify(value)
  );
};

// packages/disassembler/src/sqlite-coverage-query.ts
var decode2 = (value) => JSON.parse(decodeSqlitePayload(value));
var coverageSignature = (manifest) => JSON.stringify([1, manifest.rom, manifest.addressSpaces]);
var cachedCoverage = (db, manifest) => readQueryCache(db, "coverage", coverageSignature(manifest));
var prepareCoverage = (db, manifest) => {
  db.exec(`CREATE TEMP TABLE query_coverage_segments (start INTEGER PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TEMP TABLE query_coverage_details (kind TEXT, id TEXT, reason TEXT, payload TEXT NOT NULL);
    CREATE INDEX temp.query_coverage_detail_order ON query_coverage_details(kind,id,reason);
    DELETE FROM query_coverage_segments; DELETE FROM query_coverage_details;
    CREATE TEMP TABLE coverage_events (pos INTEGER NOT NULL, category TEXT NOT NULL, id TEXT NOT NULL, delta INTEGER NOT NULL);`);
  const fileAddressSpaces = manifest.addressSpaces.filter((s) => s.kind === "file").map((s) => s.id).sort((a, b) => a.localeCompare(b));
  const files = new Set(fileAddressSpaces);
  const size = manifest.rom.contentSize;
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error("Invalid ROM coverage size.");
  }
  const event = db.prepare("INSERT INTO temp.coverage_events VALUES(?,?,?,?)");
  const detail = db.prepare("INSERT INTO query_coverage_details VALUES(?,?,?,?)");
  const unprojected = (kind, id, reason) => {
    detail.run(
      kind,
      id,
      reason,
      JSON.stringify({
        id: `${kind}:${id}:${reason}`,
        label: id,
        description: reason,
        icon: "debug-disconnect"
      })
    );
  };
  const add = (kind, id, start, end, categories) => {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) {
      unprojected(kind, id, "invalid-range");
      return false;
    }
    if (start >= size || size === 0) {
      unprojected(kind, id, "outside-rom");
      return false;
    }
    const clipped = Math.min(end, size);
    if (clipped !== end) {
      detail.run(
        "z-diagnostic",
        id,
        "clipped",
        JSON.stringify({
          id: `diagnostic:${id}:${start}:${end}`,
          label: id,
          description: "clipped",
          tooltip: `Clipped coverage range [${start}, ${end}) to ROM content [${start}, ${clipped}).`,
          icon: "warning"
        })
      );
    }
    for (const [category, identity] of categories) {
      event.run(start, category, identity, 1);
      event.run(clipped, category, identity, -1);
    }
    return true;
  };
  try {
    for (const row of db.prepare("SELECT * FROM annotations WHERE classification != 'unreached'").iterate()) {
      const record = decode2(row.payload);
      if (!files.has(record.addressSpace)) {
        unprojected("annotation", record.id, "non-file-address-space");
        continue;
      }
      let classification = "data";
      if (["opcode", "operand"].includes(record.classification)) {
        classification = record.classification;
      }
      if (["graphics", "music", "compressed", "asset"].includes(record.classification)) {
        classification = "asset";
      }
      add("annotation", record.id, record.start, record.end, [
        ["classification", classification],
        ["annotationIds", record.id]
      ]);
    }
    for (const row of db.prepare("SELECT id,address_space,start,end FROM regions").iterate()) {
      const id = String(row.id);
      if (!files.has(String(row.address_space))) {
        unprojected("region", id, "non-file-address-space");
        continue;
      }
      add("region", id, Number(row.start), Number(row.end), [["regionIds", id]]);
    }
    for (const row of db.prepare(
      "SELECT a.id,q.file_offset,q.size FROM analysis a JOIN query_instruction_nodes q ON q.row_id=a.rowid WHERE a.kind='cfg-node'"
    ).iterate()) {
      const id = String(row.id);
      if (row.file_offset === null) {
        unprojected("analysis", id, "missing-file-offset");
        continue;
      }
      const start = Number(row.file_offset);
      add("analysis", id, start, start + 1, [
        ["classification", "opcode"],
        ["analysisIds", id]
      ]);
      if (Number(row.size) > 1) {
        add("analysis", id, start + 1, start + Number(row.size), [
          ["classification", "operand"],
          ["analysisIds", id]
        ]);
      }
    }
    const node = db.prepare(
      "SELECT a.id,q.file_offset,q.size FROM analysis a JOIN query_instruction_nodes q ON q.row_id=a.rowid WHERE a.id=? AND a.kind='cfg-node'"
    );
    for (const row of db.prepare("SELECT payload FROM analysis WHERE kind='conflict'").iterate()) {
      const record = decode2(row.payload);
      if (files.has(record.addressSpace)) {
        add("analysis", record.id, record.address, record.end ?? record.address + 1, [
          ["conflictIds", record.id]
        ]);
        continue;
      }
      let projected = false;
      for (const id of record.nodes) {
        const target = node.get(id);
        if (!target || target.file_offset === null) {
          continue;
        }
        projected = add(
          "analysis",
          record.id,
          Number(target.file_offset),
          Number(target.file_offset) + Number(target.size),
          [
            ["conflictIds", record.id],
            ["analysisIds", id]
          ]
        ) || projected;
      }
      if (!projected) {
        unprojected("analysis", record.id, "missing-file-offset");
      }
    }
    const identity = "p.value || CASE typeof(r.id) WHEN 'blob' THEN lower(hex(r.id)) ELSE r.id END";
    for (const row of db.prepare(
      `SELECT ${identity} AS id,q.file_offset,q.size FROM runtime r JOIN query_execution_offsets q ON q.row_id=r.rowid JOIN runtime_prefixes p ON p.id=r.prefix_id WHERE r.kind='runtime-execution'`
    ).iterate()) {
      const id = String(row.id);
      if (row.file_offset === null) {
        unprojected("runtime", id, "missing-file-offset");
        continue;
      }
      const start = Number(row.file_offset);
      add("runtime", id, start, start + 1, [
        ["runtime", "executed"],
        ["runtimeIds", id]
      ]);
      if (Number(row.size) > 1) {
        add("runtime", id, start + 1, start + Number(row.size), [
          ["runtime", "operand"],
          ["runtimeIds", id]
        ]);
      }
    }
    for (const row of db.prepare(
      `SELECT ${identity} AS id,r.address_space,r.start,r.end,r.coverage FROM runtime r JOIN runtime_prefixes p ON p.id=r.prefix_id WHERE r.kind='runtime-coverage'`
    ).iterate()) {
      const id = String(row.id);
      if (!files.has(String(row.address_space))) {
        unprojected("runtime", id, "non-file-address-space");
        continue;
      }
      add("runtime", id, Number(row.start), Number(row.end), [
        ["runtime", String(row.coverage)],
        ["runtimeIds", id]
      ]);
    }
    for (const row of db.prepare(`SELECT ${identity} AS id,r.accessed_address,r.payload FROM runtime r JOIN runtime_prefixes p ON p.id=r.prefix_id
      WHERE r.kind='runtime-memory-access' AND r.accessed_address_space IN (SELECT value FROM json_each(?))`).iterate(JSON.stringify(fileAddressSpaces))) {
      const id = String(row.id);
      const payload = decode2(row.payload);
      for (const [access, classification] of [
        ["read", "read"],
        ["write", "written"]
      ]) {
        if (payload.access === access || payload.access === "read-write") {
          add(
            "runtime",
            id,
            Number(row.accessed_address),
            Number(row.accessed_address) + payload.width,
            [
              ["runtime", classification],
              ["runtimeIds", id]
            ]
          );
        }
      }
    }
    event.run(0, "boundary", "", 0);
    event.run(size, "boundary", "", 0);
    const active = /* @__PURE__ */ new Map();
    const ids = (category) => [...active.get(category)?.keys() ?? []].sort((a, b) => a.localeCompare(b));
    const put = db.prepare("INSERT INTO query_coverage_segments VALUES(?,?)");
    const summary = {
      totalBytes: size,
      classifiedBytes: 0,
      unknownBytes: 0,
      conflictBytes: 0,
      segmentCount: 0,
      bytesByClassification: { opcode: 0, operand: 0, data: 0, asset: 0, unknown: 0 },
      bytesByRuntimeCoverage: { executed: 0, operand: 0, read: 0, written: 0 }
    };
    let classifiedBytes = 0, unknownBytes = 0, conflictBytes = 0, segmentCount = 0;
    const classificationTotals = { ...summary.bytesByClassification };
    const runtimeTotals = { ...summary.bytesByRuntimeCoverage };
    let previous = 0;
    let pending;
    let pendingKey;
    const savePending = () => {
      if (pending) {
        put.run(pending.start, JSON.stringify(pending));
        segmentCount++;
      }
    };
    const flush = (end) => {
      if (end <= previous) {
        return;
      }
      const classifications = ["opcode", "operand", "data", "asset"].filter(
        (c) => active.get("classification")?.has(c)
      );
      const runtime = ["executed", "operand", "read", "written"].filter(
        (c) => active.get("runtime")?.has(c)
      );
      const conflictIds = ids("conflictIds");
      let status = "classified";
      if (classifications.length === 0) {
        status = "unknown";
      }
      if (classifications.length > 1 || conflictIds.length) {
        status = "conflict";
      }
      const segment = {
        start: previous,
        end,
        status,
        classifications: classifications.length ? classifications : ["unknown"],
        runtime,
        annotationIds: ids("annotationIds"),
        analysisIds: ids("analysisIds"),
        runtimeIds: ids("runtimeIds"),
        conflictIds,
        regionIds: ids("regionIds")
      };
      const { start: _start, end: _end, ...identity2 } = segment;
      const key2 = JSON.stringify(identity2);
      if (pending && key2 === pendingKey) {
        pending = { ...pending, end };
      } else {
        savePending();
        pending = segment;
        pendingKey = key2;
      }
      const bytes = end - previous;
      for (const c of segment.classifications) {
        classificationTotals[c] += bytes;
      }
      for (const c of runtime) {
        runtimeTotals[c] += bytes;
      }
      if (status === "classified") {
        classifiedBytes += bytes;
      } else if (status === "conflict") {
        conflictBytes += bytes;
      } else {
        unknownBytes += bytes;
      }
      previous = end;
    };
    for (const row of db.prepare(
      "SELECT pos,category,id,SUM(delta) AS delta FROM temp.coverage_events GROUP BY pos,category,id HAVING SUM(delta) != 0 OR category='boundary' ORDER BY pos,category,id"
    ).iterate()) {
      flush(Number(row.pos));
      if (row.category === "boundary") {
        continue;
      }
      const category = String(row.category), id = String(row.id);
      let values = active.get(category);
      if (!values) {
        values = /* @__PURE__ */ new Map();
        active.set(category, values);
      }
      const count = (values.get(id) ?? 0) + Number(row.delta);
      if (count === 0) {
        values.delete(id);
      } else {
        values.set(id, count);
      }
    }
    savePending();
    const result = {
      contentSize: size,
      fileAddressSpaces,
      segments: [],
      unprojected: [],
      diagnostics: [],
      detailCount: Number(db.prepare("SELECT count(*) AS n FROM query_coverage_details").get().n),
      summary: {
        ...summary,
        classifiedBytes,
        unknownBytes,
        conflictBytes,
        segmentCount,
        bytesByClassification: classificationTotals,
        bytesByRuntimeCoverage: runtimeTotals
      }
    };
    return result;
  } finally {
    db.exec("DROP TABLE temp.coverage_events");
  }
};
var publishCoverage = (db) => {
  db.exec(`CREATE TABLE IF NOT EXISTS main.query_coverage_segments(start INTEGER PRIMARY KEY,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS main.query_coverage_details(kind TEXT,id TEXT,reason TEXT,payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS main.query_coverage_detail_order ON query_coverage_details(kind,id,reason);
    DELETE FROM main.query_coverage_segments;INSERT INTO main.query_coverage_segments SELECT * FROM temp.query_coverage_segments;
    DELETE FROM main.query_coverage_details;INSERT INTO main.query_coverage_details SELECT * FROM temp.query_coverage_details;`);
};
var coveragePage = (db, kind, offset) => {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Invalid analysis page offset.");
  }
  const table = kind === "segments" ? "query_coverage_segments" : "query_coverage_details";
  const order = kind === "segments" ? "start" : "kind,id,reason";
  return db.prepare(`SELECT payload FROM ${table} ORDER BY ${order} LIMIT 200 OFFSET ?`).all(offset).map((row) => JSON.parse(String(row.payload)));
};

// packages/disassembler/src/sqlite-graph-query.ts
var decode3 = (value) => JSON.parse(decodeSqlitePayload(value));
var unique = (ids) => [...new Set(ids)].sort((a, b) => a.localeCompare(b));
var numbers = (ids) => [...new Set(ids)].sort((a, b) => a - b);
var prepareGraph = (db) => {
  db.exec(`CREATE TEMP TABLE query_graph_nodes(id TEXT PRIMARY KEY,address_space TEXT,address INTEGER,file_offset INTEGER,owner TEXT) WITHOUT ROWID;
    CREATE INDEX temp.query_graph_owner ON query_graph_nodes(owner);
    CREATE INDEX temp.query_graph_location ON query_graph_nodes(address_space,address);
    CREATE TEMP TABLE query_graph_edges(id TEXT PRIMARY KEY,kind TEXT,address_space TEXT,from_address INTEGER,from_id TEXT,payload TEXT) WITHOUT ROWID;
    CREATE INDEX temp.query_graph_edge_location ON query_graph_edges(kind,address_space,from_address);
    DELETE FROM query_graph_nodes; DELETE FROM query_graph_edges;`);
  const entries = new Set(
    db.prepare(
      "SELECT n.id FROM analysis n JOIN analysis f ON f.kind='function' AND n.address_space=f.address_space AND n.address=f.address WHERE n.kind='cfg-node'"
    ).all().map((row) => String(row.id))
  );
  const putNode = db.prepare("INSERT INTO query_graph_nodes VALUES(?,?,?,?,?)");
  const putEdge = db.prepare("INSERT INTO query_graph_edges VALUES(?,?,?,?,?,?)");
  for (const row of db.prepare("SELECT kind,payload FROM analysis WHERE kind IN ('cfg-node','cfg-edge')").iterate()) {
    if (row.kind === "cfg-node") {
      const node = decode3(row.payload);
      const path5 = node.evidencePath.length ? node.evidencePath : [node.id];
      let owner;
      for (let i = path5.length - 1; i >= 0; i--) {
        if (entries.has(path5[i])) {
          owner = path5[i];
          break;
        }
      }
      putNode.run(node.id, node.addressSpace, node.address, node.fileOffset ?? null, owner ?? null);
    } else {
      const edge = decode3(row.payload);
      if (edge.edgeKind === "unresolved" || ["call", "interrupt"].includes(edge.edgeKind) && edge.toAddress !== void 0) {
        putEdge.run(
          edge.id,
          edge.edgeKind,
          edge.addressSpace,
          edge.fromAddress,
          edge.from,
          JSON.stringify(edge)
        );
      }
    }
  }
  const ownersQuery = db.prepare(`SELECT f.id FROM query_graph_nodes n JOIN query_graph_nodes e ON e.id=n.owner
    JOIN analysis f ON f.kind='function' AND f.address_space=e.address_space AND f.address=e.address WHERE n.id=?`);
  const owners = (id) => unique(ownersQuery.all(id).map((row) => String(row.id)));
  const offsetQuery = db.prepare(
    "SELECT file_offset FROM query_graph_nodes WHERE id=? AND file_offset IS NOT NULL"
  );
  const offsets = (ids) => numbers(ids.flatMap((id) => offsetQuery.all(id).map((row) => Number(row.file_offset))));
  const functionsAt = db.prepare(
    "SELECT id FROM analysis WHERE kind='function' AND address_space=? AND address=?"
  );
  const calls = [];
  for (const row of db.prepare("SELECT payload FROM query_graph_edges WHERE kind IN ('call','interrupt')").iterate()) {
    const edge = decode3(row.payload);
    calls.push({
      id: edge.id,
      edgeKind: edge.edgeKind,
      addressSpace: edge.addressSpace,
      fromAddress: edge.fromAddress,
      toAddress: edge.toAddress,
      fromNodeId: edge.from,
      ...edge.to ? { toNodeId: edge.to } : {},
      callerFunctionIds: owners(edge.from),
      calleeFunctionIds: unique(
        functionsAt.all(edge.addressSpace, edge.toAddress).map((row2) => String(row2.id))
      ),
      fromOutputOffsets: offsets([edge.from]),
      toOutputOffsets: offsets(edge.to ? [edge.to] : []),
      indirect: edge.indirect,
      ...edge.override ? { override: edge.override } : {},
      ...edge.explanation ? { explanation: edge.explanation } : {},
      evidence: edge.evidence
    });
  }
  const unresolved = [];
  const unresolvedNodes = db.prepare(
    "SELECT from_id FROM query_graph_edges WHERE kind='unresolved' AND address_space=? AND from_address=?"
  );
  for (const row of db.prepare("SELECT payload FROM analysis WHERE kind='unresolved'").iterate()) {
    const record = decode3(row.payload);
    const nodeIds = unique(
      unresolvedNodes.all(record.addressSpace, record.address).map((row2) => String(row2.from_id))
    );
    unresolved.push({
      id: record.id,
      addressSpace: record.addressSpace,
      address: record.address,
      flowKind: record.flowKind,
      indirect: record.indirect,
      reason: record.reason,
      nodeIds,
      ownerFunctionIds: unique(nodeIds.flatMap(owners)),
      outputOffsets: offsets(nodeIds),
      evidence: record.evidence
    });
  }
  const incoming = /* @__PURE__ */ new Map(), outgoing = /* @__PURE__ */ new Map(), unresolvedByOwner = /* @__PURE__ */ new Map();
  const append = (map, owner, id) => {
    let ids = map.get(owner);
    if (!ids) {
      ids = [];
      map.set(owner, ids);
    }
    ids.push(id);
  };
  for (const call of calls) {
    for (const id of call.callerFunctionIds) {
      append(outgoing, id, call.id);
    }
    for (const id of call.calleeFunctionIds) {
      append(incoming, id, call.id);
    }
  }
  for (const record of unresolved) {
    for (const id of record.ownerFunctionIds) {
      append(unresolvedByOwner, id, record.id);
    }
  }
  const owned = db.prepare(
    "SELECT n.id,n.address,n.file_offset FROM query_graph_nodes e JOIN query_graph_nodes n ON n.owner=e.id WHERE e.address_space=? AND e.address=?"
  );
  const labels = db.prepare("SELECT payload FROM labels WHERE address_space=? AND address=?");
  const functions = [];
  for (const row of db.prepare("SELECT payload FROM analysis WHERE kind='function'").iterate()) {
    const fn = decode3(row.payload);
    const nodes = owned.all(fn.addressSpace, fn.address);
    functions.push({
      id: fn.id,
      addressSpace: fn.addressSpace,
      address: fn.address,
      source: fn.source,
      labels: labels.all(fn.addressSpace, fn.address).map((row2) => {
        const { id, name } = decode3(row2.payload);
        return { id, name };
      }).sort((a, b) => a.id.localeCompare(b.id)),
      nodeIds: unique(nodes.map((row2) => String(row2.id))),
      outputOffsets: numbers(
        nodes.filter((row2) => row2.address === fn.address && row2.file_offset !== null).map((row2) => Number(row2.file_offset))
      ),
      incomingCallIds: unique(incoming.get(fn.id) ?? []),
      outgoingCallIds: unique(outgoing.get(fn.id) ?? []),
      unresolvedIds: unique(unresolvedByOwner.get(fn.id) ?? []),
      evidence: fn.evidence
    });
  }
  functions.sort(
    (a, b) => a.addressSpace.localeCompare(b.addressSpace) || a.address - b.address || a.id.localeCompare(b.id)
  );
  calls.sort(
    (a, b) => a.addressSpace.localeCompare(b.addressSpace) || a.fromAddress - b.fromAddress || a.toAddress - b.toAddress || a.id.localeCompare(b.id)
  );
  unresolved.sort(
    (a, b) => a.addressSpace.localeCompare(b.addressSpace) || a.address - b.address || a.id.localeCompare(b.id)
  );
  const graph = {
    functions,
    calls,
    unresolved,
    orphanCallIds: unique(
      calls.filter((c) => !c.callerFunctionIds.length || !c.calleeFunctionIds.length).map((c) => c.id)
    ),
    orphanUnresolvedIds: unique(
      unresolved.filter((r) => !r.ownerFunctionIds.length).map((r) => r.id)
    )
  };
  return graph;
};
var publishGraph = (db) => {
  db.exec(`CREATE TABLE IF NOT EXISTS main.query_graph_nodes(id TEXT PRIMARY KEY,address_space TEXT,address INTEGER,file_offset INTEGER,owner TEXT) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS main.query_graph_owner ON query_graph_nodes(owner);
    CREATE INDEX IF NOT EXISTS main.query_graph_location ON query_graph_nodes(address_space,address);
    CREATE TABLE IF NOT EXISTS main.query_graph_edges(id TEXT PRIMARY KEY,kind TEXT,address_space TEXT,from_address INTEGER,from_id TEXT,payload TEXT) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS main.query_graph_edge_location ON query_graph_edges(kind,address_space,from_address);
    DELETE FROM main.query_graph_nodes;INSERT INTO main.query_graph_nodes SELECT * FROM temp.query_graph_nodes;
    DELETE FROM main.query_graph_edges;INSERT INTO main.query_graph_edges SELECT * FROM temp.query_graph_edges;`);
};

// packages/disassembler/src/sqlite-maintenance.ts
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
var SQLITE_MIGRATION_DIRECTORY = ".analysis-storage-migration";
var assertNoSqliteMigration = (file) => {
  if (import_node_fs2.default.existsSync(import_node_path3.default.join(import_node_path3.default.dirname(file), SQLITE_MIGRATION_DIRECTORY))) {
    throw new Error(
      "Analysis storage migration is in progress. Retry after it completes, or run project-migrate to recover an interrupted migration."
    );
  }
};
var sqliteFileIdentity = (file) => {
  const stat = import_node_fs2.default.statSync(file, { bigint: true });
  return `${stat.dev}:${stat.ino}`;
};

// packages/disassembler/src/sqlite-runtime-storage.ts
var import_node_crypto2 = require("node:crypto");
var RUNTIME_STORAGE_SCHEMA = `
CREATE TABLE runtime_facts (
  fid INTEGER PRIMARY KEY, fingerprint BLOB UNIQUE,
  kind TEXT NOT NULL, architecture TEXT NOT NULL,
  address_space TEXT, address INTEGER, start INTEGER, "end" INTEGER,
  from_address_space TEXT, from_address INTEGER, to_address_space TEXT, to_address INTEGER,
  instruction_address_space TEXT, instruction_address INTEGER,
  accessed_address_space TEXT, accessed_address INTEGER, coverage TEXT, payload BLOB
);
CREATE TABLE runtime_observations (
  oid INTEGER PRIMARY KEY, fact_id INTEGER NOT NULL REFERENCES runtime_facts(fid),
  prefix_id INTEGER NOT NULL REFERENCES runtime_prefixes(id), id BLOB NOT NULL,
  evidence_id INTEGER NOT NULL REFERENCES runtime_evidence(id), count INTEGER NOT NULL,
  state_prefix_id INTEGER REFERENCES runtime_prefixes(id), state_id BLOB,
  query_file_offset INTEGER, query_size INTEGER, query_data BLOB, query_ready INTEGER NOT NULL DEFAULT 0,
  UNIQUE(prefix_id,id), UNIQUE(state_prefix_id,state_id),
  CHECK ((state_prefix_id IS NULL) = (state_id IS NULL))
);
CREATE INDEX runtime_observation_fact ON runtime_observations(fact_id);
CREATE VIEW runtime AS
 SELECT o.oid AS rowid,o.prefix_id,o.id,f.kind,f.architecture,o.count,
 f.address_space,f.address,f.start,f."end",f.from_address_space,f.from_address,
 f.to_address_space,f.to_address,f.instruction_address_space,f.instruction_address,
 f.accessed_address_space,f.accessed_address,f.coverage,o.evidence_id,
 CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload,
 o.query_file_offset,o.query_size,o.query_data,o.query_ready
 FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id
 UNION ALL
 SELECT -o.oid,o.state_prefix_id,o.state_id,'runtime-cpu-state',f.architecture,o.count,
 f.address_space,f.address,f.start,f."end",f.from_address_space,f.from_address,
 f.to_address_space,f.to_address,f.instruction_address_space,f.instruction_address,
 f.accessed_address_space,f.accessed_address,f.coverage,o.evidence_id,
 CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END,NULL,NULL,NULL,1
 FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id WHERE o.state_id IS NOT NULL;
CREATE TRIGGER runtime_collect_fact AFTER DELETE ON runtime_observations BEGIN
 DELETE FROM runtime_facts WHERE fid=OLD.fact_id AND NOT EXISTS(SELECT 1 FROM runtime_observations WHERE fact_id=OLD.fact_id);
END;
CREATE TRIGGER runtime_query_update INSTEAD OF UPDATE OF query_file_offset,query_size,query_data,query_ready ON runtime BEGIN
 UPDATE runtime_observations SET query_file_offset=NEW.query_file_offset,query_size=NEW.query_size,
 query_data=NEW.query_data,query_ready=NEW.query_ready WHERE oid=OLD.rowid;
END;
-- Compatibility mutations detach one logical record. They must never change another capture's shared fact.
CREATE TRIGGER runtime_insert INSTEAD OF INSERT ON runtime BEGIN
 INSERT INTO runtime_facts(kind,architecture,address_space,address,start,"end",from_address_space,from_address,
 to_address_space,to_address,instruction_address_space,instruction_address,accessed_address_space,accessed_address,coverage,payload)
 VALUES(NEW.kind,NEW.architecture,NEW.address_space,NEW.address,NEW.start,NEW."end",NEW.from_address_space,NEW.from_address,
 NEW.to_address_space,NEW.to_address,NEW.instruction_address_space,NEW.instruction_address,NEW.accessed_address_space,NEW.accessed_address,NEW.coverage,
 CASE WHEN json_valid(NEW.payload) THEN jsonb(NEW.payload) ELSE NEW.payload END);
 INSERT INTO runtime_observations(fact_id,prefix_id,id,evidence_id,count,query_file_offset,query_size,query_data,query_ready)
 VALUES(last_insert_rowid(),NEW.prefix_id,NEW.id,NEW.evidence_id,NEW.count,NEW.query_file_offset,NEW.query_size,NEW.query_data,
 CASE WHEN NEW.kind='runtime-execution' THEN 0 ELSE 1 END);
END;
CREATE TRIGGER runtime_delete INSTEAD OF DELETE ON runtime BEGIN
 -- Deleting just the instruction preserves its independent logical state record.
 INSERT INTO runtime_facts(kind,architecture,address_space,address,payload)
 SELECT 'runtime-cpu-state',f.architecture,f.address_space,f.address,f.payload
 FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id WHERE o.oid=OLD.rowid AND o.state_id IS NOT NULL;
 INSERT INTO runtime_observations(fact_id,prefix_id,id,evidence_id,count,query_ready)
 SELECT last_insert_rowid(),state_prefix_id,state_id,evidence_id,count,1 FROM runtime_observations WHERE oid=OLD.rowid AND state_id IS NOT NULL;
 UPDATE runtime_observations SET state_prefix_id=NULL,state_id=NULL WHERE oid=-OLD.rowid;
 -- A preceding instruction deletion may have detached this virtual state; stable identity still finds it.
 DELETE FROM runtime_observations WHERE prefix_id=OLD.prefix_id AND id=OLD.id;
END;
CREATE TRIGGER runtime_record_update INSTEAD OF UPDATE OF prefix_id,id,kind,architecture,count,address_space,address,start,"end",
 from_address_space,from_address,to_address_space,to_address,instruction_address_space,instruction_address,
 accessed_address_space,accessed_address,coverage,evidence_id,payload ON runtime BEGIN
 DELETE FROM runtime WHERE prefix_id=OLD.prefix_id AND id=OLD.id;
 INSERT INTO runtime(prefix_id,id,kind,architecture,count,address_space,address,start,"end",from_address_space,from_address,
 to_address_space,to_address,instruction_address_space,instruction_address,accessed_address_space,accessed_address,coverage,evidence_id,payload)
 VALUES(NEW.prefix_id,NEW.id,NEW.kind,NEW.architecture,NEW.count,NEW.address_space,NEW.address,NEW.start,NEW."end",NEW.from_address_space,NEW.from_address,
 NEW.to_address_space,NEW.to_address,NEW.instruction_address_space,NEW.instruction_address,NEW.accessed_address_space,NEW.accessed_address,NEW.coverage,NEW.evidence_id,NEW.payload);
END;
`;
var SqliteRuntimeWriter = class {
  #findFact;
  #insertFact;
  #insertObservation;
  #pair;
  #findPair;
  #removeObservation;
  constructor(db) {
    this.#findFact = db.prepare("SELECT fid FROM runtime_facts WHERE fingerprint=?");
    this.#insertFact = db.prepare(`INSERT INTO runtime_facts(fingerprint,kind,architecture,address_space,address,start,"end",
      from_address_space,from_address,to_address_space,to_address,instruction_address_space,instruction_address,
      accessed_address_space,accessed_address,coverage,payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN typeof(?)='text' THEN jsonb(?) ELSE ? END)`);
    this.#insertObservation = db.prepare(
      "INSERT INTO runtime_observations(fact_id,prefix_id,id,evidence_id,count,state_prefix_id,state_id,query_ready) VALUES(?,?,?,?,?,?,?,?)"
    );
    this.#pair = db.prepare(
      "UPDATE runtime_observations SET state_prefix_id=?,state_id=? WHERE oid=?"
    );
    this.#findPair = db.prepare(`SELECT o.*,f.kind,f.architecture,f.address_space,f.address,CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
      FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id
      WHERE o.prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) AND o.id=?`);
    this.#removeObservation = db.prepare("DELETE FROM runtime_observations WHERE oid=?");
  }
  /** Append one validated logical record. Only exact trace pairs share a count/provenance link.
   * @param {RuntimeEvidenceRecord} record Validated source fact with a stable external ID.
   * @param {Function} intern Transaction-owned prefix/evidence dictionary allocator.
   */
  insert(record, intern) {
    const identity = sqliteRuntimeIdentity(record.id);
    const prefix = intern("runtime_prefixes", identity.prefix);
    const evidence = intern("runtime_evidence", JSON.stringify(record.evidence));
    const columns = runtimeColumns(record);
    let statePrefix = null;
    let stateId = null;
    const match = /^runtime:instruction-trace:([\da-f]{64}):(code|state):([\da-f]{64})$/.exec(
      record.id
    );
    if (match && (record.kind === "runtime-instruction" || record.kind === "runtime-cpu-state")) {
      const counterpart = match[2] === "code" ? "state" : "code";
      const otherIdentity = sqliteRuntimeIdentity(
        `runtime:instruction-trace:${match[1]}:${counterpart}:${match[3]}`
      );
      const other = this.#findPair.get(otherIdentity.prefix, otherIdentity.suffix);
      const expectedKind = record.kind === "runtime-instruction" ? "runtime-cpu-state" : "runtime-instruction";
      if (other && other.kind === expectedKind && other.state_id === null && other.count === record.count && other.evidence_id === evidence && other.architecture === record.architecture && other.address_space === record.addressSpace && other.address === record.address && canonicalJson(
        JSON.parse(decodeSqlitePayload(other.payload)).state
      ) === canonicalJson(record.state)) {
        if (record.kind === "runtime-cpu-state") {
          this.#pair.run(prefix, identity.suffix, other.oid);
          return;
        }
        statePrefix = Number(other.prefix_id);
        stateId = other.id;
        this.#removeObservation.run(other.oid);
      }
    }
    const payload = columns.payload;
    const fingerprint = (0, import_node_crypto2.createHash)("sha256").update(
      // Fixed scalar fields in canonicalJson's key order avoid sorting/cloning
      // per row. Nulls, two-space indentation and the trailing newline preserve
      // persisted v2 fingerprints; changing the layout would duplicate old facts.
      // Keep this list aligned with runtimeColumns and the all-variant fingerprint test.
      JSON.stringify(
        {
          accessedAddress: columns.accessedAddress,
          accessedAddressSpace: columns.accessedAddressSpace,
          address: columns.address,
          addressSpace: columns.addressSpace,
          architecture: record.architecture,
          coverage: columns.coverage,
          end: columns.end,
          fromAddress: columns.fromAddress,
          fromAddressSpace: columns.fromAddressSpace,
          instructionAddress: columns.instructionAddress,
          instructionAddressSpace: columns.instructionAddressSpace,
          kind: record.kind,
          payload,
          start: columns.start,
          toAddress: columns.toAddress,
          toAddressSpace: columns.toAddressSpace
        },
        void 0,
        2
      ) + "\n"
    ).digest();
    const found = this.#findFact.get(fingerprint);
    let fid = found?.fid;
    if (fid === void 0) {
      const encoded = payload === null ? null : encodeSqlitePayload(payload);
      fid = this.#insertFact.run(
        fingerprint,
        record.kind,
        record.architecture,
        columns.addressSpace,
        columns.address,
        columns.start,
        columns.end,
        columns.fromAddressSpace,
        columns.fromAddress,
        columns.toAddressSpace,
        columns.toAddress,
        columns.instructionAddressSpace,
        columns.instructionAddress,
        columns.accessedAddressSpace,
        columns.accessedAddress,
        columns.coverage,
        encoded,
        encoded,
        encoded
      ).lastInsertRowid;
    }
    this.#insertObservation.run(
      fid,
      prefix,
      identity.suffix,
      evidence,
      record.count,
      statePrefix,
      stateId,
      record.kind === "runtime-execution" ? 0 : 1
    );
  }
};

// packages/disassembler/src/sqlite-source-query.ts
var collections = ["labels", "comments", "annotations", "regions"];
var sourceEvidence = `WITH source_evidence AS (
  SELECT DISTINCT e.id FROM runtime_evidence e, json_each(e.value) member
  WHERE member.value IN (SELECT value FROM json_each(?)))`;
var sourceRuntime = "r.evidence_id IN (SELECT id FROM source_evidence)";
var instructionKinds = "r.kind IN ('runtime-execution','runtime-instruction')";
var hex = (address) => `$${address.toString(16).toUpperCase().padStart(6, "0")}`;
var sourceQueriesReady = (db) => Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_source_rows'").get()) && !db.prepare("SELECT 1 FROM query_source_rows WHERE ready=0 LIMIT 1").get();
var prepareSourceQueries = (db) => {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_source_rows'").get()) {
    db.exec(`CREATE INDEX IF NOT EXISTS runtime_source ON runtime_observations(evidence_id,fact_id);
      CREATE TABLE query_source_rows(collection TEXT NOT NULL,id TEXT NOT NULL,ready INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(collection,id)) WITHOUT ROWID;
      CREATE INDEX query_source_pending ON query_source_rows(ready) WHERE ready=0;
      CREATE TABLE query_source_links(evidence_id TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(evidence_id,collection,id)) WITHOUT ROWID;
      CREATE INDEX query_source_record ON query_source_links(collection,id);`);
    for (const table of collections) {
      db.exec(`INSERT INTO query_source_rows(collection,id) SELECT '${table}',id FROM ${table};
        CREATE TRIGGER query_source_${table}_insert AFTER INSERT ON ${table} BEGIN
          INSERT OR REPLACE INTO query_source_rows(collection,id) VALUES('${table}',NEW.id); END;
        CREATE TRIGGER query_source_${table}_delete AFTER DELETE ON ${table} BEGIN
          DELETE FROM query_source_links WHERE collection='${table}' AND id=OLD.id;
          DELETE FROM query_source_rows WHERE collection='${table}' AND id=OLD.id; END;
        CREATE TRIGGER query_source_${table}_update AFTER UPDATE ON ${table} BEGIN
          DELETE FROM query_source_links WHERE collection='${table}' AND id=OLD.id;
          DELETE FROM query_source_rows WHERE collection='${table}' AND id=OLD.id;
          INSERT OR REPLACE INTO query_source_rows(collection,id) VALUES('${table}',NEW.id); END;`);
    }
  }
  const remove = db.prepare("DELETE FROM query_source_links WHERE collection=? AND id=?");
  const insert = db.prepare(
    "INSERT OR IGNORE INTO query_source_links(evidence_id,collection,id) VALUES(?,?,?)"
  );
  const ready = db.prepare("UPDATE query_source_rows SET ready=1 WHERE collection=? AND id=?");
  for (const table of collections) {
    const pending = db.prepare(
      `SELECT q.id,t.payload FROM query_source_rows q JOIN ${table} t ON t.id=q.id WHERE q.collection=? AND q.ready=0 LIMIT 1024`
    );
    for (let rows = pending.all(table); rows.length; rows = pending.all(table)) {
      for (const row of rows) {
        const record = JSON.parse(decodeSqlitePayload(row.payload));
        if (!Array.isArray(record.evidence) || record.evidence.some((id) => typeof id !== "string")) {
          throw new Error("Invalid source metadata evidence membership.");
        }
        remove.run(table, row.id);
        for (const id of record.evidence) {
          insert.run(id, table, row.id);
        }
        ready.run(table, row.id);
      }
    }
  }
};
var readSourceSummary = (db, source) => {
  const evidence = JSON.stringify(source.evidenceIds);
  const instructionCount = Number(
    db.prepare(`${sourceEvidence} SELECT count(*) AS n FROM (
    SELECT r.architecture,r.address_space,r.address FROM runtime r WHERE ${sourceRuntime} AND ${instructionKinds}
    GROUP BY r.architecture,r.address_space,r.address)`).get(evidence)?.n ?? 0
  );
  const memoryCount = Number(
    db.prepare(`${sourceEvidence} SELECT count(*) AS n FROM runtime r
    WHERE ${sourceRuntime} AND r.kind='runtime-memory-access'`).get(evidence)?.n ?? 0
  );
  const contributionCount = Number(
    db.prepare(`SELECT count(*) AS n FROM (
    SELECT DISTINCT collection,id FROM query_source_links WHERE evidence_id IN (SELECT value FROM json_each(?)))`).get(evidence)?.n ?? 0
  );
  return { source, instructionCount, memoryCount, contributionCount };
};
var readSourcePage = (db, source, group, offset = 0) => {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Invalid source page offset.");
  }
  const evidence = JSON.stringify(source.evidenceIds);
  if (group === "instructions") {
    const rows = db.prepare(`${sourceEvidence} SELECT r.architecture,r.address_space,r.address,
      SUM(CASE WHEN r.kind='runtime-execution' THEN r.count ELSE 0 END) AS executions
      FROM runtime r WHERE ${sourceRuntime} AND ${instructionKinds}
      GROUP BY r.architecture,r.address_space,r.address ORDER BY r.architecture,r.address_space,r.address LIMIT 200 OFFSET ?`).all(evidence, offset);
    const offsets = db.prepare(`${sourceEvidence} SELECT DISTINCT q.file_offset FROM runtime r
      JOIN query_execution_offsets q ON q.row_id=r.rowid WHERE ${sourceRuntime} AND r.kind='runtime-execution'
      AND r.architecture=? AND r.address_space=? AND r.address=? AND q.file_offset IS NOT NULL ORDER BY q.file_offset`);
    return rows.map((row) => ({
      id: JSON.stringify([row.architecture, row.address_space, row.address]),
      label: hex(Number(row.address)),
      description: `${String(row.executions)} recorded executions`,
      detail: "Directly observed instruction address. CPU-state variants do not inflate the address count; execution counts exclude duplicate fetched-instruction facts.",
      architecture: String(row.architecture),
      addressSpace: String(row.address_space),
      address: Number(row.address),
      outputOffsets: offsets.all(evidence, row.architecture, row.address_space, row.address).map((entry) => Number(entry.file_offset)),
      recordIds: []
    }));
  }
  if (group === "memory") {
    return db.prepare(`${sourceEvidence} SELECT r.*,p.value AS id_prefix,e.value AS evidence
      FROM runtime r JOIN runtime_prefixes p ON p.id=r.prefix_id JOIN runtime_evidence e ON e.id=r.evidence_id
      WHERE ${sourceRuntime} AND r.kind='runtime-memory-access' ORDER BY r.evidence_id,r.kind,r.rowid LIMIT 200 OFFSET ?`).all(evidence, offset).map((row) => {
      const record = runtimeFromRow(row);
      if (record.kind !== "runtime-memory-access") {
        throw new Error("Invalid memory observation.");
      }
      const detail = `${record.access} ${record.accessedAddressSpace}:${hex(record.accessedAddress)} \xB7 ${record.width} byte(s) \xB7 ${record.count} observations`;
      return {
        id: record.id,
        label: hex(record.instructionAddress),
        description: detail,
        detail,
        architecture: record.architecture,
        addressSpace: record.instructionAddressSpace,
        address: record.instructionAddress,
        outputOffsets: [],
        recordIds: [record.id]
      };
    });
  }
  if (group !== "contributions") {
    throw new Error("Unknown source contribution group.");
  }
  const select = collections.map(
    (table) => `SELECT '${table}' AS collection,t.id AS id,t.payload AS payload FROM ${table} t JOIN matched m ON m.collection='${table}' AND m.id=t.id`
  ).join(" UNION ALL ");
  return db.prepare(`WITH matched AS (SELECT DISTINCT collection,id FROM query_source_links WHERE evidence_id IN (SELECT value FROM json_each(?)))
    ${select} ORDER BY collection,id LIMIT 200 OFFSET ?`).all(evidence, offset).map((row) => {
    const record = JSON.parse(decodeSqlitePayload(row.payload));
    const address = record.address ?? record.start;
    const label = record.name ?? record.text ?? record.classification ?? record.id;
    return {
      id: `${String(row.collection)}:${record.id}`,
      label,
      description: String(row.collection),
      detail: `Attributed to ${source.name}: ${record.id}`,
      addressSpace: record.addressSpace,
      address,
      architecture: record.architecture,
      outputOffsets: [],
      recordIds: [record.id]
    };
  });
};

// packages/disassembler/src/sqlite-storage-policy.ts
var import_node_fs3 = __toESM(require("node:fs"), 1);
var DEFAULT_ANALYSIS_STORAGE_POLICY = {
  cacheMaxBytes: 256 * 1024 ** 2,
  databaseMaxBytes: 0
};
var CAPTURE_CATALOG_SCHEMA = `CREATE TABLE capture_catalog (
  sha256 TEXT PRIMARY KEY, profile TEXT NOT NULL, source_name TEXT NOT NULL,
  imported_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
  observed_events INTEGER NOT NULL, dropped_events INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;`;
var readStoragePolicy = (db) => {
  const value = db.prepare("SELECT v FROM meta WHERE k='storage-policy'").get()?.v;
  return validateStoragePolicy(
    value ? JSON.parse(String(value)) : {}
  );
};
var validateStoragePolicy = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Storage policy must be an object containing explicit limits.");
  }
  const policy = { ...DEFAULT_ANALYSIS_STORAGE_POLICY, ...value };
  for (const [key2, count] of Object.entries(policy)) {
    if (!Object.hasOwn(DEFAULT_ANALYSIS_STORAGE_POLICY, key2) || !Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Invalid storage limit '${key2}'. Use nonnegative integer byte limits.`);
    }
  }
  return policy;
};
var storageSnapshot = (db, file) => {
  const size = Number(db.prepare("PRAGMA page_size").get().page_size);
  const pages = Number(db.prepare("PRAGMA page_count").get().page_count);
  const free = Number(db.prepare("PRAGMA freelist_count").get().freelist_count);
  const rows = db.prepare("SELECT COUNT(*) AS n,COUNT(state_id) AS paired FROM runtime_observations").get();
  const captures = db.prepare("SELECT COUNT(*) AS n FROM capture_catalog").get();
  let walBytes = 0;
  try {
    walBytes = import_node_fs3.default.statSync(`${file}-wal`).size;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
  return {
    databaseBytes: import_node_fs3.default.statSync(file).size,
    walBytes,
    livePageBytes: (pages - free) * size,
    freePageBytes: free * size,
    facts: Number(db.prepare("SELECT COUNT(*) AS n FROM runtime_facts").get().n),
    observations: Number(rows.n),
    pairedStates: Number(rows.paired),
    captures: Number(captures.n)
  };
};
var enforceDatabaseBudget = (db) => {
  const budget = readStoragePolicy(db).databaseMaxBytes;
  if (!budget) {
    return;
  }
  const pages = Number(db.prepare("PRAGMA page_count").get().page_count) - Number(db.prepare("PRAGMA freelist_count").get().freelist_count);
  const bytes = pages * Number(db.prepare("PRAGMA page_size").get().page_size);
  if (bytes > budget) {
    throw new Error(
      `Analysis database exceeds its ${Math.ceil(budget / 1024 ** 2)} MiB storage budget. Publication rolled back; increase the budget or run storage maintenance.`
    );
  }
};
var CACHES = [
  { key: "coverage", tables: ["query_coverage_segments", "query_coverage_details"] },
  { key: "graph", tables: ["query_graph_nodes", "query_graph_edges"] },
  { key: "instruction_variants", tables: ["query_runtime_variants"] },
  { key: "runtime_architectures", tables: ["query_runtime_architectures"] },
  { key: "evidence_links", tables: ["query_evidence_links"] }
];
var cacheTableBytes = (db, table) => {
  const allocation = db.prepare("SELECT COALESCE(SUM(pgsize),0) AS bytes FROM dbstat WHERE name=?");
  return db.prepare("SELECT name FROM sqlite_schema WHERE tbl_name=? AND type IN ('table','index')").all(table).reduce((bytes, row) => bytes + Number(allocation.get(row.name).bytes), 0);
};
var optionalCacheBytes = (db) => CACHES.reduce(
  (bytes, cache) => bytes + cache.tables.reduce((n, table) => n + cacheTableBytes(db, table), 0),
  cacheTableBytes(db, "query_cache")
);
var maintainStorageCaches = (db) => {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_cache'").get()) {
    return { evicted: [], cacheBytes: 0 };
  }
  const budget = readStoragePolicy(db).cacheMaxBytes;
  const entries = CACHES.map((cache) => ({
    ...cache,
    bytes: cache.tables.reduce((n, table) => n + cacheTableBytes(db, table), 0)
  }));
  let cacheBytes = entries.reduce((n, cache) => n + cache.bytes, 0) + cacheTableBytes(db, "query_cache");
  const evicted = [];
  for (const cache of entries) {
    const token = db.prepare("SELECT signature FROM query_cache WHERE name=?").get(cache.key);
    if (String(token?.signature).startsWith("pending:")) {
      continue;
    }
    if (token && cacheBytes <= budget) {
      continue;
    }
    for (const table of cache.tables) {
      if (db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(table)) {
        db.exec(`DELETE FROM ${table}`);
      }
    }
    db.prepare("DELETE FROM query_cache WHERE name=?").run(cache.key);
    if (cache.bytes) {
      evicted.push(cache.key);
    }
    cacheBytes -= cache.bytes;
  }
  return { evicted, cacheBytes: optionalCacheBytes(db) };
};

// packages/disassembler/src/trace-cache.ts
var TraceCache = class {
  #entries = /* @__PURE__ */ new Map();
  /** Dense victim slots avoid scanning the Map; hits never reorder either structure. */
  #keys = [];
  #metrics;
  #random = 2654435769;
  constructor(metrics) {
    this.#metrics = metrics;
  }
  /** Look up a value; undefined is reserved for misses.
   * @param {string} key Complete semantic key, never a lossy coordinate projection.
   * @returns {T | undefined} Retained value, or a cache miss.
   */
  get(key2) {
    const value = this.#entries.get(key2);
    if (this.#metrics) {
      if (value === void 0) {
        this.#metrics.misses++;
      } else {
        this.#metrics.hits++;
      }
    }
    return value;
  }
  /** Insert a missing key, returning the displaced entry so its owner can flush it.
   * Existing keys must be updated through their caller-owned mutable value instead.
   * @param {string} key Previously missing semantic key.
   * @param {T} value Defined value whose ownership stays with the caller.
   * @returns {object | undefined} Displaced key/value, or undefined while filling unused capacity.
   */
  insert(key2, value) {
    let displaced;
    if (this.#keys.length === 4096) {
      let random = this.#random;
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      this.#random = random;
      const slot = random & 4095;
      const victim = this.#keys[slot];
      displaced = { key: victim, value: this.#entries.get(victim) };
      this.#entries.delete(victim);
      this.#keys[slot] = key2;
      if (this.#metrics) {
        this.#metrics.evictions++;
      }
    } else {
      this.#keys.push(key2);
      if (this.#metrics) {
        this.#metrics.peakEntries = Math.max(this.#metrics.peakEntries, this.#keys.length);
      }
    }
    this.#entries.set(key2, value);
    return displaced;
  }
  /** Iterate the retained working set, for a final durable delta flush.
   * @returns {MapIterator} Live entries; do not insert while iterating.
   */
  entries() {
    return this.#entries.entries();
  }
  /** Drop retained values after a flush or failed import; diagnostics remain cumulative. */
  clear() {
    this.#entries.clear();
    this.#keys.length = 0;
    this.#random = 2654435769;
  }
};

// packages/disassembler/src/sqlite-store.ts
var ANALYSIS_PROJECT_SQLITE_FILE = "analysis.sqlite";
var ANALYSIS_SQLITE_STORAGE_VERSION = 2;
var SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT NOT NULL PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS labels (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  address INTEGER NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  address INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS regions (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  classification TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analysis (
  id TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL,
  address_space TEXT,
  address INTEGER,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS imports (
  id TEXT NOT NULL PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runtime_prefixes (
  id INTEGER PRIMARY KEY,
  value TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS runtime_evidence (
  id INTEGER PRIMARY KEY,
  value TEXT NOT NULL UNIQUE
);
${RUNTIME_STORAGE_SCHEMA}
${CAPTURE_CATALOG_SCHEMA}
PRAGMA user_version=2;
`;
var SCHEMA_INDEX_STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS labels_addr ON labels (address_space, address)",
  "CREATE INDEX IF NOT EXISTS comments_addr ON comments (address_space, address)",
  'CREATE INDEX IF NOT EXISTS regions_range ON regions (address_space, start, "end")',
  'CREATE INDEX IF NOT EXISTS annotations_range ON annotations (address_space, start, "end")',
  // Point lookups through the virtual-state branch need an index on its exposed negative ID.
  "CREATE INDEX IF NOT EXISTS runtime_state_row ON runtime_observations((-oid)) WHERE state_id IS NOT NULL",
  "CREATE INDEX IF NOT EXISTS runtime_lookup ON runtime_facts (kind, address_space, address, start)",
  "CREATE INDEX IF NOT EXISTS runtime_memory ON runtime_facts (instruction_address_space, instruction_address) WHERE kind='runtime-memory-access'"
];
var RUNTIME_SELECT = `SELECT r.*, r.rowid AS storage_rowid, p.value AS id_prefix, e.value AS evidence
  FROM runtime AS r LEFT JOIN runtime_prefixes AS p ON p.id=r.prefix_id
  LEFT JOIN runtime_evidence AS e ON e.id=r.evidence_id`;
var analysisProjectSqlitePath = (directory, manifest) => {
  const relative = manifest.db ?? ANALYSIS_PROJECT_SQLITE_FILE;
  if (relative !== ANALYSIS_PROJECT_SQLITE_FILE) {
    throw new Error(`Unsupported analysis sqlite path '${relative}'.`);
  }
  return import_node_path4.default.join(directory, relative);
};
var parseRecord = (payload) => JSON.parse(decodeSqlitePayload(payload));
var SqliteAnalysisStore = class {
  #database;
  #fileIdentity;
  /** Database path as supplied at construction; resolves relative to cwd when not absolute. */
  file;
  #insertEvidence;
  #insertLabel;
  #insertComment;
  #insertRegion;
  #insertAnnotation;
  #insertAnalysis;
  #insertImport;
  #runtimeWriter;
  #findRuntime;
  #dictionaryStatements = /* @__PURE__ */ new Map();
  /** Transaction-local cache: rollback or another writer cannot leave stale integer references here. */
  #dictionaryIds = /* @__PURE__ */ new Map();
  #dictionaryCacheBytes = 0;
  /**
   * Opens or creates a project database.
   * Opening validates physical format, not every semantic record, and may create SQLite journal files.
   * Connections use a 5,000 ms busy timeout; lock contention can still throw a SQLite error.
   * @param {string} file SQLite path; parent directory must already exist.
   * @param {boolean} [createSchema] Defaults to true; permit initialization of an empty database, never upgrade an existing one.
   * @param {boolean} [deferIndexes] Defaults to false; migration-only bulk load, completed by finishMigration.
   */
  constructor(file, createSchema = true, deferIndexes = false) {
    assertNoSqliteMigration(file);
    if (!createSchema && !import_node_fs4.default.existsSync(file)) {
      throw new Error(`Analysis database does not exist: ${file}`);
    }
    this.file = file;
    this.#database = new import_node_sqlite2.DatabaseSync(file, { open: true });
    this.#database.function(
      "analysis_json",
      { deterministic: true },
      (value) => value === null ? "{}" : decodeSqlitePayload(value)
    );
    this.#fileIdentity = sqliteFileIdentity(file);
    try {
      const empty = Number(this.#database.prepare("SELECT count(*) AS n FROM sqlite_schema").get()?.n) === 0;
      const initialVersion = Number(
        this.#database.prepare("PRAGMA user_version").get()?.user_version
      );
      if (createSchema && empty && initialVersion === 0) {
        this.#database.exec(SCHEMA);
        if (!deferIndexes) {
          for (const sql of SCHEMA_INDEX_STATEMENTS) {
            this.#database.exec(sql);
          }
        }
      }
      const version = Number(this.#database.prepare("PRAGMA user_version").get()?.user_version);
      if (version !== ANALYSIS_SQLITE_STORAGE_VERSION) {
        throw new Error(
          `Unsupported analysis storage format ${version}; expected ${ANALYSIS_SQLITE_STORAGE_VERSION}. Run uttori-asm project-migrate <project-directory> for an older SQLite project.`
        );
      }
      this.#database.exec(
        "PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-8192; PRAGMA busy_timeout=5000; PRAGMA temp_store=FILE; PRAGMA journal_size_limit=67108864;"
      );
      this.#insertEvidence = this.#database.prepare(
        "INSERT INTO evidence (id, payload) VALUES (?, ?)"
      );
      this.#insertLabel = this.#database.prepare(
        "INSERT INTO labels (id, address_space, address, name, payload) VALUES (?, ?, ?, ?, ?)"
      );
      this.#insertComment = this.#database.prepare(
        "INSERT INTO comments (id, address_space, address, payload) VALUES (?, ?, ?, ?)"
      );
      this.#insertRegion = this.#database.prepare(
        'INSERT INTO regions (id, address_space, start, "end", payload) VALUES (?, ?, ?, ?, ?)'
      );
      this.#insertAnnotation = this.#database.prepare(
        'INSERT INTO annotations (id, address_space, start, "end", classification, payload) VALUES (?, ?, ?, ?, ?, ?)'
      );
      this.#insertAnalysis = this.#database.prepare(
        "INSERT INTO analysis (id, kind, address_space, address, payload) VALUES (?, ?, ?, ?, ?)"
      );
      this.#insertImport = this.#database.prepare(
        "INSERT INTO imports (id, payload) VALUES (?, ?)"
      );
      for (const table of ["runtime_prefixes", "runtime_evidence"]) {
        this.#dictionaryStatements.set(table, {
          find: this.#database.prepare(`SELECT id FROM ${table} WHERE value=?`),
          insert: this.#database.prepare(`INSERT INTO ${table} (value) VALUES (?)`)
        });
      }
      this.#findRuntime = this.#database.prepare(`${RUNTIME_SELECT}
        WHERE r.prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) AND r.id=?`);
      this.#runtimeWriter = new SqliteRuntimeWriter(this.#database);
    } catch (error) {
      this.#database.close();
      throw error;
    }
  }
  /**
   * Preserve the triggering error when SQLite has already aborted (for example SQLITE_FULL).
   * A cleanup error must never replace the original failure reported to the user.
   */
  rollback() {
    this.#clearDictionaryCache();
    if (!this.#database.isTransaction) {
      return;
    }
    try {
      this.#database.exec("ROLLBACK");
    } catch {
    }
  }
  /** Forget all transaction-owned dictionary references and their bounded text allocation. */
  #clearDictionaryCache() {
    this.#dictionaryIds.clear();
    this.#dictionaryCacheBytes = 0;
  }
  /**
   * Intern exact text with a bounded cache; callers hold the SQLite writer lock.
   * @param {string} table One of the two prepared dictionary tables.
   * @param {string} value Exact prefix or serialized evidence list.
   * @returns {number} Transactionally created or existing dictionary rowid.
   */
  #intern(table, value) {
    const key2 = `${table}:${value}`;
    const cached = this.#dictionaryIds.get(key2);
    if (cached !== void 0) {
      return cached;
    }
    const statements = this.#dictionaryStatements.get(table);
    const found = statements.find.get(value);
    const id = found ? Number(found.id) : Number(statements.insert.run(value).lastInsertRowid);
    const bytes = Buffer.byteLength(key2);
    if (this.#dictionaryIds.size >= 256 || this.#dictionaryCacheBytes + bytes > 512 * 1024) {
      this.#clearDictionaryCache();
    }
    if (bytes <= 512 * 1024) {
      this.#dictionaryIds.set(key2, id);
      this.#dictionaryCacheBytes += bytes;
    }
    return id;
  }
  #insertRecord(kind, value) {
    if (kind === "evidence") {
      const record2 = value;
      this.#insertEvidence.run(record2.id, encodeSqlitePayload(JSON.stringify(record2)));
      return;
    }
    if (kind === "labels") {
      const record2 = value;
      this.#insertLabel.run(
        record2.id,
        record2.addressSpace,
        record2.address,
        record2.name,
        encodeSqlitePayload(JSON.stringify(record2))
      );
      return;
    }
    if (kind === "comments") {
      const record2 = value;
      this.#insertComment.run(
        record2.id,
        record2.addressSpace,
        record2.address,
        encodeSqlitePayload(JSON.stringify(record2))
      );
      return;
    }
    if (kind === "regions") {
      const record2 = value;
      this.#insertRegion.run(
        record2.id,
        record2.addressSpace,
        record2.start,
        record2.end,
        encodeSqlitePayload(JSON.stringify(record2))
      );
      return;
    }
    if (kind === "annotations") {
      const record2 = value;
      this.#insertAnnotation.run(
        record2.id,
        record2.addressSpace,
        record2.start,
        record2.end,
        record2.classification,
        encodeSqlitePayload(JSON.stringify(record2))
      );
      return;
    }
    if (kind === "analysis") {
      const record2 = value;
      const located = analysisAddress(record2);
      this.#insertAnalysis.run(
        record2.id,
        record2.kind,
        located.addressSpace,
        located.address,
        encodeSqlitePayload(JSON.stringify(record2))
      );
      return;
    }
    if (kind === "imports") {
      const record2 = value;
      this.#insertImport.run(record2.id, encodeSqlitePayload(JSON.stringify(record2)));
      this.recordCaptureReceipt(record2);
      return;
    }
    const record = value;
    this.#runtimeWriter.insert(record, (table, value2) => this.#intern(table, value2));
  }
  /**
   * Run a synchronous unit against one SQLite snapshot. Writers acquire their lock before reading
   * the revision so a competing process cannot slip between the stale check and publication.
   * Throwing rolls back records and manifest changes. Promise/thenable results are rejected; perform
   * async preparation before entering. Transactions cannot nest. Low-level callbacks must publish
   * the manifest themselves when changing semantic records; prefer the commitAnalysisProject APIs.
   * @param {Function} action Synchronous work; cursors must be consumed before returning.
   * @param {boolean} [write] Defaults to true (BEGIN IMMEDIATE); false uses deferred BEGIN for reads, not an enforced read-only connection.
   * @returns {T} Callback result after a successful commit.
   */
  transaction(action, write = true) {
    assertNoSqliteMigration(this.file);
    if (sqliteFileIdentity(this.file) !== this.#fileIdentity) {
      throw new Error(
        "Analysis database was replaced; close this connection and reload the project."
      );
    }
    this.#clearDictionaryCache();
    this.#database.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
    try {
      if (write) {
        upgradeQueryCacheStorage(this.#database);
      }
      const revision = write ? this.revision() : 0;
      const result = action();
      if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result && typeof result.then === "function") {
        void Promise.resolve(result).catch(() => void 0);
        throw new TypeError("Analysis transactions require a synchronous callback, not a Promise.");
      }
      if (write && this.revision() !== revision) {
        enforceDatabaseBudget(this.#database);
      }
      this.#database.exec("COMMIT");
      this.#clearDictionaryCache();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }
  /**
   * Index trace chunks in a connection-local disk table. This transaction never reads or writes
   * main, allowing other project writers to proceed during asynchronous capture parsing.
   * @param {Function} action Async parser using only the supplied temporary counter index.
   * @param {TraceIndexMetrics} metrics Optional caller-owned diagnostic counters.
   * @returns {Promise} Parser result after temporary counters commit; the index lives until connection close.
   */
  async indexTrace(action, metrics) {
    this.#database.exec(`CREATE TEMP TABLE trace_facts (
      id TEXT PRIMARY KEY, payload TEXT NOT NULL, count INTEGER NOT NULL
    ) WITHOUT ROWID; BEGIN;`);
    const increment = this.#database.prepare(
      "UPDATE temp.trace_facts SET count=count+1 WHERE id=?"
    );
    const insert = this.#database.prepare("INSERT INTO temp.trace_facts VALUES (?, ?, 1)");
    const values = this.#database.prepare("SELECT payload, count FROM temp.trace_facts");
    const incrementMany = this.#database.prepare(
      "UPDATE temp.trace_facts SET count=count+? WHERE id=?"
    );
    const pending = new TraceCache(metrics);
    const flushEntry = (key2, count) => {
      if (!count) {
        return;
      }
      incrementMany.run(count, key2);
      if (metrics) {
        metrics.sqlStatements++;
      }
    };
    const flush = () => {
      for (const [key2, entry] of pending.entries()) {
        flushEntry(key2, entry.count);
      }
      pending.clear();
    };
    const index = {
      add: (key2, create) => {
        const entry = pending.get(key2);
        if (entry !== void 0) {
          if (!Number.isSafeInteger(entry.count + 1)) {
            throw new Error("Trace count exceeds exact integer range.");
          }
          entry.count++;
          return false;
        }
        const displaced = pending.insert(key2, { count: 0 });
        if (displaced) {
          flushEntry(displaced.key, displaced.value.count);
        }
        if (metrics) {
          metrics.sqlStatements++;
        }
        if (increment.run(key2).changes !== 0) {
          return false;
        }
        insert.run(key2, JSON.stringify(create()));
        if (metrics) {
          metrics.sqlStatements++;
          metrics.payloads++;
        }
        return true;
      },
      values: function* () {
        flush();
        for (const row of values.iterate()) {
          yield {
            fact: parseRecord(row.payload),
            count: Number(row.count)
          };
        }
      },
      clear: () => {
        pending.clear();
        this.#database.exec("DELETE FROM temp.trace_facts");
      }
    };
    try {
      const result = await action(index);
      flush();
      this.#database.exec("COMMIT");
      this.#clearDictionaryCache();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }
  /** Require mutations to belong to an explicitly owned atomic publication. */
  #requireTransaction() {
    if (!this.#database.isTransaction) {
      throw new Error("Analysis mutation requires a transaction.");
    }
  }
  /** Apply a selected metadata edit by stable ID; omitted records are never deleted.
   * Validation and optimistic revision checks belong to the publication API.
   * @param {AnalysisProjectShards} before Original selected view.
   * @param {AnalysisProjectShards} after Edited selected view.
   */
  patchMetadata(before, after) {
    this.#requireTransaction();
    for (const kind of [
      "analysis",
      "annotations",
      "labels",
      "comments",
      "regions",
      "evidence",
      "imports"
    ]) {
      const previous = new Map(before[kind].map((record) => [record.id, record]));
      const next = new Map(after[kind].map((record) => [record.id, record]));
      const find = this.#database.prepare(`SELECT payload FROM ${kind} WHERE id=?`);
      const remove = this.#database.prepare(`DELETE FROM ${kind} WHERE id=?`);
      for (const id of /* @__PURE__ */ new Set([...previous.keys(), ...next.keys()])) {
        const prior = previous.get(id), record = next.get(id);
        if (canonicalJson(prior) === canonicalJson(record)) {
          continue;
        }
        const stored = find.get(id);
        if (canonicalJson(stored ? parseRecord(stored.payload) : void 0) !== canonicalJson(prior)) {
          throw new Error(`Selected ${kind} record '${id}' changed; reload before editing.`);
        }
        remove.run(id);
        if (record) {
          this.#insertRecord(kind, record);
        }
      }
    }
    const retained = new Set(after.evidence.map((record) => record.id));
    const removed = before.evidence.filter((record) => !retained.has(record.id)).map((record) => record.id);
    if (removed.length) {
      const ids = JSON.stringify(removed);
      for (const table of ["analysis", "annotations", "labels", "comments", "regions"]) {
        if (this.#database.prepare(
          `SELECT 1 FROM ${table} r,json_each(analysis_json(r.payload),'$.evidence') e WHERE e.value IN (SELECT value FROM json_each(?)) LIMIT 1`
        ).get(ids)) {
          throw new Error("Cannot remove evidence still referenced by retained project records.");
        }
      }
      this.validateRuntimeEvidence();
    }
  }
  /**
   * Replace only supplied tables, retaining byte-identical rows. The temporary ID set bounds
   * memory and deletes removed rows without rewriting unchanged metadata or runtime history.
   * Semantic validation belongs to the project publication API; this method must run in its transaction.
   * @param {Partial<AnalysisProjectShards>} shards Validated replacements for explicitly named tables.
   */
  replaceTables(shards) {
    this.#requireTransaction();
    this.#database.exec(
      "CREATE TEMP TABLE IF NOT EXISTS replacement_ids (id TEXT PRIMARY KEY) WITHOUT ROWID"
    );
    const remember = this.#database.prepare("INSERT INTO temp.replacement_ids VALUES (?)");
    const tables = /* @__PURE__ */ new Set([
      "analysis",
      "annotations",
      "labels",
      "comments",
      "regions",
      "runtime",
      "evidence",
      "imports"
    ]);
    for (const kind of Object.keys(shards)) {
      if (!tables.has(kind)) {
        throw new Error(`Unknown analysis table '${kind}'.`);
      }
      if (kind === "runtime") {
        this.#replaceRuntime(shards.runtime ?? []);
        continue;
      }
      this.#database.exec("DELETE FROM temp.replacement_ids");
      const find = this.#database.prepare(`SELECT payload FROM ${kind} WHERE id=?`);
      const remove = this.#database.prepare(`DELETE FROM ${kind} WHERE id=?`);
      for (const record of shards[kind] ?? []) {
        remember.run(record.id);
        const prior = find.get(record.id);
        if (prior) {
          const json = decodeSqlitePayload(prior.payload);
          if (json === JSON.stringify(record)) {
            continue;
          }
          const before = JSON.parse(json);
          if (JSON.stringify(canonicalValue(before)) === JSON.stringify(canonicalValue(record))) {
            continue;
          }
          remove.run(record.id);
        }
        this.#insertRecord(kind, record);
      }
      this.#database.exec(
        `DELETE FROM ${kind} WHERE id NOT IN (SELECT id FROM temp.replacement_ids)`
      );
    }
  }
  /**
   * Replace runtime by interned external identities, including virtual paired-state records.
   * @param {Array} records Complete semantic runtime replacement; duplicate IDs remain errors.
   */
  #replaceRuntime(records) {
    this.#database.exec(
      "CREATE TEMP TABLE IF NOT EXISTS replacement_runtime_ids (prefix TEXT, id BLOB, PRIMARY KEY(prefix,id)) WITHOUT ROWID; DELETE FROM replacement_runtime_ids"
    );
    const remember = this.#database.prepare(
      "INSERT OR IGNORE INTO temp.replacement_runtime_ids VALUES (?,?)"
    );
    const remove = this.#database.prepare("DELETE FROM runtime WHERE rowid=?");
    for (const record of records) {
      const identity = sqliteRuntimeIdentity(record.id);
      if (!remember.run(identity.prefix, identity.suffix).changes) {
        throw new Error(`Duplicate runtime record ID '${record.id}'.`);
      }
      const prior = this.#findRuntime.get(identity.prefix, identity.suffix);
      if (prior && canonicalJson(runtimeFromRow(prior)) === canonicalJson(record)) {
        continue;
      }
      if (prior) {
        remove.run(prior.storage_rowid);
      }
      this.#insertRecord("runtime", record);
    }
    this.#database.exec(`DELETE FROM runtime WHERE NOT EXISTS (
      SELECT 1 FROM temp.replacement_runtime_ids keep JOIN runtime_prefixes p ON p.value=keep.prefix
      WHERE p.id=runtime.prefix_id AND keep.id=runtime.id)`);
  }
  /**
   * Append validated migration rows without materializing a complete table. Runtime IDs are checked
   * through the logical view because paired states share physical storage with an instruction.
   * @param {ShardKind} kind Destination semantic table.
   * @param {Iterable} records Bounded batch or lazy cursor; uniqueness is enforced by SQLite.
   */
  appendRecords(kind, records) {
    this.#requireTransaction();
    for (const record of records) {
      if (kind === "runtime") {
        if (!this.insertRuntime(record)) {
          throw new Error(`Duplicate runtime record ID '${record.id}'.`);
        }
      } else {
        this.#insertRecord(kind, record);
      }
    }
  }
  /**
   * Insert a content-addressed runtime fact once; an ID collision with different content is an
   * error, never a silent no-op. Count values are already aggregated within the source capture.
   * @param {RuntimeEvidenceRecord} record Fully aggregated fact with a source-derived stable ID.
   * @returns {boolean} True when inserted; identical facts return false and conflicting facts throw.
   */
  insertRuntime(record) {
    this.#requireTransaction();
    const identity = sqliteRuntimeIdentity(record.id);
    const prior = this.#findRuntime.get(identity.prefix, identity.suffix);
    if (prior) {
      if (canonicalJson(runtimeFromRow(prior)) !== canonicalJson(record)) {
        throw new Error(
          `Runtime record '${record.id}' has changed content for a stable imported ID.`
        );
      }
      return false;
    }
    this.#insertRecord("runtime", record);
    return true;
  }
  /** Prepare a unique-record batch in one source namespace, inside the publication transaction.
   * New namespaces need no per-record existence query; SQL uniqueness still rejects repeated IDs.
   * Existing/partially pruned sources use full idempotency and collision checks for every record.
   * The callback must not escape its transaction; any insertion error must abort the whole batch.
   * @param {string} prefix Exact ID prefix including its final colon.
   * @returns {Function} Transaction-scoped inserter for validated records with unique suffixes.
   */
  runtimeBatchInserter(prefix) {
    this.#requireTransaction();
    if (!prefix || !prefix.endsWith(":")) {
      throw new Error("Invalid runtime batch prefix.");
    }
    const existing = this.#database.prepare(
      "SELECT 1 FROM runtime WHERE prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) LIMIT 1"
    ).get(prefix);
    return (record) => {
      this.#requireTransaction();
      if (!record.id.startsWith(prefix) || record.id.lastIndexOf(":") !== prefix.length - 1) {
        throw new Error("Runtime record escaped its batch prefix.");
      }
      if (existing) {
        return this.insertRuntime(record);
      }
      this.#insertRecord("runtime", record);
      return true;
    };
  }
  /** Reject evidence removal that would leave retained runtime facts orphaned, without loading them. */
  validateRuntimeEvidence() {
    const missing = this.#database.prepare(`
      SELECT ref.value AS evidence FROM runtime_evidence AS sets, json_each(sets.value) AS ref
      LEFT JOIN evidence ON evidence.id=ref.value
      WHERE evidence.id IS NULL AND EXISTS (SELECT 1 FROM runtime WHERE evidence_id=sets.id) LIMIT 1
    `).get();
    if (missing) {
      throw new Error(`Runtime history refers to missing evidence '${String(missing.evidence)}'.`);
    }
  }
  /**
   * Store manifest and counter in the same transaction as the changed records.
   * @param {object} manifest Semantic project identity for this publication.
   * @returns {AnalysisProjectManifest} Manifest containing the incremented counter.
   */
  publishManifest(manifest) {
    this.#requireTransaction();
    const revision = this.revision() + 1;
    const pointer = {
      ...manifest,
      db: ANALYSIS_PROJECT_SQLITE_FILE,
      revision,
      shards: []
    };
    const insert = this.#database.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)");
    insert.run("revision", String(revision));
    insert.run("manifest", canonicalJson(pointer));
    return pointer;
  }
  /**
   * Current publication counter, or zero before initial publication. It is not a schema version.
   * Read it with related records inside transaction to retain one consistent snapshot.
   * @returns {number} Stored revision.
   */
  revision() {
    const row = this.#database.prepare("SELECT v FROM meta WHERE k='revision'").get();
    return Number(row?.v ?? 0);
  }
  /**
   * Authoritative manifest stored in SQLite, including pointer fields. Throws before initial publication.
   * Use a transaction when combining it with other reads; this does not validate the entire project.
   * @returns {AnalysisProjectManifest} Pointer manifest.
   */
  manifest() {
    const row = this.#database.prepare("SELECT v FROM meta WHERE k='manifest'").get();
    if (!row) {
      throw new Error("Sqlite analysis project is missing its stored manifest.");
    }
    return { ...parseRecord(row.v), revision: this.revision() };
  }
  /**
   * Stream only requested runtime kinds, avoiding raw-row and decoded-row arrays on the JS heap.
   * @param {Array} kinds Runtime discriminators to include; empty selects nothing.
   * @returns {IterableIterator} Cursor consumed within the owning read transaction.
   * @yields {RuntimeEvidenceRecord} One matching decoded fact.
   */
  *runtimeRecordsByKinds(kinds) {
    if (kinds.length === 0) {
      return;
    }
    const statement = this.#database.prepare(
      `${RUNTIME_SELECT} WHERE r.kind IN (${kinds.map(() => "?").join(", ")})`
    );
    for (const row of statement.iterate(...kinds)) {
      yield runtimeFromRow(row);
    }
  }
  /**
   * Stream runtime facts without retaining the complete table. Consume before the owning transaction
   * returns or the connection closes; an escaped iterator does not preserve its original snapshot.
   * @returns {IterableIterator<RuntimeEvidenceRecord>} One reconstructed runtime row at a time.
   * @yields {RuntimeEvidenceRecord} One runtime fact.
   */
  *runtimeRecords() {
    for (const row of this.#database.prepare(`${RUNTIME_SELECT} ORDER BY r.rowid`).iterate()) {
      yield runtimeFromRow(row);
    }
  }
  /**
   * Read one metadata table directly; Sources must not load unrelated CFG or runtime tables.
   * @param {string} kind Metadata table name from the semantic collection contract.
   * @returns {Array} Decoded metadata in deterministic display order.
   */
  loadTable(kind) {
    const order = {
      labels: "address_space, address, id",
      comments: "address_space, address, id",
      annotations: 'address_space, start, "end", id',
      regions: 'address_space, start, "end", id',
      analysis: "id",
      evidence: "id",
      imports: "id"
    };
    if (!Object.hasOwn(order, kind)) {
      throw new Error(`Unknown analysis table '${kind}'.`);
    }
    const records = [];
    for (const row of this.#database.prepare(`SELECT payload FROM ${kind} ORDER BY ${order[kind]}`).iterate()) {
      records.push(parseRecord(row.payload));
    }
    return records;
  }
  /** Validate a query view against this read snapshot, including every included provenance reference.
   * @param {AnalysisProjectShards} shards Selected records, with unused collections empty.
   */
  validateView(shards) {
    validateLoadedShards(shards, this.manifest());
  }
  /** Merge an already-parsed offline batch by stable IDs without loading saved runtime history.
   * The caller owns revision checking and publication in the surrounding writer transaction.
   * @param {RuntimeEvidenceBatch} batch Imported facts and metadata.
   * @returns {object} Whether anything changed and per-collection additions/updates.
   */
  mergeEvidenceBatch(batch) {
    this.#requireTransaction();
    const base = {
      analysis: [],
      annotations: this.loadTable("annotations"),
      labels: this.loadTable("labels"),
      comments: this.loadTable("comments"),
      regions: this.loadTable("regions"),
      evidence: this.loadTable("evidence"),
      imports: this.loadTable("imports"),
      runtime: []
    };
    const ids = JSON.stringify((batch.analysis ?? []).map((record) => record.id));
    const analysis = this.#database.prepare("SELECT payload FROM analysis WHERE id IN (SELECT value FROM json_each(?))").all(ids).map((row) => parseRecord(row.payload));
    const before = { ...base, analysis };
    const merged = mergeRuntimeEvidence(before, { ...batch, runtime: [] });
    this.validateView({ ...merged.shards, runtime: batch.runtime ?? [] });
    this.patchMetadata(before, merged.shards);
    let runtime = 0;
    for (const record of batch.runtime ?? []) {
      if (this.insertRuntime(record)) {
        runtime++;
      }
    }
    return {
      changed: merged.changed || runtime > 0,
      added: { ...merged.added, runtime },
      updated: merged.updated
    };
  }
  /** Produce an explicit complete evidence report one qualified PC at a time.
   * Only report output accumulates; unused instruction/memory histories and CFG contexts are never loaded.
   * @returns {object} Runtime record count, conflicts, and metadata explanations.
   */
  inspectEvidence() {
    const shards = {
      analysis: this.analysisByKinds(["target-override"]),
      annotations: this.loadTable("annotations"),
      evidence: this.loadTable("evidence"),
      labels: [],
      comments: [],
      regions: [],
      imports: [],
      runtime: []
    };
    const conflicts = [];
    const rows = this.#database.prepare(
      `${RUNTIME_SELECT} WHERE r.kind IN ('runtime-execution','runtime-cpu-state') AND r.address_space=? AND r.address=? AND r.architecture=?`
    );
    const sites = this.#database.prepare(
      "SELECT DISTINCT architecture,address_space,address FROM runtime WHERE kind IN ('runtime-execution','runtime-cpu-state')"
    );
    for (const site of sites.iterate()) {
      const runtime = [];
      for (const row of rows.iterate(site.address_space, site.address, site.architecture)) {
        runtime.push(runtimeFromRow(row));
      }
      for (const conflict of inspectRuntimeEvidence({ ...shards, runtime }).conflicts) {
        conflicts.push(conflict);
      }
    }
    conflicts.sort((a, b) => a.id.localeCompare(b.id));
    return {
      runtimeRecords: Number(this.#database.prepare("SELECT count(*) AS n FROM runtime").get().n),
      conflicts,
      explanations: inspectRuntimeEvidence(shards).explanations
    };
  }
  /** Select record choices before decoding; explicit IDs bypass unrelated history entirely.
   * @param {Partial<Record<ShardKind, readonly string[]>>} [selected] Exact context record IDs; omitted lists the first 200 records per collection.
   * @returns {AnalysisProjectShards} Bounded choice view and complete small provenance catalog.
   */
  evidenceChoices(selected) {
    const shards = {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      runtime: [],
      imports: [],
      evidence: this.loadTable("evidence")
    };
    for (const kind of [
      "analysis",
      "annotations",
      "labels",
      "comments",
      "regions",
      "runtime",
      "imports"
    ]) {
      const records = [];
      const ids = selected?.[kind];
      if (selected && !ids?.length) {
        continue;
      }
      if (kind === "runtime") {
        if (ids) {
          const find = this.#database.prepare(
            `${RUNTIME_SELECT} WHERE r.prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) AND r.id=?`
          );
          for (const id of ids.slice(0, 200)) {
            const identity = sqliteRuntimeIdentity(id);
            const row = find.get(identity.prefix, identity.suffix);
            if (row) {
              records.push(runtimeFromRow(row));
            }
          }
        } else {
          for (const row of this.#database.prepare(`${RUNTIME_SELECT} LIMIT 200`).iterate()) {
            records.push(runtimeFromRow(row));
          }
        }
      } else {
        const sql = ids ? `SELECT payload FROM ${kind} WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id LIMIT 200` : `SELECT payload FROM ${kind} ORDER BY id LIMIT 200`;
        const parameters = ids ? [JSON.stringify(ids)] : [];
        for (const row of this.#database.prepare(sql).iterate(...parameters)) {
          records.push(parseRecord(row.payload));
        }
      }
      Object.assign(shards, { [kind]: records });
    }
    return shards;
  }
  /** Explain one record with an exact reference count and a bounded reverse-reference preview.
   * @param {ShardKind} kind Selected collection.
   * @param {string} id Stable semantic record ID.
   * @returns {ProjectEvidenceExplanation} Full direct provenance/conflicts, at most 200 reverse links.
   */
  explainEvidence(kind, id) {
    const signature = "1";
    if (!readQueryCache(this.#database, "evidence_links", signature)) {
      this.transaction(() => {
        installQueryCache(this.#database, "evidence_links", [
          "analysis",
          "annotations",
          "labels",
          "comments",
          "regions"
        ]);
        this.#database.exec(
          "CREATE TABLE IF NOT EXISTS query_evidence_links(evidence TEXT,collection TEXT,id TEXT,PRIMARY KEY(evidence,collection,id)) WITHOUT ROWID;DELETE FROM query_evidence_links;"
        );
        for (const table of ["analysis", "annotations", "labels", "comments", "regions"]) {
          this.#database.exec(
            `INSERT OR IGNORE INTO query_evidence_links SELECT e.value,'${table}',r.id FROM ${table} r,json_each(analysis_json(r.payload),'$.evidence') e`
          );
        }
        writeQueryCache(this.#database, "evidence_links", signature, true);
      });
    }
    return this.transaction(() => {
      const shards = this.evidenceChoices({ [kind]: [id] });
      const view = {
        ...shards,
        analysis: [
          ...shards.analysis,
          ...this.analysisByKinds(["conflict"]).filter(
            (record) => !shards.analysis.some((other) => other.id === record.id)
          )
        ]
      };
      const base = explainProjectEvidence(view, kind, id);
      const evidenceIds = JSON.stringify(base.evidence.map((record) => record.id));
      const metadata = "SELECT collection||':'||id AS reference FROM query_evidence_links WHERE evidence IN (SELECT value FROM json_each(?)) GROUP BY collection,id";
      const runtime = "SELECT 'runtime:'||p.value||CASE typeof(r.id) WHEN 'blob' THEN lower(hex(r.id)) ELSE r.id END AS reference FROM runtime_evidence e JOIN runtime r ON r.evidence_id=e.id JOIN runtime_prefixes p ON p.id=r.prefix_id WHERE EXISTS(SELECT 1 FROM json_each(e.value) value WHERE value.value IN (SELECT value FROM json_each(?)))";
      const metadataRows = this.#database.prepare(`${metadata} ORDER BY reference LIMIT 200`).all(evidenceIds);
      const runtimeRows = this.#database.prepare(`${runtime} ORDER BY r.prefix_id,r.id LIMIT 200`).all(evidenceIds);
      const referencedBy = [...metadataRows, ...runtimeRows].map((row) => String(row.reference)).sort((a, b) => a.localeCompare(b)).slice(0, 200);
      const metadataCount = Number(
        this.#database.prepare(`SELECT count(*) AS n FROM (${metadata})`).get(evidenceIds).n
      );
      const runtimeCount = Number(
        this.#database.prepare(`SELECT count(*) AS n FROM runtime r WHERE r.evidence_id IN
        (SELECT e.id FROM runtime_evidence e WHERE EXISTS(SELECT 1 FROM json_each(e.value) value WHERE value.value IN (SELECT value FROM json_each(?))))`).get(evidenceIds).n
      );
      const referencedByTotal = metadataCount + runtimeCount;
      return { ...base, referencedBy, referencedByTotal };
    }, false);
  }
  /** Exact coverage totals; build only when classifications, code, or runtime facts changed.
   * @returns {object} Persisted summary and detail count.
   */
  coverageSummary() {
    const cached = cachedCoverage(this.#database, this.manifest());
    if (cached) {
      return cached;
    }
    this.prepareAnnotationQueries();
    try {
      this.cachedProjection(
        "coverage",
        coverageSignature(this.manifest()),
        ["analysis", "annotations", "regions", "runtime"],
        () => prepareCoverage(this.#database, this.manifest()),
        () => publishCoverage(this.#database)
      );
      const published = cachedCoverage(this.#database, this.manifest());
      if (!published) {
        throw new Error("Project changed while building coverage; refresh the view.");
      }
      return published;
    } finally {
      this.#database.exec(
        "DROP TABLE IF EXISTS temp.query_coverage_segments;DROP TABLE IF EXISTS temp.query_coverage_details"
      );
    }
  }
  /** Read at most 200 coverage rows from a current projection.
   * @param {"segments" | "details"} kind Collection to page.
   * @param {number} offset Nonnegative row offset.
   * @returns {unknown[]} Persisted rows, never the full ROM map.
   */
  coveragePage(kind, offset = 0) {
    this.coverageSummary();
    return this.transaction(() => coveragePage(this.#database, kind, offset), false);
  }
  /** Persisted call graph plus current labels, without retaining CFG contexts between requests.
   * @returns {object} Functions, calls, unresolved sites, and ownership.
   */
  callGraph() {
    let graph;
    try {
      graph = this.cachedProjection(
        "graph",
        "2",
        ["analysis"],
        () => prepareGraph(this.#database),
        () => publishGraph(this.#database)
      );
      const published = readQueryCache(this.#database, "graph", "2");
      if (!published) {
        throw new Error("Analysis changed while building the graph; refresh the view.");
      }
      graph = published;
    } finally {
      this.#database.exec(
        "DROP TABLE IF EXISTS temp.query_graph_nodes;DROP TABLE IF EXISTS temp.query_graph_edges"
      );
    }
    const labels = this.loadTable("labels");
    return {
      ...graph,
      functions: graph.functions.map((fn) => ({
        ...fn,
        labels: labels.filter((label) => label.addressSpace === fn.addressSpace && label.address === fn.address).map(({ id, name }) => ({ id, name })).sort((a, b) => a.id.localeCompare(b.id))
      }))
    };
  }
  /** Cache a compact target-specific result; callers declare every persisted input it consumes.
   * Computation uses a deferred transaction so expensive analysis does not hold the writer lock.
   * Concurrent input changes discard cache publication; results still belong to one read snapshot.
   * @param {string} key Internal stable query name.
   * @param {string} signature Layout/configuration fingerprint.
   * @param {readonly ShardKind[]} dependencies Source collections.
   * @param {Function} compute Synchronous reader; must not open another transaction.
   * @param {Function} [publish] Optional short SQL publication for derived rows built in temporary tables.
   * @returns {T} Current projected value.
   */
  cachedProjection(key2, signature, dependencies, compute, publish) {
    const cached = readQueryCache(this.#database, key2, signature);
    if (cached !== void 0) {
      return cached;
    }
    const pending = `pending:${(0, import_node_crypto3.randomUUID)()}`;
    this.transaction(() => {
      installQueryCache(this.#database, key2, dependencies);
      writeQueryCache(this.#database, key2, pending, null);
    });
    const result = this.transaction(compute, false);
    this.transaction(() => {
      if (this.#database.prepare("SELECT signature FROM query_cache WHERE name=?").get(key2)?.signature === pending) {
        publish?.();
        writeQueryCache(this.#database, key2, signature, result);
      }
    });
    return result;
  }
  /** CPU architectures at one PC from indexed scalar columns; register payloads are untouched.
   * @param {string} space Exact logical address space.
   * @param {number} address Instruction address.
   * @returns {string[]} Distinct observed architecture IDs.
   */
  runtimeArchitecturesAt(space, address) {
    return this.#database.prepare(
      "SELECT architecture FROM query_runtime_architectures WHERE address_space=? AND address=? ORDER BY architecture"
    ).all(space, address).map((row) => String(row.architecture));
  }
  /** Build distinct processor/location hints once instead of rescanning hot-PC register rows per function. */
  prepareRuntimeArchitectures() {
    try {
      this.cachedProjection(
        "runtime_architectures",
        "2",
        ["runtime"],
        () => {
          this.#database.exec(`CREATE TEMP TABLE runtime_architectures_pending(address_space TEXT,address INTEGER,architecture TEXT,PRIMARY KEY(address_space,address,architecture)) WITHOUT ROWID;
          INSERT OR IGNORE INTO temp.runtime_architectures_pending SELECT address_space,address,architecture FROM runtime NOT INDEXED WHERE kind IN ('runtime-execution','runtime-instruction','runtime-cpu-state');`);
          return true;
        },
        () => {
          this.#database.exec(`CREATE TABLE IF NOT EXISTS query_runtime_architectures(address_space TEXT,address INTEGER,architecture TEXT,PRIMARY KEY(address_space,address,architecture)) WITHOUT ROWID;
          DELETE FROM query_runtime_architectures;
          INSERT INTO query_runtime_architectures SELECT * FROM temp.runtime_architectures_pending;`);
        }
      );
      if (!readQueryCache(this.#database, "runtime_architectures", "2")) {
        throw new Error("Runtime changed while building processor hints; refresh the view.");
      }
    } finally {
      this.#database.exec("DROP TABLE IF EXISTS temp.runtime_architectures_pending");
    }
  }
  /** Select a bounded CFG navigation window through its address index.
   * @param {string} space Exact logical address space.
   * @param {number} address Selected PC.
   * @param {readonly string[]} architectures Optional specification prefixes.
   * @returns {AnalysisRecord[]} Four preceding and 28 following variants, in address order.
   */
  navigationNodes(space, address, architectures) {
    const matches = architectures.length ? " AND EXISTS(SELECT 1 FROM json_each(?) h WHERE json_extract(analysis_json(payload),'$.specificationId')=h.value OR substr(json_extract(analysis_json(payload),'$.specificationId'),1,length(h.value)+1)=h.value||'.')" : "";
    const parameters = [space, address];
    if (architectures.length) {
      parameters.push(JSON.stringify(architectures));
    }
    const before = this.#database.prepare(
      `SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address<? ${matches} ORDER BY address DESC,id DESC LIMIT 4`
    ).all(...parameters).reverse();
    const after = this.#database.prepare(
      `SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address>=? ${matches} ORDER BY address,id LIMIT ?`
    ).all(...parameters, 32 - before.length);
    return [...before, ...after].map((row) => parseRecord(row.payload));
  }
  /** Explicit known-code intervals, grouped in SQL for the incomplete-analysis preservation guard.
   * @returns {Array} Half-open ROM-content intervals.
   */
  codeRanges() {
    return this.#database.prepare(
      "SELECT file_offset AS start,MAX(file_offset+size) AS end FROM query_instruction_nodes WHERE file_offset IS NOT NULL GROUP BY file_offset"
    ).all().map((row) => ({ start: Number(row.start), end: Number(row.end) }));
  }
  /** Select processor MMIO observations before decoding payloads.
   * @param {string} architecture Exact runtime architecture.
   * @param {string} space Instruction and accessed logical space.
   * @param {readonly number[]} addresses Exact hardware addresses, including target-approved mirrors.
   * @returns {IterableIterator<RuntimeEvidenceRecord>} SQL-grouped observations; counts/provenance stay exact.
   * @yields {RuntimeEvidenceRecord} One role-relevant access variant.
   */
  *runtimeMemoryAtAddresses(architecture, space, addresses) {
    const sql = `WITH candidates AS MATERIALIZED (SELECT r.*,analysis_json(r.payload) AS json FROM runtime r
      WHERE r.kind='runtime-memory-access' AND r.architecture=? AND r.instruction_address_space=? AND r.accessed_address_space=?
      AND r.accessed_address IN (SELECT value FROM json_each(?))), grouped AS (
      SELECT *,SUM(count) AS total FROM candidates GROUP BY instruction_address,accessed_address,evidence_id,
      json_extract(json,'$.access'),json_extract(json,'$.actor'),json_extract(json,'$.channel'))
      SELECT g.*,p.value AS id_prefix,e.value AS evidence FROM grouped g JOIN runtime_prefixes p ON p.id=g.prefix_id JOIN runtime_evidence e ON e.id=g.evidence_id`;
    for (const row of this.#database.prepare(sql).iterate(architecture, space, space, JSON.stringify(addresses))) {
      yield runtimeFromRow({ ...row, count: row.total });
    }
  }
  /** Decode-state variants aggregated in SQL; raw register histories never become a JS array.
   * The signature includes the ordered state fields and architecture. Aliases remain distinct so
   * the target decoder retains its original precedence and validation rules.
   * @param {string} architecture Exact instruction architecture.
   * @param {string} space Exact instruction address space.
   * @param {readonly string[]} stateFields Only fields the target decoder consumes, including aliases.
   * @param {Readonly<Record>} masks Optional decoder bit masks, applied only to valid nonnegative integers up to max.
   * @returns {IterableIterator<RuntimeEvidenceRecord>} SQL cursor over compact variants with exact per-evidence counts.
   * Prepare before starting the consuming read transaction.
   */
  runtimeInstructionVariants(architecture, space, stateFields, masks = {}) {
    if (stateFields.some((field) => !/^\w+$/.test(field))) {
      throw new Error("Invalid instruction state field.");
    }
    const signature = JSON.stringify([3, architecture, space, stateFields, masks]);
    try {
      this.cachedProjection(
        "instruction_variants",
        signature,
        ["runtime"],
        () => {
          this.#database.function(
            "analysis_instruction_variant",
            { deterministic: true },
            (value) => {
              const record = parseRecord(value);
              const state = {};
              for (const key2 of stateFields) {
                const value2 = record.state[key2], mask = masks[key2];
                if (mask && typeof value2 === "number" && Number.isInteger(value2) && value2 >= 0 && value2 <= mask.max) {
                  state[key2] = value2 & mask.mask;
                } else if (value2 !== void 0) {
                  state[key2] = value2;
                }
              }
              return JSON.stringify([record.bytes, state]);
            }
          );
          this.#database.exec(
            "CREATE TEMP TABLE instruction_variants_pending(payload TEXT NOT NULL)"
          );
          const insert = this.#database.prepare(
            "INSERT INTO temp.instruction_variants_pending VALUES(?)"
          );
          const rows = this.#database.prepare(`WITH grouped AS (
          SELECT MIN(rowid) AS sample,SUM(count) AS total FROM runtime WHERE kind='runtime-instruction' AND architecture=? AND address_space=?
          GROUP BY address,evidence_id,analysis_instruction_variant(payload))
          SELECT r.*,g.total,p.value AS id_prefix,e.value AS evidence FROM grouped g JOIN runtime r ON r.rowid=g.sample JOIN runtime_prefixes p ON p.id=r.prefix_id JOIN runtime_evidence e ON e.id=r.evidence_id`);
          for (const row of rows.iterate(architecture, space)) {
            const record = runtimeFromRow({ ...row, count: row.total });
            if (record.kind === "runtime-instruction") {
              insert.run(
                JSON.stringify({
                  ...record,
                  state: Object.fromEntries(
                    Object.entries(record.state).filter(([key2]) => stateFields.includes(key2))
                  )
                })
              );
            }
          }
          return true;
        },
        () => {
          this.#database.exec(`CREATE TABLE IF NOT EXISTS query_runtime_variants(payload TEXT NOT NULL);
          DELETE FROM query_runtime_variants;
          INSERT INTO query_runtime_variants SELECT payload FROM temp.instruction_variants_pending;`);
        }
      );
      if (!readQueryCache(this.#database, "instruction_variants", signature)) {
        throw new Error("Runtime changed while building instruction variants; retry reanalysis.");
      }
    } finally {
      this.#database.exec("DROP TABLE IF EXISTS temp.instruction_variants_pending");
    }
    const statement = this.#database.prepare(
      "SELECT payload FROM query_runtime_variants ORDER BY rowid"
    );
    return (function* () {
      for (const row of statement.iterate()) {
        yield JSON.parse(String(row.payload));
      }
    })();
  }
  /** Exact execution seed totals grouped by PC and provenance, without decoding execution payloads.
   * @param {string} architecture Target processor.
   * @param {string} space Logical CPU address space.
   * @returns {RuntimeEvidenceRecord[]} Execution facts reduced to the fields used for seed selection.
   */
  runtimeExecutionSeeds(architecture, space) {
    return this.#database.prepare(`SELECT r.address,SUM(r.count) AS count,r.evidence_id,e.value AS evidence FROM runtime r JOIN runtime_evidence e ON e.id=r.evidence_id
      WHERE r.kind='runtime-execution' AND r.architecture=? AND r.address_space=? GROUP BY r.address,r.evidence_id`).all(architecture, space).map((row) => ({
      id: `query:execution:${String(row.address)}:${String(row.evidence_id)}`,
      kind: "runtime-execution",
      architecture,
      addressSpace: space,
      address: Number(row.address),
      count: Number(row.count),
      evidence: JSON.parse(String(row.evidence))
    }));
  }
  /** Build additive query indexes once, then refresh only rows invalidated by project writes. */
  prepareAnnotationQueries() {
    if (annotationQueryIndexesReady(this.#database)) {
      return;
    }
    this.transaction(() => ensureAnnotationQueryIndexes(this.#database));
  }
  /** Prepare direct source attribution indexes without decoding runtime payloads. */
  prepareSourceQueries() {
    if (!sourceQueriesReady(this.#database)) {
      this.transaction(() => prepareSourceQueries(this.#database));
    }
  }
  /** Validated source identities from small catalog tables in the caller's read snapshot.
   * @returns {object} Manifest and sources ordered by their most recent successful import.
   */
  sourceCatalog() {
    const manifest = this.manifest();
    const shards = {
      imports: this.loadTable("imports"),
      evidence: this.loadTable("evidence"),
      analysis: [],
      labels: [],
      comments: [],
      annotations: [],
      regions: [],
      runtime: []
    };
    validateLoadedShards(shards, manifest);
    const importTimes = new Map(
      this.#database.prepare("SELECT sha256,last_seen_at FROM capture_catalog").all().map((row) => [String(row.sha256), Number(row.last_seen_at)])
    );
    return { manifest, sources: buildAnalysisSourceCatalog(shards, importTimes) };
  }
  /** Exact SQL counts for a catalog source; no baseline or inferred static execution.
   * @param {string} sourceId Catalog source ID.
   * @returns {object} Manifest and source counts.
   */
  sourceSummary(sourceId) {
    const { manifest, sources } = this.sourceCatalog();
    const source = sources.find(({ id }) => id === sourceId);
    if (!source) {
      throw new Error("Unknown analysis source.");
    }
    return { manifest, summary: readSourceSummary(this.#database, source) };
  }
  /** At most 200 SQL-selected contribution rows, decoded within the caller's read transaction.
   * @param {string} sourceId Catalog source ID.
   * @param {AnalysisSourceGroup} group Contribution category.
   * @param {number} offset Nonnegative page offset.
   * @returns {Array} Bounded source records.
   */
  sourcePage(sourceId, group, offset = 0) {
    const source = this.sourceCatalog().sources.find(({ id }) => id === sourceId);
    if (!source) {
      throw new Error("Unknown analysis source.");
    }
    return readSourcePage(this.#database, source, group, offset);
  }
  /**
   * Read names, comments and provenance for editing without materializing instruction variants.
   * @returns {object} Validated editing metadata from the caller's read transaction.
   */
  annotationEditView() {
    const manifest = this.manifest();
    const shards = {
      labels: this.loadTable("labels"),
      comments: this.loadTable("comments"),
      evidence: this.loadTable("evidence"),
      analysis: this.analysisByKinds(["function"]),
      annotations: [],
      regions: [],
      imports: [],
      runtime: []
    };
    validateLoadedShards(shards, manifest);
    return { manifest, shards };
  }
  /** Small export metadata; instruction candidates are supplied separately by an ordered SQL cursor.
   * @returns {object} Validated manifest, metadata, and an empty runtime collection.
   */
  sourceExportView() {
    const manifest = this.manifest();
    const shards = {
      labels: this.loadTable("labels"),
      comments: this.loadTable("comments"),
      evidence: this.loadTable("evidence"),
      regions: this.loadTable("regions"),
      annotations: this.loadTable("annotations"),
      analysis: this.analysisByKinds(["function", "conflict"]),
      imports: [],
      runtime: []
    };
    validateLoadedShards(shards, manifest);
    return { manifest, shards };
  }
  /**
   * Stream one file-offset group at a time; do not retain the complete CFG to plan source.
   * The caller prepares annotation indexes first and owns a read transaction until iteration ends.
   * @returns {IterableIterator<readonly InstructionExportRecord[]>} All variants at each explicit output offset.
   * @yields {readonly InstructionExportRecord[]} One complete group, without clipping variants.
   */
  *instructionExportGroups() {
    const spaces = new Map(
      this.manifest().addressSpaces.map((space) => [space.id, 2 ** space.addressBits])
    );
    const evidence = new Set(this.loadTable("evidence").map(({ id }) => id));
    let previous;
    let group = [];
    for (const row of this.#database.prepare(
      "SELECT file_offset,data FROM query_instruction_nodes WHERE file_offset IS NOT NULL ORDER BY file_offset"
    ).iterate()) {
      const offset = Number(row.file_offset);
      if (previous !== void 0 && previous !== offset) {
        yield group;
        group = [];
      }
      const record = parseRecord(row.data);
      if (typeof record.id !== "string" || !record.id || !Number.isSafeInteger(record.address) || record.address < 0 || record.address >= (spaces.get(record.addressSpace) ?? 0) || !Number.isSafeInteger(record.size) || record.size < 1 || !Number.isSafeInteger(record.opcode) || typeof record.specificationId !== "string" || !record.incomingState || typeof record.incomingState !== "object" || !Array.isArray(record.evidence) || record.evidence.some((id) => typeof id !== "string" || !evidence.has(id))) {
        throw new Error("Invalid indexed export instruction or missing provenance.");
      }
      group.push(record);
      previous = offset;
    }
    if (group.length) {
      yield group;
    }
  }
  /**
   * Read and validate only the requested instruction metadata and bounded runtime details.
   * @param {readonly AnnotationQueryRange[]} ranges Exact visible source/debugger coordinates.
   * @returns {SqliteAnnotationView} Small view; consume inside the caller's read transaction.
   */
  instructionAnnotationView(ranges) {
    const manifest = this.manifest();
    const result = readSqliteAnnotationView(this.#database, manifest, ranges);
    validateLoadedShards(result.shards, manifest);
    return result;
  }
  /**
   * Read selected metadata kinds through the address index instead of loading the complete CFG.
   * @param {readonly AnalysisRecord["kind"][]} kinds Analysis discriminators to include.
   * @returns {AnalysisRecord[]} Matching rows in stable ID order.
   */
  analysisByKinds(kinds) {
    if (!kinds.length) {
      return [];
    }
    const records = [];
    for (const row of this.#database.prepare(
      `SELECT payload FROM analysis WHERE kind IN (${kinds.map(() => "?").join(",")}) ORDER BY id`
    ).iterate(...kinds)) {
      records.push(parseRecord(row.payload));
    }
    return records;
  }
  /**
   * Resolve an edit boundary to representative CFG nodes, one per qualified location.
   * Call after preparing query indexes and consume inside a read transaction.
   * @param {string} addressSpace Exact debug-map/native address space.
   * @param {number} address Instruction start in that space.
   * @param {number} [outputOffset] Optional explicit file offset, never an inferred mapper alias.
   * @returns {AnalysisProjectShards["analysis"]} Location representatives; state variants need not be loaded to edit a comment.
   */
  annotationNodesAt(addressSpace, address, outputOffset) {
    const rows = this.#database.prepare(`SELECT payload FROM analysis WHERE rowid IN (
      SELECT MIN(rowid) FROM analysis WHERE kind='cfg-node' AND address_space=? AND address=? GROUP BY address_space,address
      UNION SELECT MIN(rowid) FROM analysis INDEXED BY query_instruction_output
      WHERE kind='cfg-node' AND query_file_offset=? GROUP BY address_space,address)`).all(addressSpace, address, outputOffset ?? null);
    return rows.map((row) => parseRecord(row.payload));
  }
  /**
   * Stream decoded records in insertion order for migration digest verification.
   * @param {ShardKind} kind Semantic table to traverse.
   * @returns {IterableIterator} Cursor retaining only the current decoded record.
   * @yields {object} Original semantic record.
   */
  *records(kind) {
    if (kind === "runtime") {
      yield* this.runtimeRecords();
      return;
    }
    if (!["evidence", "labels", "comments", "regions", "annotations", "analysis", "imports"].includes(
      kind
    )) {
      throw new Error(`Unknown analysis table '${kind}'.`);
    }
    for (const row of this.#database.prepare(`SELECT payload FROM ${kind} ORDER BY rowid`).iterate()) {
      yield parseRecord(row.payload);
    }
  }
  /**
   * Initialize a migrated project's unchanged logical identity once, inside its first publication.
   * @param {AnalysisProjectManifest} manifest Validated authoritative source manifest and revision.
   */
  initializeMigratedManifest(manifest) {
    this.#requireTransaction();
    if (this.#database.prepare("SELECT 1 FROM meta LIMIT 1").get()) {
      throw new Error("Migration manifest can only initialize an empty metadata header.");
    }
    const insert = this.#database.prepare("INSERT INTO meta (k,v) VALUES (?,?)");
    insert.run("revision", String(manifest.revision ?? 0));
    insert.run("manifest", canonicalJson(manifest));
  }
  /**
   * Build deferred indexes and check all physical structures before closing a staged migration file.
   * Switching through DELETE verifies that no staging reader retains a WAL dependency; the closed
   * file retains WAL mode for ordinary clients, with all committed pages checkpointed into main.
   */
  finishMigration() {
    for (const sql of SCHEMA_INDEX_STATEMENTS) {
      this.#database.exec(sql);
    }
    const integrity = this.#database.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
      throw new Error("Migrated SQLite database failed integrity validation.");
    }
    if (this.#database.prepare("PRAGMA foreign_key_check").get()) {
      throw new Error("Migrated SQLite database contains an invalid dictionary reference.");
    }
    this.#database.exec(
      "PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; PRAGMA journal_mode=WAL;"
    );
  }
  /**
   * Materialize complete record arrays without semantic validation. Run inside a read transaction.
   * @param {boolean} [runtime] Defaults to true; false omits runtime and must not be treated as a complete replacement.
   * @returns {AnalysisProjectShards} Decoded record arrays owned by the caller.
   */
  loadShards(runtime = true) {
    return {
      evidence: this.loadTable("evidence"),
      labels: this.loadTable("labels"),
      comments: this.loadTable("comments"),
      regions: this.loadTable("regions"),
      annotations: this.loadTable("annotations"),
      analysis: this.loadTable("analysis"),
      imports: this.loadTable("imports"),
      runtime: runtime ? [...this.runtimeRecords()].sort(compareRuntimeRecordIds) : []
    };
  }
  /**
   * Table counts for reports.
   * @returns {Readonly<Record<string, number>>} Row counts.
   */
  counts() {
    const tables = [
      "evidence",
      "labels",
      "comments",
      "regions",
      "annotations",
      "analysis",
      "imports",
      "runtime"
    ];
    const result = {};
    for (const table of tables) {
      const row = this.#database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
      result[table] = Number(row?.n ?? 0);
    }
    return result;
  }
  /**
   * Count analysis kinds without inflating or parsing their compressed payloads.
   * @returns {Readonly<Record<string, number>>} Counts by analysis record discriminator.
   */
  analysisCounts() {
    const result = {};
    for (const row of this.#database.prepare("SELECT kind, COUNT(*) AS n FROM analysis GROUP BY kind").iterate()) {
      result[String(row.kind)] = Number(row.n);
    }
    return result;
  }
  /**
   * Summarize per-PC execution facts using stored columns, without reading register history.
   * @returns {object} Fact count and total observed executions in the owning transaction.
   */
  runtimeExecutionCounts() {
    const row = this.#database.prepare(
      "SELECT COUNT(*) AS records, COALESCE(SUM(count), 0) AS events FROM runtime WHERE kind='runtime-execution'"
    ).get();
    return { records: Number(row?.records ?? 0), events: Number(row?.events ?? 0) };
  }
  /**
   * Atomically refresh the watcher hint after commit. SQLite is authoritative: a failed hint write
   * is reported as a warning, never as a failed import that could cause an unsafe retry.
   * @param {string} directory Project root for the watcher hint.
   */
  writePointer(directory) {
    const temporary = import_node_path4.default.join(directory, `.analysis.json.${(0, import_node_crypto3.randomUUID)()}.tmp`);
    try {
      this.transaction(() => {
        import_node_fs4.default.writeFileSync(temporary, canonicalJson(this.manifest()), { flag: "wx" });
        import_node_fs4.default.renameSync(temporary, import_node_path4.default.join(directory, ANALYSIS_PROJECT_MANIFEST));
      });
    } catch (error) {
      process.emitWarning(
        `Analysis database committed, but its watcher pointer could not be refreshed: ${String(error)}`
      );
    } finally {
      try {
        import_node_fs4.default.rmSync(temporary, { force: true });
      } catch {
      }
    }
  }
  /** Checkpoint and reclaim unused SQLite pages; run only during explicit storage maintenance. */
  compact() {
    const disk = import_node_fs4.default.statfsSync(import_node_path4.default.dirname(this.file));
    const pageCount = Number(this.#database.prepare("PRAGMA page_count").get()?.page_count);
    const pageSize = Number(this.#database.prepare("PRAGMA page_size").get()?.page_size);
    if (disk.bavail * disk.bsize < 2 * pageCount * pageSize) {
      throw new Error(
        "Insufficient free disk space for SQLite VACUUM; allow twice the database size."
      );
    }
    this.transaction(() => {
      this.#database.exec(`
        DELETE FROM runtime_prefixes WHERE id NOT IN (SELECT DISTINCT prefix_id FROM runtime);
        DELETE FROM runtime_evidence WHERE id NOT IN (SELECT DISTINCT evidence_id FROM runtime);
      `);
    });
    this.#database.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
  }
  /** Current persisted policy; defaults do not write or change the semantic revision.
   * @returns {AnalysisStoragePolicy} Validated defaults and persisted overrides.
   */
  storagePolicy() {
    return readStoragePolicy(this.#database);
  }
  /** Update only explicit policy fields in the caller's writer transaction.
   * @param {Partial<AnalysisStoragePolicy>} patch Explicit limits, in bytes/days/counts.
   * @returns {AnalysisStoragePolicy} Complete policy saved without changing the edit revision.
   */
  setStoragePolicy(patch) {
    this.#requireTransaction();
    const policy = validateStoragePolicy({ ...this.storagePolicy(), ...patch });
    this.#database.prepare("INSERT OR REPLACE INTO meta VALUES('storage-policy',?)").run(JSON.stringify(policy));
    return policy;
  }
  /** Storage accounting avoids decoding runtime or analysis payloads.
   * @returns {object} Physical allocation and logical retention counts.
   */
  storageSnapshot() {
    return storageSnapshot(this.#database, this.file);
  }
  /** Optional projection allocation, including secondary indexes; reserved for explicit accounting.
   * @returns {number} Allocated cache bytes, excluding permanent editor/export indexes.
   */
  storageCacheBytes() {
    return optionalCacheBytes(this.#database);
  }
  /** Durable receipt lookup survives source-file removal and cache eviction.
   * @param {string} sha256 Canonical capture identity.
   * @returns {object | undefined} Retained import identity and counts.
   */
  captureReceipt(sha256) {
    return this.#database.prepare("SELECT * FROM capture_catalog WHERE sha256=?").get(sha256);
  }
  /** Catalog rows contain small import provenance metadata, never capture contents.
   * @returns {object[]} Small capture metadata rows in import order.
   */
  captureCatalog() {
    return this.#database.prepare("SELECT * FROM capture_catalog ORDER BY imported_at,sha256").all();
  }
  /** Record the first successful import atomically with its facts; reimports only refresh last-seen time.
   * @param {ImportReport} report Successfully validated native trace import.
   */
  recordCaptureReceipt(report) {
    this.#requireTransaction();
    if (!["uttori-asm-instruction-trace", "uttori-asm-bus-trace"].includes(report.format)) {
      return;
    }
    const now = Date.now();
    this.#database.prepare(`INSERT INTO capture_catalog(sha256,profile,source_name,imported_at,last_seen_at,observed_events,dropped_events)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(sha256) DO UPDATE SET last_seen_at=excluded.last_seen_at`).run(
      report.sourceSha256,
      report.indexProfile ?? "full",
      report.sourceName,
      now,
      now,
      report.imported.busEvents ?? report.imported.executionEvents ?? 0,
      report.unsupported.find((entry) => entry.field === "instruction-addresses")?.count ?? 0
    );
  }
  /** Drop disposable projections after publication, then recycle WAL without waiting on active readers.
   * @returns {object} Cache eviction totals and whether readers delayed WAL truncation.
   */
  maintainStorage() {
    const caches = this.transaction(() => maintainStorageCaches(this.#database));
    const previousTimeout = Number(this.#database.prepare("PRAGMA busy_timeout").get().timeout);
    try {
      this.#database.exec("PRAGMA busy_timeout=0; PRAGMA wal_checkpoint(PASSIVE)");
      const checkpoint = this.#database.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
      return { ...caches, checkpointBusy: Number(checkpoint?.busy ?? 0) !== 0 };
    } finally {
      this.#database.exec(`PRAGMA busy_timeout=${previousTimeout}`);
    }
  }
  /** Close once in finally, releasing statements and any active transaction. Further use throws. */
  close() {
    this.#database.close();
  }
};

// packages/disassembler/src/runtime-bus-trace.ts
var import_node_crypto4 = require("node:crypto");

// packages/disassembler/src/runtime-graphics.ts
var mapVram = (address, mapping) => {
  if (mapping === 0) {
    return address;
  }
  const bits = mapping + 4;
  const lowMask = (1 << bits) - 1;
  const blockMask = (1 << bits + 3) - 1;
  return address & ~blockMask | (address & lowMask) << 3 | address >> bits & 7;
};
var createRuntimeGraphicsAccumulator = () => {
  let forcedBlank = null;
  let vmain = null;
  let vramAddress = 0;
  let vramKnown = 0;
  let cgramAddress = null;
  let cgramHigh = null;
  let cgramLatch = {
    value: null,
    sourceSequence: null
  };
  let oamBase = 0;
  let oamKnown = 1;
  let oamAddress = null;
  let oamLatch = {
    value: null,
    sourceSequence: null
  };
  const activity = /* @__PURE__ */ new Map();
  const writes = [];
  let omittedWrites = 0;
  const advanceVram = (byte) => {
    if (vmain === null) {
      vramKnown = 0;
    } else if (byte === vmain >> 7) {
      if (vramKnown === 65535) {
        vramAddress = vramAddress + [1, 32, 128, 128][vmain & 3] & 65535;
      } else {
        vramKnown = 0;
      }
    }
  };
  const advanceCgram = () => {
    if (cgramHigh === null) {
      cgramAddress = null;
    } else {
      if (cgramHigh && cgramAddress !== null) {
        cgramAddress = cgramAddress + 1 & 255;
      }
      cgramHigh = !cgramHigh;
    }
  };
  const record = (write) => {
    const key2 = `${write.actor}:${write.channel}:${write.target}`;
    let group = activity.get(key2);
    if (!group) {
      group = {
        actor: write.actor,
        channel: write.channel,
        target: write.target,
        portWrites: 0,
        addressed: 0,
        latched: 0,
        unknown: 0,
        byteTargets: 0,
        knownValueTargets: 0
      };
      activity.set(key2, group);
    }
    group.portWrites++;
    group[write.status]++;
    group.byteTargets += write.bytes.length;
    group.knownValueTargets += write.bytes.filter((byte) => byte.value !== null).length;
    if (!Number.isSafeInteger(group.byteTargets)) {
      throw new Error("Graphics byte count exceeds the safe range.");
    }
    if (writes.length < 64) {
      writes.push(write);
    } else {
      omittedWrites++;
    }
  };
  const push = (access) => {
    if ((access.address & 4194304) !== 0) {
      return;
    }
    const port = access.address & 65535;
    if (port < 8448 || port > 8511) {
      return;
    }
    const { value } = access;
    if (access.direction === "read") {
      if (port === 8505 || port === 8506) {
        advanceVram(port - 8505);
      } else if (port === 8507) {
        advanceCgram();
      } else if (port === 8504 && oamAddress !== null) {
        oamAddress = oamAddress + 1 & 1023;
      }
      return;
    }
    switch (port) {
      case 8448:
        forcedBlank = (value & 128) !== 0;
        oamAddress = null;
        return;
      case 8450:
      case 8451:
        if (port === 8450) {
          oamBase = oamBase & 512 | value << 1;
          oamKnown |= 510;
        } else {
          oamBase = oamBase & 511 | (value & 1) << 9;
          oamKnown |= 512;
        }
        oamAddress = forcedBlank === true && oamKnown === 1023 ? oamBase : null;
        return;
      case 8469:
        vmain = value;
        return;
      case 8470:
        vramAddress = vramAddress & 65280 | value;
        vramKnown |= 255;
        return;
      case 8471:
        vramAddress = vramAddress & 255 | value << 8;
        vramKnown |= 65280;
        return;
      case 8481:
        cgramAddress = value;
        cgramHigh = false;
        return;
    }
    if (port !== 8472 && port !== 8473 && port !== 8482 && port !== 8452) {
      return;
    }
    const data = { value, sourceSequence: access.sequence };
    const base = {
      sequence: access.sequence,
      actor: access.actor,
      channel: access.channel,
      port,
      value,
      forcedBlank
    };
    if (port === 8472 || port === 8473) {
      const byte = port - 8472;
      if (vmain !== null && vramKnown === 65535) {
        const address = mapVram(vramAddress, vmain >> 2 & 3) * 2 + byte;
        record({ ...base, target: "vram", status: "addressed", bytes: [{ address, ...data }] });
      } else {
        record({
          ...base,
          target: "vram",
          status: "unknown",
          reason: "missing-vram-registers",
          bytes: []
        });
      }
      advanceVram(byte);
    } else if (port === 8482) {
      if (cgramHigh === false) {
        cgramLatch = data;
        record({ ...base, target: "cgram", status: "latched", bytes: [] });
      } else if (cgramHigh === true && cgramAddress !== null) {
        record({
          ...base,
          target: "cgram",
          status: "addressed",
          bytes: [
            { address: cgramAddress * 2, ...cgramLatch },
            { address: cgramAddress * 2 + 1, ...data, value: value & 127 }
          ]
        });
      } else {
        cgramLatch = { value: null, sourceSequence: null };
        record({
          ...base,
          target: "cgram",
          status: "unknown",
          reason: "missing-cgram-state",
          bytes: []
        });
      }
      advanceCgram();
    } else if (oamAddress === null) {
      oamLatch = { value: null, sourceSequence: null };
      record({ ...base, target: "oam", status: "unknown", reason: "missing-oam-state", bytes: [] });
    } else {
      const address = oamAddress;
      oamAddress = address + 1 & 1023;
      if ((address & 1) === 0) {
        oamLatch = data;
      }
      if (address & 512) {
        record({
          ...base,
          target: "oam",
          status: "addressed",
          bytes: [{ address: 512 | address & 31, ...data }]
        });
      } else if (address & 1) {
        record({
          ...base,
          target: "oam",
          status: "addressed",
          bytes: [
            { address: address - 1, ...oamLatch },
            { address, ...data }
          ]
        });
      } else {
        record({ ...base, target: "oam", status: "latched", bytes: [] });
      }
    }
  };
  return {
    push,
    finish: () => ({
      model: "snes-ppu-ports-v1",
      activity: [...activity.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group),
      writes,
      omittedWrites
    })
  };
};

// packages/disassembler/src/runtime-transfer.ts
var validateRuntimeTransferBoundary = (marker) => {
  const { configuration: c } = marker;
  if (!c || !["dma", "hdma"].includes(marker.actor) || !Number.isInteger(marker.channel) || marker.channel < 0 || marker.channel > 7 || !["begin", "complete", "interrupted"].includes(marker.boundary) || typeof marker.transferId !== "string" || !/^(0|[1-9]\d{0,19})$/.test(marker.transferId) || BigInt(marker.transferId) > 0xffffffffffffffffn || !Number.isInteger(marker.pc) || marker.pc < 0 || marker.pc > 16777215 || !["unattributed", "instruction", "interrupt", "wait", "stop"].includes(marker.context) || !Number.isInteger(marker.transferred) || marker.transferred < 0 || marker.transferred > 65536) {
    throw new Error("Invalid transfer boundary attribution or count.");
  }
  for (const field of ["dmap", "bbad", "a1b", "dasb", "ntlr"]) {
    if (!Number.isInteger(c[field]) || c[field] < 0 || c[field] > 255) {
      throw new Error("Invalid transfer byte register.");
    }
  }
  for (const field of ["a1t", "das", "a2a"]) {
    if (!Number.isInteger(c[field]) || c[field] < 0 || c[field] > 65535) {
      throw new Error("Invalid transfer word register.");
    }
  }
  if (!Number.isInteger(c.flags) || c.flags < 0 || c.flags > 15) {
    throw new Error("Invalid transfer channel flags.");
  }
  if (marker.boundary === "begin") {
    if (marker.transferId !== marker.sequence || marker.transferred !== 0) {
      throw new Error("Invalid transfer begin identity.");
    }
  } else if (BigInt(marker.transferId) >= BigInt(marker.sequence) || marker.transferred < 1) {
    throw new Error("Invalid transfer end identity.");
  }
  if (marker.actor === "hdma" && (marker.boundary === "interrupted" || marker.transferred > 4)) {
    throw new Error("Invalid HDMA payload-burst boundary.");
  }
  return {
    kind: "transfer",
    sequence: marker.sequence,
    ordinal: marker.ordinal,
    cycle: marker.cycle,
    transferId: marker.transferId,
    pc: marker.pc,
    boundary: marker.boundary,
    actor: marker.actor,
    channel: marker.channel,
    context: marker.context,
    hcounter: marker.hcounter,
    vcounter: marker.vcounter,
    transferred: marker.transferred,
    configuration: {
      dmap: c.dmap,
      bbad: c.bbad,
      a1t: c.a1t,
      a1b: c.a1b,
      das: c.das,
      dasb: c.dasb,
      a2a: c.a2a,
      ntlr: c.ntlr,
      flags: c.flags
    }
  };
};
var createRuntimeTransferAccumulator = () => {
  const open2 = /* @__PURE__ */ new Map();
  const activity = /* @__PURE__ */ new Map();
  const windows = [];
  let omittedWindows = 0;
  const retain = (window) => {
    const key2 = `${window.actor}:${window.channel}`;
    let group = activity.get(key2);
    if (!group) {
      group = {
        actor: window.actor,
        channel: window.channel,
        complete: 0,
        interrupted: 0,
        leadingPartial: 0,
        trailingPartial: 0,
        bothPartial: 0,
        attemptedSlots: 0,
        reads: 0,
        writes: 0
      };
      activity.set(key2, group);
    }
    const fields = {
      complete: "complete",
      interrupted: "interrupted",
      "leading-partial": "leadingPartial",
      "trailing-partial": "trailingPartial",
      "both-partial": "bothPartial"
    };
    group[fields[window.status]]++;
    group.reads += window.reads;
    group.writes += window.writes;
    if (window.begin && window.end) {
      group.attemptedSlots += window.end.transferred;
    }
    if (!Number.isSafeInteger(group.attemptedSlots)) {
      throw new Error("Transfer slot total exceeds the safe integer range.");
    }
    if (windows.length < 64) {
      windows.push(window);
    } else {
      omittedWindows++;
    }
  };
  return {
    /** Attach only DMA/HDMA payload events; table/pointer fetches remain separate bus evidence.
     * @param {RuntimeBusAccess | RuntimeTransferBoundary} event Already validated ordered event.
     */
    push: (event) => {
      if (event.actor === "cpu") {
        return;
      }
      const marker = "kind" in event;
      if (!marker && event.phase !== "dma" && event.phase !== "hdma-transfer") {
        return;
      }
      const key2 = `${event.actor}:${event.channel}`;
      let current = open2.get(key2);
      if (marker && event.boundary === "begin") {
        if (current) {
          throw new Error("Transfer began before the previous channel window ended.");
        }
        open2.set(key2, {
          actor: event.actor,
          channel: event.channel,
          begin: event,
          reads: 0,
          writes: 0
        });
        return;
      }
      if (!current) {
        current = { actor: event.actor, channel: event.channel, reads: 0, writes: 0 };
        open2.set(key2, current);
      }
      if (!marker) {
        if (event.direction === "read") {
          current.reads++;
        } else {
          current.writes++;
        }
        const maximum = event.actor === "dma" ? 65536 : 4;
        if (current.reads > maximum || current.writes > maximum) {
          throw new Error("Transfer window exceeds the native payload bound.");
        }
        return;
      }
      const expectedId = current.begin?.transferId ?? "0";
      if (event.transferId !== expectedId) {
        throw new Error("Transfer end does not match its observed begin.");
      }
      if (current.reads > event.transferred || current.writes > event.transferred) {
        throw new Error("Transfer contains more observed accesses than attempted byte slots.");
      }
      if (current.begin) {
        if (current.reads + current.writes < event.transferred) {
          throw new Error("Transfer is missing bus accesses inside its observed boundaries.");
        }
        const configuration = current.begin.configuration;
        let expected = configuration.das || 65536;
        if (event.actor === "hdma") {
          expected = [1, 2, 2, 4, 4, 4, 2, 4][configuration.dmap & 7];
        }
        if (event.boundary === "complete" && event.transferred !== expected || event.transferred > expected) {
          throw new Error("Transfer completion disagrees with its starting configuration.");
        }
      }
      let status = "leading-partial";
      if (current.begin) {
        status = event.boundary === "complete" ? "complete" : "interrupted";
      }
      retain({ ...current, end: event, status });
      open2.delete(key2);
    },
    /** Close remaining windows without claiming completion or an attempted slot count.
     * @returns {RuntimeTransferSummary} Bounded report with exact lifetime window counts.
     */
    finish: () => {
      for (const current of open2.values()) {
        retain({ ...current, status: current.begin ? "trailing-partial" : "both-partial" });
      }
      open2.clear();
      return {
        activity: [...activity.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
        windows,
        omittedWindows
      };
    }
  };
};

// packages/disassembler/src/runtime-bus-trace.ts
var RUNTIME_BUS_TRACE_FORMAT = "uttori-asm-bus-trace";
var RUNTIME_BUS_INDEX_PROFILE = "bus-access-v1";
var unsigned = (value) => {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,19})$/.test(value)) {
    throw new Error("Bus trace requires canonical unsigned 64-bit decimal strings.");
  }
  if (value.length <= 15) {
    return Number(value);
  }
  const number = BigInt(value);
  if (number > 0xffffffffffffffffn) {
    throw new Error("Bus trace integer exceeds u64.");
  }
  if (number <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(number);
  }
  return number;
};
var validateRuntimeBusTraceMetadata = (value) => {
  const meta = value;
  if (!meta || meta.format !== RUNTIME_BUS_TRACE_FORMAT || meta.schemaVersion !== 1 || meta.scope !== "snes.cpu-bus" && meta.scope !== "snes.cpu-bus-transfers" && meta.scope !== "snes.cpu-bus-ppu" || meta.architecture !== "snes.65816" || meta.addressSpace !== "snes.cpu" || typeof meta.romContentSha256 !== "string" || !/^[\da-f]{64}$/.test(meta.romContentSha256) || typeof meta.session !== "string" || !/^[\da-f]{32}$/.test(meta.session) || typeof meta.producer?.id !== "string" || !meta.producer.id || typeof meta.producer?.revision !== "string" || !meta.producer.revision || meta.clock?.id !== "snes.master") {
    throw new Error("Invalid SNES bus trace metadata.");
  }
  if (unsigned(meta.clock.numerator) === 0 || unsigned(meta.clock.denominator) === 0) {
    throw new Error("Bus trace clock frequency must be positive.");
  }
  return {
    format: RUNTIME_BUS_TRACE_FORMAT,
    schemaVersion: 1,
    scope: meta.scope,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: meta.romContentSha256,
    producer: { id: meta.producer.id, revision: meta.producer.revision },
    session: meta.session,
    clock: {
      id: "snes.master",
      numerator: meta.clock.numerator,
      denominator: meta.clock.denominator
    }
  };
};
var createRuntimeBusTraceImporter = (metadata, context, storage) => {
  const meta = validateRuntimeBusTraceMetadata(metadata);
  if (meta.romContentSha256 !== context.projectRomContentSha256) {
    throw new Error("ROM/project mismatch: bus capture does not match the destination ROM.");
  }
  if (typeof context.sourceName !== "string" || !context.sourceName) {
    throw new Error("Bus capture source name must not be empty.");
  }
  const limit = context.maxIndexRecords ?? 2e6;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8e6) {
    throw new Error("Bus trace fact budget must be in [1, 8000000].");
  }
  const memory = /* @__PURE__ */ new Map();
  const index = storage?.index ?? {
    add: (key2, create) => {
      const current = memory.get(key2);
      if (current) {
        current.count++;
        return false;
      }
      memory.set(key2, { fact: create(), count: 1 });
      return true;
    },
    values: () => memory.values(),
    clear: () => memory.clear()
  };
  const hash = (0, import_node_crypto4.createHash)("sha256").update(`uttori-bus-index-v1
${JSON.stringify(meta)}
`);
  const factKeys = new TraceCache(context.cacheMetrics?.facts);
  const activity = /* @__PURE__ */ new Map();
  const contexts = {
    unattributed: 0,
    instruction: 0,
    interrupt: 0,
    wait: 0,
    stop: 0
  };
  const transfers = meta.scope !== "snes.cpu-bus" ? createRuntimeTransferAccumulator() : void 0;
  const graphics = createRuntimeGraphicsAccumulator();
  const ppu = meta.scope === "snes.cpu-bus-ppu" ? createRuntimePPUAccumulator() : void 0;
  let streamEvents = 0;
  let markerEvents = 0;
  let observed = 0;
  let facts = 0;
  let previousCycle = 0;
  let firstCycle = null;
  let lastOrdinal = 0;
  let lastPc = 0;
  let finished = false;
  let failed = false;
  const push = (chunk) => {
    if (finished || failed) {
      throw new Error("Bus trace importer is no longer writable.");
    }
    try {
      const accesses = chunk?.accesses;
      if (!Array.isArray(accesses) || accesses.length < 1 || accesses.length > 4095) {
        throw new Error("Bus trace chunks require 1\u20134095 accesses.");
      }
      const hashLines = [];
      for (const item of accesses) {
        if (!item || typeof item !== "object") {
          throw new Error("Invalid bus trace event.");
        }
        const access = item;
        const sequence = unsigned(access.sequence);
        const ordinal = unsigned(access.ordinal);
        const cycle = unsigned(access.cycle);
        if (streamEvents === Number.MAX_SAFE_INTEGER || sequence !== streamEvents + 1) {
          throw new Error(
            "Bus trace event sequence is not contiguous or exceeds the safe count range."
          );
        }
        if (cycle < previousCycle) {
          throw new Error("Bus trace master clock moved backwards.");
        }
        const hasOwner = ordinal > 0;
        if (hasOwner !== (access.context === "instruction")) {
          throw new Error("Bus trace instruction context and ordinal disagree.");
        }
        if (ordinal > 0 && (ordinal < lastOrdinal || ordinal === lastOrdinal && access.pc !== lastPc)) {
          throw new Error("Bus trace instruction ownership moved backwards or changed PC.");
        }
        if (!Number.isInteger(access.hcounter) || access.hcounter < 0 || access.hcounter >= 1368 || !Number.isInteger(access.vcounter) || access.vcounter < 0 || access.vcounter >= 313) {
          throw new Error("Bus trace raster position is out of range.");
        }
        previousCycle = cycle;
        firstCycle ??= access.cycle;
        if (ordinal > 0) {
          lastOrdinal = ordinal;
          lastPc = access.pc;
        }
        streamEvents++;
        if ("kind" in access) {
          if (!transfers || access.kind !== "transfer") {
            throw new Error("Transfer markers require the negotiated transfer scope.");
          }
          const marker = validateRuntimeTransferBoundary(access);
          transfers.push(marker);
          markerEvents++;
          hashLines.push(JSON.stringify(marker) + "\n");
          continue;
        }
        const port = access.address & 65535;
        const dataPort = access.direction === "write" && !(access.address & 4194304) && [8452, 8472, 8473, 8482].includes(port);
        if (access.ppu !== void 0 !== Boolean(ppu && dataPort)) {
          throw new Error("Missing or out-of-scope native PPU effect.");
        }
        const effect = access.ppu;
        if (access.ppu && (!Number.isInteger(access.ppu.hcounter) || access.ppu.hcounter < 0 || access.ppu.hcounter >= 1368 || !Number.isInteger(access.ppu.vcounter) || access.ppu.vcounter < 0 || access.ppu.vcounter >= 313)) {
          throw new Error("Invalid PPU decision raster.");
        }
        const fact = {
          // Presence is not truthiness: null/false/zero annotations must reach
          // validation and fail, rather than masquerade as an omitted effect.
          ...effect !== void 0 ? { ppu: effect } : {},
          addressSpace: meta.addressSpace,
          address: access.address,
          pc: access.pc,
          value: access.value,
          direction: access.direction,
          actor: access.actor,
          channel: access.channel,
          phase: access.phase,
          context: access.context
        };
        const normalizedEffect = validateRuntimeBusFact(fact);
        if (normalizedEffect) {
          fact.ppu = normalizedEffect;
        }
        transfers?.push(access);
        if (ppu) {
          ppu.push(access);
        } else {
          graphics.push(access);
        }
        const factJson = JSON.stringify(fact);
        let key2 = factKeys.get(factJson);
        if (key2 === void 0) {
          key2 = (0, import_node_crypto4.createHash)("sha256").update(factJson).digest("hex");
          factKeys.insert(factJson, key2);
        }
        if (index.add(key2, () => ({
          kind: "memory",
          record: {
            ...fact,
            id: key2,
            kind: "runtime-bus-access",
            architecture: meta.architecture,
            count: 1,
            evidence: []
          }
        }))) {
          facts++;
          if (facts > limit) {
            throw new Error(`Bus trace exceeds the ${limit} distinct-fact budget.`);
          }
        }
        let line = `["${access.sequence}","${access.ordinal}","${access.cycle}",${factJson},${access.hcounter},${access.vcounter}`;
        if (access.ppu) {
          line += `,${access.ppu.hcounter},${access.ppu.vcounter}`;
        }
        hashLines.push(line + "]\n");
        observed++;
        contexts[access.context]++;
        const groupKey = `${access.actor}:${access.channel}:${access.phase}`;
        let group = activity.get(groupKey);
        if (!group) {
          group = {
            actor: access.actor,
            channel: access.channel,
            phase: access.phase,
            reads: 0,
            writes: 0,
            unowned: 0,
            firstSequence: access.sequence,
            lastSequence: access.sequence,
            firstCycle: access.cycle,
            lastCycle: access.cycle
          };
          activity.set(groupKey, group);
        }
        if (access.direction === "read") {
          group.reads++;
        } else {
          group.writes++;
        }
        if (ordinal === 0) {
          group.unowned++;
        }
        group.lastSequence = access.sequence;
        group.lastCycle = access.cycle;
      }
      hash.update(hashLines.join(""));
      if (context.onProgress) {
        const summary = ppu?.finish();
        const counts = summary ? {
          portWrites: summary.portWrites,
          written: summary.written,
          blocked: summary.blocked,
          latched: summary.latched,
          byteWrites: summary.byteWrites,
          renderingRestricted: summary.renderingRestricted,
          omittedWrites: summary.omittedWrites
        } : void 0;
        context.onProgress({
          streamEvents,
          busEvents: observed,
          distinctFacts: facts,
          transferMarkers: markerEvents,
          firstCycle,
          lastCycle: firstCycle === null ? null : String(previousCycle),
          ...counts ? { ppu: counts } : {},
          activity: [...activity.values()].map((group) => ({ ...group }))
        });
      }
    } catch (error) {
      failed = true;
      index.clear();
      throw error;
    }
  };
  const finish = () => {
    if (finished || failed) {
      throw new Error("Bus trace importer cannot be finalized again or after failure.");
    }
    finished = true;
    try {
      const sourceSha256 = hash.digest("hex");
      storage?.onSource?.(sourceSha256, RUNTIME_BUS_INDEX_PROFILE);
      const evidenceId = `evidence:bus-trace:${sourceSha256}`;
      const runtime = [];
      for (const { fact, count } of index.values()) {
        if (fact.kind !== "memory" || fact.record.kind !== "runtime-bus-access") {
          throw new Error("Bus trace index contains an unexpected fact kind.");
        }
        const record = {
          ...fact.record,
          id: `runtime:bus-trace:${sourceSha256}:${fact.record.id}`,
          count,
          evidence: [evidenceId]
        };
        if (storage?.onRecord) {
          storage.onRecord(record);
        } else {
          runtime.push(record);
        }
      }
      const transferSummary = transfers?.finish();
      const graphicsSummary = graphics.finish();
      const ppuSummary = ppu?.finish();
      const transferCounts = {};
      if (ppuSummary) {
        for (const key2 of [
          "portWrites",
          "written",
          "blocked",
          "latched",
          "byteWrites",
          "renderingRestricted"
        ]) {
          transferCounts[`ppu.${key2}`] = ppuSummary[key2];
        }
      }
      if (transferSummary) {
        transferCounts.streamEvents = streamEvents;
        transferCounts.transferMarkers = markerEvents;
        for (const group of transferSummary.activity) {
          for (const field of [
            "complete",
            "interrupted",
            "leadingPartial",
            "trailingPartial",
            "bothPartial",
            "attemptedSlots",
            "reads",
            "writes"
          ]) {
            transferCounts[`${group.actor}${group.channel}.${field}`] = group[field];
          }
        }
      }
      const report = {
        id: `import:bus-trace:${sourceSha256}`,
        format: RUNTIME_BUS_TRACE_FORMAT,
        indexProfile: RUNTIME_BUS_INDEX_PROFILE,
        sourceName: context.sourceName,
        sourceSha256,
        sourceVersion: `v1@${meta.producer.id}:${meta.producer.revision}`,
        imported: {
          ...transferCounts,
          busEvents: observed,
          busRecords: facts,
          unownedEvents: observed - contexts.instruction
        },
        unsupported: [],
        warnings: [
          "Bus facts retain byte-access variants and exact counts. Ordered timing, raster and instruction-ordinal history require the capture archive.",
          transfers ? "Transfer totals use explicit native boundaries. Partial windows stay explicit; full configuration and ordered history require the capture archive." : "Activity counts describe observed bus accesses; transfer boundaries, register setup and source instructions are not inferred."
        ]
      };
      return {
        report,
        sourceSha256,
        observedEvents: observed,
        droppedEvents: 0,
        summary: {
          ...transferSummary ? { transfers: transferSummary } : {},
          ...ppuSummary ? { ppu: ppuSummary } : {},
          ...graphicsSummary.activity.length ? { graphics: graphicsSummary } : {},
          clock: meta.clock,
          firstCycle,
          lastCycle: firstCycle === null ? null : String(previousCycle),
          contexts,
          activity: [...activity.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value)
        },
        batch: {
          ...storage?.onRecord ? {} : { runtime: runtime.sort((a, b) => a.id.localeCompare(b.id)) },
          evidence: [
            {
              id: evidenceId,
              source: "runtime",
              sourceId: `${meta.producer.id}:${meta.producer.revision}`,
              confidence: "certain",
              detail: `${observed} lossless bus accesses; ${observed - contexts.instruction} without an owning instruction.`,
              artifact: {
                format: RUNTIME_BUS_TRACE_FORMAT,
                formatVersion: "1",
                sha256: sourceSha256,
                romContentSha256: meta.romContentSha256
              }
            }
          ],
          imports: [report]
        }
      };
    } finally {
      index.clear();
    }
  };
  return { push, finish };
};

// packages/disassembler/src/runtime-bus-project.ts
var import_node_fs5 = __toESM(require("node:fs"), 1);
var captureFileIdentity = (file) => {
  const stat = import_node_fs5.default.statSync(file, { bigint: true });
  if (!stat.isFile()) {
    throw new Error("Capture input must be a regular file.");
  }
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
};
var importRuntimeBusTraceSourceIntoProject = async (source, directory, context, options = {}) => {
  options.signal?.throwIfAborted();
  const store = openAnalysisProjectStore(directory);
  try {
    const before = store.storageSnapshot();
    const manifest = store.transaction(() => store.manifest(), false);
    const expected = analysisProjectRevision(manifest);
    if (manifest.rom.contentSha256 !== context.projectRomContentSha256) {
      throw new Error("ROM/project mismatch: destination does not match the bus import context.");
    }
    let addedRuntime = 0;
    let completedFileIdentity;
    let validate;
    let insert;
    options.onStage?.("Indexing CPU/DMA/HDMA bus facts in SQLite\u2026");
    const importer = await store.indexTrace(async (index) => {
      const importer2 = createRuntimeBusTraceImporter(source.metadata, context, {
        index,
        // finish() calls onSource before onRecord inside the publication transaction,
        // after the entire source validates. This keeps the one-time namespace
        // lookup protected by the same writer lock as the inserts it authorizes.
        onSource: (sha256) => {
          insert = store.runtimeBatchInserter(`runtime:bus-trace:${sha256}:`);
        },
        onRecord: (record) => {
          options.signal?.throwIfAborted();
          validate ??= createRuntimeRecordValidator(
            manifest,
            record.evidence.map((id) => ({
              id,
              source: "runtime",
              sourceId: "bus-trace",
              confidence: "certain"
            })),
            false
          );
          validate(record);
          if (insert(record)) {
            addedRuntime++;
          }
        }
      });
      await source.read((chunk) => {
        options.signal?.throwIfAborted();
        importer2.push(chunk);
      });
      if (source.completedFile) {
        completedFileIdentity = captureFileIdentity(source.completedFile);
      }
      return importer2;
    }, context.cacheMetrics?.index);
    options.onStage?.("Publishing validated bus activity\u2026");
    options.signal?.throwIfAborted();
    const result = store.transaction(() => {
      assertAnalysisProjectRevision(store, expected);
      let imported;
      try {
        imported = importer.finish();
      } finally {
        validate?.close();
      }
      const base = {
        analysis: [],
        annotations: [],
        labels: [],
        comments: [],
        regions: [],
        runtime: [],
        evidence: store.loadTable("evidence"),
        imports: store.loadTable("imports")
      };
      const retained = base.imports.find((item) => item.id === imported.report.id);
      const report = {
        ...imported.report,
        sourceName: retained?.sourceName ?? imported.report.sourceName
      };
      const merged = mergeRuntimeEvidence(base, { ...imported.batch, imports: [report] });
      validateLoadedShards(merged.shards, manifest);
      const changed = merged.changed || addedRuntime > 0;
      if (changed) {
        store.replaceTables({ evidence: merged.shards.evidence, imports: merged.shards.imports });
        store.publishManifest(manifest);
      }
      if (options.storagePolicy) {
        store.setStoragePolicy(options.storagePolicy);
      }
      store.recordCaptureReceipt(report);
      if (source.completedFile) {
        if (captureFileIdentity(source.completedFile) !== completedFileIdentity) {
          throw new Error("Completed live capture changed before publication.");
        }
      }
      options.signal?.throwIfAborted();
      return {
        report,
        sourceSha256: imported.sourceSha256,
        observedEvents: imported.observedEvents,
        droppedEvents: imported.droppedEvents,
        summary: imported.summary,
        changed,
        added: { runtime: addedRuntime, evidence: merged.added.evidence }
      };
    });
    if (result.changed) {
      store.writePointer(directory);
    }
    let checkpointBusy = false;
    const warnings = [];
    try {
      options.onStage?.("Recycling SQLite caches and WAL\u2026");
      checkpointBusy = store.maintainStorage().checkpointBusy;
    } catch (error) {
      warnings.push(`Bus import committed; storage maintenance deferred: ${String(error)}`);
    }
    const after = store.storageSnapshot();
    const newFacts = after.facts - before.facts;
    return {
      ...result,
      warnings,
      storage: {
        before,
        after,
        newFacts,
        reusedFacts: Math.max(0, after.observations - before.observations - newFacts),
        checkpointBusy
      }
    };
  } finally {
    store.close();
  }
};

// packages/vscode-extension/src/live-bus-analysis-process.ts
var cancellation = new AbortController();
var latest;
var started = false;
var previewInFlight = false;
var pendingPreview;
var flushPreview = () => {
  if (previewInFlight || !pendingPreview) {
    return;
  }
  previewInFlight = true;
  const message = pendingPreview;
  pendingPreview = void 0;
  process.send?.(message);
};
var handleLiveBusProcessMessage = (message) => {
  if (message.type === "preview-accepted") {
    previewInFlight = false;
    flushPreview();
    return;
  }
  if (message.type === "cancel") {
    cancellation.abort();
    return;
  }
  if (message.type === "position") {
    latest = message.position;
    process.send?.({ type: "accepted" });
    return;
  }
  if (started) {
    return;
  }
  started = true;
  latest = message.position;
  const settle = (value) => {
    process.send?.(value, () => process.disconnect?.());
  };
  void runLiveBusAnalysis(message).then(
    (value) => settle({ type: "result", value }),
    (error) => settle({ type: "error", error: error instanceof Error ? error.message : String(error) })
  );
};
if (typeof process.send === "function") {
  process.on("disconnect", () => process.exit(0));
  process.on("message", handleLiveBusProcessMessage);
}
async function runLiveBusAnalysis(options) {
  const profile = options.profile ? { cursorMs: 0, yields: 0, yieldMs: 0, idleWaits: 0, idleMs: 0, stages: {} } : void 0;
  let stage = "Opening capture";
  let stageStarted = profile ? performance.now() : 0;
  const onStage = (next) => {
    if (!profile) {
      return;
    }
    const now = performance.now();
    profile.stages[stage] = (profile.stages[stage] ?? 0) + now - stageStarted;
    stageStarted = now;
    stage = next;
  };
  if (![options.maxLagBytes, options.maxBytes, options.maxIndexRecords].every(
    (n) => Number.isSafeInteger(n) && n > 0
  )) {
    throw new Error("Invalid live analysis budgets.");
  }
  let cursor;
  try {
    cursor = await NativeCaptureFileCursor.open(options.file + ".partial", {
      signal: cancellation.signal,
      maxBytes: options.maxBytes
    });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    cursor = await NativeCaptureFileCursor.open(options.file, {
      signal: cancellation.signal,
      maxBytes: options.maxBytes
    });
  }
  let lastProgress = -Infinity;
  let peakLagBytes = 0;
  const startedAt = performance.now();
  try {
    const metadata = validateRuntimeBusTraceMetadata({
      ...cursor.header,
      format: "uttori-asm-bus-trace",
      schemaVersion: 1
    });
    if (metadata.session !== options.position.session) {
      throw new Error("Live capture session changed before opening.");
    }
    const result = await importRuntimeBusTraceSourceIntoProject(
      {
        metadata,
        completedFile: options.file,
        read: async (accept) => {
          while (!cursor.complete) {
            cancellation.signal.throwIfAborted();
            const position = latest;
            const lag = Number(position.fileBytes) - cursor.readBytes;
            peakLagBytes = Math.max(peakLagBytes, lag);
            if (lag > options.maxLagBytes) {
              throw new Error(
                "Live analysis exceeded its lag budget; recording continues. Import the completed archive offline."
              );
            }
            const sliceStarted = profile ? performance.now() : 0;
            await cursor.readThrough(
              position,
              (chunk) => {
                if (chunk.scope === "snes.65816.instructions") {
                  throw new Error("Live bus analysis requires bus scope.");
                }
                accept({
                  accesses: chunk.scope === "snes.cpu-bus" ? chunk.accesses : chunk.events
                });
              },
              16,
              options.file
            );
            if (profile) {
              profile.cursorMs += performance.now() - sliceStarted;
            }
            const waitStarted = profile ? performance.now() : 0;
            if (cursor.complete || cursor.readBytes < Number(position.fileBytes)) {
              await (0, import_promises3.setImmediate)(void 0, { signal: cancellation.signal });
              if (profile) {
                profile.yields++;
                profile.yieldMs += performance.now() - waitStarted;
              }
            } else {
              await (0, import_promises3.setTimeout)(5, void 0, { signal: cancellation.signal });
              if (profile) {
                profile.idleWaits++;
                profile.idleMs += performance.now() - waitStarted;
              }
            }
          }
        }
      },
      options.projectDirectory,
      {
        projectRomContentSha256: metadata.romContentSha256,
        sourceName: options.file.split(/[/\\]/).at(-1),
        maxIndexRecords: options.maxIndexRecords,
        onProgress: (progress) => {
          const now = performance.now();
          if (now - lastProgress < 200) {
            return;
          }
          lastProgress = now;
          pendingPreview = {
            type: "progress",
            progress: {
              ...progress,
              readBytes: cursor.readBytes,
              durableBytes: Number(latest.fileBytes),
              provisional: true
            }
          };
          flushPreview();
        }
      },
      { signal: cancellation.signal, onStage: profile ? onStage : void 0 }
    );
    onStage("done");
    return {
      ...result,
      live: {
        wallMs: performance.now() - startedAt,
        peakLagBytes,
        peakRssBytes: process.resourceUsage().maxRSS * 1024,
        ...profile ? { profile } : {}
      }
    };
  } finally {
    await cursor.close();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handleLiveBusProcessMessage,
  runLiveBusAnalysis
});
