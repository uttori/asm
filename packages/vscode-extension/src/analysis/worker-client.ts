import { fork, type ChildProcess } from "node:child_process";
import * as path from "node:path";

import type { AnalysisWorkerOperation, AnalysisWorkerRequest } from "./worker.js";

/**
 * Queued worker request and its promise callbacks; the execution timer starts only after
 * dispatch.
 */
interface PendingProjection {
  readonly message: AnalysisWorkerRequest;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Resource limits and optional process isolation for projection requests.
 * Heap limits default to 4096 MiB and must be safe integers of at least 128; timeouts default to
 * 60 seconds.
 */
export interface AnalysisWorkerOptions {
  /** Lifecycle messages contain operation names and paths, never projected evidence payloads. */
  readonly log?: (level: "debug" | "error", message: string) => void;
  /** Evaluated per request so selecting a source worktree changes external evidence query context. */
  readonly sourceRoot?: () => string | undefined;
  readonly maxMemoryMiB?: (directory: string) => number;
  readonly timeoutMs?: number;
  /** Separate manifests, viewport previews, and bulk views so one timeout cannot cancel unrelated work. */
  readonly isolateAnnotations?: boolean;
}

/**
 * Manifest operations routed to a dedicated worker when isolation is enabled, keeping
 * them out of bulk-view queues.
 */
const interactiveOperations = new Set([
  // ROM matching precedes overlays and must not queue behind bulk views.
  "manifest",
]);
/**
 * Read-only editor/DAP annotation requests routed separately from manifests and bulk views when
 * isolation is enabled.
 */
const previewOperations = new Set(["annotations", "annotationSummary", "debugAnnotations"]);

/** Shared projection process: fatal heap errors cannot terminate the extension host. */
export class AnalysisWorkerClient {
  /** Lazily allocated manifest queries remain responsive while bulk views are loading. */
  #manifests?: AnalysisWorkerClient;
  /** Viewport requests must never hold up project identity queries. */
  #previews?: AnalysisWorkerClient;
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

  request(
    directory: string,
    operation: AnalysisWorkerOperation,
    options: Pick<
      AnalysisWorkerRequest,
      "offset" | "ranges" | "sourceId" | "navigationTarget" | "evidenceSelection" | "evidenceRecord"
    > = {},
  ): Promise<unknown> {
    if (this.options.isolateAnnotations && interactiveOperations.has(operation)) {
      this.#manifests ??= new AnalysisWorkerClient(this.workerFile, {
        ...this.options,
        isolateAnnotations: false,
      });
      return this.#manifests.request(directory, operation, options);
    }
    if (this.options.isolateAnnotations && previewOperations.has(operation)) {
      this.#previews ??= new AnalysisWorkerClient(this.workerFile, {
        ...this.options,
        isolateAnnotations: false,
      });
      return this.#previews.request(directory, operation, options);
    }
    const sourceRoot = this.options.sourceRoot?.();
    const key = JSON.stringify({ directory, operation, sourceRoot, ...options });
    const previous = this.#inflight.get(key);
    if (previous) {
      return previous;
    }
    const id = ++this.#nextId;
    const promise = new Promise<unknown>((resolve, reject) => {
      this.#queue.push({
        message: { id, directory, operation, sourceRoot, ...options },
        resolve,
        reject,
      });
    });
    this.#inflight.set(key, promise);
    const forget = (): void => {
      if (this.#inflight.get(key) === promise) {
        this.#inflight.delete(key);
      }
    };
    void promise.then(forget, (error: unknown) => {
      forget();
      if (operation !== "clear") {
        this.options.log?.("error", `Analysis ${operation} (${directory}): ${String(error)}`);
      }
    });
    this.#dispatch();
    return promise;
  }

  #dispatch(): void {
    if (this.#active) {
      return;
    }
    const pending = this.#queue.shift();
    if (!pending) {
      return;
    }
    this.#active = pending;
    try {
      if (pending.message.operation !== "clear") {
        this.options.log?.(
          "debug",
          `Analysis ${pending.message.operation}: ${pending.message.directory}`,
        );
      }
      const maxMemoryMiB =
        pending.message.operation === "clear"
          ? this.#memoryMiB
          : (this.options.maxMemoryMiB?.(pending.message.directory) ?? 4096);
      if (!Number.isSafeInteger(maxMemoryMiB) || maxMemoryMiB < 128) {
        throw new Error("asm.analysis.maxMemoryMiB must be a safe integer of at least 128.");
      }
      if (this.#worker && this.#memoryMiB !== maxMemoryMiB) {
        const previous = this.#worker;
        this.#worker = undefined;
        previous.kill();
      }
      if (!this.#worker) {
        this.#start(maxMemoryMiB);
      }
      // Queueing behind another view does not consume this operation's execution budget.
      const timeoutMs = this.options.timeoutMs ?? 60_000;
      pending.timer = setTimeout(
        () =>
          this.#fail(
            new Error(
              `Analysis ${pending.message.operation} process exceeded ${timeoutMs / 1000} seconds. Memory budget: ${maxMemoryMiB} MiB (asm.analysis.maxMemoryMiB). Retry the query after checking its resource limits.`,
            ),
          ),
        timeoutMs,
      );
      this.#worker!.send(pending.message, (error) => {
        if (error && this.#active === pending) {
          this.#fail(error);
        }
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
        if (this.#worker !== worker || pending?.message.id !== message.id) {
          return;
        }
        clearTimeout(pending.timer);
        this.#active = undefined;
        if (message.error) {
          const error = new Error(message.error);
          if (message.stack) {
            error.stack = message.stack;
          }
          pending.reject(error);
        } else {
          pending.resolve(message.value);
        }
        this.#dispatch();
      },
    );
    worker.on("error", (error) => {
      if (this.#worker === worker) {
        this.#fail(error);
      }
    });
    worker.on("exit", (code, signal) => {
      if (this.#worker === worker) {
        this.#fail(
          new Error(
            `Analysis ${this.#active?.message.operation ?? "view"} process exited (${signal ?? code}). Memory budget: ${maxMemoryMiB} MiB (asm.analysis.maxMemoryMiB). Expand the view to retry.${stderr ? `\n${stderr}` : ""}`,
          ),
        );
      }
    });
  }

  invalidate(): void {
    this.#manifests?.invalidate();
    this.#previews?.invalidate();
    this.#inflight.clear();
    if (this.#worker) {
      void this.request("", "clear").catch(() => undefined);
    }
  }
  dispose(): void {
    this.#manifests?.dispose();
    this.#previews?.dispose();
    this.#fail(new Error("Analysis worker disposed."));
  }
  #fail(error: Error): void {
    const worker = this.#worker;
    this.#worker = undefined;
    if (worker) {
      worker.kill();
    }
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

/**
 * Extension-host singleton initialized during activation; its owner registers disposal with the
 * extension context.
 */
let client: AnalysisWorkerClient | undefined;
/**
 * Create the shared worker client on first use, enabling separate edit and preview processes.
 * Later calls reuse it and ignore new options; the activation owner must dispose the returned
 * client.
 * @param {string} extensionRoot Installed extension directory containing the bundled worker.
 * @param {AnalysisWorkerOptions} [options] First-initialization resource settings; later calls reuse the singleton.
 * @returns {AnalysisWorkerClient} Shared client whose lifecycle belongs to the activation owner.
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.subscriptions
 */
export const initializeAnalysisWorker = (
  extensionRoot: string,
  options?: AnalysisWorkerOptions,
): AnalysisWorkerClient =>
  (client ??= new AnalysisWorkerClient(path.join(extensionRoot, "out", "analysis-worker.cjs"), {
    ...options,
    isolateAnnotations: true,
  }));
/**
 * Return the initialized shared projection client; throw if activation has not created it yet.
 * @returns {AnalysisWorkerClient} Shared client; throws before initialization.
 */
export const analysisWorker = (): AnalysisWorkerClient => {
  if (!client) {
    throw new Error("Analysis worker has not been initialized.");
  }
  return client;
};
