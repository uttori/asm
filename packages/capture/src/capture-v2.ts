import { crc32cBytes } from "@uttori/data-tools/data-hash-crc32";

import { decodeCaptureChunkBytes } from "./capture-compression.js";
import { decodeNesBusRecords, type CaptureNesBusAccessV2 } from "./capture-nes-ppu.js";
import type { CaptureNesTimelineV2 } from "./capture-nes-timeline.js";
import type { CaptureInstructionDetail } from "./instruction-detail.js";
import { readCaptureTargetPayload, type CaptureTargetPayload } from "./target-payload.js";

/** Exact counters crossing JavaScript/JSON boundaries. */
export type CaptureU64 = string;
/** Mutually exclusive streams. Bus scope does not contain fetched instruction bytes or registers. */
export type CaptureScopeV2 =
  | "nes.cpu-bus-ppu"
  | "nes.2a03.instructions"
  | "snes.65816.instructions"
  | "snes.cpu-bus"
  | "snes.cpu-bus-transfers"
  | "snes.cpu-bus-ppu";
/** Native capability reply. Every field except `nativeFile` must match the negotiated contract exactly. */
export interface CaptureCapabilitiesV2 {
  /** Wire protocol generation; only ACT2 version 2 is accepted. */
  readonly version: 2;
  /** Stream the producer will record; never downgraded to another scope. */
  readonly scope: CaptureScopeV2;
  /** Producers must never drop in-scope events. */
  readonly mode: "lossless";
  /** Producer retains events until the consumer acknowledges them as durable. */
  readonly ownership: "durable-prefix";
  /** Upper bound on one encoded chunk, in bytes. */
  readonly maxChunkBytes: 262144;
  /** Per-record ring reservation in bytes, fixed by scope (71 SNES instructions, 91 NES instructions, 64/80/88 SNES bus scopes, 128 NES bus). */
  readonly requiredReserveBytes: 71 | 64 | 80 | 88 | 91 | 128;
  /** Fixed producer allocation overhead in bytes, beyond the requested buffer. */
  readonly overheadBytes: 4194304;
  /** Sessions cannot be resumed after a disconnect; a new session must start. */
  readonly resumeSession: false;
  /** Explicit native file capability. Omitted by streamed-only producers. */
  readonly nativeFile?: true;
}
/**
 * Producer status snapshot. Event boundaries are non-decreasing in the order
 * released ≤ durable ≤ accepted ≤ delivered ≤ produced.
 */
export interface CapturePositionV2 {
  /** 32-hex-digit session identity. */
  readonly session: string;
  /** Every producer confirms its session scope, including instruction-only captures. */
  readonly scope: CaptureScopeV2;
  /** Session lifecycle state. `complete` requires reconciled totals; `incomplete` marks a failed or truncated session. */
  readonly state:
    | "armed"
    | "recording"
    | "throttled"
    | "stopping"
    | "draining"
    | "complete"
    | "incomplete";
  /** Last event sequence the producer has recorded. */
  readonly producedThrough: CaptureU64;
  /** Last event sequence handed to the consumer in a chunk. */
  readonly deliveredThrough: CaptureU64;
  /** Last event sequence the consumer has acknowledged receiving. */
  readonly acceptedThrough: CaptureU64;
  /** Last event sequence the consumer has persisted durably. */
  readonly durableThrough: CaptureU64;
  /** Last event sequence whose buffer space the producer has reclaimed. */
  readonly releasedThrough: CaptureU64;
  /** Last delivered chunk sequence; never exceeds `producedChunks`. */
  readonly chunkThrough: CaptureU64;
  /** Number of chunks the producer has sealed. */
  readonly producedChunks: CaptureU64;
  /** Bytes currently held in the producer buffer, 0..allocatedBytes; zero once complete. */
  readonly bufferedBytes: number;
  /** Producer buffer allocation in bytes, at most 64 MiB. */
  readonly allocatedBytes: number;
  /** Times the producer stalled emulation to avoid dropping events. */
  readonly throttleCount: CaptureU64;
  /** Numerator of the rational clock domain for record `cycle` values; nonzero. */
  readonly clockNumerator: CaptureU64;
  /** Denominator of the rational clock domain for record `cycle` values; nonzero. */
  readonly clockDenominator: CaptureU64;
  /** Lossless contract: always zero. */
  readonly droppedInScope: "0";
  /** Producer failure text, at most 256 characters; empty when healthy and required empty when complete. */
  readonly error: string;
}
/**
 * Local runtime companion operations. Identity is checked against the launched
 * executable before any path or replay state reaches the emulator.
 */
export type CaptureContextRequest =
  | {
      readonly operation: "context";
      readonly action: "prepare" | "replay" | "restore";
      readonly directory: string;
      /** Full iNES image identity, required for NES contexts. */
      readonly romFileSha256?: string;
      readonly romContentSha256: string;
      readonly producer: { readonly id: string; readonly revision: string };
    }
  | { readonly operation: "context"; readonly action: "start" | "stop"; readonly session: string }
  | {
      readonly operation: "context";
      readonly action: "mark";
      readonly session: string;
      readonly label: string;
    }
  | { readonly operation: "context"; readonly action: "abort" | "status" };
/**
 * Every request accepted by a capture transport. Native file operations write
 * ACT2 directly on the runtime host; streamed operations deliver chunks for
 * `read`/`ack` ownership transfer.
 */
export type CaptureRequestV2 =
  | CaptureContextRequest
  | { readonly operation: "file-capabilities"; readonly scope?: CaptureScopeV2 }
  | {
      readonly operation: "file-start";
      /** Optional native chunk/writer timings. Omitted for ordinary recording. */
      readonly measureStages?: boolean;
      readonly scope?: CaptureScopeV2;
      readonly bufferBytes: number;
      /** Absolute path on the verified local runtime host. No remote path translation. */
      readonly file: string;
      /** Full iNES identity; independent from the payload digest. */
      readonly romFileSha256?: string;
      readonly romContentSha256: string;
      readonly producer: { readonly id: string; readonly revision: string };
    }
  | {
      readonly operation: "file-status" | "file-stop" | "file-abort" | "file-release";
      readonly session: string;
    }
  | { readonly operation: "capabilities"; readonly scope?: CaptureScopeV2 }
  | { readonly operation: "start"; readonly bufferBytes: number; readonly scope?: CaptureScopeV2 }
  | { readonly operation: "status" | "stop" | "abort" | "release"; readonly session: string }
  | { readonly operation: "read"; readonly session: string; readonly chunk: CaptureU64 }
  | {
      readonly operation: "ack";
      readonly session: string;
      readonly chunk: CaptureU64;
      readonly event: CaptureU64;
    };
/** Transport reply: capabilities, a position, hex-encoded chunk bytes from `read`, or a context state. */
export type CaptureResultV2 =
  | CaptureCapabilitiesV2
  | CapturePositionV2
  | { readonly hex: string }
  | { readonly contextState: string };
/** Sends one validated request to the producer; callers validate the reply with `validateCaptureResult`. */
export type CaptureTransportV2 = (request: CaptureRequestV2) => Promise<CaptureResultV2>;

const maxU64 = (1n << 64n) - 1n;
/**
 * Validate the explicit stream dictionary. Callers choose the instruction default only on omission.
 * @param value Scope supplied by the caller or archive header.
 * @returns Supported stream identity. Unknown values throw.
 */
export const captureScope = (value: unknown): CaptureScopeV2 => {
  if (
    value !== "nes.cpu-bus-ppu" &&
    value !== "nes.2a03.instructions" &&
    value !== "snes.65816.instructions" &&
    value !== "snes.cpu-bus" &&
    value !== "snes.cpu-bus-transfers" &&
    value !== "snes.cpu-bus-ppu"
  ) {
    throw new Error("Unsupported capture scope.");
  }
  return value;
};
/**
 * Parse an exact counter without leading zeros or precision loss.
 * @param value Canonical decimal string.
 * @returns Counter in 0..2^64-1. Anything else throws.
 */
export const captureU64 = (value: unknown): bigint => {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,19})$/.test(value) || BigInt(value) > maxU64) {
    throw new Error("Capture counter must be a canonical unsigned 64-bit decimal string.");
  }
  return BigInt(value);
};
/**
 * Validate a session identity.
 * @param value Candidate identity.
 * @returns The same 32-digit lowercase hex string. Anything else throws.
 */
export const captureSession = (value: unknown): string => {
  if (typeof value !== "string" || !/^[\da-f]{32}$/.test(value)) {
    throw new Error("Invalid capture session identity.");
  }
  return value;
};

/**
 * Narrow to an indexable non-null object. Arrays pass; field checks reject them later.
 * @param value Candidate wire value.
 * @returns Whether fields can be read by key.
 */
function isFieldRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Check a nonempty, NUL-free string against a UTF-8 byte budget.
 * @param text Candidate string.
 * @param max Maximum encoded length in bytes.
 * @returns Whether the string fits.
 */
const bounded = (text: unknown, max: number): boolean =>
  typeof text === "string" &&
  text.length > 0 &&
  !text.includes("\0") &&
  new TextEncoder().encode(text).length <= max;

/**
 * Reject unknown operations, unknown fields and out-of-contract values before a request reaches a producer.
 * @param value Candidate request from a caller or wire peer.
 */
export function validateCaptureRequest(value: unknown): asserts value is CaptureRequestV2 {
  if (!isFieldRecord(value)) {
    throw new Error("Invalid capture request.");
  }
  if (value.operation === "context") {
    let fields = ["operation", "action"];
    const action = value.action;
    if (action === "prepare" || action === "replay" || action === "restore") {
      fields.push("directory", "romContentSha256", "romFileSha256", "producer");
      // Reuse the same bounded local path and immutable identity contract as ACT2.
      validateCaptureRequest({
        operation: "file-start",
        file: value.directory,
        romFileSha256: value.romFileSha256,
        romContentSha256: value.romContentSha256,
        producer: value.producer,
        bufferBytes: 8388608,
      });
    } else if (action === "start" || action === "stop" || action === "mark") {
      fields.push("session");
      captureSession(value.session);
      if (action === "mark") {
        fields.push("label");
        if (
          typeof value.label !== "string" ||
          !value.label.trim() ||
          value.label.includes("\0") ||
          new TextEncoder().encode(value.label).length > 256
        ) {
          throw new Error("Capture milestone labels must contain 1–256 UTF-8 bytes.");
        }
      }
    } else if (action !== "abort" && action !== "status") {
      throw new Error("Unsupported capture context action.");
    }
    if (Object.keys(value).some((key) => !fields.includes(key))) {
      throw new Error("Unsupported capture context field.");
    }
    return;
  }
  // File negotiation has its own packet family. Unsupported runtimes must fail
  // before arming instead of silently streaming a user-selected native capture.
  if (value.operation === "file-capabilities") {
    if (Object.keys(value).some((key) => !["operation", "scope"].includes(key))) {
      throw new Error("Unsupported native file capability field.");
    }
    if (value.scope !== undefined) {
      captureScope(value.scope);
    }
    return;
  }
  if (value.operation === "file-start") {
    if (
      Object.keys(value).some(
        (key) =>
          ![
            "operation",
            "scope",
            "bufferBytes",
            "file",
            "romContentSha256",
            "romFileSha256",
            "producer",
            "measureStages",
          ].includes(key),
      )
    ) {
      throw new Error("Unsupported native file start field.");
    }
    if (value.measureStages !== undefined && typeof value.measureStages !== "boolean") {
      throw new Error("Native file profiling must be boolean.");
    }
    validateCaptureRequest({
      operation: "start",
      bufferBytes: value.bufferBytes,
      scope: value.scope,
    });
    const producer = value.producer;
    if (
      !bounded(value.file, 4096) ||
      typeof value.file !== "string" ||
      !/^(?:\/|[a-z]:[/\\]|\\\\)/i.test(value.file) ||
      typeof value.romContentSha256 !== "string" ||
      !/^[\da-f]{64}$/.test(value.romContentSha256) ||
      (value.romFileSha256 !== undefined &&
        (typeof value.romFileSha256 !== "string" || !/^[\da-f]{64}$/.test(value.romFileSha256))) ||
      !isFieldRecord(producer) ||
      !bounded(producer.id, 256) ||
      !bounded(producer.revision, 1024) ||
      Object.keys(producer).some((key) => !["id", "revision"].includes(key))
    ) {
      throw new Error(
        "Native file capture requires an absolute bounded path and exact ROM/producer identity.",
      );
    }
    return;
  }
  let fields = ["operation", "session"];
  if (value.operation === "capabilities") {
    fields = ["operation", "scope"];
  }
  if (value.operation === "start") {
    fields = ["operation", "bufferBytes", "scope"];
  }
  if (value.operation === "read") {
    fields = ["operation", "session", "chunk"];
  }
  if (value.operation === "ack") {
    fields = ["operation", "session", "chunk", "event"];
  }
  if (Object.keys(value).some((key) => !fields.includes(key))) {
    throw new Error(
      "Unsupported capture negotiation field. Capture requires an explicit supported stream with durable ownership.",
    );
  }
  if (value.operation === "capabilities" || value.operation === "start") {
    if (value.scope !== undefined) {
      captureScope(value.scope);
    }
  }
  if (value.operation === "capabilities") {
    return;
  }
  if (value.operation === "start") {
    const bufferBytes = value.bufferBytes;
    if (
      typeof bufferBytes !== "number" ||
      !Number.isSafeInteger(bufferBytes) ||
      bufferBytes < 4718656 ||
      bufferBytes > 64 * 1024 * 1024
    ) {
      throw new Error("Capture buffer must be between 4718656 bytes and 64 MiB.");
    }
    return;
  }
  captureSession(value.session);
  if (
    value.operation === "status" ||
    value.operation === "stop" ||
    value.operation === "abort" ||
    value.operation === "release" ||
    value.operation === "file-status" ||
    value.operation === "file-stop" ||
    value.operation === "file-abort" ||
    value.operation === "file-release"
  ) {
    return;
  }
  if (value.operation === "read" || value.operation === "ack") {
    if (!captureU64(value.chunk)) {
      throw new Error("Capture chunk sequence starts at one.");
    }
    if (value.operation === "ack" && !captureU64(value.event)) {
      throw new Error("Capture event sequence starts at one.");
    }
    return;
  }
  throw new Error("Unsupported capture operation.");
}
/**
 * Require the requested scope and its reservation size. Never downgrade to a different stream.
 * @param value Native capability reply.
 * @param scope Requested stream, defaulting to instructions for older callers.
 * @returns Verified lossless ownership and allocation contract.
 */
export const validateCaptureCapabilities = (
  value: unknown,
  scope: CaptureScopeV2 = "snes.65816.instructions",
): CaptureCapabilitiesV2 => {
  captureScope(scope);
  let reserve: 71 | 64 | 80 | 88 | 91 | 128 = scope === "nes.2a03.instructions" ? 91 : 71;
  if (scope === "nes.cpu-bus-ppu") {
    reserve = 128;
  }
  if (scope === "snes.cpu-bus") {
    reserve = 64;
  }
  if (scope === "snes.cpu-bus-transfers") {
    reserve = 80;
  }
  if (scope === "snes.cpu-bus-ppu") {
    reserve = 88;
  }
  const expected = {
    version: 2,
    scope,
    mode: "lossless",
    ownership: "durable-prefix",
    maxChunkBytes: 262144,
    requiredReserveBytes: reserve,
    overheadBytes: 4194304,
    resumeSession: false,
  } as const;
  if (
    !isFieldRecord(value) ||
    Object.entries(expected).some(([key, item]) => value[key] !== item)
  ) {
    throw new Error("Unsupported capture scope, reserve, or ownership contract.");
  }
  if (value.nativeFile === true) {
    return { ...expected, nativeFile: true };
  }
  return expected;
};
/**
 * Scope is required and stable for the complete session.
 * @param value Native status or archive terminal frame.
 * @param session Expected identity when an active session is already known.
 * @param scope Expected stream. Every position must explicitly confirm its own scope.
 * @returns Validated ownership boundaries and integrity state.
 */
function assertCapturePosition(
  value: unknown,
  session?: string,
  scope?: CaptureScopeV2,
): asserts value is CapturePositionV2 {
  if (!isFieldRecord(value)) {
    throw new Error("Invalid capture position.");
  }
  captureSession(value.session);
  if (session !== undefined && value.session !== session) {
    throw new Error("Capture session changed.");
  }
  const positionScope = captureScope(value.scope);
  if (scope !== undefined && positionScope !== captureScope(scope)) {
    throw new Error("Capture scope changed or was not confirmed by the producer.");
  }
  const state = value.state;
  if (
    state !== "armed" &&
    state !== "recording" &&
    state !== "throttled" &&
    state !== "stopping" &&
    state !== "draining" &&
    state !== "complete" &&
    state !== "incomplete"
  ) {
    throw new Error("Invalid capture state.");
  }
  const bounds = [
    value.releasedThrough,
    value.durableThrough,
    value.acceptedThrough,
    value.deliveredThrough,
    value.producedThrough,
  ].map(captureU64);
  if (bounds.some((bound, index) => index > 0 && bound < bounds[index - 1])) {
    throw new Error("Capture ownership boundaries are inconsistent.");
  }
  if (captureU64(value.chunkThrough) > captureU64(value.producedChunks)) {
    throw new Error("Capture chunk boundary is inconsistent.");
  }
  captureU64(value.throttleCount);
  if (!captureU64(value.clockNumerator) || !captureU64(value.clockDenominator)) {
    throw new Error("Invalid capture clock domain.");
  }
  if (value.droppedInScope !== "0" || typeof value.error !== "string" || value.error.length > 256) {
    throw new Error("Capture integrity failed.");
  }
  const bufferedBytes = value.bufferedBytes;
  const allocatedBytes = value.allocatedBytes;
  if (
    typeof bufferedBytes !== "number" ||
    typeof allocatedBytes !== "number" ||
    !Number.isSafeInteger(bufferedBytes) ||
    !Number.isSafeInteger(allocatedBytes) ||
    bufferedBytes < 0 ||
    allocatedBytes < 0 ||
    bufferedBytes > 64 * 1024 * 1024 ||
    allocatedBytes > 64 * 1024 * 1024 ||
    bufferedBytes > allocatedBytes
  ) {
    throw new Error("Capture allocation exceeds its bounds.");
  }
  if (
    state === "complete" &&
    (value.error ||
      bufferedBytes ||
      new Set(bounds.map(String)).size !== 1 ||
      value.chunkThrough !== value.producedChunks)
  ) {
    throw new Error("Capture terminal totals do not reconcile.");
  }
}

/**
 * Validate a producer position and return it typed.
 * @param value Native status or archive terminal frame.
 * @param session Expected identity when an active session is already known.
 * @param scope Expected stream, when known.
 * @returns The same value after all boundary, clock and integrity checks.
 */
export const validateCapturePosition = (
  value: unknown,
  session?: string,
  scope?: CaptureScopeV2,
): CapturePositionV2 => {
  assertCapturePosition(value, session, scope);
  return value;
};

/**
 * Accept one wire result after the matching request validator has already run.
 * Capability replies are rebuilt from the negotiated contract; other results keep
 * their validated fields, including native file counters carried beside a position.
 * @param value Sidecar or backend capture reply.
 * @returns A capabilities, position, hex, or context-state result.
 */
export function validateCaptureResult(value: unknown): CaptureResultV2 {
  if (!isFieldRecord(value)) {
    throw new Error("Capture result must be an object.");
  }
  if (
    typeof value.hex === "string" &&
    value.version === undefined &&
    value.session === undefined &&
    value.contextState === undefined
  ) {
    return { hex: value.hex };
  }
  if (
    typeof value.contextState === "string" &&
    value.version === undefined &&
    value.session === undefined
  ) {
    return { contextState: value.contextState };
  }
  if (value.version === 2) {
    return validateCaptureCapabilities(value, captureScope(value.scope));
  }
  return validateCapturePosition(value);
}

/**
 * CRC-32C of an ACT2 envelope or archive JSON frame, without changing caller storage.
 * @param bytes Byte view; checksum positions are relative to this view.
 * @param zeroChecksum Treat ACT2 bytes 56–59 as zero. Defaults to false for JSON frames.
 * @returns Unsigned Castagnoli checksum.
 */
export const captureCrc32c = (bytes: Uint8Array, zeroChecksum = false): number =>
  crc32cBytes(bytes, zeroChecksum);

/** One executed CPU instruction from an instruction scope. */
export interface CaptureInstructionV2 {
  /** Global event sequence in the session, starting at one. */
  readonly sequence: CaptureU64;
  /** Instruction ordinal; equal to `sequence` in instruction scopes. */
  readonly ordinal: CaptureU64;
  /** Monotonic clock ticks in the archive's rational clock domain. */
  readonly cycle: CaptureU64;
  /** Starting PC: 24-bit PB:PC on SNES, 16-bit on NES. */
  readonly address: number;
  /** Fetched opcode/operand bytes and the pre-execution register/mapper state. */
  readonly detail: CaptureInstructionDetail;
  /** Validated profile identity, independent of debugger register presentation. */
  readonly target: CaptureTargetPayload;
}
/**
 * Actual PPU write decision, attached to the completing CPU-bus access.
 * Byte destinations are physical offsets. Duplicate offsets retain write order.
 * The two raster counters describe the PPU decision, which may differ from the CPU counter.
 */
export interface CapturePPUEffectV2 {
  /** Memory selected by the data port: $2118/$2119 VRAM, $2122 CGRAM, $2104 OAM. */
  readonly target: "vram" | "cgram" | "oam";
  /** `written` commits bytes, `blocked` is a VRAM write refused during rendering, `latched` buffers a CGRAM/OAM low byte. */
  readonly outcome: "written" | "blocked" | "latched";
  /** Forced blank was active at the decision. */
  readonly forcedBlank: boolean;
  /** Active rendering restricted access; mutually exclusive with `forcedBlank`. */
  readonly renderingRestricted: boolean;
  /** PPU core that made the decision. */
  readonly implementation: "accurate" | "performance";
  /** Physical VRAM size for VRAM effects; null for CGRAM and OAM. */
  readonly vramBytes: 65536 | 131072 | null;
  /** Committed physical bytes in write order: one for VRAM, two for CGRAM, one or two for OAM; empty unless written. */
  readonly bytes: readonly { readonly address: number; readonly value: number }[];
  /** PPU horizontal counter at the decision, 0..1367. */
  readonly hcounter: number;
  /** PPU scanline at the decision, 0..312. */
  readonly vcounter: number;
}
/** Actual CPU-bus operation, with exact counters and optional instruction ownership. */
export interface CaptureBusAccessV2 {
  /** Present only on data-port writes in the explicitly negotiated PPU scope. */
  readonly ppu?: CapturePPUEffectV2;
  /** Global event sequence in the session, starting at one. */
  readonly sequence: CaptureU64;
  /** Zero means no observed instruction owns the access. This is not an instruction event count. */
  readonly ordinal: CaptureU64;
  /** Monotonic SNES master-clock ticks in the archive's rational clock domain. */
  readonly cycle: CaptureU64;
  /** 24-bit CPU bus address. */
  readonly address: number;
  /** Owning instruction's starting PC, or the current PC when ordinal is zero. */
  readonly pc: number;
  /** Data byte read or written. */
  readonly value: number;
  /** Bus direction; HDMA table and indirect fetches are always reads. */
  readonly direction: "read" | "write";
  /** Bus master performing the access. */
  readonly actor: "cpu" | "dma" | "hdma";
  /** DMA/HDMA channel 0..7. CPU accesses have no channel. */
  readonly channel: number | null;
  /** Access purpose; determines `actor` (`cpu`, `dma`, or one of the HDMA phases). */
  readonly phase: "cpu" | "dma" | "hdma-table" | "hdma-indirect" | "hdma-transfer";
  /** CPU execution context, not a claim that an instruction caused asynchronous HDMA. */
  readonly context: "unattributed" | "instruction" | "interrupt" | "wait" | "stop";
  /** Horizontal counter in master clocks, 0..1367. */
  readonly hcounter: number;
  /** Zero-based scanline, 0..312 for the supported NTSC/PAL cores. */
  readonly vcounter: number;
}
/** Native DMA run / HDMA payload-burst boundary. End snapshots may lack an observed begin. */
export interface CaptureTransferV2 {
  /** Discriminates markers from bus accesses in mixed event streams. */
  readonly kind: "transfer";
  /** Global event sequence in the session, starting at one. */
  readonly sequence: CaptureU64;
  /** Owning instruction ordinal, or zero when no observed instruction owns the boundary. */
  readonly ordinal: CaptureU64;
  /** Monotonic SNES master-clock ticks in the archive's rational clock domain. */
  readonly cycle: CaptureU64;
  /** Begin event sequence in this session, or zero for an unobserved begin. */
  readonly transferId: CaptureU64;
  /** Owning instruction's starting PC, or the current PC when ordinal is zero. */
  readonly pc: number;
  /** Lifecycle point; HDMA bursts are never `interrupted`. */
  readonly boundary: "begin" | "complete" | "interrupted";
  /** Transfer engine. */
  readonly actor: "dma" | "hdma";
  /** DMA/HDMA channel 0..7. */
  readonly channel: number;
  /** CPU execution context at the boundary. */
  readonly context: CaptureBusAccessV2["context"];
  /** Horizontal counter in master clocks, 0..1367. */
  readonly hcounter: number;
  /** Zero-based scanline, 0..312. */
  readonly vcounter: number;
  /** Attempted byte slots, including hardware-suppressed accesses. Zero on begin markers. */
  readonly transferred: number;
  /**
   * Raw channel registers at this boundary: DMAP control, BBAD port offset, A1B:A1T source,
   * DAS size/indirect address, DASB indirect bank, A2A table address, and NTLR line counter.
   */
  readonly configuration: {
    /** DMAPn control byte ($43n0). */
    readonly dmap: number;
    /** BBADn B-bus port offset ($43n1). */
    readonly bbad: number;
    /** A1TnL/H 16-bit source address ($43n2–$43n3). */
    readonly a1t: number;
    /** A1Bn source bank ($43n4). */
    readonly a1b: number;
    /** DASnL/H 16-bit byte count or HDMA indirect address ($43n5–$43n6). */
    readonly das: number;
    /** DASBn HDMA indirect bank ($43n7). */
    readonly dasb: number;
    /** A2AnL/H 16-bit HDMA table address ($43n8–$43n9). */
    readonly a2a: number;
    /** NTRLn HDMA line counter ($43nA). */
    readonly ntlr: number;
    /** Bits: DMA enabled, HDMA enabled, HDMA completed, HDMA do-transfer. */
    readonly flags: number;
  };
}
/** Decoded NES CPU-bus chunk with interleaved PPU timeline events. */
export interface CaptureNesBusChunkV2 extends CaptureChunkBaseV2 {
  /** NES bus stream. */
  readonly scope: "nes.cpu-bus-ppu";
  /** Bus accesses and timeline events in sequence order. */
  readonly events: readonly (CaptureNesBusAccessV2 | CaptureNesTimelineV2)[];
}
/** Decoded SNES bus chunk that may interleave DMA/HDMA boundary markers. */
export interface CaptureTransferChunkV2 extends CaptureChunkBaseV2 {
  /** SNES bus scopes that permit transfer markers. */
  readonly scope: "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu";
  /** Accesses and markers in sequence order. */
  readonly events: readonly (CaptureBusAccessV2 | CaptureTransferV2)[];
}
/** Envelope identity shared by every decoded chunk. */
interface CaptureChunkBaseV2 {
  /** Owning session; envelope bytes 8–23 as hex. */
  readonly session: string;
  /** Chunk sequence in the session, starting at one. */
  readonly sequence: CaptureU64;
  /** Event sequence of the first record. */
  readonly first: CaptureU64;
  /** Event sequence of the last record, inclusive. */
  readonly through: CaptureU64;
}
/** Decoded instruction chunk. */
export interface CaptureInstructionChunkV2 extends CaptureChunkBaseV2 {
  /** CPU instruction stream. */
  readonly scope: "snes.65816.instructions" | "nes.2a03.instructions";
  /** Instructions in sequence order, at most 3854 per SNES chunk. */
  readonly instructions: readonly CaptureInstructionV2[];
}
/** Decoded SNES bus chunk without transfer markers. */
export interface CaptureBusChunkV2 extends CaptureChunkBaseV2 {
  /** Plain SNES bus stream. */
  readonly scope: "snes.cpu-bus";
  /** Accesses in sequence order. */
  readonly accesses: readonly CaptureBusAccessV2[];
}
/** Scope discrimination prevents bus-only evidence from entering the instruction importer. */
export type CaptureChunkV2 =
  | CaptureInstructionChunkV2
  | CaptureBusChunkV2
  | CaptureTransferChunkV2
  | CaptureNesBusChunkV2;

/**
 * Common ordering fields without converting bus accesses into instruction records.
 * @param chunk Validated nonempty chunk.
 * @returns Original ordered record array.
 */
export const captureChunkRecords = (
  chunk: CaptureChunkV2,
): readonly (
  | CaptureInstructionV2
  | CaptureBusAccessV2
  | CaptureTransferV2
  | CaptureNesBusAccessV2
  | CaptureNesTimelineV2
)[] => {
  if ("instructions" in chunk) {
    return chunk.instructions;
  }
  if (chunk.scope === "snes.cpu-bus") {
    return chunk.accesses;
  }
  return chunk.events;
};

/**
 * Validate the entire envelope and every record before accepting any event.
 * @param bytes Bounded encoded chunk.
 * @param session Negotiated session identity.
 * @param scope Negotiated stream. Omission preserves instruction-only callers.
 * @returns Fully validated ordered records in exactly the requested scope.
 */
export function decodeCaptureChunk(
  bytes: Uint8Array,
  session: string,
  scope?: "snes.65816.instructions" | "nes.2a03.instructions",
): CaptureInstructionChunkV2;
export function decodeCaptureChunk(
  bytes: Uint8Array,
  session: string,
  scope: "snes.cpu-bus",
): CaptureBusChunkV2;
export function decodeCaptureChunk(
  bytes: Uint8Array,
  session: string,
  scope: "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu",
): CaptureTransferChunkV2;
export function decodeCaptureChunk(
  bytes: Uint8Array,
  session: string,
  scope: "nes.cpu-bus-ppu",
): CaptureNesBusChunkV2;
export function decodeCaptureChunk(
  bytes: Uint8Array,
  session: string,
  scope: CaptureScopeV2,
): CaptureChunkV2;
export function decodeCaptureChunk(
  bytes: Uint8Array,
  session: string,
  scope: CaptureScopeV2 = "snes.65816.instructions",
): CaptureChunkV2 {
  captureSession(session);
  captureScope(scope);
  const b = decodeCaptureChunkBytes(bytes);
  if (b.toString("hex", 8, 24) !== session) {
    throw new Error("Capture chunk belongs to another session.");
  }
  const sequence = b.readBigUInt64LE(24),
    first = b.readBigUInt64LE(32),
    count = b.readUInt32LE(40);
  const through = first + BigInt(count) - 1n;
  const maxRecords = scope === "snes.65816.instructions" ? 3854 : 4095;
  if (!sequence || !first || !count || count > maxRecords || through > maxU64) {
    throw new Error("Invalid capture sequence range.");
  }
  const identity = {
    session,
    sequence: String(sequence),
    first: String(first),
    through: String(through),
  };
  if (scope === "snes.cpu-bus") {
    const accesses: CaptureBusAccessV2[] = [];
    for (const access of decodeBusAccesses(b, first, count)) {
      if ("kind" in access) {
        throw new Error("Bus capture chunk contains a transfer marker.");
      }
      accesses.push(access);
    }
    return {
      ...identity,
      scope,
      accesses,
    };
  }
  if (scope === "snes.cpu-bus-transfers" || scope === "snes.cpu-bus-ppu") {
    return {
      ...identity,
      scope,
      events: decodeBusAccesses(b, first, count, true, scope === "snes.cpu-bus-ppu"),
    };
  }
  if (scope === "nes.cpu-bus-ppu") {
    return { ...identity, scope, events: decodeNesBusRecords(b, first, count) };
  }
  const nes = scope === "nes.2a03.instructions";
  const instructions: CaptureInstructionV2[] = [];
  let offset = 64;
  for (let i = 0; i < count; i++) {
    if (offset + 68 > b.length) {
      throw new Error("Truncated capture record.");
    }
    const length = b.readUInt32LE(offset + 4),
      n = b[offset + 48];
    const event = first + BigInt(i),
      ordinal = b.readBigUInt64LE(offset + 32),
      address = b.readBigUInt64LE(offset + 40);
    if (
      b.readUInt16LE(offset) !== 1 ||
      b.readUInt16LE(offset + 2) !== 1 ||
      b.readUInt32LE(offset + 16) !== (nes ? 1 : 0) ||
      b.readUInt32LE(offset + 20) !== (nes ? 1 : 0)
    ) {
      throw new Error("Unsupported required capture record.");
    }
    if (
      n < 1 ||
      n > (nes ? 3 : 4) ||
      length !== (nes ? 88 : 67) + n ||
      offset + length > b.length ||
      b.readUInt16LE(offset + 49) !== (nes ? 37 : 16)
    ) {
      throw new Error("Invalid instruction record length.");
    }
    if (
      b.readBigUInt64LE(offset + 8) !== event ||
      ordinal !== event ||
      address > (nes ? 0xffffn : 0xffffffn)
    ) {
      throw new Error("Instruction identity disagrees with capture scope.");
    }
    const r = offset + 51 + n;
    let state: Record<string, number>;
    if (nes) {
      state = {
        a: b[r],
        x: b[r + 1],
        y: b[r + 2],
        s: b[r + 3],
        p: b[r + 4],
        pc: b.readUInt16LE(r + 5),
        mapper: b.readUInt16LE(r + 7),
        select: b[r + 9],
        prgMode: b[r + 10],
        chrMode: b[r + 11],
        ramEnabled: b[r + 20],
        ramWritable: b[r + 21],
        mirroring: b[r + 22],
        irqLatch: b[r + 23],
        irqEnabled: b[r + 24],
      };
      for (let bank = 0; bank < 8; bank++) {
        state[`r${bank}`] = b[r + 12 + bank];
      }
      for (let byte = 0; byte < n; byte++) {
        state[`prg${byte}`] = b.readUInt32LE(r + 25 + byte * 4);
      }
      if (
        state.pc !== Number(address) ||
        ![0, 4].includes(state.mapper) ||
        state.select > 7 ||
        state.prgMode > 1 ||
        state.chrMode > 1
      ) {
        throw new Error("Captured NES PC/mapper state is invalid.");
      }
    } else {
      state = {
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
      if (state.e > 1 || ((state.pb << 16) | state.pc) !== Number(address)) {
        throw new Error("Captured PC/state mismatch.");
      }
    }
    const cycle = b.readBigUInt64LE(offset + 24);
    if (i && cycle < BigInt(instructions[i - 1].cycle)) {
      throw new Error("Capture clock moved backwards.");
    }
    instructions.push({
      sequence: String(event),
      ordinal: String(ordinal),
      cycle: String(cycle),
      address: Number(address),
      detail: { bytes: [...b.subarray(offset + 51, r)], state },
      target: readCaptureTargetPayload(nes ? "nes.2a03" : "snes.65816", 1, state),
    });
    offset += length;
  }
  if (offset !== b.length) {
    throw new Error("Capture record count does not consume the payload exactly.");
  }
  return {
    ...identity,
    scope,
    instructions,
  };
}

/**
 * Decode 64-byte bus accesses and optional 80-byte boundaries after envelope, session and CRC validation.
 * @param b Complete validated envelope and payload.
 * @param first First event sequence declared in the envelope.
 * @param count Bounded, nonzero record count.
 * @param transfers Whether the negotiated scope also permits boundary markers.
 * @param ppu Require verified effects on every mapped graphics data-port write.
 * @returns Decoded accesses and markers. Invalid fields reject the whole chunk.
 */
const decodeBusAccesses = (
  b: Buffer,
  first: bigint,
  count: number,
  transfers = false,
  ppu = false,
): readonly (CaptureBusAccessV2 | CaptureTransferV2)[] => {
  if (!transfers && b.length !== 64 + count * 64) {
    throw new Error("Invalid bus record payload length.");
  }
  const accesses: (CaptureBusAccessV2 | CaptureTransferV2)[] = [];
  const actors = ["cpu", "dma", "hdma"] as const;
  const phases = ["cpu", "dma", "hdma-table", "hdma-indirect", "hdma-transfer"] as const;
  const contexts = ["unattributed", "instruction", "interrupt", "wait", "stop"] as const;
  let lastCycle = 0n;
  let offset = 64;
  for (let i = 0; i < count; i++) {
    if (offset + 64 > b.length) {
      throw new Error("Truncated bus/transfer record.");
    }
    if (transfers && b.readUInt16LE(offset) === 3) {
      const marker = decodeTransfer(b, offset, first + BigInt(i));
      if (BigInt(marker.cycle) < lastCycle) {
        throw new Error("Capture clock moved backwards.");
      }
      lastCycle = BigInt(marker.cycle);
      accesses.push(marker);
      offset += 80;
      continue;
    }
    const extended = ppu && b.readUInt16LE(offset + 2) === 2;
    const length = extended ? 88 : 64;
    if (
      b.readUInt16LE(offset) !== 2 ||
      b.readUInt16LE(offset + 2) !== (extended ? 2 : 1) ||
      b.readUInt32LE(offset + 4) !== length ||
      offset + length > b.length ||
      b.readUInt32LE(offset + 16) !== 0 ||
      b.readUInt32LE(offset + 20) !== 0 ||
      b.readUInt16LE(offset + 62) !== 0
    ) {
      throw new Error("Unsupported required bus capture record.");
    }
    const event = first + BigInt(i);
    const cycle = b.readBigUInt64LE(offset + 24);
    const ordinal = b.readBigUInt64LE(offset + 32);
    const address = b.readBigUInt64LE(offset + 40);
    const pc = b.readUInt32LE(offset + 48);
    const direction = b[offset + 53],
      actor = b[offset + 54],
      channel = b[offset + 55];
    const phase = b[offset + 56],
      context = b[offset + 57];
    const hcounter = b.readUInt16LE(offset + 58),
      vcounter = b.readUInt16LE(offset + 60);
    if (b.readBigUInt64LE(offset + 8) !== event || address > 0xffffffn || pc > 0xffffff) {
      throw new Error("Bus identity disagrees with capture scope.");
    }
    // Actor/phase/channel are redundant on the wire so corrupted attribution cannot
    // quietly turn a table read into payload, or attach a DMA channel to a CPU access.
    const expectedActor = phase === 0 ? 0 : 2;
    const phaseActor = phase === 1 ? 1 : expectedActor;
    if (
      direction > 1 ||
      phase >= phases.length ||
      actor !== phaseActor ||
      (actor === 0 ? channel !== 255 : channel > 7) ||
      ((phase === 2 || phase === 3) && direction !== 0) ||
      context >= contexts.length ||
      (ordinal !== 0n) !== (context === 1) ||
      hcounter >= 1368 ||
      vcounter >= 313
    ) {
      throw new Error("Invalid bus attribution or timing fields.");
    }
    if (cycle < lastCycle) {
      throw new Error("Capture clock moved backwards.");
    }
    lastCycle = cycle;
    const port = Number(address) & 0xffff;
    const dataPort =
      direction === 1 &&
      !(Number(address) & 0x400000) &&
      [0x2104, 0x2118, 0x2119, 0x2122].includes(port);
    if (ppu && extended !== dataPort) {
      throw new Error("Missing or misplaced PPU effect.");
    }
    accesses.push({
      ...(extended ? { ppu: decodePPUEffect(b, offset, port) } : {}),
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
      vcounter,
    });
    offset += length;
  }
  if (offset !== b.length) {
    throw new Error("Capture record count does not consume the payload exactly.");
  }
  return accesses;
};

/**
 * Decode a native boundary after envelope validation. Cross-record lifecycle validation belongs to analysis.
 * @param b Complete envelope and payload.
 * @param offset Start of the 80-byte marker.
 * @param event Expected global event sequence.
 * @returns Exact marker with raw channel configuration.
 */
const decodeTransfer = (b: Buffer, offset: number, event: bigint): CaptureTransferV2 => {
  if (
    offset + 80 > b.length ||
    b.readUInt16LE(offset + 2) !== 1 ||
    b.readUInt32LE(offset + 4) !== 80 ||
    b.readUInt32LE(offset + 16) !== 0 ||
    b.readUInt32LE(offset + 20) !== 0 ||
    b.readUInt32LE(offset + 76) !== 0
  ) {
    throw new Error("Unsupported transfer capture record.");
  }
  const sequence = b.readBigUInt64LE(offset + 8),
    ordinal = b.readBigUInt64LE(offset + 32),
    transferId = b.readBigUInt64LE(offset + 40),
    pc = b.readUInt32LE(offset + 48);
  const boundary = b[offset + 52],
    actor = b[offset + 53],
    channel = b[offset + 54],
    context = b[offset + 55];
  const hcounter = b.readUInt16LE(offset + 56),
    vcounter = b.readUInt16LE(offset + 58),
    transferred = b.readUInt32LE(offset + 72);
  const owned = ordinal !== 0n;
  if (
    sequence !== event ||
    pc > 0xffffff ||
    boundary > 2 ||
    (actor !== 1 && actor !== 2) ||
    channel > 7 ||
    context > 4 ||
    owned !== (context === 1) ||
    hcounter >= 1368 ||
    vcounter >= 313 ||
    b[offset + 71] > 15 ||
    (boundary === 0 && (transferId !== event || transferred !== 0)) ||
    (boundary !== 0 && (transferId >= event || transferred < 1 || transferred > 65536)) ||
    (actor === 2 && (boundary === 2 || transferred > 4))
  ) {
    throw new Error("Invalid transfer boundary identity, attribution or counters.");
  }
  return {
    kind: "transfer",
    sequence: String(sequence),
    ordinal: String(ordinal),
    cycle: String(b.readBigUInt64LE(offset + 24)),
    transferId: String(transferId),
    pc,
    boundary: (["begin", "complete", "interrupted"] as const)[boundary],
    actor: actor === 1 ? "dma" : "hdma",
    channel,
    context: (["unattributed", "instruction", "interrupt", "wait", "stop"] as const)[context],
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
      flags: b[offset + 71],
    },
  };
};

/**
 * Decode the fixed 24-byte effect extension. Malformed results reject the whole chunk.
 * @param b Fully bounded record bytes.
 * @param offset Beginning of the 88-byte bus record.
 * @param port Mapped graphics data port, already checked against direction and bank.
 * @returns Native decision and ordered physical byte writes.
 */
const decodePPUEffect = (b: Buffer, offset: number, port: number): CapturePPUEffectV2 => {
  const target = b[offset + 64],
    outcome = b[offset + 65],
    count = b[offset + 66],
    flags = b[offset + 67];
  const hcounter = b.readUInt16LE(offset + 68),
    vcounter = b.readUInt16LE(offset + 70);
  let expectedTarget = 1;
  if (port === 0x2122) {
    expectedTarget = 2;
  }
  if (port === 0x2104) {
    expectedTarget = 3;
  }
  if (
    target !== expectedTarget ||
    outcome > 2 ||
    count > 2 ||
    flags > 15 ||
    (flags & 3) === 3 ||
    (target !== 1 && flags & 8) ||
    hcounter >= 1368 ||
    vcounter >= 313 ||
    b.readUInt32LE(offset + 82) !== 0 ||
    b.readUInt16LE(offset + 86) !== 0
  ) {
    throw new Error("Invalid PPU effect identity, flags or raster.");
  }
  if (
    (outcome === 0 &&
      (count === 0 || (target === 1 && count !== 1) || (target === 2 && count !== 2))) ||
    (outcome !== 0 && count !== 0) ||
    (outcome === 1 && (target !== 1 || !(flags & 2))) ||
    (outcome === 2 && (target === 1 || flags & 2))
  ) {
    throw new Error("Invalid PPU effect outcome or byte count.");
  }
  const bytes: { address: number; value: number }[] = [];
  const vramBytes = flags & 8 ? 131072 : 65536;
  for (let i = 0; i < 2; i++) {
    const address = b.readUInt32LE(offset + 72 + i * 4),
      value = b[offset + 80 + i];
    if (i >= count) {
      if (address || value) {
        throw new Error("Nonzero unused PPU effect slot.");
      }
      continue;
    }
    let bound = vramBytes;
    if (target === 2) {
      bound = 512;
    }
    if (target === 3) {
      bound = 544;
    }
    if (
      address >= bound ||
      (target === 1 && ((address & 1) !== (port & 1) || value !== b[offset + 52])) ||
      (target === 2 &&
        (i === 0
          ? (address & 1) !== 0
          : address !== bytes[0].address + 1 || value !== (b[offset + 52] & 127))) ||
      (target === 3 && i === count - 1 && value !== b[offset + 52])
    ) {
      throw new Error("Invalid PPU physical byte address or value.");
    }
    bytes.push({ address, value });
  }
  return {
    target: (["vram", "cgram", "oam"] as const)[target - 1],
    outcome: (["written", "blocked", "latched"] as const)[outcome],
    forcedBlank: Boolean(flags & 1),
    renderingRestricted: Boolean(flags & 2),
    implementation: flags & 4 ? "accurate" : "performance",
    vramBytes: target === 1 ? vramBytes : null,
    bytes,
    hcounter,
    vcounter,
  };
};
