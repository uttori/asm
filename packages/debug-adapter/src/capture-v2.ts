import type { DebugTraceInstructionDetail } from "./contracts.js";

/** Exact counters crossing JavaScript/JSON boundaries. */
export type CaptureU64 = string;
export interface CaptureCapabilitiesV2 {
  readonly version: 2;
  readonly scope: "snes.65816.instructions";
  readonly mode: "lossless";
  readonly ownership: "durable-prefix";
  readonly maxChunkBytes: 262144;
  readonly requiredReserveBytes: 71;
  readonly overheadBytes: 4194304;
  readonly resumeSession: false;
}
export interface CapturePositionV2 {
  readonly session: string;
  readonly state:
    | "armed"
    | "recording"
    | "throttled"
    | "stopping"
    | "draining"
    | "complete"
    | "incomplete";
  readonly producedThrough: CaptureU64;
  readonly deliveredThrough: CaptureU64;
  readonly acceptedThrough: CaptureU64;
  readonly durableThrough: CaptureU64;
  readonly releasedThrough: CaptureU64;
  readonly chunkThrough: CaptureU64;
  readonly producedChunks: CaptureU64;
  readonly bufferedBytes: number;
  readonly allocatedBytes: number;
  readonly throttleCount: CaptureU64;
  readonly clockNumerator: CaptureU64;
  readonly clockDenominator: CaptureU64;
  readonly droppedInScope: "0";
  readonly error: string;
}
export type CaptureRequestV2 =
  | { readonly operation: "capabilities" }
  | { readonly operation: "start"; readonly bufferBytes: number }
  | { readonly operation: "status" | "stop" | "abort" | "release"; readonly session: string }
  | { readonly operation: "read"; readonly session: string; readonly chunk: CaptureU64 }
  | {
      readonly operation: "ack";
      readonly session: string;
      readonly chunk: CaptureU64;
      readonly event: CaptureU64;
    };
export type CaptureResultV2 = CaptureCapabilitiesV2 | CapturePositionV2 | { readonly hex: string };
export type CaptureTransportV2 = (request: CaptureRequestV2) => Promise<CaptureResultV2>;

const maxU64 = (1n << 64n) - 1n;
export const captureU64 = (value: unknown): bigint => {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,19})$/.test(value) || BigInt(value) > maxU64)
    throw new Error("Capture counter must be a canonical unsigned 64-bit decimal string.");
  return BigInt(value);
};
export const captureSession = (value: unknown): string => {
  if (typeof value !== "string" || !/^[\da-f]{32}$/.test(value))
    throw new Error("Invalid capture session identity.");
  return value;
};
export const validateCaptureRequest = (value: CaptureRequestV2): void => {
  if (!value || typeof value !== "object") throw new Error("Invalid capture request.");
  let fields = ["operation", "session"];
  if (value.operation === "capabilities") fields = ["operation"];
  if (value.operation === "start") fields = ["operation", "bufferBytes"];
  if (value.operation === "read") fields = ["operation", "session", "chunk"];
  if (value.operation === "ack") fields = ["operation", "session", "chunk", "event"];
  if (Object.keys(value).some((key) => !fields.includes(key)))
    throw new Error(
      "Unsupported capture negotiation field; this version supports only lossless 65816 instructions with durable ownership.",
    );
  if (value.operation === "capabilities") return;
  if (value.operation === "start") {
    if (
      !Number.isSafeInteger(value.bufferBytes) ||
      value.bufferBytes < 4718656 ||
      value.bufferBytes > 64 * 1024 * 1024
    )
      throw new Error("Capture buffer must be between 4718656 bytes and 64 MiB.");
    return;
  }
  captureSession(value.session);
  if (["status", "stop", "abort", "release"].includes(value.operation)) return;
  if (value.operation === "read" || value.operation === "ack") {
    if (!captureU64(value.chunk)) throw new Error("Capture chunk sequence starts at one.");
    if (value.operation === "ack" && !captureU64(value.event))
      throw new Error("Capture event sequence starts at one.");
    return;
  }
  throw new Error("Unsupported capture operation.");
};
export const validateCaptureCapabilities = (value: unknown): CaptureCapabilitiesV2 => {
  const expected = {
    version: 2,
    scope: "snes.65816.instructions",
    mode: "lossless",
    ownership: "durable-prefix",
    maxChunkBytes: 262144,
    requiredReserveBytes: 71,
    overheadBytes: 4194304,
    resumeSession: false,
  } as const;
  if (
    !value ||
    typeof value !== "object" ||
    Object.entries(expected).some(([key, item]) => (value as Record<string, unknown>)[key] !== item)
  )
    throw new Error("Unsupported capture scope, reserve, or ownership contract.");
  return expected;
};
export const validateCapturePosition = (value: unknown, session?: string): CapturePositionV2 => {
  if (!value || typeof value !== "object") throw new Error("Invalid capture position.");
  const p = value as CapturePositionV2;
  captureSession(p.session);
  if (session !== undefined && p.session !== session) throw new Error("Capture session changed.");
  if (
    !["armed", "recording", "throttled", "stopping", "draining", "complete", "incomplete"].includes(
      p.state,
    )
  )
    throw new Error("Invalid capture state.");
  const bounds = [
    p.releasedThrough,
    p.durableThrough,
    p.acceptedThrough,
    p.deliveredThrough,
    p.producedThrough,
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
  if (
    ![p.bufferedBytes, p.allocatedBytes].every(
      (v) => Number.isSafeInteger(v) && v >= 0 && v <= 64 * 1024 * 1024,
    ) ||
    p.bufferedBytes > p.allocatedBytes
  )
    throw new Error("Capture allocation exceeds its bounds.");
  if (
    p.state === "complete" &&
    (p.error ||
      p.bufferedBytes ||
      new Set(bounds.map(String)).size !== 1 ||
      p.chunkThrough !== p.producedChunks)
  )
    throw new Error("Capture terminal totals do not reconcile.");
  return p;
};

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0x82f63b78 : 0);
  return crc >>> 0;
});
/**
 * CRC-32C Castagnoli, including the canonical 123456789 test vector.
 * @param {Uint8Array} bytes Bytes to checksum.
 * @param {boolean} zeroChecksum Treat the ACT2 checksum field as zero.
 * @returns {number} Unsigned checksum.
 */
export const captureCrc32c = (bytes: Uint8Array, zeroChecksum = false): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++)
    crc = (crc >>> 8) ^ crcTable[(crc ^ (zeroChecksum && i >= 56 && i < 60 ? 0 : bytes[i])) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
};
export interface CaptureInstructionV2 {
  readonly sequence: CaptureU64;
  readonly ordinal: CaptureU64;
  readonly cycle: CaptureU64;
  readonly address: number;
  readonly detail: DebugTraceInstructionDetail;
}
export interface CaptureChunkV2 {
  readonly session: string;
  readonly sequence: CaptureU64;
  readonly first: CaptureU64;
  readonly through: CaptureU64;
  readonly instructions: readonly CaptureInstructionV2[];
}
/**
 * Validate the entire envelope and every record before accepting any event.
 * @param {Uint8Array} bytes Bounded encoded chunk.
 * @param {string} session Negotiated session identity.
 * @returns {CaptureChunkV2} Fully validated ordered instructions.
 */
export const decodeCaptureChunk = (bytes: Uint8Array, session: string): CaptureChunkV2 => {
  captureSession(session);
  if (bytes.length < 64 || bytes.length > 262144)
    throw new Error("Capture chunk length exceeds bounds.");
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    b.toString("ascii", 0, 4) !== "ACT2" ||
    b.readUInt16LE(4) !== 2 ||
    b.readUInt16LE(6) !== 0 ||
    b.readUInt32LE(44) !== 64 ||
    b.readUInt32LE(60) !== 0
  )
    throw new Error("Unsupported capture envelope.");
  if (b.toString("hex", 8, 24) !== session)
    throw new Error("Capture chunk belongs to another session.");
  if (b.readUInt32LE(48) !== bytes.length - 64 || b.readUInt32LE(52) !== bytes.length - 64)
    throw new Error("Capture payload lengths disagree.");
  if (captureCrc32c(bytes, true) !== b.readUInt32LE(56))
    throw new Error("Capture checksum mismatch.");
  const sequence = b.readBigUInt64LE(24),
    first = b.readBigUInt64LE(32),
    count = b.readUInt32LE(40);
  const through = first + BigInt(count) - 1n;
  if (!sequence || !first || !count || count > 3854 || through > maxU64)
    throw new Error("Invalid capture sequence range.");
  const instructions: CaptureInstructionV2[] = [];
  let offset = 64;
  for (let i = 0; i < count; i++) {
    if (offset + 68 > b.length) throw new Error("Truncated capture record.");
    const length = b.readUInt32LE(offset + 4),
      n = b[offset + 48];
    const event = first + BigInt(i),
      ordinal = b.readBigUInt64LE(offset + 32),
      address = b.readBigUInt64LE(offset + 40);
    if (
      b.readUInt16LE(offset) !== 1 ||
      b.readUInt16LE(offset + 2) !== 1 ||
      b.readUInt32LE(offset + 16) !== 0 ||
      b.readUInt32LE(offset + 20) !== 0
    )
      throw new Error("Unsupported required capture record.");
    if (
      n < 1 ||
      n > 4 ||
      length !== 67 + n ||
      offset + length > b.length ||
      b.readUInt16LE(offset + 49) !== 16
    )
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
      e: b[r + 15],
    };
    if (state.e > 1 || ((state.pb << 16) | state.pc) !== Number(address))
      throw new Error("Captured PC/state mismatch.");
    const cycle = b.readBigUInt64LE(offset + 24);
    if (i && cycle < BigInt(instructions[i - 1].cycle))
      throw new Error("Capture clock moved backwards.");
    instructions.push({
      sequence: String(event),
      ordinal: String(ordinal),
      cycle: String(cycle),
      address: Number(address),
      detail: { bytes: [...b.subarray(offset + 51, r)], state },
    });
    offset += length;
  }
  if (offset !== b.length)
    throw new Error("Capture record count does not consume the payload exactly.");
  return {
    session,
    sequence: String(sequence),
    first: String(first),
    through: String(through),
    instructions,
  };
};
