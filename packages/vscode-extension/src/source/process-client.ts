import { fork, type ChildProcess } from "node:child_process";

import type { AssetOperation } from "@uttori/asm-workflows/asset-interchange";
import type { AssetSourceOperation } from "@uttori/asm-workflows/asset-source";
import type { AssemblyBuildOperation } from "@uttori/asm-workflows/build";
import type { SourceOperation } from "@uttori/asm-workflows/source";

import { WorkerRequestSlots, workerTimeout } from "../workers/lifecycle.js";

/** Serializable request: buffers use advanced IPC serialization, while cancellation stays process-local. */
type WorkerRequest<T> = T extends unknown ? Omit<T, "signal" | "onProgress"> : never;
export type SourceProcessOperation =
  | WorkerRequest<SourceOperation>
  | AssetOperation
  | AssemblyBuildOperation
  | AssetSourceOperation;

export interface SourceProcessOptions {
  readonly maxMemoryMiB: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (message: string) => void;
  /** Live source/editor version check; returning rejects or acknowledges the worker's final publication gate. */
  readonly onBeforePublish?: (paths: readonly string[]) => void | Promise<void>;
}
/** Isolate assembly/SQLite CPU and memory from the extension host; dispose terminates owned children. */
export class SourceProcessClient {
  readonly #children = new Set<ChildProcess>();
  readonly #slots: WorkerRequestSlots;
  readonly #timeoutMs: number;
  #disposed = false;
  constructor(
    readonly file: string,
    readonly log: (message: string) => void = () => {},
    limits: { readonly maxConcurrent?: number; readonly timeoutMs?: number } = {},
  ) {
    this.#slots = new WorkerRequestSlots(limits.maxConcurrent ?? 2);
    this.#timeoutMs = workerTimeout(limits.timeoutMs, 30 * 60_000);
  }

  /**
   * Own one child and its status timer until exit. Quiet phases retain their last reported stage.
   * Cancellation may race a durable commit; an orderly completed result remains authoritative.
   */
  run<T>(
    operation: SourceProcessOperation,
    options: SourceProcessOptions & { readonly readResult: (value: unknown) => T },
  ): Promise<T>;
  run(operation: SourceProcessOperation, options: SourceProcessOptions): Promise<unknown>;
  run(
    operation: SourceProcessOperation,
    options: SourceProcessOptions & { readonly readResult?: (value: unknown) => unknown },
  ): Promise<unknown> {
    options.signal?.throwIfAborted();
    if (this.#disposed) {
      return Promise.reject(new Error("Source worker has been disposed."));
    }
    if (!Number.isSafeInteger(options.maxMemoryMiB) || options.maxMemoryMiB < 128) {
      return Promise.reject(new Error("Source worker heap budget must be at least 128 MiB."));
    }
    let requestId: number;
    try {
      requestId = this.#slots.acquire();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    return new Promise((resolve, reject) => {
      const started = Date.now();
      let lastUpdate = started;
      let lastStage = "Waiting for worker startup.";
      let label = `Source ${operation.action}: ${operation.directory}`;
      if ("capture" in operation && operation.capture) {
        label += `; capture ${operation.capture}`;
      }
      this.log(`${label}: started.`);
      if ("captures" in operation && operation.captures) {
        for (const [index, capture] of operation.captures.entries()) {
          this.log(`Queued capture ${index + 1}/${operation.captures.length}: ${capture}`);
        }
      } else if ("capture" in operation && operation.capture) {
        this.log(`Importing capture: ${operation.capture}`);
        lastStage = `Starting import of ${operation.capture}.`;
      }
      let child: ChildProcess;
      try {
        child = fork(this.file, [], {
          execArgv: [`--max-old-space-size=${options.maxMemoryMiB}`],
          env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
          serialization: "advanced",
          stdio: ["ignore", "ignore", "pipe", "ipc"],
        });
      } catch (error) {
        this.#slots.release(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      this.#children.add(child);
      let response: { value: unknown } | { error: Error } | undefined;
      let finished = false;
      let stderr = "";
      let cancellationTimer: NodeJS.Timeout | undefined;
      let deadline: NodeJS.Timeout | undefined;
      const report = (message: string): void => {
        // VS Code treats bracketed text as filter categories; elapsed time must stay plain text.
        const progress = `${((Date.now() - started) / 1000).toFixed(1)}s: ${message}`;
        this.log(progress);
        options.onProgress?.(progress);
      };
      // This timer belongs to the responsive parent. Worker timers cannot run during synchronous
      // assembly or SQLite work. Stage age shows a quiet worker without claiming measurable progress.
      const heartbeat = setInterval(() => {
        if (finished || response || options.signal?.aborted || Date.now() - lastUpdate < 10_000) {
          return;
        }
        report(
          `Waiting for worker ${child.pid}; last progress update ${((Date.now() - lastUpdate) / 1000).toFixed(0)}s ago. ${lastStage}`,
        );
      }, 10_000);
      heartbeat.unref();
      const finish = (error?: Error, value?: unknown): void => {
        if (finished) {
          return;
        }
        finished = true;
        this.#slots.release(requestId);
        clearInterval(heartbeat);
        clearTimeout(cancellationTimer);
        clearTimeout(deadline);
        options.signal?.removeEventListener("abort", cancel);
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        if (error) {
          this.log(`${label}: failed after ${seconds}s. Last stage: ${lastStage} ${error.message}`);
          reject(error);
        } else {
          this.log(`${label}: completed in ${seconds}s. Last stage: ${lastStage}`);
          resolve(value);
        }
      };
      const cancel = (): void => {
        if (finished || cancellationTimer) {
          return;
        }
        clearInterval(heartbeat);
        report(
          `Cancelling ${label}; last stage: ${lastStage}. The next status check will reconcile native Git state.`,
        );
        if (child.connected) {
          child.send({ type: "cancel" }, () => {});
        }
        // A synchronous assembler/SQLite statement cannot receive IPC. Termination leaves SQLite
        // rollback and the Git operation journal authoritative; never claim cancellation undid a commit.
        cancellationTimer = setTimeout(() => child.kill("SIGTERM"), 1500);
      };
      // Large capture queues can legitimately run for hours. Bound inactivity rather than total
      // duration; only worker progress refreshes this timer, never the parent's status heartbeat.
      // A final committed response still wins cancellation racing the child's orderly exit.
      deadline = setTimeout(() => {
        report(
          `Worker made no progress for ${this.#timeoutMs} ms; reconciling publication is required if termination interrupts the response.`,
        );
        cancel();
      }, this.#timeoutMs);
      deadline.unref();
      options.signal?.addEventListener("abort", cancel, { once: true });
      child.stderr?.on("data", (bytes: Buffer) => {
        stderr = (stderr + bytes.toString()).slice(-8192);
        this.log(bytes.toString());
      });
      child.on("message", (payload: unknown) => {
        if (finished || response) {
          return;
        }
        if (
          typeof payload !== "object" ||
          payload === null ||
          !("type" in payload) ||
          typeof payload.type !== "string" ||
          !["progress", "result", "error", "publish-check"].includes(payload.type)
        ) {
          child.kill();
          finish(
            new Error("Malformed source worker response; check Source status before retrying."),
          );
          return;
        }
        const message = {
          type: payload.type,
          message: "message" in payload ? payload.message : undefined,
          value: "value" in payload ? payload.value : undefined,
          paths: "paths" in payload ? payload.paths : undefined,
          code: "code" in payload ? payload.code : undefined,
        };
        if (message.type === "progress" && typeof message.message === "string") {
          // All phases get elapsed time, including Git/SQLite operations without a fixed work total.
          lastStage = message.message;
          lastUpdate = Date.now();
          deadline.refresh();
          report(lastStage);
        } else if (message.type === "result") {
          clearTimeout(deadline);
          if (!Object.hasOwn(payload, "value")) {
            child.kill();
            finish(
              new Error("Source worker omitted its result; check Source status before retrying."),
            );
            return;
          }
          try {
            response = {
              value: options.readResult ? options.readResult(message.value) : message.value,
            };
          } catch (error) {
            response = { error: error instanceof Error ? error : new Error(String(error)) };
          }
        } else if (message.type === "error") {
          clearTimeout(deadline);
          response = {
            error: Object.assign(
              new Error(
                typeof message.message === "string" ? message.message : "Source operation failed.",
              ),
              {
                code:
                  typeof message.code === "string" &&
                  [
                    "unsupported",
                    "stale",
                    "conflict",
                    "cancelled",
                    "committed-with-warning",
                    "failed",
                  ].includes(message.code)
                    ? message.code
                    : "failed",
              },
            ),
          };
        } else if (message.type === "publish-check") {
          // Only bounded path metadata crosses IPC. Native payloads remain in the worker, and absence of a coordinator denies publication.
          void Promise.resolve()
            .then(async () => {
              options.signal?.throwIfAborted();
              if (
                !options.onBeforePublish ||
                !Array.isArray(message.paths) ||
                message.paths.length > 65536 ||
                message.paths.some((item: unknown) => typeof item !== "string")
              ) {
                throw new Error("Invalid or uncoordinated asset publication check.");
              }
              let bytes = 0;
              const paths = message.paths.map((item: unknown) => {
                if (typeof item !== "string") {
                  throw new Error("Invalid asset publication path.");
                }
                bytes += Buffer.byteLength(item, "utf8");
                if (bytes > 16 * 1024 * 1024) {
                  throw new Error("Asset publication metadata exceeds its byte budget.");
                }
                return item;
              });
              await options.onBeforePublish(paths);
              options.signal?.throwIfAborted();
              return;
            })
            .then(
              () => {
                if (child.connected) {
                  child.send({ type: "publish-confirm" }, () => {});
                }
                return;
              },
              (error: unknown) => {
                if (child.connected) {
                  child.send(
                    {
                      type: "publish-confirm",
                      error: error instanceof Error ? error.message : String(error),
                    },
                    () => {},
                  );
                }
              },
            );
        }
      });
      child.on("error", (error) => finish(error));
      child.on("exit", (code, signal) => {
        this.#children.delete(child);
        if (code === 0 && response) {
          // A completed publication is reported even if cancellation raced its final IPC response.
          if ("error" in response) {
            finish(response.error);
          } else {
            finish(undefined, response.value);
          }
        } else {
          finish(
            new Error(
              `Source operation exited (${signal ?? code}). Check Source status before retrying.${stderr ? `\n${stderr}` : ""}`,
            ),
          );
        }
      });
      child.send({ type: "run", operation }, (error) => {
        if (error) {
          child.kill();
          finish(error);
        }
      });
    });
  }

  dispose(): void {
    this.#disposed = true;
    this.#slots.dispose();
    for (const child of this.#children) {
      child.kill();
    }
    this.#children.clear();
  }
}
