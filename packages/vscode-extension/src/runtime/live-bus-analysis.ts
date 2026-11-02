import { fork, type ChildProcess } from "node:child_process";

import type { NativeCaptureFilePosition } from "@uttori/asm-capture";
import type {
  RuntimeBusProjectImportResult,
  RuntimeBusTraceProgress,
} from "@uttori/asm-disassembler";

import type { LiveBusStart, LiveBusProfile } from "./live-bus-analysis-process.js";

/**
 * Provisional importer counters with consumed and durably captured byte positions; their
 * difference is current analysis lag.
 */
export interface LiveBusProgress extends RuntimeBusTraceProgress {
  /** Bytes consumed from the capture archive so far. */
  readonly readBytes: number;
  /** Bytes durably recorded by the native capture pipeline. */
  readonly durableBytes: number;
  /** Marks progress as provisional until the importer commits. */
  readonly provisional: true;
}
/**
 * Committed bus import plus wall-clock milliseconds, peak unread bytes, peak resident memory
 * bytes, and optional profiling data.
 */
export interface LiveBusResult extends RuntimeBusProjectImportResult {
  /** Live-import timing and resource peaks recorded by the child process. */
  readonly live: {
    /** Wall milliseconds for the committed import. */
    readonly wallMs: number;
    /** Peak unread archive bytes observed during import. */
    readonly peakLagBytes: number;
    /** Peak resident set size in bytes during import. */
    readonly peakRssBytes: number;
    /** Optional coarse stage timings when profiling was enabled. */
    readonly profile?: LiveBusProfile;
  };
}

/**
 * Isolated single-capture importer with one in-flight and one latest status.
 * No raw events queue in the editor. Failures never abort the native recorder.
 */
export class LiveBusAnalysis {
  /** Resolves only after guarded project publication. Rejection leaves the recording available. */
  readonly completion: Promise<LiveBusResult>;
  readonly #worker: ChildProcess;
  #latest?: NativeCaptureFilePosition;
  #sending = false;
  #settled = false;
  #reject!: (error: Error) => void;
  #cancelTimer?: ReturnType<typeof setTimeout>;
  constructor(
    workerFile: string,
    options: Omit<LiveBusStart, "type">,
    onProgress: (progress: LiveBusProgress) => void,
    maxMemoryMiB = 512,
  ) {
    if (!Number.isSafeInteger(maxMemoryMiB) || maxMemoryMiB < 128) {
      throw new Error("Live analysis requires a heap budget of at least 128 MiB.");
    }
    this.#worker = fork(workerFile, [], {
      execArgv: [`--max-old-space-size=${maxMemoryMiB}`],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    this.completion = new Promise((resolve, reject) => {
      this.#reject = reject;
      this.#worker.on(
        "message",
        (message: {
          type: string;
          value?: LiveBusResult;
          error?: string;
          progress?: LiveBusProgress;
        }) => {
          if (this.#settled) {
            return;
          }
          if (message.type === "accepted") {
            this.#sending = false;
            this.#send();
          } else if (message.type === "progress" && message.progress) {
            try {
              onProgress(message.progress);
            } catch (error) {
              this.#fail(error instanceof Error ? error : new Error(String(error)));
              return;
            }
            // The child can finish and close IPC while its terminal result is still queued here.
            // Preview acknowledgments only release backpressure; result/error/exit owns completion.
            this.#worker.send({ type: "preview-accepted" }, () => undefined);
          } else if (message.type === "result" && message.value) {
            this.#settled = true;
            clearTimeout(this.#cancelTimer);
            resolve(message.value);
          } else if (message.type === "error") {
            this.#fail(new Error(message.error));
          }
        },
      );
      this.#worker.on("error", (error) => this.#fail(error));
      this.#worker.on("exit", (code, signal) => {
        if (!this.#settled) {
          this.#fail(
            new Error(
              `Live analysis process exited (${signal ?? code}). The capture can be imported offline.`,
            ),
          );
        }
      });
    });
    // Avoid an unhandled rejection before the UI has attached its completion handler.
    void this.completion.catch(() => undefined);
    this.#worker.stderr?.resume();
    this.#worker.send({ type: "start", ...options }, (error) => {
      if (error) {
        this.#fail(error);
      }
    });
  }
  /**
   * Replace pending progress. Debugger polling never waits for analysis.
   * @param position Latest validated native status, including final publication.
   */
  update(position: NativeCaptureFilePosition): void {
    this.#latest = position;
    this.#send();
  }
  #send(): void {
    if (this.#settled || this.#sending || !this.#latest) {
      return;
    }
    const position = this.#latest;
    this.#latest = undefined;
    this.#sending = true;
    this.#worker.send({ type: "position", position }, (error) => {
      if (error) {
        this.#fail(error);
      }
    });
  }
  /** Cooperative cancellation rolls back temp staging. Force exit bounds cleanup after 2 s. */
  cancel(): void {
    if (this.#settled) {
      return;
    }
    this.#worker.send({ type: "cancel" }, (error) => {
      if (error) {
        this.#fail(error);
      }
    });
    this.#cancelTimer ??= setTimeout(() => this.#fail(new Error("Live analysis cancelled.")), 2000);
  }
  #fail(error: Error): void {
    if (this.#settled) {
      return;
    }
    this.#settled = true;
    clearTimeout(this.#cancelTimer);
    this.#worker.kill();
    this.#reject(error);
  }
}
