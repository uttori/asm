import { open, link, unlink, type FileHandle } from "node:fs/promises";

import {
  captureCrc32c,
  captureU64,
  captureSession,
  decodeCaptureChunk,
  validateCaptureCapabilities,
  validateCapturePosition,
  type CaptureChunkV2,
  type CapturePositionV2,
  type CaptureTransportV2,
} from "./capture-v2.js";

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
  readonly scope: "snes.65816.instructions";
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
export interface CaptureFileSummary {
  readonly file: string;
  readonly archive: string;
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
  )
    throw new Error("Capture requires 65816 CPU scope and exact ROM/producer identity.");
};
const jsonFrame = (magic: string, value: unknown): Buffer => {
  const body = Buffer.from(JSON.stringify(value));
  if (body.length > 65536) throw new Error("Capture metadata exceeds its bound.");
  const header = Buffer.alloc(12);
  header.write(magic, "ascii");
  header.writeUInt32LE(body.length, 4);
  header.writeUInt32LE(captureCrc32c(body), 8);
  return Buffer.concat([header, body]);
};

/** One bounded chunk at a time; acceptance follows data sync AND checkpoint sync. */
export class LosslessCaptureFileRecorder {
  readonly completion: Promise<CaptureFileSummary>;
  readonly #file: string;
  readonly #partial: string;
  readonly #transport: CaptureTransportV2;
  readonly #handle: FileHandle;
  #position: CapturePositionV2;
  #stopRequested = false;
  #cancelled = false;
  #through = 0n;
  #chunk = 0n;
  #cycle = 0n;

  private constructor(
    file: string,
    handle: FileHandle,
    transport: CaptureTransportV2,
    position: CapturePositionV2,
  ) {
    this.#file = file;
    this.#partial = `${file}.act2.partial`;
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
    this.completion = this.#pump();
  }

  static async create(
    options: CaptureFileMetadata & {
      readonly file: string;
      readonly transport: CaptureTransportV2;
      readonly bufferBytes?: number;
    },
  ): Promise<LosslessCaptureFileRecorder> {
    metadataValid(options);
    validateCaptureCapabilities(await options.transport({ operation: "capabilities" }));
    // Reserve the eventual analysis destination before starting production.
    const destination = await open(options.file, "wx");
    await destination.close();
    let handle: FileHandle | undefined;
    let position: CapturePositionV2 | undefined;
    try {
      handle = await open(`${options.file}.act2.partial`, "wx");
      position = validateCapturePosition(
        await options.transport({
          operation: "start",
          bufferBytes: options.bufferBytes ?? 8 * 1024 * 1024,
        }),
      );
      if (
        position.producedThrough !== "0" ||
        position.chunkThrough !== "0" ||
        position.state !== "armed"
      )
        throw new Error("Capture did not start at an empty armed boundary.");
      const header: CaptureFileHeader = {
        format: "uttori-ares-capture",
        version: 2,
        session: position.session,
        scope: "snes.65816.instructions",
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
      return new LosslessCaptureFileRecorder(options.file, handle, options.transport, position);
    } catch (error) {
      if (position)
        await options
          .transport({ operation: "abort", session: position.session })
          .catch(() => undefined);
      await handle?.close().catch(() => undefined);
      await unlink(options.file).catch(() => undefined);
      throw error;
    }
  }

  async stop(): Promise<CaptureFileSummary> {
    if (!this.#stopRequested) {
      this.#stopRequested = true;
      try {
        validateCapturePosition(
          await this.#transport({ operation: "stop", session: this.#position.session }),
          this.#position.session,
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

  async #pump(): Promise<CaptureFileSummary> {
    const session = this.#position.session;
    try {
      while (!this.#cancelled) {
        const result = await this.#transport({
          operation: "read",
          session,
          chunk: String(this.#chunk + 1n),
        });
        if (
          !("hex" in result) ||
          typeof result.hex !== "string" ||
          result.hex.length > 524288 ||
          result.hex.length % 2 ||
          !/^[\da-f]*$/.test(result.hex)
        )
          throw new Error("Invalid capture read response.");
        if (result.hex) {
          const bytes = Buffer.from(result.hex, "hex"),
            chunk = decodeCaptureChunk(bytes, session);
          if (
            BigInt(chunk.sequence) !== this.#chunk + 1n ||
            BigInt(chunk.first) !== this.#through + 1n ||
            BigInt(chunk.instructions[0].cycle) < this.#cycle
          )
            throw new Error("Capture chunk is not contiguous.");
          await this.#handle.writeFile(bytes);
          await this.#handle.sync();
          await this.#handle.writeFile(
            jsonFrame("ACK2", {
              session,
              chunkThrough: chunk.sequence,
              eventThrough: chunk.through,
            }),
          );
          await this.#handle.sync();
          // Producer retention is released only after the checkpoint is synced.
          const p = validateCapturePosition(
            await this.#transport({
              operation: "ack",
              session,
              chunk: chunk.sequence,
              event: chunk.through,
            }),
            session,
          );
          if (p.durableThrough !== chunk.through || p.chunkThrough !== chunk.sequence)
            throw new Error("Producer acknowledgement did not match the durable checkpoint.");
          this.#position = p;
          this.#chunk = BigInt(chunk.sequence);
          this.#through = BigInt(chunk.through);
          this.#cycle = BigInt(chunk.instructions.at(-1)!.cycle);
        } else {
          this.#position = validateCapturePosition(
            await this.#transport({ operation: "status", session }),
            session,
          );
          if (this.#position.state === "incomplete")
            throw new Error(`Native capture incomplete: ${this.#position.error}`);
          if (this.#position.state === "complete") break;
          await pause();
        }
      }
      if (this.#cancelled)
        throw new Error(
          "Capture session ended before finalization; the partial archive retains its committed prefix.",
        );
      const p = this.#position;
      if (
        !this.#stopRequested ||
        p.state !== "complete" ||
        p.producedThrough !== String(this.#through) ||
        p.producedChunks !== String(this.#chunk)
      )
        throw new Error("Capture terminal accounting did not reconcile.");
      await this.#handle.writeFile(jsonFrame("END2", p));
      await this.#handle.sync();
      await this.#handle.close();
      // A no-clobber link publishes the fully synced inode; power-loss durability
      // of directory entries is deliberately not claimed by this prototype.
      const archive = `${this.#file}.act2`;
      await link(this.#partial, archive);
      await unlink(this.#partial);
      await exportCaptureJson(archive, this.#file, true);
      return {
        file: this.#file,
        archive,
        observedEvents: Number(this.#through),
        droppedEvents: 0,
        chunks: Number(this.#chunk),
        complete: true,
        position: p,
      };
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

/**
 * Scan bounded frames, delivering only chunks backed by validated checkpoints.
 * @param {string} file Archive or partial artifact.
 * @param {Function} accept Optional committed-chunk consumer.
 * @returns {Promise<CaptureRecovery>} Validated prefix and terminal integrity.
 */
export const recoverCaptureFile = async (
  file: string,
  accept?: (chunk: CaptureChunkV2) => void | Promise<void>,
): Promise<CaptureRecovery> => {
  const handle = await open(file, "r");
  let offset = 0;
  const read = async (length: number): Promise<Buffer> => {
    const b = Buffer.alloc(length);
    let got = 0;
    while (got < length) {
      const { bytesRead } = await handle.read(b, got, length - got, offset + got);
      if (!bytesRead) throw new Error("Torn capture frame.");
      got += bytesRead;
    }
    offset += length;
    return b;
  };
  const json = async (prefix: Buffer): Promise<unknown> => {
    const length = prefix.readUInt32LE(4);
    if (length > 65536) throw new Error("Capture metadata length exceeds bounds.");
    const body = await read(length);
    if (captureCrc32c(body) !== prefix.readUInt32LE(8))
      throw new Error("Capture metadata checksum mismatch.");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  };
  let header: CaptureFileHeader;
  try {
    const prefix = await read(12);
    if (prefix.toString("ascii", 0, 4) !== "ACS2")
      throw new Error("Missing capture session header.");
    header = (await json(prefix)) as CaptureFileHeader;
    metadataValid(header);
    captureSession(header.session);
    if (
      header.clock?.id !== "snes.master" ||
      !captureU64(header.clock.numerator) ||
      !captureU64(header.clock.denominator)
    )
      throw new Error("Invalid session clock domain.");
    if (
      header.format !== "uttori-ares-capture" ||
      header.version !== 2 ||
      header.scope !== "snes.65816.instructions" ||
      header.ownership !== "durable-prefix" ||
      header.compression !== "none" ||
      header.checksum !== "crc32c" ||
      header.maxChunkBytes !== 262144 ||
      !Number.isSafeInteger(header.allocatedBytes) ||
      header.allocatedBytes < 4718656 ||
      header.allocatedBytes > 64 * 1024 * 1024
    )
      throw new Error("Unsupported capture session contract.");
  } catch (error) {
    await handle.close();
    throw error;
  }
  let chunkThrough = 0n,
    eventThrough = 0n,
    lastCycle = 0n;
  let pending: CaptureChunkV2 | undefined;
  try {
    while (true) {
      const prefix = await read(12),
        magic = prefix.toString("ascii", 0, 4);
      if (magic === "ACT2") {
        if (pending) throw new Error("Uncommitted capture chunk before another chunk.");
        const envelope = Buffer.concat([prefix, await read(52)]);
        const length = envelope.readUInt32LE(48);
        if (length > 262144 - 64) throw new Error("Capture chunk exceeds negotiated bound.");
        pending = decodeCaptureChunk(Buffer.concat([envelope, await read(length)]), header.session);
        if (
          BigInt(pending.sequence) !== chunkThrough + 1n ||
          BigInt(pending.first) !== eventThrough + 1n ||
          BigInt(pending.instructions[0].cycle) < lastCycle
        )
          throw new Error("Noncontiguous capture history.");
      } else if (magic === "ACK2") {
        const checkpoint = (await json(prefix)) as Record<string, unknown>;
        if (
          !pending ||
          checkpoint.session !== header.session ||
          checkpoint.chunkThrough !== pending.sequence ||
          checkpoint.eventThrough !== pending.through
        )
          throw new Error("Checkpoint does not match the pending chunk.");
        if (accept) await accept(pending);
        chunkThrough = BigInt(pending.sequence);
        eventThrough = BigInt(pending.through);
        lastCycle = BigInt(pending.instructions.at(-1)!.cycle);
        pending = undefined;
      } else if (magic === "END2") {
        const terminal = validateCapturePosition(await json(prefix), header.session);
        if (
          pending ||
          terminal.state !== "complete" ||
          captureU64(terminal.producedThrough) !== eventThrough ||
          captureU64(terminal.producedChunks) !== chunkThrough
        )
          throw new Error("Terminal capture totals disagree with the committed prefix.");
        if ((await handle.stat()).size !== offset)
          throw new Error("Unexpected bytes after capture terminal.");
        return {
          header,
          complete: true,
          chunkThrough: String(chunkThrough),
          eventThrough: String(eventThrough),
        };
      } else throw new Error("Unknown required capture frame.");
    }
  } catch (error) {
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
  // inspect the committed prefix separately; incomplete archives cannot be promoted.
  const verified = await recoverCaptureFile(archive);
  if (!verified.complete) throw new Error(`Capture archive is incomplete: ${verified.reason}`);
  if (BigInt(verified.eventThrough) >= BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(
      "Legacy JSON sequence numbers cannot represent this capture; retain the exact ACT2 archive.",
    );
  const h = await open(destination, reserved ? "r+" : "wx");
  try {
    if (reserved && (await h.stat()).size !== 0)
      throw new Error("Reserved trace destination changed during capture.");
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
    if (!result.complete || result.eventThrough !== verified.eventThrough)
      throw new Error("Capture archive changed during export.");
    await h.writeFile("]}\n");
    await h.sync();
  } finally {
    await h.close();
  }
};
