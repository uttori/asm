import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { StringDecoder } from "node:string_decoder";

import { canonicalJson } from "./project-store.js";
import {
  createRuntimeInstructionTraceImporter,
  createRuntimeTraceChunkValidator,
  validateRuntimeInstructionTraceMetadata,
  type RuntimeInstructionTraceChunk,
  type RuntimeInstructionTraceImportContext,
  type RuntimeInstructionTraceImportResult,
  type RuntimeInstructionTraceMetadata,
  type RuntimeTraceSource,
} from "./runtime-trace.js";

/** Default file-size budget, independent of static-analysis work. */
export const DEFAULT_RUNTIME_TRACE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_VALUE_CHARACTERS = 32 * 1024 * 1024;

/** File import limits, cancellation and incremental progress. */
export interface RuntimeTraceFileOptions {
  readonly maxBytes?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (readBytes: number, totalBytes: number) => void;
}

type TraceEntry =
  | { kind: "property"; key: string; value: unknown }
  | { kind: "chunk"; value: unknown };

/**
 * Parse the trace envelope and its chunks without materializing the chunks array.
 * @param {string} file Trace JSON path.
 * @param {RuntimeTraceFileOptions} options File budget and progress.
 * @returns {AsyncGenerator<TraceEntry>} Bounded JSON values in file order.
 * @yields {TraceEntry} One metadata field or trace chunk.
 */
async function* traceEntries(
  file: string,
  options: RuntimeTraceFileOptions,
): AsyncGenerator<TraceEntry> {
  const maxBytes = options.maxBytes ?? DEFAULT_RUNTIME_TRACE_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Trace import maximum bytes must be a positive safe integer.");
  }
  options.signal?.throwIfAborted();
  const before = await stat(file);
  const checkSize = (size: number): void => {
    if (size > maxBytes) {
      throw new Error(
        `Instruction trace is ${(size / 1024 / 1024).toFixed(1)} MiB; import limit is ${(maxBytes / 1024 / 1024).toFixed(1)} MiB. Increase asm.trace.maxImportSizeMiB in the project settings to import this capture.`,
      );
    }
  };
  checkSize(before.size);
  let mode:
    | "start"
    | "key"
    | "colon"
    | "value"
    | "property-end"
    | "chunk"
    | "chunk-end"
    | "end"
    | "token" = "start";
  let tokenKind: "key" | "property" | "chunk" = "key";
  let key = "";
  const keys = new Set<string>();
  let allowEnd = true;
  let inString = false;
  let escaped = false;
  let depth = 0;
  let primitive = false;
  let parts: string[] = [];
  let length = 0;
  const fail = (): never => {
    throw new Error(`Instruction trace '${file}' is not a valid JSON object with a chunks array.`);
  };
  const append = (text: string): void => {
    length += text.length;
    if (length > MAX_VALUE_CHARACTERS) {
      throw new Error("Instruction trace chunk or metadata value exceeds the 32 MiB text limit.");
    }
    parts.push(text);
  };
  const decoder = new StringDecoder("utf8");
  const stream = createReadStream(file, { highWaterMark: 64 * 1024 });
  let bytesRead = 0;
  try {
    for await (const bytes of stream) {
      options.signal?.throwIfAborted();
      bytesRead += (bytes as Buffer).length;
      checkSize(bytesRead);
      const text = decoder.write(bytes as Buffer);
      let tokenStart = mode === "token" ? 0 : -1;
      for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (mode === "token") {
          let done = false;
          let delimiter = false;
          if (inString) {
            if (escaped) {
              escaped = false;
            } else if (char === "\\") {
              escaped = true;
            } else if (char === '"') {
              inString = false;
              done = depth === 0;
            }
          } else if (primitive) {
            if (char === "," || char === "}" || char === "]" || /\s/.test(char)) {
              done = true;
              delimiter = true;
            }
          } else if (char === '"') {
            inString = true;
          } else if (char === "{" || char === "[") {
            depth++;
          } else if (char === "}" || char === "]") {
            depth--;
            done = depth === 0;
          }
          if (!done) {
            continue;
          }
          append(text.slice(tokenStart, delimiter ? index : index + 1));
          const value: unknown = JSON.parse(parts.join(""));
          parts = [];
          length = 0;
          tokenStart = -1;
          if (tokenKind === "key") {
            if (typeof value !== "string" || keys.has(value)) {
              fail();
            }
            key = value as string;
            keys.add(key);
            mode = "colon";
          } else if (tokenKind === "chunk") {
            mode = "chunk-end";
            yield { kind: "chunk", value };
          } else {
            mode = "property-end";
            yield { kind: "property", key, value };
          }
          if (delimiter) {
            index--;
          }
          continue;
        }
        if (char === " " || char === "\n" || char === "\r" || char === "\t") {
          continue;
        }
        if (mode === "start" && char === "{") {
          mode = "key";
          allowEnd = true;
          continue;
        }
        if (mode === "key" && char === "}" && allowEnd) {
          mode = "end";
          continue;
        }
        if (mode === "colon" && char === ":") {
          mode = "value";
          continue;
        }
        if (mode === "property-end") {
          if (char === "}") {
            mode = "end";
            continue;
          }
          if (char === ",") {
            mode = "key";
            allowEnd = false;
            continue;
          }
        }
        if (mode === "chunk-end") {
          if (char === "]") {
            mode = "property-end";
            continue;
          }
          if (char === ",") {
            mode = "chunk";
            allowEnd = false;
            continue;
          }
        }
        if (mode === "chunk" && char === "]" && allowEnd) {
          mode = "property-end";
          continue;
        }
        if (mode === "value" && key === "chunks") {
          if (char !== "[") {
            fail();
          }
          mode = "chunk";
          allowEnd = true;
          continue;
        }
        if (
          (mode !== "key" && mode !== "value" && mode !== "chunk") ||
          (mode === "key" && char !== '"') ||
          char === "]" ||
          char === "}" ||
          char === ","
        ) {
          fail();
        }
        tokenKind = "property";
        if (mode === "key") {
          tokenKind = "key";
        } else if (mode === "chunk") {
          tokenKind = "chunk";
        }
        mode = "token";
        tokenStart = index;
        inString = char === '"';
        escaped = false;
        depth = char === "{" || char === "[" ? 1 : 0;
        primitive = !inString && depth === 0;
      }
      if (tokenStart >= 0) {
        append(text.slice(tokenStart));
      }
      options.onProgress?.(bytesRead, before.size);
    }
    // The final progress callback can cancel too; no next read exists to check that signal.
    options.signal?.throwIfAborted();
    if (decoder.end() || String(mode) !== "end" || !keys.has("chunks")) {
      fail();
    }
    const after = await stat(file);
    if (
      bytesRead !== before.size ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs
    ) {
      throw new Error(
        "Instruction trace changed while it was being read; stop recording before importing.",
      );
    }
  } finally {
    stream.destroy();
  }
}

/**
 * Read identity before selecting a matching project; normal recorder headers require one block.
 * @param {string} file Trace path.
 * @param {RuntimeTraceFileOptions} options Read budget and cancellation.
 * @returns {Promise<RuntimeInstructionTraceMetadata>} Validated envelope (body checked on import).
 */
export const readRuntimeTraceFileMetadata = async (
  file: string,
  options: RuntimeTraceFileOptions = {},
): Promise<RuntimeInstructionTraceMetadata> => {
  const metadata: Record<string, unknown> = {};
  for await (const entry of traceEntries(file, options)) {
    if (entry.kind !== "property") {
      continue;
    }
    Object.defineProperty(metadata, entry.key, {
      value: entry.value,
      enumerable: true,
      configurable: true,
    });
    if (
      [
        "format",
        "schemaVersion",
        "architecture",
        "addressSpace",
        "romContentSha256",
        "producer",
      ].every((key) => Object.hasOwn(metadata, key))
    ) {
      return validateRuntimeInstructionTraceMetadata(metadata);
    }
  }
  return validateRuntimeInstructionTraceMetadata(metadata);
};

/**
 * Yield parsed chunks and check the complete JSON envelope before successful completion.
 * Consumers validate chunk contents once; this reader owns JSON syntax and envelope integrity.
 * @param {string} file Trace path.
 * @param {RuntimeInstructionTraceMetadata} metadata Expected recording identity.
 * @param {RuntimeTraceFileOptions} options Read limits and cancellation.
 * @returns {AsyncGenerator<unknown>} Parsed values in file order.
 * @yields {unknown} One unvalidated trace chunk.
 */
async function* traceFileChunks(
  file: string,
  metadata: RuntimeInstructionTraceMetadata,
  options: RuntimeTraceFileOptions = {},
): AsyncGenerator<unknown> {
  const properties: Record<string, unknown> = {};
  for await (const entry of traceEntries(file, options)) {
    if (entry.kind === "chunk") {
      yield entry.value;
    } else {
      Object.defineProperty(properties, entry.key, {
        value: entry.value,
        enumerable: true,
        configurable: true,
      });
    }
  }
  if (
    canonicalJson(validateRuntimeInstructionTraceMetadata(properties)) !== canonicalJson(metadata)
  ) {
    throw new Error("Instruction trace identity changed while importing.");
  }
}

/**
 * Read and normalize ordered chunks for callers that need standalone validated data.
 * @param {string} file Trace JSON path.
 * @param {RuntimeInstructionTraceMetadata} metadata Expected envelope identity.
 * @param {RuntimeTraceFileOptions} options Input limits, cancellation and progress.
 * @yields {RuntimeInstructionTraceChunk} One normalized chunk; the tail is checked on exhaustion.
 */
export async function* readRuntimeTraceFileChunks(
  file: string,
  metadata: RuntimeInstructionTraceMetadata,
  options: RuntimeTraceFileOptions = {},
): AsyncGenerator<RuntimeInstructionTraceChunk> {
  const validateChunk = createRuntimeTraceChunkValidator();
  for await (const chunk of traceFileChunks(file, metadata, options)) {
    yield validateChunk(chunk);
  }
}

/**
 * Open a bounded JSON source for an importer that already validates every chunk. Keeping validation
 * at the consumer avoids cloning all addresses, bytes, registers and bus accesses twice per read.
 * @param {string} file Trace JSON path.
 * @param {RuntimeTraceFileOptions} options Input limits, cancellation and progress.
 * @returns {Promise<RuntimeTraceSource>} Metadata plus a reader that checks the complete envelope.
 */
export const createRuntimeTraceFileSource = async (
  file: string,
  options: RuntimeTraceFileOptions = {},
): Promise<RuntimeTraceSource> => {
  const metadata = await readRuntimeTraceFileMetadata(file, options);
  return {
    metadata,
    read: async (accept) => {
      for await (const chunk of traceFileChunks(file, metadata, options)) {
        accept(chunk);
      }
    },
  };
};

/**
 * Import a native trace without allocating a file-sized string or retaining earlier chunks.
 * @param {string} file Trace path.
 * @param {RuntimeInstructionTraceImportContext} context Selected project identity.
 * @param {RuntimeTraceFileOptions} options Read budget and progress.
 * @returns {Promise<RuntimeInstructionTraceImportResult>} Merge-ready facts after full validation.
 */
export const importRuntimeInstructionTraceFile = async (
  file: string,
  context: RuntimeInstructionTraceImportContext,
  options: RuntimeTraceFileOptions = {},
): Promise<RuntimeInstructionTraceImportResult> => {
  const source = await createRuntimeTraceFileSource(file, options);
  const importer = createRuntimeInstructionTraceImporter(source.metadata, context);
  await source.read(importer.push);
  return importer.finish();
};
