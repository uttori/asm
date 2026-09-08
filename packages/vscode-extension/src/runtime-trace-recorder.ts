import type { RuntimeInstructionDetail } from "@uttori/asm-disassembler";
import { open, type FileHandle } from "node:fs/promises";

/** One trace batch returned by the debugger's bounded pull protocol. */
export interface EditorTraceBatch {
  readonly architecture: string;
  readonly addressSpace: string;
  readonly sequenceStart: number;
  readonly addresses: readonly number[];
  readonly details?: readonly RuntimeInstructionDetail[];
  readonly unattributedMemoryAccesses?: number;
  readonly droppedEvents: number;
  readonly active: boolean;
}

/** Immutable identity written ahead of streamed trace chunks. */
export interface EditorTraceMetadata {
  readonly architecture: string;
  readonly addressSpace: string;
  readonly romContentSha256: string;
  readonly producer: { readonly id: string; readonly revision: string };
}

/** Pull/stop functions supplied by one active DAP session. */
export interface RuntimeTraceFileRecorderOptions extends EditorTraceMetadata {
  readonly file: string;
  readonly maxBatchEvents: number;
  readonly readTrace: (maxEvents: number) => Promise<EditorTraceBatch>;
  readonly stopTrace: () => Promise<void>;
}

/** Summary reported after a trace file is completely flushed and closed. */
export interface RuntimeTraceFileSummary {
  readonly file: string;
  readonly chunks: number;
  readonly observedEvents: number;
  readonly droppedEvents: number;
  readonly complete: boolean;
}

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const assertIdentity = (value: string, name: string): void => {
  if (!value) throw new Error(`${name} must not be empty.`);
};

/** Streams native trace chunks to disk with file I/O as explicit backpressure. */
export class RuntimeTraceFileRecorder {
  readonly #options: RuntimeTraceFileRecorderOptions;
  readonly #handle: FileHandle;
  readonly #completion: Promise<RuntimeTraceFileSummary>;
  #cancelled = false;
  #stopRequested = false;
  #closed = false;
  #firstChunk = true;
  #chunks = 0;
  #observedEvents = 0;
  #droppedEvents = 0;
  #expectedSequence = 1;
  #unattributed = 0;
  #producerStopped = false;
  #complete = false;

  private constructor(options: RuntimeTraceFileRecorderOptions, handle: FileHandle) {
    this.#options = options;
    this.#handle = handle;
    this.#completion = this.#pump();
  }

  /** @returns {Promise<RuntimeTraceFileSummary>} Settlement when the artifact is closed. */
  get completion(): Promise<RuntimeTraceFileSummary> {
    return this.#completion;
  }

  /**
   * Opens and initializes a native version-1 instruction-trace artifact.
   * @param {RuntimeTraceFileRecorderOptions} options Destination, identity, and DAP callbacks.
   * @returns {Promise<RuntimeTraceFileRecorder>} Active disk-backed recorder.
   */
  static async create(options: RuntimeTraceFileRecorderOptions): Promise<RuntimeTraceFileRecorder> {
    assertIdentity(options.architecture, "Trace architecture");
    assertIdentity(options.addressSpace, "Trace address space");
    assertIdentity(options.producer.id, "Trace producer id");
    assertIdentity(options.producer.revision, "Trace producer revision");
    if (!/^[\da-f]{64}$/.test(options.romContentSha256))
      throw new Error("Trace ROM content identity must be a lowercase SHA-256 value.");
    if (!Number.isSafeInteger(options.maxBatchEvents) || options.maxBatchEvents < 1)
      throw new Error("Trace batch maximum must be a positive safe integer.");
    const handle = await open(options.file, "w");
    const header = {
      format: "uttori-asm-instruction-trace",
      schemaVersion: 1,
      architecture: options.architecture,
      addressSpace: options.addressSpace,
      romContentSha256: options.romContentSha256,
      producer: options.producer,
    };
    const prefix = `${JSON.stringify(header, undefined, 2).slice(0, -2)},\n  "chunks": [`;
    try {
      await handle.writeFile(prefix, "utf8");
      return new RuntimeTraceFileRecorder(options, handle);
    } catch (error) {
      await handle.close().catch(() => undefined);
      throw error;
    }
  }

  /**
   * Stops capture, drains the producer, and closes a complete JSON artifact.
   * @returns {Promise<RuntimeTraceFileSummary>} Final file and loss counters.
   */
  async stop(): Promise<RuntimeTraceFileSummary> {
    if (!this.#stopRequested) {
      this.#stopRequested = true;
      try {
        await this.#options.stopTrace();
      } catch (error) {
        this.#cancelled = true;
        await this.#completion.catch(() => undefined);
        throw error;
      }
    }
    return this.#completion;
  }

  /**
   * Closes a valid but explicitly incomplete artifact after session loss.
   * @returns {Promise<RuntimeTraceFileSummary>} Final incomplete file and loss counters.
   */
  finishIncomplete(): Promise<RuntimeTraceFileSummary> {
    this.#cancelled = true;
    return this.#completion;
  }

  async #pump(): Promise<RuntimeTraceFileSummary> {
    try {
      const { validateRuntimeInstructionDetails } = await import("@uttori/asm-disassembler");
      while (!this.#cancelled) {
        const batch = await this.#options.readTrace(this.#options.maxBatchEvents);
        if (batch.details !== undefined)
          validateRuntimeInstructionDetails(batch.details, batch.addresses.length);
        this.#assertBatch(batch);
        if (
          batch.addresses.length > 0 ||
          batch.droppedEvents !== this.#droppedEvents ||
          !batch.active
        )
          await this.#writeChunk(batch);
        if (!batch.active && batch.addresses.length === 0) {
          this.#complete = this.#stopRequested;
          break;
        }
        if (batch.active && batch.addresses.length === 0) await delay(10);
      }
      return await this.#finish();
    } catch (error) {
      await this.#finish().catch(() => undefined);
      throw error;
    }
  }

  #assertBatch(batch: EditorTraceBatch): void {
    if (!Array.isArray(batch.addresses) || typeof batch.active !== "boolean")
      throw new Error("Invalid trace batch shape.");
    if (
      batch.architecture !== this.#options.architecture ||
      batch.addressSpace !== this.#options.addressSpace
    )
      throw new Error("Trace batch identity differs from the selected recording stream.");
    if (batch.addresses.length > this.#options.maxBatchEvents)
      throw new Error("Trace batch exceeds the negotiated event maximum.");
    if (!Number.isSafeInteger(batch.sequenceStart) || batch.sequenceStart < 1)
      throw new Error("Trace batch sequence must be a positive safe integer.");
    if (!Number.isSafeInteger(batch.droppedEvents) || batch.droppedEvents < this.#droppedEvents)
      throw new Error("Trace batch loss counter is invalid or decreased.");
    if (batch.sequenceStart - this.#expectedSequence !== batch.droppedEvents - this.#droppedEvents)
      throw new Error("Trace sequence gap disagrees with producer loss.");
    if (this.#producerStopped && batch.active) throw new Error("Trace resumed after stopping.");
    if (
      batch.unattributedMemoryAccesses !== undefined &&
      (!Number.isSafeInteger(batch.unattributedMemoryAccesses) ||
        batch.unattributedMemoryAccesses < this.#unattributed)
    )
      throw new Error("Invalid unattributed memory counter.");
    if (
      batch.addresses.some(
        (address) => !Number.isSafeInteger(address) || address < 0 || address > 0xff_ffff,
      )
    )
      throw new Error("Trace batch contains an invalid 24-bit instruction address.");
  }

  async #writeChunk(batch: EditorTraceBatch): Promise<void> {
    const separator = this.#firstChunk ? "\n" : ",\n";
    const json = JSON.stringify(
      {
        sequenceStart: batch.sequenceStart,
        addresses: batch.addresses,
        ...(batch.details === undefined ? {} : { details: batch.details }),
        ...(batch.unattributedMemoryAccesses === undefined
          ? {}
          : { unattributedMemoryAccesses: batch.unattributedMemoryAccesses }),
        droppedEvents: batch.droppedEvents,
        active: batch.active,
      },
      undefined,
      2,
    )
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n");
    await this.#handle.writeFile(`${separator}${json}`, "utf8");
    this.#firstChunk = false;
    this.#chunks++;
    this.#observedEvents += batch.addresses.length;
    this.#droppedEvents = batch.droppedEvents;
    this.#expectedSequence = batch.sequenceStart + batch.addresses.length;
    this.#unattributed = batch.unattributedMemoryAccesses ?? this.#unattributed;
    this.#producerStopped ||= !batch.active;
  }

  async #finish(): Promise<RuntimeTraceFileSummary> {
    if (!this.#closed) {
      this.#closed = true;
      await this.#handle.writeFile(`${this.#firstChunk ? "" : "\n"}  ]\n}\n`, "utf8");
      await this.#handle.close();
    }
    return {
      file: this.#options.file,
      chunks: this.#chunks,
      observedEvents: this.#observedEvents,
      droppedEvents: this.#droppedEvents,
      complete: this.#complete,
    };
  }
}
