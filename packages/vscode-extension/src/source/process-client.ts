import { fork, type ChildProcess } from "node:child_process";

import type { AssetOperation } from "@uttori/asm-cli/asset-interchange";
import type { AssetSourceOperation } from "@uttori/asm-cli/asset-source";
import type { SourceOperation } from "@uttori/asm-cli/source";

/** Serializable request: buffers use advanced IPC serialization, while cancellation stays process-local. */
export type SourceProcessOperation =
  | Omit<SourceOperation, "signal" | "onProgress">
  | AssetOperation
  | AssetSourceOperation;

/** Isolate assembly/SQLite CPU and memory from the extension host; dispose terminates owned children. */
export class SourceProcessClient {
  readonly #children = new Set<ChildProcess>();
  #disposed = false;
  constructor(
    readonly file: string,
    readonly log: (message: string) => void = () => {},
  ) {}

  /**
   * Own one child and its status timer until exit. Quiet phases retain their last reported stage.
   * Cancellation may race a durable commit; an orderly completed result remains authoritative.
   */
  run<T = unknown>(
    operation: SourceProcessOperation,
    options: {
      readonly maxMemoryMiB: number;
      readonly signal?: AbortSignal;
      readonly onProgress?: (message: string) => void;
      /** Live source/editor version check; returning rejects or acknowledges the worker's final publication gate. */
      readonly onBeforePublish?: (paths: readonly string[]) => void | Promise<void>;
    },
  ): Promise<T> {
    options.signal?.throwIfAborted();
    if (this.#disposed) {
      return Promise.reject(new Error("Source worker has been disposed."));
    }
    if (!Number.isSafeInteger(options.maxMemoryMiB) || options.maxMemoryMiB < 128) {
      return Promise.reject(new Error("Source worker heap budget must be at least 128 MiB."));
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
      const child = fork(this.file, [], {
        execArgv: [`--max-old-space-size=${options.maxMemoryMiB}`],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        serialization: "advanced",
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      this.#children.add(child);
      let response: { value: T } | { error: Error } | undefined;
      let finished = false;
      let stderr = "";
      let cancellationTimer: NodeJS.Timeout | undefined;
      const report = (message: string): void => {
        const progress = `[${((Date.now() - started) / 1000).toFixed(1)}s] ${message}`;
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
      const finish = (error?: Error, value?: T): void => {
        if (finished) {
          return;
        }
        finished = true;
        clearInterval(heartbeat);
        clearTimeout(cancellationTimer);
        options.signal?.removeEventListener("abort", cancel);
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        if (error) {
          this.log(`${label}: failed after ${seconds}s. Last stage: ${lastStage} ${error.message}`);
          reject(error);
        } else {
          this.log(`${label}: completed in ${seconds}s. Last stage: ${lastStage}`);
          resolve(value!);
        }
      };
      const cancel = (): void => {
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
      options.signal?.addEventListener("abort", cancel, { once: true });
      child.stderr?.on("data", (bytes: Buffer) => {
        stderr = (stderr + bytes.toString()).slice(-8192);
        this.log(bytes.toString());
      });
      child.on(
        "message",
        (message: { type: string; message?: string; value?: T; paths?: unknown }) => {
          if (message.type === "progress" && typeof message.message === "string") {
            // All phases get elapsed time, including Git/SQLite operations without a fixed work total.
            lastStage = message.message;
            lastUpdate = Date.now();
            report(lastStage);
          } else if (message.type === "result") {
            response = { value: message.value! };
          } else if (message.type === "error") {
            response = { error: new Error(message.message ?? "Source operation failed.") };
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
        },
      );
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
    for (const child of this.#children) {
      child.kill();
    }
    this.#children.clear();
  }
}
