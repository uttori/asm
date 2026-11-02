import { canonicalEquals } from "@uttori/asm-core/canonical-json";

import { verifyRuntimeCaptureCompanion } from "./capture-companion.js";
import {
  validateRuntimeBusTraceMetadata,
  type RuntimeBusTraceSource,
} from "./runtime-bus-trace.js";
import {
  DEFAULT_RUNTIME_TRACE_MAX_BYTES,
  type RuntimeTraceFileOptions,
} from "./runtime-trace-file.js";

/**
 * Decode checkpointed ACT2 bus chunks without an intermediate JSON file or instruction projection.
 * @param file Complete lossless bus archive.
 * @param options Byte budget, progress and cancellation.
 * @returns Provisional stream. Read rejects torn tails or changed identity.
 */
export const createRuntimeBusCaptureSource = async (
  file: string,
  options: RuntimeTraceFileOptions = {},
): Promise<RuntimeBusTraceSource> => {
  const { readCaptureFileHeader, recoverCaptureFile } = await import("@uttori/asm-capture");
  const limits = { ...options, maxBytes: options.maxBytes ?? DEFAULT_RUNTIME_TRACE_MAX_BYTES };
  options.signal?.throwIfAborted();
  const header = await readCaptureFileHeader(file, limits);
  if (
    header.scope !== "snes.cpu-bus" &&
    header.scope !== "snes.cpu-bus-transfers" &&
    header.scope !== "snes.cpu-bus-ppu"
  ) {
    throw new Error("Bus activity import requires a lossless CPU/DMA/HDMA bus capture.");
  }
  const metadata = validateRuntimeBusTraceMetadata({
    ...header,
    format: "uttori-asm-bus-trace",
    schemaVersion: 1,
  });
  return {
    metadata,
    read: async (accept) => {
      const result = await recoverCaptureFile(
        file,
        (chunk) => {
          if (chunk.scope === "snes.cpu-bus-transfers" || chunk.scope === "snes.cpu-bus-ppu") {
            accept({ accesses: chunk.events });
          } else if (chunk.scope === "snes.cpu-bus") {
            accept({ accesses: chunk.accesses });
          } else {
            throw new Error("Capture scope changed during bus import.");
          }
        },
        limits,
      );
      // The consumer may have indexed a valid prefix, but must publish nothing without END2.
      if (!result.complete) {
        throw new Error(`Capture archive is incomplete: ${result.reason}`);
      }
      if (!canonicalEquals(result.header, header)) {
        throw new Error("Capture archive identity changed while importing.");
      }
      await verifyRuntimeCaptureCompanion(file, result, options.signal);
    },
  };
};
