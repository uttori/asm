import { open } from "node:fs/promises";

import { createRuntimeBusCaptureSource } from "./capture-bus-source.js";
import { createRuntimeCaptureSource } from "./capture-instruction-source.js";
import type { RuntimeBusTraceSource } from "./runtime-bus-trace.js";
import type { RuntimeTraceFileOptions } from "./runtime-trace-file.js";
import type { RuntimeTraceSource } from "./runtime-trace.js";

/** The archive's validated scope selects its importer; filenames and UI menu choices are not authority. */
export type RuntimeCaptureSource =
  | { readonly kind: "instructions"; readonly source: RuntimeTraceSource }
  | { readonly kind: "bus"; readonly source: RuntimeBusTraceSource };

/** Select JSON instructions or ACT2 instruction/bus scopes. All readers still validate the complete stream. */
export async function openRuntimeCaptureSource(
  file: string,
  options: RuntimeTraceFileOptions = {},
): Promise<RuntimeCaptureSource> {
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
  } finally {
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
