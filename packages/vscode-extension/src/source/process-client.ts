import { fork, type ChildProcess } from "node:child_process";

import type { SourceOperation } from "@uttori/asm-cli/source";

/** Serializable request: buffers use advanced IPC serialization, while cancellation stays process-local. */
export type SourceProcessOperation = Omit<SourceOperation, "signal" | "onProgress">;

/** Isolate assembly/SQLite CPU and memory from the extension host; dispose terminates owned children. */
export class SourceProcessClient {
  readonly #children = new Set<ChildProcess>();
  #disposed = false;
  constructor(
    readonly file: string,
    readonly log: (message: string) => void = () => {},
  ) {}

  run<T = unknown>(
    operation: SourceProcessOperation,
    options: {
      readonly maxMemoryMiB: number;
      readonly signal?: AbortSignal;
      readonly onProgress?: (message: string) => void;
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
      const finish = (error?: Error, value?: T): void => {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(cancellationTimer);
        options.signal?.removeEventListener("abort", cancel);
        if (error) {
          reject(error);
        } else {
          resolve(value!);
        }
      };
      const cancel = (): void => {
        options.onProgress?.("Cancelling; the next status check will reconcile native Git state.");
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
      child.on("message", (message: { type: string; message?: string; value?: T }) => {
        if (message.type === "progress" && typeof message.message === "string") {
          // All phases get elapsed time, including Git/SQLite operations without a fixed work total.
          const progress = `[${((Date.now() - started) / 1000).toFixed(1)}s] ${message.message}`;
          this.log(progress);
          options.onProgress?.(progress);
        } else if (message.type === "result") {
          response = { value: message.value! };
        } else if (message.type === "error") {
          response = { error: new Error(message.message ?? "Source operation failed.") };
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
    for (const child of this.#children) {
      child.kill();
    }
    this.#children.clear();
  }
}
