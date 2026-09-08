import * as path from "node:path";
import { Worker } from "node:worker_threads";
import type { AnalysisWorkerRequest } from "./analysis-worker.js";

/** Shared, bounded worker client. Errors/timeouts reject requests instead of blocking VS Code. */
export class AnalysisWorkerClient {
  #worker?: Worker;
  #nextId = 0;
  readonly #pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  readonly #inflight = new Map<string, Promise<unknown>>();
  constructor(readonly workerFile: string) {}

  request<T>(
    directory: string,
    operation: AnalysisWorkerRequest["operation"],
    options: Pick<AnalysisWorkerRequest, "offset" | "ranges"> = {},
  ): Promise<T> {
    const key = JSON.stringify({ directory, operation, ...options });
    const previous = this.#inflight.get(key);
    if (previous) return previous as Promise<T>;
    if (!this.#worker) {
      const worker = new Worker(this.workerFile, {
        execArgv: [],
        resourceLimits: { maxOldGenerationSizeMb: 1536 },
      });
      this.#worker = worker;
      worker.on("message", (message: { id: number; value?: unknown; error?: string }) => {
        const pending = this.#pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.#pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error));
        else pending.resolve(message.value);
      });
      worker.on("error", (error) => {
        if (this.#worker === worker)
          this.#fail(error instanceof Error ? error : new Error(String(error)));
      });
      worker.on("exit", (code) => {
        if (this.#worker === worker)
          this.#fail(new Error(`Analysis worker exited (${code}). Expand the view to retry.`));
      });
    }
    const id = ++this.#nextId;
    const promise = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          this.#fail(
            new Error("Analysis worker exceeded 60 seconds. No project files were changed."),
          ),
        60_000,
      );
      this.#pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      this.#worker!.postMessage({ id, directory, operation, ...options });
    });
    this.#inflight.set(key, promise);
    const forget = (): void => {
      if (this.#inflight.get(key) === promise) this.#inflight.delete(key);
    };
    void promise.then(forget, forget);
    return promise;
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
    if (worker) void worker.terminate();
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
    this.#inflight.clear();
  }
}

let client: AnalysisWorkerClient | undefined;
export const initializeAnalysisWorker = (extensionRoot: string): AnalysisWorkerClient =>
  (client ??= new AnalysisWorkerClient(path.join(extensionRoot, "out", "analysis-worker.cjs")));
export const analysisWorker = (): AnalysisWorkerClient => {
  if (!client) throw new Error("Analysis worker has not been initialized.");
  return client;
};
