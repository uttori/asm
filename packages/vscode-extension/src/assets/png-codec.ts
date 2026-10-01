import { Worker } from "node:worker_threads";

import type { IndexedImage } from "@uttori/asm-assets/image";

/** Bounded per-request workers avoid keeping decoded image copies alive after an editor closes. */
export class PngCodec {
  readonly #workers = new Set<Worker>();
  #disposed = false;
  constructor(readonly workerFile: string) {}

  private run<T>(bytes: Uint8Array, indexes?: Uint8Array): Promise<T> {
    if (this.#disposed) {
      return Promise.reject(new Error("PNG editor closed."));
    }
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.workerFile, {
        workerData: { bytes, indexes },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
      this.#workers.add(worker);
      const timer = setTimeout(() => {
        reject(new Error("PNG conversion exceeded 15 seconds."));
        void worker.terminate();
      }, 15000);
      worker.once("message", (message: { value?: T; error?: string }) => {
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.value!);
        }
        void worker.terminate();
      });
      worker.once("error", reject);
      worker.once("exit", () => {
        clearTimeout(timer);
        this.#workers.delete(worker);
        reject(new Error("PNG conversion worker exited before returning a result."));
      });
    });
  }
  decode(bytes: Uint8Array): Promise<IndexedImage> {
    return this.run(bytes);
  }
  encode(bytes: Uint8Array, indexes: Uint8Array): Promise<Uint8Array> {
    return this.run(bytes, indexes);
  }
  dispose(): void {
    this.#disposed = true;
    for (const worker of this.#workers) {
      void worker.terminate();
    }
  }
}
