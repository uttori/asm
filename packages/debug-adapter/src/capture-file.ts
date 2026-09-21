import { open, link, unlink, lstat, type FileHandle } from "node:fs/promises";
import { setImmediate as yieldToMessages } from "node:timers/promises";

import { CaptureContextRecorder, type CaptureContextOptions } from "./capture-context.js";
import { CaptureFrameReader } from "./capture-file-reader.js";
import {
  captureCrc32c,
  captureU64,
  captureSession,
  captureScope,
  captureChunkRecords,
  decodeCaptureChunk,
  validateCaptureCapabilities,
  validateCapturePosition,
  type CaptureChunkV2,
  type CapturePositionV2,
  type CaptureTransportV2,
  type CaptureScopeV2,
} from "./capture-v2.js";

/** Immutable ROM and producer identity shared by an archive and its optional JSON export. */
export interface CaptureFileMetadata {
  readonly architecture: string;
  readonly addressSpace: string;
  readonly romContentSha256: string;
  readonly producer: { readonly id: string; readonly revision: string };
}
export interface CaptureFileHeader extends CaptureFileMetadata {
  readonly format: "uttori-ares-capture";
  readonly version: 2;
  readonly session: string;
  readonly scope: CaptureScopeV2;
  readonly ownership: "durable-prefix";
  readonly compression: "none";
  readonly checksum: "crc32c";
  readonly maxChunkBytes: 262144;
  readonly allocatedBytes: number;
  readonly clock: {
    readonly id: "snes.master";
    readonly numerator: string;
    readonly denominator: string;
  };
}
/** Sequential recorder stages, measured only when explicitly requested. Transport
 * spans include request queueing, native servicing, RSP and sidecar/DAP forwarding.
 */
export type CaptureFileTimingStage =
  | "read"
  | "decode"
  | "dataWrite"
  | "dataSync"
  | "checkpointWrite"
  | "checkpointSync"
  | "ack"
  | "status"
  | "idle"
  | "finalize";
export interface CaptureFileTimings {
  readonly elapsedMs: number;
  readonly bytes: number;
  readonly stages: Readonly<
    Record<
      CaptureFileTimingStage,
      { readonly calls: number; readonly totalMs: number; readonly maxMs: number }
    >
  >;
}
export interface CaptureFileSummary {
  /** Diagnostic wall-clock spans. Excluded from archive identity and durable accounting. */
  readonly timings?: CaptureFileTimings;
  /** Selected output: ACT2 directly, or legacy JSON when explicitly requested. */
  readonly file: string;
  readonly archive: string;
  /** Sibling directory with a verified context manifest, when context is enabled. */
  readonly contextDirectory?: string;
  readonly scope: CaptureScopeV2;
  readonly observedEvents: number;
  readonly droppedEvents: 0;
  readonly chunks: number;
  readonly complete: boolean;
  readonly position: CapturePositionV2;
}

const pause = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));
const metadataValid = (m: CaptureFileMetadata): void => {
  if (
    m.architecture !== "snes.65816" ||
    m.addressSpace !== "snes.cpu" ||
    !/^[\da-f]{64}$/.test(m.romContentSha256) ||
    !m.producer?.id ||
    !m.producer.revision
  ) {
    throw new Error("Capture requires 65816 CPU scope and exact ROM/producer identity.");
  }
};
const jsonFrame = (magic: string, value: unknown): Buffer => {
  const body = Buffer.from(JSON.stringify(value));
  if (body.length > 65536) {
    throw new Error("Capture metadata exceeds its bound.");
  }
  const header = Buffer.alloc(12);
  header.write(magic, "ascii");
  header.writeUInt32LE(body.length, 4);
  header.writeUInt32LE(captureCrc32c(body), 8);
  return Buffer.concat([header, body]);
};

/** One bounded chunk at a time. Acceptance follows data sync AND checkpoint sync. */
export class LosslessCaptureFileRecorder {
  readonly completion: Promise<CaptureFileSummary>;
  readonly #file: string;
  readonly #partial: string;
  readonly #archive: string;
  readonly #format: "json" | "act2";
  readonly #scope: CaptureScopeV2;
  readonly #transport: CaptureTransportV2;
  readonly #context?: CaptureContextRecorder;
  readonly #handle: FileHandle;
  #position: CapturePositionV2;
  #stopRequested = false;
  #cancelled = false;
  #through = 0n;
  #chunk = 0n;
  #cycle = 0n;
  readonly #timings?: {
    started: number;
    bytes: number;
    stages: Record<CaptureFileTimingStage, { calls: number; totalMs: number; maxMs: number }>;
  };

  private constructor(
    file: string,
    handle: FileHandle,
    transport: CaptureTransportV2,
    position: CapturePositionV2,
    format: "json" | "act2",
    scope: CaptureScopeV2,
    measureStages: boolean,
    context?: CaptureContextRecorder,
  ) {
    this.#file = file;
    this.#context = context;
    this.#format = format;
    this.#scope = scope;
    this.#archive = format === "act2" ? file : `${file}.act2`;
    this.#partial = `${this.#archive}.partial`;
    this.#handle = handle;
    // A stop may arrive while a pull/ack is in flight. The transport may allow
    // only one outstanding request (RSP), so serialize the recorder's calls.
    let tail = Promise.resolve();
    this.#transport = (request) => {
      const operation = tail.then(() => transport(request));
      tail = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    };
    this.#position = position;
    if (measureStages) {
      const stage = () => ({ calls: 0, totalMs: 0, maxMs: 0 });
      this.#timings = {
        started: performance.now(),
        bytes: 0,
        stages: {
          read: stage(),
          decode: stage(),
          dataWrite: stage(),
          dataSync: stage(),
          checkpointWrite: stage(),
          checkpointSync: stage(),
          ack: stage(),
          status: stage(),
          idle: stage(),
          finalize: stage(),
        },
      };
    }
    this.completion = this.#pump();
  }

  /**
   * Reserve a new output and start lossless recording. ACT2 output publishes only the archive.
   * Legacy JSON output additionally exports a compatible trace after draining the producer.
   * @param {object} options Output format, identity and serialized producer transport.
   * @returns {Promise<LosslessCaptureFileRecorder>} Active recorder. Stop() drains and syncs it.
   */
  static async create(
    options: CaptureFileMetadata &
      CaptureContextOptions & {
        readonly file: string;
        readonly transport: CaptureTransportV2;
        readonly bufferBytes?: number;
        /** Opt-in stage profiling. No clock reads or diagnostic allocations when omitted. */
        readonly measureStages?: boolean;
        /** Defaults to instructions. CPU/DMA/HDMA bus capture requires ACT2 output. */
        readonly scope?: CaptureScopeV2;
        /** Defaults to legacy JSON plus ACT2. Act2 skips all post-capture JSON conversion. */
        readonly format?: "json" | "act2";
      },
  ): Promise<LosslessCaptureFileRecorder> {
    metadataValid(options);
    const scope = captureScope(options.scope ?? "snes.65816.instructions");
    const format = options.format ?? "json";
    if (format !== "json" && format !== "act2") {
      throw new Error("Unsupported capture output format.");
    }
    // Reject before reserving files or arming the producer: legacy instruction JSON
    // cannot represent bus-only records without discarding their evidence.
    if (scope !== "snes.65816.instructions" && format !== "act2") {
      throw new Error("Bus capture requires ACT2 output. Instruction JSON cannot represent it.");
    }
    validateCaptureCapabilities(
      await options.transport({ operation: "capabilities", scope }),
      scope,
    );
    const archive = format === "act2" ? options.file : `${options.file}.act2`;
    const context =
      options.context === false
        ? undefined
        : new CaptureContextRecorder(archive, options, options.transport);
    const transport = context?.transport ?? options.transport;
    if (format === "json") {
      // Legacy callers own a reserved JSON destination. ACT2 callers reserve only the partial
      // archive. The final no-clobber link also guards against another writer publishing first.
      const destination = await open(options.file, "wx");
      await destination.close();
    } else {
      const existing = await lstat(archive).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
        return undefined;
      });
      if (existing) {
        throw new Error("Capture destination already exists.");
      }
    }
    let handle: FileHandle | undefined;
    let position: CapturePositionV2 | undefined;
    try {
      handle = await open(`${archive}.partial`, "wx");
      position = validateCapturePosition(
        await transport({
          operation: "start",
          bufferBytes: options.bufferBytes ?? 8 * 1024 * 1024,
          scope,
        }),
      );
      // Retain a valid session identity first so a scope mismatch still aborts
      // an armed producer instead of abandoning a queue that can stall emulation.
      validateCapturePosition(position, undefined, scope);
      if (
        position.producedThrough !== "0" ||
        position.chunkThrough !== "0" ||
        position.state !== "armed"
      ) {
        throw new Error("Capture did not start at an empty armed boundary.");
      }
      const header: CaptureFileHeader = {
        format: "uttori-ares-capture",
        version: 2,
        session: position.session,
        scope,
        ownership: "durable-prefix",
        compression: "none",
        checksum: "crc32c",
        maxChunkBytes: 262144,
        allocatedBytes: position.allocatedBytes,
        clock: {
          id: "snes.master",
          numerator: position.clockNumerator,
          denominator: position.clockDenominator,
        },
        architecture: options.architecture,
        addressSpace: options.addressSpace,
        romContentSha256: options.romContentSha256,
        producer: options.producer,
      };
      await handle.writeFile(jsonFrame("ACS2", header));
      await handle.sync();
      return new LosslessCaptureFileRecorder(
        options.file,
        handle,
        transport,
        position,
        format,
        scope,
        options.measureStages === true,
        context,
      );
    } catch (error) {
      if (position) {
        await transport({ operation: "abort", session: position.session }).catch(() => undefined);
      }
      await handle?.close().catch(() => undefined);
      if (format === "json") {
        await unlink(options.file).catch(() => undefined);
      }
      throw error;
    }
  }

  /** Current producer session, for a paused user milestone.
   * @returns {CapturePositionV2} Latest verified position; querying does not drain the archive.
   */
  get position(): CapturePositionV2 {
    return this.#position;
  }

  async stop(): Promise<CaptureFileSummary> {
    if (!this.#stopRequested) {
      this.#stopRequested = true;
      try {
        validateCapturePosition(
          await this.#transport({ operation: "stop", session: this.#position.session }),
          this.#position.session,
          this.#scope,
        );
      } catch (error) {
        this.#cancelled = true;
        await this.completion.catch(() => undefined);
        throw error;
      }
    }
    return this.completion;
  }
  finishIncomplete(): Promise<CaptureFileSummary> {
    this.#cancelled = true;
    return this.completion;
  }

  /** Account one completed stage without retaining per-chunk samples.
   * @param {CaptureFileTimingStage} stage Work completed since the previous boundary.
   * @param {number} start Monotonic start in milliseconds, or zero with profiling disabled.
   * @returns {number} Next boundary. Disabled profiling never reads the clock.
   */
  #mark(stage: CaptureFileTimingStage, start: number): number {
    if (!this.#timings) {
      return 0;
    }
    const now = performance.now(),
      elapsed = now - start,
      entry = this.#timings.stages[stage];
    entry.calls++;
    entry.totalMs += elapsed;
    entry.maxMs = Math.max(entry.maxMs, elapsed);
    return now;
  }

  async #pump(): Promise<CaptureFileSummary> {
    const session = this.#position.session;
    try {
      while (!this.#cancelled) {
        let boundary = this.#timings ? performance.now() : 0;
        const result = await this.#transport({
          operation: "read",
          session,
          chunk: String(this.#chunk + 1n),
        });
        boundary = this.#mark("read", boundary);
        if (
          !("hex" in result) ||
          typeof result.hex !== "string" ||
          result.hex.length > 524288 ||
          result.hex.length % 2 ||
          !/^[\da-f]*$/.test(result.hex)
        ) {
          throw new Error("Invalid capture read response.");
        }
        if (result.hex) {
          const bytes = Buffer.from(result.hex, "hex"),
            chunk = decodeCaptureChunk(bytes, session, this.#scope);
          const records = captureChunkRecords(chunk);
          if (
            BigInt(chunk.sequence) !== this.#chunk + 1n ||
            BigInt(chunk.first) !== this.#through + 1n ||
            BigInt(records[0].cycle) < this.#cycle
          ) {
            throw new Error("Capture chunk is not contiguous.");
          }
          boundary = this.#mark("decode", boundary);
          if (this.#timings) {
            this.#timings.bytes += bytes.length;
          }
          await this.#handle.writeFile(bytes);
          boundary = this.#mark("dataWrite", boundary);
          await this.#handle.sync();
          boundary = this.#mark("dataSync", boundary);
          await this.#handle.writeFile(
            jsonFrame("ACK2", {
              session,
              chunkThrough: chunk.sequence,
              eventThrough: chunk.through,
            }),
          );
          boundary = this.#mark("checkpointWrite", boundary);
          await this.#handle.sync();
          boundary = this.#mark("checkpointSync", boundary);
          // Producer retention is released only after the checkpoint is synced.
          const p = validateCapturePosition(
            await this.#transport({
              operation: "ack",
              session,
              chunk: chunk.sequence,
              event: chunk.through,
            }),
            session,
            this.#scope,
          );
          this.#mark("ack", boundary);
          if (p.durableThrough !== chunk.through || p.chunkThrough !== chunk.sequence) {
            throw new Error("Producer acknowledgement did not match the durable checkpoint.");
          }
          this.#position = p;
          this.#chunk = BigInt(chunk.sequence);
          this.#through = BigInt(chunk.through);
          this.#cycle = BigInt(records.at(-1)!.cycle);
        } else {
          boundary = this.#mark("decode", boundary);
          this.#position = validateCapturePosition(
            await this.#transport({ operation: "status", session }),
            session,
            this.#scope,
          );
          boundary = this.#mark("status", boundary);
          if (this.#position.state === "incomplete") {
            throw new Error(`Native capture incomplete: ${this.#position.error}`);
          }
          if (this.#position.state === "complete") {
            break;
          }
          await pause();
          this.#mark("idle", boundary);
        }
      }
      if (this.#cancelled) {
        throw new Error(
          "Capture session ended before finalization. The partial archive retains its committed prefix.",
        );
      }
      const p = this.#position;
      if (
        !this.#stopRequested ||
        p.state !== "complete" ||
        p.producedThrough !== String(this.#through) ||
        p.producedChunks !== String(this.#chunk)
      ) {
        throw new Error("Capture terminal accounting did not reconcile.");
      }
      const finalStart = this.#timings ? performance.now() : 0;
      await this.#handle.writeFile(jsonFrame("END2", p));
      await this.#handle.sync();
      await this.#handle.close();
      // A no-clobber link publishes the fully synced inode. Power-loss durability
      // of directory entries is deliberately not claimed by this prototype.
      const archive = this.#archive;
      await link(this.#partial, archive);
      await unlink(this.#partial);
      if (this.#format === "json") {
        await exportCaptureJson(archive, this.#file, true);
      }
      this.#mark("finalize", finalStart);
      const summary: CaptureFileSummary = {
        ...(this.#timings
          ? {
              timings: {
                elapsedMs: performance.now() - this.#timings.started,
                bytes: this.#timings.bytes,
                stages: this.#timings.stages,
              },
            }
          : {}),
        file: this.#file,
        archive,
        scope: this.#scope,
        observedEvents: Number(this.#through),
        droppedEvents: 0,
        chunks: Number(this.#chunk),
        complete: true,
        position: p,
        ...(this.#context ? { contextDirectory: this.#context.directory } : {}),
      };
      await this.#context?.finish(summary);
      return summary;
    } catch (error) {
      await this.#transport({ operation: "abort", session }).catch(() => undefined);
      await this.#handle.close().catch(() => undefined);
      throw error;
    }
  }
}

export interface CaptureRecovery {
  readonly header: CaptureFileHeader;
  readonly complete: boolean;
  readonly chunkThrough: string;
  readonly eventThrough: string;
  readonly reason?: string;
}

/** Input byte budget and cooperative cancellation apply to both header reads and archive scans. */
export interface CaptureFileReadOptions {
  readonly maxBytes?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (readBytes: number, totalBytes: number) => void;
  /** Opt-in chunk/frame timings in milliseconds. No clock reads when omitted. */
  readonly onTiming?: (stage: "read" | "decode" | "consume", milliseconds: number) => void;
}

/**
 * Reject oversized input before reading. Recovery tools remain unlimited unless given a budget.
 * @param {number} size File size or proposed read end, in bytes.
 * @param {CaptureFileReadOptions} options Optional positive safe-integer byte limit.
 */
const checkCaptureSize = (size: number, options: CaptureFileReadOptions): void => {
  const limit = options.maxBytes ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("Capture maximum bytes must be a positive safe integer.");
  }
  if (size > limit) {
    throw new Error(
      "Capture exceeds the import byte limit. Increase asm.trace.maxImportSizeMiB to import it.",
    );
  }
};

/**
 * Validate the bounded header before choosing a consumer or accepting any scoped chunks.
 * @param {unknown} value Decoded, checksummed JSON header.
 * @returns {CaptureFileHeader} Supported archive identity and ownership contract.
 */
const validateCaptureFileHeader = (value: unknown): CaptureFileHeader => {
  if (!value || typeof value !== "object") {
    throw new Error("Missing capture session header.");
  }
  const header = value as CaptureFileHeader;
  metadataValid(header);
  captureSession(header.session);
  captureScope(header.scope);
  if (
    header.clock?.id !== "snes.master" ||
    !captureU64(header.clock.numerator) ||
    !captureU64(header.clock.denominator)
  ) {
    throw new Error("Invalid session clock domain.");
  }
  if (
    header.format !== "uttori-ares-capture" ||
    header.version !== 2 ||
    header.ownership !== "durable-prefix" ||
    header.compression !== "none" ||
    header.checksum !== "crc32c" ||
    header.maxChunkBytes !== 262144 ||
    !Number.isSafeInteger(header.allocatedBytes) ||
    header.allocatedBytes < 4718656 ||
    header.allocatedBytes > 64 * 1024 * 1024
  ) {
    throw new Error("Unsupported capture session contract.");
  }
  return header;
};

/**
 * Read exactly one bounded frame component. Short reads must never become zero-filled valid data.
 * @param {FileHandle} handle Caller-owned open archive handle.
 * @param {number} length Validated frame component length, in bytes.
 * @param {number} offset Absolute file byte offset.
 * @returns {Promise<Buffer>} Fully initialized bytes. Premature EOF rejects the read.
 */
const readCaptureBytes = async (
  handle: FileHandle,
  length: number,
  offset: number,
): Promise<Buffer> => {
  const bytes = Buffer.allocUnsafe(length);
  let got = 0;
  while (got < length) {
    const result = await handle.read(bytes, got, length - got, offset + got);
    if (!result.bytesRead) {
      throw new Error("Torn capture frame.");
    }
    got += result.bytesRead;
  }
  return bytes;
};

/**
 * Read only the checksummed session header, without scanning the archive's event chunks.
 * @param {string} file ACT2 archive path.
 * @param {CaptureFileReadOptions} options Byte budget and cancellation.
 * @returns {Promise<CaptureFileHeader>} Validated identity. Completion is checked during consumption.
 */
export const readCaptureFileHeader = async (
  file: string,
  options: CaptureFileReadOptions = {},
): Promise<CaptureFileHeader> => {
  options.signal?.throwIfAborted();
  const handle = await open(file, "r");
  try {
    checkCaptureSize((await handle.stat()).size, options);
    const prefix = await readCaptureBytes(handle, 12, 0);
    if (prefix.toString("ascii", 0, 4) !== "ACS2") {
      throw new Error("Missing capture session header.");
    }
    const length = prefix.readUInt32LE(4);
    if (length > 65536) {
      throw new Error("Capture metadata length exceeds bounds.");
    }
    const body = await readCaptureBytes(handle, length, 12);
    if (captureCrc32c(body) !== prefix.readUInt32LE(8)) {
      throw new Error("Capture metadata checksum mismatch.");
    }
    options.signal?.throwIfAborted();
    return validateCaptureFileHeader(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)),
    );
  } finally {
    await handle.close();
  }
};

/**
 * Scan bounded frames, delivering only chunks backed by validated checkpoints.
 * @param {string} file Archive or partial artifact.
 * @param {Function} accept Optional committed-chunk consumer.
 * @param {CaptureFileReadOptions} options Scan budget, cancellation and progress. Consumer failures propagate.
 * @returns {Promise<CaptureRecovery>} Validated prefix and terminal integrity.
 */
export const recoverCaptureFile = async (
  file: string,
  accept?: (chunk: CaptureChunkV2) => void | Promise<void>,
  options: CaptureFileReadOptions = {},
): Promise<CaptureRecovery> => {
  options.signal?.throwIfAborted();
  const handle = await open(file, "r");
  let before: Awaited<ReturnType<FileHandle["stat"]>>;
  try {
    before = await handle.stat();
    checkCaptureSize(before.size, options);
  } catch (error) {
    await handle.close();
    throw error;
  }
  let offset = 0;
  // Coalesce sequential component reads within the initial snapshot. A growing
  // file cannot extend this offline scan. Final metadata checks still detect changes.
  const reader = new CaptureFrameReader((buffer, start, length, position) => {
    options.signal?.throwIfAborted();
    return handle.read(buffer, start, length, position);
  });
  const read = async (length: number): Promise<Buffer> => {
    options.signal?.throwIfAborted();
    checkCaptureSize(offset + length, options);
    const started = options.onTiming ? performance.now() : 0;
    const b = await reader.read(length, offset, before.size);
    options.onTiming?.("read", performance.now() - started);
    offset += length;
    return b;
  };
  const json = async (prefix: Buffer): Promise<unknown> => {
    const length = prefix.readUInt32LE(4);
    if (length > 65536) {
      throw new Error("Capture metadata length exceeds bounds.");
    }
    const body = await read(length);
    if (captureCrc32c(body) !== prefix.readUInt32LE(8)) {
      throw new Error("Capture metadata checksum mismatch.");
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  };
  let header: CaptureFileHeader;
  try {
    const prefix = await read(12);
    if (prefix.toString("ascii", 0, 4) !== "ACS2") {
      throw new Error("Missing capture session header.");
    }
    header = validateCaptureFileHeader(await json(prefix));
  } catch (error) {
    await handle.close();
    throw error;
  }
  let chunkThrough = 0n,
    eventThrough = 0n,
    lastCycle = 0n;
  let pending: CaptureChunkV2 | undefined;
  let consumerFailed = false;
  try {
    while (true) {
      const prefix = await read(12),
        magic = prefix.toString("ascii", 0, 4);
      if (magic === "ACT2") {
        if (pending) {
          throw new Error("Uncommitted capture chunk before another chunk.");
        }
        const envelope = Buffer.concat([prefix, await read(52)]);
        const length = envelope.readUInt32LE(48);
        if (length > 262144 - 64) {
          throw new Error("Capture chunk exceeds negotiated bound.");
        }
        const bytes = Buffer.concat([envelope, await read(length)]);
        const started = options.onTiming ? performance.now() : 0;
        pending = decodeCaptureChunk(bytes, header.session, header.scope);
        options.onTiming?.("decode", performance.now() - started);
        if (
          BigInt(pending.sequence) !== chunkThrough + 1n ||
          BigInt(pending.first) !== eventThrough + 1n ||
          BigInt(captureChunkRecords(pending)[0].cycle) < lastCycle
        ) {
          throw new Error("Noncontiguous capture history.");
        }
      } else if (magic === "ACK2") {
        const checkpoint = (await json(prefix)) as Record<string, unknown>;
        if (
          !pending ||
          checkpoint.session !== header.session ||
          checkpoint.chunkThrough !== pending.sequence ||
          checkpoint.eventThrough !== pending.through
        ) {
          throw new Error("Checkpoint does not match the pending chunk.");
        }
        if (accept) {
          try {
            const started = options.onTiming ? performance.now() : 0;
            await accept(pending);
            options.onTiming?.("consume", performance.now() - started);
          } catch (error) {
            // A consumer may reject an import budget, stale project or cancellation. These
            // failures belong to the caller, not to archive recovery, and must keep their type.
            consumerFailed = true;
            throw error;
          }
        }
        chunkThrough = BigInt(pending.sequence);
        eventThrough = BigInt(pending.through);
        lastCycle = BigInt(captureChunkRecords(pending).at(-1)!.cycle);
        pending = undefined;
        options.onProgress?.(offset, before.size);
        // Read-ahead removes the I/O waits between many checkpoints. Retain a
        // full turn for cancellation and async cleanup. Promise.resolve() would
        // only enqueue another microtask. Omitting this yield raised cancellation
        // latency and peak RSS in dense runs, despite faster small-chunk recovery.
        await yieldToMessages(undefined, { signal: options.signal });
      } else if (magic === "END2") {
        const terminal = validateCapturePosition(await json(prefix), header.session, header.scope);
        if (
          pending ||
          terminal.state !== "complete" ||
          captureU64(terminal.producedThrough) !== eventThrough ||
          captureU64(terminal.producedChunks) !== chunkThrough
        ) {
          throw new Error("Terminal capture totals disagree with the committed prefix.");
        }
        const after = await handle.stat();
        if (after.size !== offset) {
          throw new Error("Unexpected bytes after capture terminal.");
        }
        if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
          throw new Error("Capture archive changed while being read.");
        }
        options.onProgress?.(offset, before.size);
        options.signal?.throwIfAborted();
        return {
          header,
          complete: true,
          chunkThrough: String(chunkThrough),
          eventThrough: String(eventThrough),
        };
      } else {
        throw new Error("Unknown required capture frame.");
      }
    }
  } catch (error) {
    options.signal?.throwIfAborted();
    if (consumerFailed) {
      throw error;
    }
    return {
      header,
      complete: false,
      chunkThrough: String(chunkThrough),
      eventThrough: String(eventThrough),
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await handle.close();
  }
};

/**
 * Stream a verified complete archive into the existing instruction importer format.
 * @param {string} archive Complete ACT2 artifact.
 * @param {string} destination New JSON artifact.
 * @param {boolean} reserved Whether the recorder already reserved an empty destination.
 * @returns {Promise<void>} Settlement after the export is synced and closed.
 */
export const exportCaptureJson = async (
  archive: string,
  destination: string,
  reserved = false,
): Promise<void> => {
  // Validate before creating a complete-looking legacy artifact. Recovery callers
  // inspect the committed prefix separately. Incomplete archives cannot be promoted.
  const verified = await recoverCaptureFile(archive);
  if (!verified.complete) {
    throw new Error(`Capture archive is incomplete: ${verified.reason}`);
  }
  if (verified.header.scope !== "snes.65816.instructions") {
    throw new Error(
      "Bus capture cannot be exported as an instruction trace. Retain the ACT2 archive.",
    );
  }
  if (BigInt(verified.eventThrough) >= BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(
      "Legacy JSON sequence numbers cannot represent this capture. Retain the exact ACT2 archive.",
    );
  }
  const h = await open(destination, reserved ? "r+" : "wx");
  try {
    if (reserved && (await h.stat()).size !== 0) {
      throw new Error("Reserved trace destination changed during capture.");
    }
    const m = verified.header;
    await h.writeFile(
      JSON.stringify({
        format: "uttori-asm-instruction-trace",
        schemaVersion: 1,
        architecture: m.architecture,
        addressSpace: m.addressSpace,
        romContentSha256: m.romContentSha256,
        producer: m.producer,
      }).slice(0, -1) + ',"chunks":[',
    );
    let first = true;
    const result = await recoverCaptureFile(archive, async (chunk) => {
      // A replaced archive must not change scope between the verification and export scans.
      if (chunk.scope !== "snes.65816.instructions") {
        throw new Error("Capture scope changed during instruction export.");
      }
      await h.writeFile(
        (first ? "" : ",") +
          JSON.stringify({
            sequenceStart: Number(chunk.first),
            addresses: chunk.instructions.map((i) => i.address),
            details: chunk.instructions.map((i) => i.detail),
            droppedEvents: 0,
            active: false,
          }),
      );
      first = false;
    });
    if (!result.complete || result.eventThrough !== verified.eventThrough) {
      throw new Error("Capture archive changed during export.");
    }
    await h.writeFile("]}\n");
    await h.sync();
  } finally {
    await h.close();
  }
};

/** Native writer state is separate from producer drain: publication can still fail
 * after the queue is empty. Counters describe synced file bytes/batches only.
 */
export interface NativeCaptureFilePosition extends CapturePositionV2 {
  readonly fileState: "preparing" | "writing" | "complete" | "incomplete";
  readonly fileBytes: string;
  readonly fileBatches: string;
  /** Nanosecond spans. Writer times overlap emulation and cannot be summed as wall shares. */
  readonly fileProfile?: Readonly<Record<"sealNs" | "copyNs" | "writeNs" | "syncNs", string>>;
}

/** Append-only native archive cursor. Reads only the producer's synced byte prefix,
 * retaining one bounded chunk and an open inode across no-clobber publication.
 * Every callback is provisional until END2 and the published path both validate.
 */
export class NativeCaptureFileCursor {
  readonly header: CaptureFileHeader;
  readonly #handle: FileHandle;
  readonly #options: CaptureFileReadOptions;
  readonly #identity: { dev: number; ino: number };
  #offset: number;
  #chunk = 0n;
  #event = 0n;
  #cycle = 0n;
  #watermark = 0;
  #failed = false;
  #complete = false;

  private constructor(
    handle: FileHandle,
    header: CaptureFileHeader,
    offset: number,
    identity: { dev: number; ino: number },
    options: CaptureFileReadOptions,
  ) {
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
  static async open(
    file: string,
    options: CaptureFileReadOptions = {},
  ): Promise<NativeCaptureFileCursor> {
    options.signal?.throwIfAborted();
    const handle = await open(file, "r");
    try {
      const identity = await handle.stat();
      const prefix = await readCaptureBytes(handle, 12, 0);
      const length = prefix.readUInt32LE(4);
      if (prefix.toString("ascii", 0, 4) !== "ACS2" || length > 65536) {
        throw new Error("Invalid native capture header.");
      }
      checkCaptureSize(12 + length, options);
      const body = await readCaptureBytes(handle, length, 12);
      if (captureCrc32c(body) !== prefix.readUInt32LE(8)) {
        throw new Error("Capture metadata checksum mismatch.");
      }
      const header = validateCaptureFileHeader(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)),
      );
      return new NativeCaptureFileCursor(handle, header, 12 + length, identity, options);
    } catch (error) {
      await handle.close();
      throw error;
    }
  }
  /** Byte offset includes only the header and consumed, checkpointed chunks.
   * @returns {number} Consumed file bytes, for bounded backlog accounting.
   */
  get readBytes(): number {
    return this.#offset;
  }
  get observedEvents(): string {
    return String(this.#event);
  }
  get complete(): boolean {
    return this.#complete;
  }
  /** Read at most maxChunks (default 16) from a validated native status. Growth beyond
   * that durable watermark is ignored even if an unsynced ACK2 is already visible.
   * A failure permanently poisons the cursor. Callers must discard staged facts.
   * @param {NativeCaptureFilePosition} value Native producer's latest durable watermark.
   * @param {Function} accept Provisional synchronous chunk consumer. Exceptions poison this cursor.
   * @param {number} maxChunks Maximum chunks per slice, in [1, 256].
   * @param {string} publishedFile Final path whose inode must agree before completion.
   * @returns {Promise<void>} Settlement of one bounded read slice.
   */
  async readThrough(
    value: NativeCaptureFilePosition,
    accept: (chunk: CaptureChunkV2) => void,
    maxChunks = 16,
    publishedFile?: string,
  ): Promise<void> {
    if (this.#failed) {
      throw new Error("Native capture cursor failed previously.");
    }
    try {
      this.#options.signal?.throwIfAborted();
      const position = nativePosition(value, this.header.session, this.header.scope);
      const bytes = Number(captureU64(position.fileBytes));
      if (
        !Number.isSafeInteger(bytes) ||
        bytes < this.#watermark ||
        bytes < this.#offset ||
        !Number.isSafeInteger(maxChunks) ||
        maxChunks < 1 ||
        maxChunks > 256
      ) {
        throw new Error("Native capture watermark or chunk budget is invalid.");
      }
      checkCaptureSize(bytes, this.#options);
      if (position.fileState === "incomplete") {
        throw new Error("Native capture was interrupted.");
      }
      if (this.#complete) {
        if (bytes !== this.#watermark || position.fileState !== "complete") {
          throw new Error("Completed native capture changed.");
        }
        return;
      }
      this.#watermark = bytes;
      const before = await this.#handle.stat();
      if (before.size < bytes) {
        throw new Error("Native capture is shorter than its durable watermark.");
      }
      // Scope read-ahead to this slice's snapshot. Reusing an unread tail across
      // calls could hide a changed frame before the next status arrives.
      // Cap speculative buffering by both the slice's chunk budget and 1 MiB.
      // the read limit below remains the synced watermark, never visible file size.
      const reader = new CaptureFrameReader(
        (buffer, start, length, offset) => {
          this.#options.signal?.throwIfAborted();
          return this.#handle.read(buffer, start, length, offset);
        },
        Math.min(1048576, maxChunks * 262144),
      );
      const read = async (length: number): Promise<Buffer> => {
        this.#options.signal?.throwIfAborted();
        if (this.#offset + length > bytes) {
          throw new Error("Native durable watermark splits a frame.");
        }
        const result = await reader.read(length, this.#offset, bytes);
        this.#offset += length;
        return result;
      };
      const json = async (prefix: Buffer): Promise<unknown> => {
        const length = prefix.readUInt32LE(4);
        if (length > 65536) {
          throw new Error("Capture metadata exceeds bounds.");
        }
        const body = await read(length);
        if (captureCrc32c(body) !== prefix.readUInt32LE(8)) {
          throw new Error("Capture metadata checksum mismatch.");
        }
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
      };
      for (let count = 0; this.#offset < bytes && count < maxChunks; count++) {
        const prefix = await read(12);
        const magic = prefix.toString("ascii", 0, 4);
        if (magic === "END2") {
          const terminal = validateCapturePosition(
            await json(prefix),
            this.header.session,
            this.header.scope,
          );
          if (
            terminal.state !== "complete" ||
            position.fileState !== "complete" ||
            captureU64(terminal.producedThrough) !== this.#event ||
            captureU64(terminal.producedChunks) !== this.#chunk ||
            position.producedThrough !== terminal.producedThrough ||
            position.producedChunks !== terminal.producedChunks ||
            this.#offset !== bytes
          ) {
            throw new Error("Native capture terminal disagrees with the consumed prefix.");
          }
          const after = await this.#handle.stat();
          if (
            after.size !== bytes ||
            before.size !== after.size ||
            before.mtimeMs !== after.mtimeMs
          ) {
            throw new Error("Native capture changed during final validation.");
          }
          if (publishedFile) {
            const published = await lstat(publishedFile);
            if (
              !published.isFile() ||
              published.dev !== this.#identity.dev ||
              published.ino !== this.#identity.ino
            ) {
              throw new Error("Native capture publication replaced the opened file.");
            }
          }
          this.#complete = true;
          break;
        }
        if (magic !== "ACT2") {
          throw new Error("Native capture expected an ACT2 chunk.");
        }
        const envelope = Buffer.concat([prefix, await read(52)]);
        const length = envelope.readUInt32LE(48);
        if (length > 262144 - 64) {
          throw new Error("Capture chunk exceeds its bound.");
        }
        const chunk = decodeCaptureChunk(
          Buffer.concat([envelope, await read(length)]),
          this.header.session,
          this.header.scope,
        );
        const records = captureChunkRecords(chunk);
        if (
          captureU64(chunk.sequence) !== this.#chunk + 1n ||
          captureU64(chunk.first) !== this.#event + 1n ||
          captureU64(records[0].cycle) < this.#cycle ||
          captureU64(chunk.through) > captureU64(position.durableThrough)
        ) {
          throw new Error("Noncontiguous native capture history.");
        }
        const ackPrefix = await read(12);
        if (ackPrefix.toString("ascii", 0, 4) !== "ACK2") {
          throw new Error("Native capture chunk has no checkpoint.");
        }
        const ack = (await json(ackPrefix)) as Record<string, unknown>;
        if (
          ack.session !== this.header.session ||
          ack.chunkThrough !== chunk.sequence ||
          ack.eventThrough !== chunk.through
        ) {
          throw new Error("Native checkpoint disagrees with its chunk.");
        }
        accept(chunk);
        this.#chunk = captureU64(chunk.sequence);
        this.#event = captureU64(chunk.through);
        this.#cycle = captureU64(records.at(-1)!.cycle);
        // Yield at a validated checkpoint, even inside a multi-chunk slice, so
        // microtask-only reads cannot defer IPC/cancellation until the whole slice
        // finishes. The worker's outer scheduling yield cannot replace this one.
        await yieldToMessages(undefined, { signal: this.#options.signal });
      }
      if (this.#offset === bytes && !this.#complete && position.fileState === "complete") {
        throw new Error("Completed native capture has no terminal frame.");
      }
      this.#options.onProgress?.(this.#offset, bytes);
    } catch (error) {
      this.#failed = true;
      throw error;
    }
  }
  /** Close the pinned inode. Pending analysis remains caller-owned and provisional. */
  async close(): Promise<void> {
    await this.#handle.close();
  }
}
const nativePosition = (
  value: unknown,
  session?: string,
  scope?: CaptureScopeV2,
): NativeCaptureFilePosition => {
  const position = validateCapturePosition(value, session, scope) as NativeCaptureFilePosition;
  if (!["preparing", "writing", "complete", "incomplete"].includes(position.fileState)) {
    throw new Error("Invalid native file state.");
  }
  captureU64(position.fileBytes);
  captureU64(position.fileBatches);
  if (position.fileProfile) {
    for (const field of ["sealNs", "copyNs", "writeNs", "syncNs"] as const) {
      captureU64(position.fileProfile[field]);
    }
  }
  if ((position.state === "complete") !== (position.fileState === "complete")) {
    throw new Error("Native file publication and producer completion disagree.");
  }
  return position;
};

/** Controls a local native ACT2 writer. No event bytes cross RSP/DAP and no live
 * decoding occurs here. The existing bounded archive reader validates on import.
 */
export class NativeCaptureFileRecorder {
  readonly completion: Promise<CaptureFileSummary>;
  readonly #file: string;
  readonly #scope: CaptureScopeV2;
  readonly #transport: CaptureTransportV2;
  readonly #context?: CaptureContextRecorder;
  #position: NativeCaptureFilePosition;
  #stopRequested = false;
  #cancelled = false;

  /** Latest validated durable position. Observing it never reads or drains event bytes.
   * @returns {NativeCaptureFilePosition} Read-only status snapshot from the control pump.
   */
  get position(): NativeCaptureFilePosition {
    return this.#position;
  }

  private constructor(
    file: string,
    scope: CaptureScopeV2,
    transport: CaptureTransportV2,
    position: NativeCaptureFilePosition,
    context?: CaptureContextRecorder,
  ) {
    this.#file = file;
    this.#context = context;
    this.#scope = scope;
    this.#position = position;
    let tail = Promise.resolve();
    // Polling, stop and cancellation share the one-outstanding-request transport.
    this.#transport = (request) => {
      const operation = tail.then(() => transport(request));
      tail = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    };
    this.completion = this.#pump();
  }

  /** Arm while the debugger is stopped, then await the durable session header.
   * The supplied path belongs to the native host, which must share this filesystem.
   * @param {object} options Destination, scope, verified identity and control transport.
   * @returns {Promise<NativeCaptureFileRecorder>} Armed recorder with a durable session header.
   */
  static async create(
    options: CaptureFileMetadata &
      CaptureContextOptions & {
        readonly file: string;
        readonly transport: CaptureTransportV2;
        readonly scope?: CaptureScopeV2;
        readonly bufferBytes?: number;
        readonly measureStages?: boolean;
      },
  ): Promise<NativeCaptureFileRecorder> {
    metadataValid(options);
    const scope = captureScope(options.scope ?? "snes.65816.instructions");
    const cap = validateCaptureCapabilities(
      await options.transport({ operation: "file-capabilities", scope }),
      scope,
    );
    if (!cap.nativeFile) {
      throw new Error("Runtime does not support native file capture.");
    }
    const context =
      options.context === false
        ? undefined
        : new CaptureContextRecorder(options.file, options, options.transport);
    const transport = context?.transport ?? options.transport;
    let position: NativeCaptureFilePosition | undefined;
    let session: string | undefined;
    try {
      const initial = await transport({
        operation: "file-start",
        ...(options.measureStages ? { measureStages: true } : {}),
        file: options.file,
        scope,
        bufferBytes: options.bufferBytes ?? 8 * 1024 * 1024,
        romContentSha256: options.romContentSha256,
        producer: options.producer,
      });
      // Keep a valid identity before checking additional file/scope fields so
      // rejected setup can still cancel a producer that has already armed.
      session = validateCapturePosition(initial).session;
      position = nativePosition(initial, session, scope);
      while (position.fileState === "preparing") {
        await pause();
        position = nativePosition(
          await transport({ operation: "file-status", session: position.session }),
          position.session,
          scope,
        );
      }
      if (position.fileState !== "writing" || position.state !== "armed") {
        throw new Error(
          `Native file capture could not prepare its output: ${position.error || position.fileState}.`,
        );
      }
      return new NativeCaptureFileRecorder(options.file, scope, transport, position, context);
    } catch (error) {
      if (session) {
        await transport({ operation: "file-abort", session }).catch(() => undefined);
      }
      throw error;
    }
  }

  /** Fix the capture boundary, then wait for synced END2 and no-clobber publication.
   * @returns {Promise<CaptureFileSummary>} Published complete archive, or a writer failure.
   */
  async stop(): Promise<CaptureFileSummary> {
    if (!this.#stopRequested) {
      this.#stopRequested = true;
      try {
        nativePosition(
          await this.#transport({ operation: "file-stop", session: this.#position.session }),
          this.#position.session,
          this.#scope,
        );
      } catch (error) {
        this.#cancelled = true;
        await this.completion.catch(() => undefined);
        throw error;
      }
    }
    return this.completion;
  }
  /** Leave a recoverable partial artifact. Never publish an interrupted session.
   * @returns {Promise<CaptureFileSummary>} Existing completion. Rejects on cancellation.
   */
  finishIncomplete(): Promise<CaptureFileSummary> {
    this.#cancelled = true;
    return this.completion;
  }
  async #pump(): Promise<CaptureFileSummary> {
    try {
      while (!this.#cancelled) {
        const p = nativePosition(
          await this.#transport({ operation: "file-status", session: this.#position.session }),
          this.#position.session,
          this.#scope,
        );
        this.#position = p;
        if (p.fileState === "incomplete" || p.state === "incomplete") {
          throw new Error(`Native capture incomplete: ${p.error}.`);
        }
        if (p.fileState === "complete") {
          const events = captureU64(p.producedThrough),
            chunks = captureU64(p.producedChunks);
          if (
            events > BigInt(Number.MAX_SAFE_INTEGER) ||
            chunks > BigInt(Number.MAX_SAFE_INTEGER)
          ) {
            throw new Error("Native capture totals exceed the consumer's exact integer range.");
          }
          const summary: CaptureFileSummary = {
            file: this.#file,
            archive: this.#file,
            scope: this.#scope,
            observedEvents: Number(events),
            droppedEvents: 0,
            chunks: Number(chunks),
            complete: true,
            position: p,
            ...(this.#context ? { contextDirectory: this.#context.directory } : {}),
          };
          await this.#context?.finish(summary);
          return summary;
        }
        // Capture drains at native scheduler exits. Polling frequency affects
        // status latency only and never limits writer throughput.
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
      throw new Error("Native capture cancelled. The partial archive remains incomplete.");
    } catch (error) {
      await this.#transport({ operation: "file-abort", session: this.#position.session }).catch(
        () => undefined,
      );
      throw error;
    }
  }
}
