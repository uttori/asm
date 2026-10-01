import path from "node:path";
import { Worker } from "node:worker_threads";

import type { InformationRequirements, LineInformation } from "./format.js";
import type {
  EditorInformationHost,
  EditorInformationService,
  InformationLineRange,
} from "./provider.js";

/** Keep parsing, canonical hashing and map indexes off the extension host; IPC carries only viewport facts. */
export class EditorInformationWorker implements EditorInformationService {
  readonly #worker: Worker;
  readonly #pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  readonly #tracked = new Set<string>();
  #sequence = 0;
  #failure?: Error;
  constructor(
    file: string,
    readonly host: EditorInformationHost,
  ) {
    this.#worker = new Worker(file, { resourceLimits: { maxOldGenerationSizeMb: 768 } });
    this.#worker.on(
      "message",
      (message: {
        id: number;
        type: string;
        method?: string;
        args?: unknown[];
        value?: unknown;
        error?: string;
        tracked?: string[];
      }) => {
        if (message.type === "host") {
          void this.#hostRequest(message);
          return;
        }
        if (message.type === "failure") {
          this.#fail(new Error(message.error ?? "Source information worker failed."));
          return;
        }
        if (message.tracked) {
          // Each published set replaces one completed discovery snapshot. An append-only set
          // would retain every historical build path across branch switches and rebuilds.
          this.#tracked.clear();
          for (const file of message.tracked) {
            this.#tracked.add(file);
          }
        }
        const request = this.#pending.get(message.id);
        this.#pending.delete(message.id);
        if (message.error) {
          request?.reject(new Error(message.error));
        } else {
          request?.resolve(message.value);
        }
      },
    );
    this.#worker.on("error", (error: unknown) =>
      this.#fail(error instanceof Error ? error : new Error(String(error))),
    );
    this.#worker.on("exit", (code) =>
      this.#fail(
        new Error(`Source information worker exited (${code}). Reload the window to restart it.`),
      ),
    );
  }

  /** Host callbacks are limited to small discovery metadata and existing bounded analysis queries. */
  async #hostRequest(message: { id: number; method?: string; args?: unknown[] }): Promise<void> {
    try {
      let value: unknown;
      if (message.method === "discoverMaps") {
        value = await this.host.discoverMaps();
      } else if (message.method === "projects") {
        value = await this.host.projects();
      } else if (message.method === "request") {
        const [directory, operation, options] = message.args as Parameters<
          EditorInformationHost["request"]
        >;
        value = await this.host.request(directory, operation, options);
      } else {
        throw new Error("Unknown source information host request.");
      }
      if (!this.#failure) {
        this.#worker.postMessage({ type: "hostResult", id: message.id, value });
      }
    } catch (error) {
      if (!this.#failure) {
        this.#worker.postMessage({ type: "hostResult", id: message.id, error: String(error) });
      }
    }
  }
  #fail(error: Error): void {
    this.#failure ??= error;
    for (const request of this.#pending.values()) {
      request.reject(error);
    }
    this.#pending.clear();
  }
  #send<T>(method: string, args: unknown[]): Promise<T> {
    if (this.#failure) {
      return Promise.reject(this.#failure);
    }
    const id = ++this.#sequence;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { resolve: (value) => resolve(value as T), reject });
      try {
        this.#worker.postMessage({ type: "query", id, method, args });
      } catch (error) {
        // A serialization or closed-port failure must not retain a request that can never reply.
        this.#pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
  #notify(method: string, args: unknown[] = []): void {
    if (!this.#failure) {
      try {
        this.#worker.postMessage({ type: "control", method, args });
      } catch (error) {
        // Failed invalidation makes existing facts unsafe; fail closed until the window reloads.
        this.#fail(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
  buildCompleted(map: string, root: string): void {
    this.#notify("buildCompleted", [map, root]);
  }
  configurationChanged(): void {
    this.#notify("configurationChanged");
  }
  invalidate(): void {
    this.#notify("invalidate");
  }
  tracks(file: string): boolean {
    return this.#tracked.has(path.resolve(file)) || file.endsWith(".debug.json");
  }
  diagnostics(file: string, dirty: ReadonlySet<string>): Promise<readonly string[]> {
    return this.#send("diagnostics", [file, dirty]);
  }
  lines(
    file: string,
    visible: readonly InformationLineRange[],
    requirements: InformationRequirements,
    dirty: ReadonlySet<string>,
  ): Promise<ReadonlyMap<number, readonly LineInformation[]>> {
    return this.#send("lines", [file, visible, requirements, dirty]);
  }
  dispose(): void {
    this.#fail(new Error("Source information worker disposed."));
    void this.#worker.terminate();
  }
}
