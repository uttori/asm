import { fork, type ChildProcess } from "node:child_process";
import * as path from "node:path";

import type { AnalysisWorkerRequest } from "./analysis-worker.js";

interface PendingProjection {
  readonly message: AnalysisWorkerRequest;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export interface AnalysisWorkerOptions {
  readonly maxMemoryMiB?: (directory: string) => number;
  readonly timeoutMs?: number;
}

/** Shared projection process: fatal heap errors cannot terminate the extension host. */
export class AnalysisWorkerClient {
  #worker?: ChildProcess;
  #memoryMiB = 0;
  #nextId = 0;
  #active?: PendingProjection;
  readonly #queue: PendingProjection[] = [];
  readonly #inflight = new Map<string, Promise<unknown>>();
  constructor(
    readonly workerFile: string,
    readonly options: AnalysisWorkerOptions = {},
  ) {}

  request<T>(
    directory: string,
    operation: AnalysisWorkerRequest["operation"],
    options: Pick<
      AnalysisWorkerRequest,
      | "offset"
      | "ranges"
      | "annotationLookup"
      | "annotationSave"
      | "sourceId"
      | "baselineIds"
      | "sourceGroup"
      | "navigationTarget"
    > = {},
  ): Promise<T> {
    const key = JSON.stringify({ directory, operation, ...options });
    const previous = this.#inflight.get(key);
    if (previous) return previous as Promise<T>;
    const id = ++this.#nextId;
    const promise = new Promise<T>((resolve, reject) => {
      this.#queue.push({
        message: { id, directory, operation, ...options },
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
    this.#inflight.set(key, promise);
    const forget = (): void => {
      if (this.#inflight.get(key) === promise) this.#inflight.delete(key);
    };
    void promise.then(forget, forget);
    this.#dispatch();
    return promise;
  }

  #dispatch(): void {
    if (this.#active) return;
    const pending = this.#queue.shift();
    if (!pending) return;
    this.#active = pending;
    try {
      const maxMemoryMiB =
        pending.message.operation === "clear"
          ? this.#memoryMiB
          : (this.options.maxMemoryMiB?.(pending.message.directory) ?? 4096);
      if (!Number.isSafeInteger(maxMemoryMiB) || maxMemoryMiB < 128)
        throw new Error("asm.analysis.maxMemoryMiB must be a safe integer of at least 128.");
      if (this.#worker && this.#memoryMiB !== maxMemoryMiB) {
        const previous = this.#worker;
        this.#worker = undefined;
        previous.kill();
      }
      if (!this.#worker) this.#start(maxMemoryMiB);
      // Queueing behind another view does not consume this operation's execution budget.
      const timeoutMs = this.options.timeoutMs ?? 60_000;
      pending.timer = setTimeout(
        () =>
          this.#fail(
            new Error(
              `Analysis ${pending.message.operation} process exceeded ${timeoutMs / 1000} seconds. Memory budget: ${maxMemoryMiB} MiB (asm.analysis.maxMemoryMiB). Check project status before retrying an edit.`,
            ),
          ),
        timeoutMs,
      );
      this.#worker!.send(pending.message, (error) => {
        if (error && this.#active === pending) this.#fail(error);
      });
    } catch (error) {
      this.#fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  #start(maxMemoryMiB: number): void {
    const worker = fork(this.workerFile, [], {
      execArgv: [`--max-old-space-size=${maxMemoryMiB}`],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
      serialization: "advanced",
    });
    this.#worker = worker;
    this.#memoryMiB = maxMemoryMiB;
    let stderr = "";
    worker.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-8192);
    });
    worker.on(
      "message",
      (message: { id: number; value?: unknown; error?: string; stack?: string }) => {
        const pending = this.#active;
        if (this.#worker !== worker || pending?.message.id !== message.id) return;
        clearTimeout(pending.timer);
        this.#active = undefined;
        if (message.error) {
          const error = new Error(message.error);
          if (message.stack) error.stack = message.stack;
          pending.reject(error);
        } else pending.resolve(message.value);
        this.#dispatch();
      },
    );
    worker.on("error", (error) => {
      if (this.#worker === worker) this.#fail(error);
    });
    worker.on("exit", (code, signal) => {
      if (this.#worker === worker)
        this.#fail(
          new Error(
            `Analysis ${this.#active?.message.operation ?? "view"} process exited (${signal ?? code}). Memory budget: ${maxMemoryMiB} MiB (asm.analysis.maxMemoryMiB). Expand the view to retry.${stderr ? `\n${stderr}` : ""}`,
          ),
        );
    });
  }

  invalidate(): void {
    this.#inflight.clear();
    if (this.#worker) void this.request("", "clear").catch(() => undefined);
  }
  dispose(): void {
    this.#fail(new Error("Analysis worker disposed."));
  }
  #fail(error: Error): void {
    const worker = this.#worker;
    this.#worker = undefined;
    if (worker) worker.kill();
    const pendingRequests = this.#active ? [this.#active, ...this.#queue] : this.#queue;
    this.#active = undefined;
    for (const pending of pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#queue.length = 0;
    this.#inflight.clear();
  }
}

let client: AnalysisWorkerClient | undefined;
export const initializeAnalysisWorker = (
  extensionRoot: string,
  options?: AnalysisWorkerOptions,
): AnalysisWorkerClient =>
  (client ??= new AnalysisWorkerClient(
    path.join(extensionRoot, "out", "analysis-worker.cjs"),
    options,
  ));
export const analysisWorker = (): AnalysisWorkerClient => {
  if (!client) throw new Error("Analysis worker has not been initialized.");
  return client;
};
