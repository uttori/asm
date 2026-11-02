import { open, lstat } from "node:fs/promises";

import { canonicalEquals } from "@uttori/asm-core/canonical-json";

import { verifyRuntimeCaptureCompanion } from "./capture-companion.js";
import {
  createRuntimeTraceFileSource,
  DEFAULT_RUNTIME_TRACE_MAX_BYTES,
  type RuntimeTraceFileOptions,
} from "./runtime-trace-file.js";
import {
  validateRuntimeInstructionTraceMetadata,
  type RuntimeTraceSource,
} from "./runtime-trace.js";

/**
 * Select JSON or ACT2 by its magic bytes. ACT2 instructions pass straight from the decoder to the
 * consumer, retaining only one bounded chunk. The file is needed until this reader finishes;
 * imported project facts and provenance must remain usable after the input is removed.
 * @param file Selected capture, including older .json.act2 archives.
 * @param options Input byte budget, cancellation and progress.
 * @returns Identity plus a reader that rejects incomplete archives.
 */
export const createRuntimeCaptureSource = async (
  file: string,
  options: RuntimeTraceFileOptions = {},
): Promise<RuntimeTraceSource> => {
  options.signal?.throwIfAborted();
  const handle = await open(file, "r");
  const magic = Buffer.alloc(4);
  try {
    // Even a small read may be short. A partially read magic must not misclassify a valid ACT2 file.
    let offset = 0;
    while (offset < magic.length) {
      const { bytesRead } = await handle.read(magic, offset, magic.length - offset, offset);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }
  } finally {
    await handle.close();
  }
  if (magic.toString("ascii") !== "ACS2") {
    if (options.recoverPartial) {
      throw new Error("Partial recovery requires an ACT2 instruction archive.");
    }
    return createRuntimeTraceFileSource(file, options);
  }
  const { readCaptureFileHeader, recoverCaptureFile } = await import("@uttori/asm-capture");
  const limits = { ...options, maxBytes: options.maxBytes ?? DEFAULT_RUNTIME_TRACE_MAX_BYTES };
  const header = await readCaptureFileHeader(file, limits);
  if (header.scope !== "snes.65816.instructions" && header.scope !== "nes.2a03.instructions") {
    throw new Error(
      "This ACT2 file contains CPU/DMA/HDMA bus accesses. Instruction import requires an instruction capture.",
    );
  }
  const metadata = validateRuntimeInstructionTraceMetadata({
    ...header,
    format: "uttori-asm-instruction-trace",
    schemaVersion: 1,
  });
  let recovery: RuntimeTraceSource["recovery"];
  return {
    metadata,
    verifyRetained: async () => {
      await verifyRuntimeCaptureCompanion(file, { header, complete: true }, options.signal);
    },
    get recovery() {
      return recovery;
    },
    read: async (accept) => {
      recovery = undefined;
      const before = await lstat(file, { bigint: true });
      if (!before.isFile() || before.isSymbolicLink()) {
        throw new Error("Capture must be a regular file.");
      }
      const result = await recoverCaptureFile(
        file,
        (chunk) => {
          // Recheck during consumption in case the path was replaced after reading its header.
          if (
            chunk.scope !== "snes.65816.instructions" &&
            chunk.scope !== "nes.2a03.instructions"
          ) {
            throw new Error("Capture scope changed during instruction import.");
          }
          // Project sequence numbers are safe JS integers even though ACT2 stores exact u64s.
          // Reject before narrowing. Never silently round an otherwise valid archive position.
          if (BigInt(chunk.through) >= BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new Error("Trace sequence exceeds the project index's safe integer range.");
          }
          accept({
            sequenceStart: Number(chunk.first),
            addresses: chunk.instructions.map((instruction) => instruction.address),
            details: chunk.instructions.map((instruction) => instruction.detail),
            droppedEvents: 0,
            // Match legacy JSON normalization. Publication still requires a validated terminal
            // or, with explicit recovery, a validated checkpointed prefix.
            active: false,
          });
        },
        limits,
      );
      const after = await lstat(file, { bigint: true });
      if (
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs ||
        before.ctimeNs !== after.ctimeNs
      ) {
        throw new Error("Capture archive changed while importing.");
      }
      if (
        !result.complete &&
        (!options.recoverPartial ||
          result.reasonCode !== "truncated" ||
          result.eventThrough === "0")
      ) {
        throw new Error(`Capture archive is incomplete: ${result.reason}`);
      }
      if (!canonicalEquals(result.header, header)) {
        throw new Error("Capture archive identity changed while importing.");
      }
      if (result.complete) {
        await verifyRuntimeCaptureCompanion(file, result, options.signal);
      } else {
        // Recovery accepts only ACK-backed chunks from an unchanged file. An unfinished companion
        // has no verified end boundary and must never be presented as complete scene context.
        recovery = {
          chunkThrough: result.chunkThrough,
          eventThrough: result.eventThrough,
          reason: result.reason!,
        };
      }
    },
  };
};
