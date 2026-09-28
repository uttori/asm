import type { SourceOwner, SourceOwnershipEntry } from "@uttori/asm-disassembler";

/**
 * Internal markers survive comment wrapping and are removed before publication. Source locations
 * therefore describe the actual formatted files, including comments removed by export policy.
 */
export class SourceOwnershipBuilder {
  readonly entries: SourceOwnershipEntry[] = [];
  readonly #owners: SourceOwner[] = [];

  /**
   * Wrap an emitted fragment. Nested owners are allowed for fields within a data record.
   * @param {SourceOwner} owner Persistent entity represented by this fragment.
   * @param {readonly string[]} lines Unformatted source lines, which may contain nested markers.
   * @returns {string[]} Marked source, or an empty array when nothing was emitted.
   */
  mark(owner: SourceOwner, lines: readonly string[]): string[] {
    if (!lines.length) {
      return [];
    }
    const id = this.#owners.push(owner) - 1;
    return [`\0ownership:${id}:start\0`, ...lines, `\0ownership:${id}:end\0`];
  }

  /**
   * Finalize formatted source, recording one-based inclusive ranges without emitting markers.
   * @param {string} file Export-relative source path.
   * @param {string} source Source after comment and declaration formatting.
   * @returns {string} Marker-free source whose locations are now recorded in entries.
   */
  render(file: string, source: string): string {
    const output: string[] = [];
    const starts = new Map<number, number>();
    for (const line of source.split("\n")) {
      const marker = /^\0ownership:(\d+):(start|end)\0$/.exec(line);
      if (!marker) {
        output.push(line);
        continue;
      }
      const id = Number(marker[1]);
      if (marker[2] === "start") {
        starts.set(id, output.length + 1);
      } else {
        const startLine = starts.get(id);
        if (startLine === undefined) {
          throw new Error("Unbalanced source ownership marker.");
        }
        // Export policy may remove an entire provenance-only comment. It has no source location.
        if (startLine <= output.length) {
          this.entries.push({ ...this.#owners[id], file, startLine, endLine: output.length });
        }
        starts.delete(id);
      }
    }
    if (starts.size) {
      throw new Error("Unclosed source ownership marker.");
    }
    return output.join("\n");
  }

  /**
   * Attach known definition owners after formatting RAM, hardware, and struct declarations.
   * @param {string} file Export-relative definitions path.
   * @param {string} source Final formatted definitions.
   * @param {ReadonlyMap<string, SourceOwner>} owners Persistent owners keyed by emitted symbol spelling.
   * @returns {string} Unmodified source after recording declaration and comment ranges.
   */
  definitions(file: string, source: string, owners: ReadonlyMap<string, SourceOwner>): string {
    const lines = source.split("\n");
    let scope: string | undefined;
    let preceding = 1;
    for (const [index, line] of lines.entries()) {
      const structure = /^struct (\w+)\s/.exec(line);
      if (structure) {
        scope = structure[1];
      }
      const field = /^\s+\.(\w+):/.exec(line);
      let symbol = /^(\w+)\s*=/.exec(line)?.[1] ?? structure?.[1];
      if (field && scope) {
        symbol = `${scope}.${field[1]}`;
      }
      const owner = symbol ? owners.get(symbol) : undefined;
      if (owner) {
        this.entries.push({ ...owner, file, startLine: preceding, endLine: index + 1 });
        preceding = index + 2;
      } else if (line.trim() && !line.trimStart().startsWith(";")) {
        preceding = index + 2;
      } else if (!line.trim()) {
        preceding = index + 2;
      }
      if (/^endstruct\b/.test(line)) {
        scope = undefined;
      }
    }
    return source;
  }
}
