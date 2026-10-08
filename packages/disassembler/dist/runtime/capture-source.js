import { open } from "node:fs/promises";
import { createRuntimeBusCaptureSource } from "./capture-bus-source.js";
import { createRuntimeCaptureSource } from "./capture-instruction-source.js";
/** Select JSON instructions or ACT2 instruction/bus scopes. All readers still validate the complete stream. */
export async function openRuntimeCaptureSource(file, options = {}) {
    options.signal?.throwIfAborted();
    const handle = await open(file, "r");
    const magic = Buffer.alloc(4);
    try {
        let offset = 0;
        while (offset < magic.length) {
            const { bytesRead } = await handle.read(magic, offset, magic.length - offset, offset);
            if (!bytesRead) {
                break;
            }
            offset += bytesRead;
        }
    }
    finally {
        await handle.close();
    }
    if (magic.toString("ascii") === "ACS2") {
        const { readCaptureFileHeader } = await import("@uttori/asm-debug-adapter");
        const header = await readCaptureFileHeader(file, options);
        if (header.scope !== "snes.65816.instructions" && header.scope !== "nes.2a03.instructions") {
            return { kind: "bus", source: await createRuntimeBusCaptureSource(file, options) };
        }
    }
    return { kind: "instructions", source: await createRuntimeCaptureSource(file, options) };
}
//# sourceMappingURL=capture-source.js.map