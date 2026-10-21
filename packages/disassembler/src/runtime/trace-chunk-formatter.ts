import { TraceCache } from "../internal/trace-cache.js";
import type { RuntimeInstructionTraceChunk } from "./runtime-trace.js";

/** Historical canonical trace text at its four-space envelope indentation. Input must already
 * belong to createRuntimeTraceChunkValidator: every nested object's keys are canonical and no
 * producer-owned values may change during formatting. No fields or observations are omitted.
 */
export class TraceChunkFormatter {
  /** Repeated instruction snapshots reuse their indented text; large arbitrary JSON bypasses it. */
  readonly #details = new TraceCache<string>();

  /** Format one bounded validated chunk without recursively copying its register objects again. */
  format(chunk: RuntimeInstructionTraceChunk): string {
    const fields = [
      `      "active": ${chunk.active}`,
      this.#array(
        "addresses",
        chunk.addresses.map((address) => `        ${address}`),
      ),
    ];
    if (chunk.details !== undefined) {
      const details = chunk.details.map((detail) => {
        // Compact stringify uses V8's native fast path. Only a working-set miss needs the slower
        // indented form, and only short key/value pairs enter the bounded 4,096-entry cache.
        const key = JSON.stringify(detail);
        const cacheable = key.length <= 1024;
        let text = cacheable ? this.#details.get(key) : undefined;
        if (text === undefined) {
          text = `        ${JSON.stringify(detail, undefined, 2).replaceAll("\n", "\n        ")}`;
          if (cacheable && text.length <= 2048) {
            this.#details.insert(key, text);
          }
        }
        return text;
      });
      fields.push(this.#array("details", details));
    }
    fields.push(
      `      "droppedEvents": ${chunk.droppedEvents}`,
      `      "sequenceStart": ${chunk.sequenceStart}`,
    );
    if (chunk.unattributedMemoryAccesses !== undefined) {
      fields.push(`      "unattributedMemoryAccesses": ${chunk.unattributedMemoryAccesses}`);
    }
    return `    {\n${fields.join(",\n")}\n    }`;
  }

  /** Preserve JSON's compact empty arrays and canonical multiline nonempty arrays. */
  #array(name: string, entries: readonly string[]): string {
    if (!entries.length) {
      return `      "${name}": []`;
    }
    return `      "${name}": [\n${entries.join(",\n")}\n      ]`;
  }
}
