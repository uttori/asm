import {
  MAX_CAPTURE_EVENTS,
  MAX_CAPTURE_MILLISECONDS,
  type BehaviorCaptureWindow,
  type BehaviorCaptureStopReason,
} from "./behavior-capture.js";
import {
  validateRuntimeInstructionTrace,
  type RuntimeInstructionTraceChunk,
  type RuntimeInstructionTraceArtifact,
} from "./runtime-trace.js";
import { validateRuntimeInstructionDetails } from "./trace-detail.js";

type EditorTraceMetadata = Pick<
  RuntimeInstructionTraceArtifact,
  "architecture" | "addressSpace" | "romContentSha256" | "producer"
>;
interface EditorTraceBatch extends RuntimeInstructionTraceChunk {
  readonly architecture: string;
  readonly addressSpace: string;
}

export interface BehaviorRecorderOptions extends EditorTraceMetadata {
  readonly role: BehaviorCaptureWindow["role"];
  readonly label: string;
  readonly stop: BehaviorCaptureWindow["stop"];
  readonly limits: BehaviorCaptureWindow["limits"];
  readonly maxBatchEvents: number;
  readonly readTrace: (maxEvents: number) => Promise<EditorTraceBatch>;
  readonly stopTrace: () => Promise<void>;
  readonly now?: () => number;
}

/** A bounded observation window. A polled address limit trims the batch, not CPU execution. */
export class BehaviorCaptureRecorder {
  readonly completion: Promise<BehaviorCaptureWindow>;
  readonly #options: BehaviorRecorderOptions;
  readonly #now: () => number;
  readonly #startedAt: string;
  readonly #started: number;
  #reason?: BehaviorCaptureStopReason;
  #stopPromise?: Promise<void>;
  #sessionEnded = false;

  constructor(options: BehaviorRecorderOptions) {
    if (
      !Number.isSafeInteger(options.limits.maxEvents) ||
      options.limits.maxEvents < 1 ||
      options.limits.maxEvents > MAX_CAPTURE_EVENTS ||
      !Number.isSafeInteger(options.limits.maxMilliseconds) ||
      options.limits.maxMilliseconds < 1 ||
      options.limits.maxMilliseconds > MAX_CAPTURE_MILLISECONDS ||
      !Number.isSafeInteger(options.maxBatchEvents) ||
      options.maxBatchEvents < 1 ||
      options.maxBatchEvents > MAX_CAPTURE_EVENTS
    )
      throw new Error("Invalid behavior capture limits.");
    this.#options = options;
    this.#now = options.now ?? (() => performance.now());
    this.#started = this.#now();
    this.#startedAt = new Date().toISOString();
    this.completion = this.#pump();
  }

  requestStop(reason: BehaviorCaptureStopReason = "manual"): void {
    this.#reason ??= reason;
    if (reason === "session-ended") this.#sessionEnded = true;
  }

  async #stopProducer(): Promise<void> {
    if (this.#sessionEnded) return;
    this.#stopPromise ??= this.#options.stopTrace();
    await this.#stopPromise;
  }

  async #pump(): Promise<BehaviorCaptureWindow> {
    const chunks: RuntimeInstructionTraceChunk[] = [];
    let observed = 0;
    let dropped = 0;
    let unattributed = 0;
    let expectedSequence = 1;
    let excludedPolledEvents = 0;
    let failed = false;
    const timer = setTimeout(
      () => this.requestStop("elapsed"),
      this.#options.limits.maxMilliseconds,
    );
    try {
      while (!this.#reason) {
        if (this.#now() - this.#started >= this.#options.limits.maxMilliseconds) {
          this.requestStop("elapsed");
          break;
        }
        const batch = await this.#options.readTrace(
          Math.min(this.#options.maxBatchEvents, this.#options.limits.maxEvents - observed),
        );
        if (batch.details !== undefined)
          validateRuntimeInstructionDetails(batch.details, batch.addresses.length);
        if (
          batch.unattributedMemoryAccesses !== undefined &&
          (!Number.isSafeInteger(batch.unattributedMemoryAccesses) ||
            batch.unattributedMemoryAccesses < unattributed)
        )
          throw new Error("Invalid unattributed memory counter.");
        if (
          batch.architecture !== this.#options.architecture ||
          batch.addressSpace !== this.#options.addressSpace ||
          typeof batch.active !== "boolean" ||
          !Array.isArray(batch.addresses) ||
          batch.addresses.length > this.#options.maxBatchEvents ||
          !Number.isSafeInteger(batch.sequenceStart) ||
          !Number.isSafeInteger(batch.droppedEvents) ||
          batch.droppedEvents < dropped ||
          batch.sequenceStart - expectedSequence !== batch.droppedEvents - dropped ||
          batch.addresses.some(
            (address) => !Number.isSafeInteger(address) || address < 0 || address > 0xff_ffff,
          )
        )
          throw new Error("Invalid behavior trace identity, sequence, loss, or event batch.");
        let count = Math.min(batch.addresses.length, this.#options.limits.maxEvents - observed);
        const stop = this.#options.stop;
        if (stop.kind === "address") {
          const match = (batch.addresses as readonly number[])
            .slice(0, count)
            .findIndex((address) => stop.addresses.includes(address));
          if (match >= 0) {
            count = match + 1;
            this.requestStop("address");
          }
        }
        if (count)
          chunks.push({
            sequenceStart: batch.sequenceStart,
            addresses: batch.addresses.slice(0, count),
            ...(batch.details === undefined ? {} : { details: batch.details.slice(0, count) }),
            ...(batch.unattributedMemoryAccesses === undefined
              ? {}
              : { unattributedMemoryAccesses: batch.unattributedMemoryAccesses }),
            droppedEvents: batch.droppedEvents,
            active: true,
          });
        observed += count;
        dropped = batch.droppedEvents;
        unattributed = batch.unattributedMemoryAccesses ?? unattributed;
        expectedSequence = batch.sequenceStart + count;
        excludedPolledEvents += batch.addresses.length - count;
        if (observed >= this.#options.limits.maxEvents) this.requestStop("instruction-limit");
        if (!batch.active && !batch.addresses.length) this.requestStop("producer-stopped");
        if (!this.#reason && !batch.addresses.length)
          await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } catch {
      failed = true;
      this.#reason = this.#sessionEnded ? "session-ended" : "error";
    } finally {
      clearTimeout(timer);
      try {
        await this.#stopProducer();
      } catch {
        failed = true;
        this.#reason = "error";
      }
    }
    // This delimiter ends the selected observation interval; unpulled producer data is outside it.
    chunks.push({
      sequenceStart: expectedSequence,
      addresses: [],
      droppedEvents: dropped,
      ...(unattributed ? { unattributedMemoryAccesses: unattributed } : {}),
      active: failed || this.#sessionEnded,
    });
    const trace = validateRuntimeInstructionTrace({
      format: "uttori-asm-instruction-trace",
      schemaVersion: 1,
      architecture: this.#options.architecture,
      addressSpace: this.#options.addressSpace,
      romContentSha256: this.#options.romContentSha256,
      producer: this.#options.producer,
      chunks,
    });
    return {
      role: this.#options.role,
      label: this.#options.label,
      startedAt: this.#startedAt,
      elapsedMilliseconds: Math.max(0, Math.floor(this.#now() - this.#started)),
      limits: this.#options.limits,
      stop: this.#options.stop,
      stopReason: this.#reason ?? "error",
      excludedPolledEvents,
      trace,
    };
  }
}
