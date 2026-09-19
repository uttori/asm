import { fork, type ChildProcess } from "node:child_process";

import type { MaintenanceJobs, MaintenanceProgress } from "./disassembly-maintenance-jobs.js";
import { MaintenanceLog, type MaintenanceLogSink } from "./disassembly-maintenance-log.js";

export interface MaintenanceRunOptions {
  readonly maxMemoryMiB: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (value: MaintenanceProgress) => void;
}

const cancelled = (message: string): Error =>
  Object.assign(new Error(message), { name: "AbortError" });

/** Fresh processes bound each phase lifetime and isolate fatal heap errors from the editor. */
export class DisassemblyMaintenanceClient {
  readonly #children = new Set<ChildProcess>();
  #disposed = false;
  constructor(
    readonly processFile: string,
    readonly output?: MaintenanceLogSink,
  ) {}

  run<K extends keyof MaintenanceJobs>(
    operation: K,
    input: MaintenanceJobs[K]["input"],
    options: MaintenanceRunOptions,
  ): Promise<MaintenanceJobs[K]["output"]> {
    if (this.#disposed) {
      return Promise.reject(new Error("Disassembly maintenance client disposed."));
    }
    if (options.signal?.aborted) {
      return Promise.reject(cancelled("Disassembly maintenance cancelled."));
    }
    if (!Number.isSafeInteger(options.maxMemoryMiB) || options.maxMemoryMiB < 128) {
      return Promise.reject(
        new Error("asm.analysis.maxMemoryMiB must be a safe integer of at least 128."),
      );
    }
    return new Promise((resolve, reject) => {
      const child = fork(this.processFile, [], {
        execArgv: [`--max-old-space-size=${options.maxMemoryMiB}`],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      this.#children.add(child);
      const project = "target" in input ? input.target.projectDirectory : input.projectDirectory;
      const trace = "traceFile" in input ? `; capture=${input.traceFile}` : "";
      const log = this.output
        ? new MaintenanceLog(
            this.output,
            `${operation} pid=${child.pid ?? "pending"}; project=${project}${trace}; heap=${options.maxMemoryMiB} MiB`,
          )
        : undefined;
      // This timer belongs to the responsive parent. A heartbeat explicitly reports silence,
      // rather than inventing progress while the child is blocked in a synchronous statement.
      const heartbeat = log ? setInterval(() => log.tick(), 10000) : undefined;
      let settled = false;
      let response: { value: MaintenanceJobs[K]["output"] } | { error: Error } | undefined;
      let stderr = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-8192);
        log?.stderr(chunk.toString());
      });
      const finish = (error?: Error, value?: MaintenanceJobs[K]["output"]): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearInterval(heartbeat);
        options.signal?.removeEventListener("abort", cancel);
        if (!error && options.signal?.aborted) {
          error = cancelled(
            "Disassembly maintenance cancelled after finishing the current step. Check disassembly status before retrying.",
          );
        }
        log?.finish(error);
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      };
      const cancel = (): void => {
        log?.progress({
          message:
            "Cancellation requested; waiting for the current safe step. Check project status before retrying.",
        });
        // Do not kill a writer between file operations. Async phases observe this immediately;
        // synchronous phases finish, then the caller stops before starting another phase.
        options.onProgress?.({
          message: "Cancellation requested; finishing the current safe step…",
        });
        if (child.connected) {
          child.send({ type: "cancel" }, (error) => {
            if (error) {
              finish(error);
            }
          });
        }
      };
      options.signal?.addEventListener("abort", cancel, { once: true });
      child.on(
        "message",
        (message: {
          type: string;
          progress?: MaintenanceProgress;
          error?: { message: string; stack?: string; name?: string };
          value?: MaintenanceJobs[K]["output"];
        }) => {
          if (message.type === "progress" && message.progress) {
            log?.progress(message.progress);
            if (!options.signal?.aborted) {
              options.onProgress?.(message.progress);
            }
          } else if (message.type === "error") {
            const error = new Error(message.error?.message ?? "Disassembly maintenance failed.");
            if (message.error?.stack) {
              error.stack = message.error.stack;
            }
            if (message.error?.name) {
              error.name = message.error.name;
            }
            response = { error };
          } else if (message.type === "result") {
            response = { value: message.value };
          }
        },
      );
      child.on("error", (error) => finish(error));
      child.on("exit", (code, signal) => {
        this.#children.delete(child);
        if (code === 0 && response) {
          if ("error" in response) {
            finish(response.error);
          } else {
            finish(undefined, response.value);
          }
          return;
        }
        finish(
          new Error(
            `Disassembly ${operation} process exited (${signal ?? code}) before returning a result. The editor is still running. Memory budget: ${options.maxMemoryMiB} MiB (asm.analysis.maxMemoryMiB).${stderr ? `\n${stderr}` : ""}`,
          ),
        );
      });
      child.send({ type: "run", job: { operation, input } }, (error) => {
        if (error) {
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
