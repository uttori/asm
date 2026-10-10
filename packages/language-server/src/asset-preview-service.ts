import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";

import {
  assetSourceMediaType,
  resolveAssetResourceSnapshot,
  type AssetValueNode,
  type WorkspaceIndex,
} from "@uttori/asm-core";

import { assetCallContainingLine } from "./asset-language.js";
import type { AssetPreviewInput, AssetPreviewResult } from "./asset-preview-conversion.js";
import { OverlayFileProvider } from "./core.js";
import { uriToPath } from "./providers.js";

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 16;

/**
 * Limit worker previews to formats whose conversion is bundled and bounded here.
 * @param {string} id Registered format identifier from the active project environment.
 * @returns {boolean} Whether the worker has a portable preview path for this format.
 */
export function supportsPortableAssetPreview(id: string): boolean {
  return (
    id.startsWith("snes.") ||
    id === "nes.chr.2bpp" ||
    id === "uttori.data.raw" ||
    id === "som.sprite.frames" ||
    id === "som.boss.graphics" ||
    id === "som.palette.bgr555" ||
    id === "som.room" ||
    id === "som.brr.pcm" ||
    id === "som.brr.segment"
  );
}

/** Wire request identifies the exact open document revision. */
export interface AssetPreviewRequest {
  readonly uri: string;
  readonly version: number;
  readonly line: number;
}

/** A rejected preview is diagnostic text, never media from an older request. */
export type AssetPreviewResponse =
  | { readonly ok: true; readonly preview: AssetPreviewResult }
  | { readonly ok: false; readonly message: string };

/** Evaluate only literal editor options; the assembler remains authoritative for defines/expressions.
 * @param {AssetValueNode} node Parsed source option.
 * @returns {unknown} JSON-compatible literal value.
 */
function literal(node: AssetValueNode): unknown {
  if (node.kind === "string" || node.kind === "boolean") {
    return node.value;
  }
  if (node.kind === "number") {
    const raw = node.expression.trim();
    let value: number;
    if (/^\$[\da-f]+$/i.test(raw)) {
      value = Number.parseInt(raw.slice(1), 16);
    } else if (/^%[01]+$/.test(raw)) {
      value = Number.parseInt(raw.slice(1), 2);
    } else if (/^(?:\d+|0x[\da-f]+)$/i.test(raw)) {
      value = Number(raw);
    } else {
      throw new Error("Preview needs literal numeric options; Build Binary resolves expressions.");
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error("Preview numeric option is outside the safe integer range.");
    }
    return value;
  }
  if (node.kind === "array") {
    return node.items.map(literal);
  }
  return Object.fromEntries(
    Object.entries(node.entries).map(([key, value]) => [key, literal(value)]),
  );
}

/** Resolve with the same provider search order as assembly, including unsaved text resources.
 * @param {OverlayFileProvider} provider Current editor overlay and filesystem.
 * @param {string} declaringFile Assembly source path.
 * @param {readonly string[]} includePaths Ordered include search roots.
 * @param {string} name User-spelled asset path.
 * @returns {object} Resolved path, owned bytes, and media type.
 */
function readInput(
  provider: OverlayFileProvider,
  declaringFile: string,
  includePaths: readonly string[],
  name: string,
): { path: string; bytes: Uint8Array; mediaType: string } {
  const resolved = provider.resolvePath(name, {
    currentFile: declaringFile,
    includePaths: [...includePaths],
  });
  if (!resolved) {
    throw new Error(`Asset '${name}' is missing.`);
  }
  const size = provider.stat(resolved).size ?? 0;
  if (size > MAX_INPUT_BYTES) {
    throw new Error(`Asset '${name}' is ${size} bytes; preview limit is ${MAX_INPUT_BYTES}.`);
  }
  const bytes = provider.readFile(resolved);
  if (bytes.length > MAX_INPUT_BYTES) {
    throw new Error(`Asset '${name}' exceeds the preview input limit.`);
  }
  return { path: resolved, bytes, mediaType: assetSourceMediaType(resolved) };
}

/** Run conversion in a disposable worker so hover never blocks the server event loop.
 * @param {AssetPreviewInput} input Resolved conversion request.
 * @param {AbortSignal} [signal] Cancellation signal.
 * @returns {Promise<AssetPreviewResult>} Generated preview media.
 */
function inWorker(input: AssetPreviewInput, signal?: AbortSignal): Promise<AssetPreviewResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./asset-preview-worker.mjs", import.meta.url));
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("Asset preview exceeded the five-second limit."));
    }, 5000);
    const cleanup = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", aborted);
      void worker.terminate();
    };
    const aborted = (): void => {
      cleanup();
      reject(new Error("Asset preview cancelled."));
    };
    signal?.addEventListener("abort", aborted, { once: true });
    worker.once("message", (message: { result?: AssetPreviewResult; error?: string }) => {
      cleanup();
      if (message.error || !message.result) {
        reject(new Error(message.error ?? "Asset preview worker returned no result."));
      } else {
        resolve(message.result);
      }
    });
    worker.once("error", (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
    worker.postMessage({ id: 1, input });
    if (signal?.aborted) {
      aborted();
    }
  });
}

/** Bounded content-keyed preview cache owned by one language-server process. */
export class AssetPreviewService {
  readonly #cache = new Map<string, AssetPreviewResult>();

  /** Preview one current call. The caller rechecks document version after awaiting this method.
   * @param {WorkspaceIndex} index Active environment and include paths.
   * @param {string} text Current open source text.
   * @param {AssetPreviewRequest} request Position and document version.
   * @param {AbortSignal} [signal] Request cancellation.
   * @returns {Promise<AssetPreviewResponse>} Current preview or explanatory error.
   */
  async preview(
    index: WorkspaceIndex,
    text: string,
    request: AssetPreviewRequest,
    signal?: AbortSignal,
  ): Promise<AssetPreviewResponse> {
    try {
      const call = assetCallContainingLine(text, request.line);
      if (!call) {
        return { ok: false, message: "No complete includeAsset call on this line." };
      }
      const format = index.environment.getAssetFormat(call.format.value, index.target);
      if (!format) {
        return { ok: false, message: `Asset format '${call.format.value}' is unavailable.` };
      }
      // An unknown plugin format stays build-only until it has a bounded worker path.
      if (!supportsPortableAssetPreview(format.id)) {
        return { ok: false, message: `Preview is unavailable for '${format.id}'.` };
      }
      const file = uriToPath(request.uri);
      const provider = new OverlayFileProvider(index.overlay);
      const includePaths = index.deriveIncludePaths(file);
      const source = readInput(provider, file, includePaths, call.path.value);
      const allOptions = Object.fromEntries(
        Object.entries(call.options).map(([name, node]) => [name, literal(node)]),
      );
      const output = allOptions.output;
      delete allOptions.output;
      delete allOptions.maxSize;
      delete allOptions.compress;
      delete allOptions.compressOptions;
      if (output !== undefined && typeof output !== "string") {
        throw new Error("Asset preview output must be a string.");
      }
      const resourceSnapshots = new Map<string, Uint8Array>([[source.path, source.bytes]]);
      let total = source.bytes.length;
      source.mediaType = assetSourceMediaType(source.path, format);
      const { resources } = resolveAssetResourceSnapshot(format, source, allOptions, {
        resolve: (name, declaringResource) =>
          provider.resolvePath(
            name,
            declaringResource
              ? { currentFile: declaringResource }
              : { currentFile: file, includePaths: [...includePaths] },
          ),
        read: (resolved) => {
          const cached = resourceSnapshots.get(resolved);
          if (cached) {
            return cached;
          }
          const resource = readInput(provider, file, includePaths, resolved);
          total += resource.bytes.length;
          if (total > MAX_TOTAL_BYTES) {
            throw new Error(`Asset preview inputs exceed ${MAX_TOTAL_BYTES} bytes combined.`);
          }
          resourceSnapshots.set(resolved, resource.bytes);
          return resource.bytes;
        },
        mediaType: (resolved) => assetSourceMediaType(resolved, format),
      });
      const input: AssetPreviewInput = {
        source: { bytes: source.bytes, mediaType: source.mediaType },
        resources,
        format: format.id,
        options: allOptions,
        output,
      };
      const observedInputs = [...resourceSnapshots].map(([path, bytes]) => ({ path, bytes }));
      const hash = createHash("sha256");
      hash
        .update(format.id)
        .update(format.version)
        .update(JSON.stringify(allOptions))
        .update(output ?? "");
      hash.update(source.bytes);
      for (const [name, resource] of Object.entries(resources).toSorted(([a], [b]) =>
        a.localeCompare(b),
      )) {
        hash.update(name).update(resource.bytes);
      }
      const key = hash.digest("hex");
      const cached = this.#cache.get(key);
      if (cached) {
        this.#cache.delete(key);
        this.#cache.set(key, cached);
        return { ok: true, preview: cached };
      }
      const result = await inWorker(input, signal);
      if (signal?.aborted) {
        return { ok: false, message: "Asset preview cancelled." };
      }
      // A resource edit during conversion invalidates the snapshot even if its watcher event
      // reaches this process after the worker response.
      for (const observed of observedInputs) {
        let current: Uint8Array;
        try {
          current = provider.readFile(observed.path);
        } catch {
          return { ok: false, message: "Asset input disappeared during preview." };
        }
        if (
          current.length !== observed.bytes.length ||
          !current.every((value, offset) => value === observed.bytes[offset])
        ) {
          return { ok: false, message: "Asset input changed during preview." };
        }
      }
      this.#cache.set(key, result);
      if (this.#cache.size > MAX_CACHE_ENTRIES) {
        this.#cache.delete(this.#cache.keys().next().value!);
      }
      return { ok: true, preview: result };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Discard cached previews when plugin registrations or workspace settings change. */
  clear(): void {
    this.#cache.clear();
  }
}
