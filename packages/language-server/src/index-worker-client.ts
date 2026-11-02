import { Worker } from "node:worker_threads";

import {
  WORKSPACE_ANALYSIS_SNAPSHOT_VERSION,
  type WorkspaceAnalysisSnapshot,
} from "@uttori/asm-core/tooling";

import type { ProjectEnvironmentSettings } from "./project-environment.js";

/** At most one analysis exists per root. Revisions cancel obsolete work before starting a successor. */
export class IndexWorkerClient {
  #revision = 0;
  #disposed = false;
  #active?: { readonly worker: Worker; readonly reject: (error: Error) => void };
  /** Create a client that launches `index-worker.mjs` unless another worker URL is supplied. */
  constructor(readonly file = new URL("./index-worker.mjs", import.meta.url)) {}

  /** Cancel the in-flight worker and bump the revision so its result is ignored. */
  invalidate(): void {
    this.#revision++;
    const active = this.#active;
    this.#active = undefined;
    if (active) {
      active.reject(new Error("Analysis revision superseded."));
      void active.worker.terminate();
    }
  }

  /**
   * Run workspace analysis in a worker. A later call supersedes any in-flight result.
   * @param settings Project environment used to configure the worker.
   * @param overlays Open-buffer text keyed by absolute path.
   */
  async analyze(
    settings: ProjectEnvironmentSettings,
    overlays: ReadonlyMap<string, string>,
  ): Promise<WorkspaceAnalysisSnapshot> {
    if (this.#disposed) {
      throw new Error("Index worker disposed.");
    }
    this.invalidate();
    const id = this.#revision;
    const worker = new Worker(this.file, {
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 4096 },
    });
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, snapshot?: WorkspaceAnalysisSnapshot): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (this.#active?.worker === worker) {
          this.#active = undefined;
        }
        void worker.terminate();
        if (error) {
          reject(error);
        } else {
          resolve(snapshot!);
        }
      };
      const timer = setTimeout(
        () => finish(new Error("Workspace indexing exceeded 120 seconds.")),
        120_000,
      );
      timer.unref();
      this.#active = { worker, reject: (error) => finish(error) };
      worker.on(
        "message",
        (
          message:
            | { id?: unknown; error?: unknown; snapshot?: WorkspaceAnalysisSnapshot }
            | null
            | undefined,
        ) => {
          if (id !== this.#revision || this.#disposed) {
            return;
          }
          if (!message || message.id !== id) {
            return finish(new Error("Invalid indexing response identity."));
          }
          if (typeof message.error === "string") {
            return finish(new Error(message.error));
          }
          const snapshot = message.snapshot;
          if (
            !snapshot ||
            // oxlint-disable-next-line typescript/no-unnecessary-condition -- Worker messages are structured-clone data validated before publication.
            snapshot.version !== WORKSPACE_ANALYSIS_SNAPSHOT_VERSION ||
            !Array.isArray(snapshot.roots) ||
            !Array.isArray(snapshot.files) ||
            !Array.isArray(snapshot.symbols) ||
            !Array.isArray(snapshot.references)
          ) {
            return finish(new Error("Invalid indexing snapshot."));
          }
          finish(undefined, snapshot);
        },
      );
      worker.on("error", (error) =>
        finish(error instanceof Error ? error : new Error(String(error))),
      );
      worker.on("exit", (code) =>
        finish(new Error(`Index worker exited before publication (${code}).`)),
      );
      try {
        worker.postMessage({ id, settings, overlays: [...overlays] });
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Stop accepting analysis and terminate any in-flight worker. */
  dispose(): void {
    this.#disposed = true;
    this.invalidate();
  }
}
