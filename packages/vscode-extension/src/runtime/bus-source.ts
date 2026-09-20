import type { RuntimeBusTraceSource, RuntimeTraceFileOptions } from "@uttori/asm-disassembler";

/** Decode checkpointed ACT2 bus chunks without an intermediate JSON file or instruction projection.
 * @param {string} file Complete lossless bus archive.
 * @param {RuntimeTraceFileOptions} options Byte budget, progress and cancellation.
 * @returns {Promise<RuntimeBusTraceSource>} Provisional stream. Read rejects torn tails or changed identity.
 */
export const createEditorRuntimeBusSource = async (
  file: string,
  options: RuntimeTraceFileOptions = {},
): Promise<RuntimeBusTraceSource> => {
  // Workspace packages are ESM while the extension host bundle is CommonJS.
  const { canonicalJson, DEFAULT_RUNTIME_TRACE_MAX_BYTES, validateRuntimeBusTraceMetadata } =
    await import("@uttori/asm-disassembler");
  const { readCaptureFileHeader, recoverCaptureFile } = await import("@uttori/asm-debug-adapter");
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
      if (canonicalJson(result.header) !== canonicalJson(header)) {
        throw new Error("Capture archive identity changed while importing.");
      }
    },
  };
};
