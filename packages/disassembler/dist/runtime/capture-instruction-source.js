import { open } from "node:fs/promises";
import { canonicalEquals } from "@uttori/asm-core/canonical-json";
import { verifyRuntimeCaptureCompanion } from "./capture-companion.js";
import { createRuntimeTraceFileSource, DEFAULT_RUNTIME_TRACE_MAX_BYTES, } from "./runtime-trace-file.js";
import { validateRuntimeInstructionTraceMetadata, } from "./runtime-trace.js";
/**
 * Select JSON or ACT2 by its magic bytes. ACT2 instructions pass straight from the decoder to the
 * consumer, retaining only one bounded chunk. The durable archive remains the replayable source.
 * @param {string} file Selected capture, including older .json.act2 archives.
 * @param {RuntimeTraceFileOptions} options Input byte budget, cancellation and progress.
 * @returns {Promise<RuntimeTraceSource>} Identity plus a reader that rejects incomplete archives.
 */
export const createRuntimeCaptureSource = async (file, options = {}) => {
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
    }
    finally {
        await handle.close();
    }
    if (magic.toString("ascii") !== "ACS2") {
        return createRuntimeTraceFileSource(file, options);
    }
    const { readCaptureFileHeader, recoverCaptureFile } = await import("@uttori/asm-debug-adapter");
    const limits = { ...options, maxBytes: options.maxBytes ?? DEFAULT_RUNTIME_TRACE_MAX_BYTES };
    const header = await readCaptureFileHeader(file, limits);
    if (header.scope !== "snes.65816.instructions") {
        throw new Error("This ACT2 file contains CPU/DMA/HDMA bus accesses. Instruction import requires an instruction capture.");
    }
    const metadata = validateRuntimeInstructionTraceMetadata({
        ...header,
        format: "uttori-asm-instruction-trace",
        schemaVersion: 1,
    });
    return {
        metadata,
        read: async (accept) => {
            const result = await recoverCaptureFile(file, (chunk) => {
                // Recheck during consumption in case the path was replaced after reading its header.
                if (chunk.scope !== "snes.65816.instructions") {
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
                    // This is the same normalization as legacy JSON export. Nothing is published until
                    // the terminal frame confirms the entire capture completed without loss.
                    active: false,
                });
            }, limits);
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
//# sourceMappingURL=capture-instruction-source.js.map