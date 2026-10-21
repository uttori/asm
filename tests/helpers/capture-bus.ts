import { captureCrc32c, type CapturePositionV2 } from "@uttori/asm-capture";

/** Synthetic bus stream identity and native negotiation contract, shared by archive/RSP tests. */
export const busSession = "0123456789abcdef0123456789abcdef";
export const busScope = "snes.cpu-bus";
export const busCapabilities = {
  version: 2,
  scope: busScope,
  mode: "lossless",
  ownership: "durable-prefix",
  maxChunkBytes: 262144,
  requiredReserveBytes: 64,
  overheadBytes: 4194304,
  resumeSession: false,
} as const;

/** Fully accepted prefix; tests override individual ownership boundaries for negative cases. */
export const busPosition = (
  events = "0",
  chunks = "0",
  state: CapturePositionV2["state"] = "armed",
): CapturePositionV2 => ({
  scope: busScope,
  session: busSession,
  state,
  producedThrough: events,
  deliveredThrough: events,
  acceptedThrough: events,
  durableThrough: events,
  releasedThrough: events,
  chunkThrough: chunks,
  producedChunks: chunks,
  bufferedBytes: 0,
  allocatedBytes: 4718656,
  throttleCount: "0",
  clockNumerator: "236250000",
  clockDenominator: "11",
  droppedInScope: "0",
  error: "",
});

/** Raw wire values deliberately permit invalid combinations for decoder rejection tests. */
export interface BusWireAccess {
  readonly ordinal?: bigint;
  readonly cycle?: bigint;
  readonly address?: bigint;
  readonly pc?: number;
  readonly value?: number;
  readonly direction?: number;
  readonly actor?: number;
  readonly channel?: number;
  readonly phase?: number;
  readonly context?: number;
  readonly hcounter?: number;
  readonly vcounter?: number;
}

/** Encode a checksummed kind-2 frame. Default records are CPU opcode reads owned by instruction 1. */
export const busChunk = (
  records: readonly BusWireAccess[] = [{}],
  sequence = 1n,
  first = 1n,
): Buffer => {
  const b = Buffer.alloc(64 + 64 * records.length);
  b.write("ACT2");
  b.writeUInt16LE(2, 4);
  Buffer.from(busSession, "hex").copy(b, 8);
  b.writeBigUInt64LE(sequence, 24);
  b.writeBigUInt64LE(first, 32);
  b.writeUInt32LE(records.length, 40);
  b.writeUInt32LE(64, 44);
  b.writeUInt32LE(b.length - 64, 48);
  b.writeUInt32LE(b.length - 64, 52);
  records.forEach((r, i) => {
    const offset = 64 + i * 64;
    b.writeUInt16LE(2, offset);
    b.writeUInt16LE(1, offset + 2);
    b.writeUInt32LE(64, offset + 4);
    b.writeBigUInt64LE(first + BigInt(i), offset + 8);
    b.writeBigUInt64LE(r.cycle ?? (first + BigInt(i)) * 8n, offset + 24);
    b.writeBigUInt64LE(r.ordinal ?? 1n, offset + 32);
    b.writeBigUInt64LE(r.address ?? 0x808000n, offset + 40);
    b.writeUInt32LE(r.pc ?? 0x808000, offset + 48);
    b[offset + 52] = r.value ?? 0xea;
    b[offset + 53] = r.direction ?? 0;
    b[offset + 54] = r.actor ?? 0;
    b[offset + 55] = r.channel ?? 255;
    b[offset + 56] = r.phase ?? 0;
    b[offset + 57] = r.context ?? 1;
    b.writeUInt16LE(r.hcounter ?? 1367, offset + 58);
    b.writeUInt16LE(r.vcounter ?? 312, offset + 60);
  });
  b.writeUInt32LE(captureCrc32c(b, true), 56);
  return b;
};

/** Bounded JSON frames surrounding synthetic ACT2 chunks. */
export const busJsonFrame = (magic: string, value: unknown): Buffer => {
  const body = Buffer.from(JSON.stringify(value));
  const prefix = Buffer.alloc(12);
  prefix.write(magic);
  prefix.writeUInt32LE(body.length, 4);
  prefix.writeUInt32LE(captureCrc32c(body), 8);
  return Buffer.concat([prefix, body]);
};
