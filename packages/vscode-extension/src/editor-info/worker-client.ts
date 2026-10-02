import path from "node:path";
import { Worker } from "node:worker_threads";

import type { DebugMapInstruction, DebugMapRange } from "@uttori/asm-core/debug-map";
import type { InstructionAnalysisAnnotation } from "@uttori/asm-disassembler";

import type { EditorLocation, InformationRequirements, LineInformation } from "./format.js";
import type {
  EditorInformationHost,
  EditorInformationService,
  InformationLineRange,
} from "./provider.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDebugMapRange(value: unknown): value is DebugMapRange {
  return (
    isRecord(value) &&
    typeof value.architecture === "string" &&
    typeof value.addressSpace === "string" &&
    typeof value.start === "number" &&
    typeof value.end === "number" &&
    typeof value.sourceId === "number" &&
    typeof value.line === "number" &&
    (value.outputStart === undefined || typeof value.outputStart === "number") &&
    (value.outputEnd === undefined || typeof value.outputEnd === "number")
  );
}

function isEditorLocation(value: unknown): value is EditorLocation {
  return (
    isRecord(value) &&
    typeof value.addressSpace === "string" &&
    typeof value.address === "number" &&
    typeof value.file === "boolean" &&
    (value.executionCount === undefined || typeof value.executionCount === "number")
  );
}

function isDebugMapInstruction(value: unknown): value is DebugMapInstruction {
  return (
    isRecord(value) &&
    typeof value.sourceId === "number" &&
    typeof value.line === "number" &&
    typeof value.architecture === "string" &&
    typeof value.addressSpace === "string" &&
    typeof value.address === "number" &&
    Array.isArray(value.operands) &&
    value.operands.every(
      (operand) =>
        isRecord(operand) &&
        typeof operand.expression === "string" &&
        typeof operand.value === "number",
    ) &&
    (value.size === undefined || typeof value.size === "number") &&
    (value.outputOffset === undefined || typeof value.outputOffset === "number")
  );
}

function isAnnotation(value: unknown): value is InstructionAnalysisAnnotation {
  return isRecord(value) && typeof value.id === "string";
}

function isLineInformation(value: unknown): value is LineInformation {
  return (
    isRecord(value) &&
    typeof value.identity === "string" &&
    typeof value.label === "string" &&
    Array.isArray(value.ranges) &&
    value.ranges.every(isDebugMapRange) &&
    Array.isArray(value.locations) &&
    value.locations.every(isEditorLocation) &&
    Array.isArray(value.instructions) &&
    value.instructions.every(isDebugMapInstruction) &&
    (value.bytes === undefined ||
      (Array.isArray(value.bytes) && value.bytes.every((byte) => typeof byte === "number"))) &&
    (value.outputSize === undefined || typeof value.outputSize === "number") &&
    (value.annotations === undefined ||
      (Array.isArray(value.annotations) && value.annotations.every(isAnnotation))) &&
    (value.limited === undefined || typeof value.limited === "boolean")
  );
}

function isLineMap(value: unknown): value is ReadonlyMap<number, readonly LineInformation[]> {
  if (!(value instanceof Map)) {
    return false;
  }
  for (const [key, lines] of value) {
    if (typeof key !== "number" || !Array.isArray(lines) || !lines.every(isLineInformation)) {
      return false;
    }
  }
  return true;
}

function isHostRequestArgs(
  args: readonly unknown[],
): args is [
  string,
  "annotationSummary" | "annotations",
  { readonly ranges: readonly DebugMapRange[] },
] {
  if (args.length !== 3 || typeof args[0] !== "string") {
    return false;
  }
  if (args[1] !== "annotationSummary" && args[1] !== "annotations") {
    return false;
  }
  return (
    isRecord(args[2]) && Array.isArray(args[2].ranges) && args[2].ranges.every(isDebugMapRange)
  );
}

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
          for (const trackedFile of message.tracked) {
            this.#tracked.add(trackedFile);
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
        if (!message.args || !isHostRequestArgs(message.args)) {
          throw new Error("Invalid source information host request.");
        }
        const [directory, operation, options] = message.args;
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
  #send(method: string, args: unknown[]): Promise<unknown> {
    if (this.#failure) {
      return Promise.reject(this.#failure);
    }
    const id = ++this.#sequence;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
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
  async diagnostics(file: string, dirty: ReadonlySet<string>): Promise<readonly string[]> {
    const value = await this.#send("diagnostics", [file, dirty]);
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
      throw new Error("Invalid source information diagnostics.");
    }
    return value;
  }
  async lines(
    file: string,
    visible: readonly InformationLineRange[],
    requirements: InformationRequirements,
    dirty: ReadonlySet<string>,
  ): Promise<ReadonlyMap<number, readonly LineInformation[]>> {
    const value = await this.#send("lines", [file, visible, requirements, dirty]);
    if (!isLineMap(value)) {
      throw new Error("Invalid source information lines.");
    }
    return value;
  }
  dispose(): void {
    this.#fail(new Error("Source information worker disposed."));
    void this.#worker.terminate();
  }
}
