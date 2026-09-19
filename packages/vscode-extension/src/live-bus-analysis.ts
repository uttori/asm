import { fork, type ChildProcess } from "node:child_process";

import type { NativeCaptureFilePosition } from "@uttori/asm-debug-adapter";
import type {
  RuntimeBusProjectImportResult,
  RuntimeBusTraceProgress,
} from "@uttori/asm-disassembler";

import type { LiveBusStart, LiveBusProfile } from "./live-bus-analysis-process.js";

export interface LiveBusProgress extends RuntimeBusTraceProgress {
  readonly readBytes: number;
  readonly durableBytes: number;
  readonly provisional: true;
}
export interface LiveBusResult extends RuntimeBusProjectImportResult {
  readonly live: {
    readonly wallMs: number;
    readonly peakLagBytes: number;
    readonly peakRssBytes: number;
    readonly profile?: LiveBusProfile;
  };
}

/** Isolated single-capture importer with one in-flight and one latest status.
 * No raw events queue in the editor; failures never abort the native recorder.
 */
export class LiveBusAnalysis {
  /** Resolves only after guarded project publication; rejection leaves the recording available. */
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
            this.#worker.send({ type: "preview-accepted" }, (error) => {
              if (error) {
                this.#fail(error);
              }
            });
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
              `Live analysis process exited (${signal ?? code}); the capture can be imported offline.`,
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
  /** Replace pending progress; debugger polling never waits for analysis.
   * @param {NativeCaptureFilePosition} position Latest validated native status, including final publication.
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
  /** Cooperative cancellation rolls back temp staging; force exit bounds cleanup after 2 s. */
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
