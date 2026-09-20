import type { DebugMap } from "@uttori/asm-core/debug-map";
import {
  projectSourceLabelNames,
  type AnalysisProjectShards,
  type AnalysisControlFlowNodeRecord,
} from "@uttori/asm-disassembler";

/** Stable native identity selected from a hash-checked source map or analysis record. */
export interface DisassemblyAnnotationLocation {
  readonly addressSpace: string;
  readonly address: number;
  readonly labelId?: string;
  readonly name?: string;
}

/** SQLite-backed resolution of only the current source line. Output offsets must be explicit. */
export type AnnotationNodeLookup = (range: {
  readonly addressSpace: string;
  readonly start: number;
  readonly outputStart?: number;
}) => readonly AnalysisControlFlowNodeRecord[];

/**
 * A symbol operand under the cursor. Definitions, opcodes, numeric operands and comments are excluded.
 * @param {string} text Current source text.
 * @param {number} line One-based source line.
 * @param {number} column Zero-based cursor column.
 * @returns {string | undefined} Referenced assembly symbol.
 */
export const annotationReferenceAt = (
  text: string,
  line: number,
  column: number,
): string | undefined => {
  const code = (text.split(/\r?\n/)[line - 1] ?? "").split(";")[0];
  if (/^\s*[A-Z_a-z]\w*\s*:/.test(code)) {
    return undefined;
  }
  const token = [...code.matchAll(/[A-Z_a-z]\w*/g)].find(
    (match) => match.index <= column && column <= match.index + match[0].length,
  );
  if (
    !token ||
    /[\d$]/.test(code[token.index - 1] ?? "") ||
    token.index <= code.search(/\S/) + (code.trimStart().match(/^\S+/)?.[0].length ?? 0)
  ) {
    return undefined;
  }
  return token[0];
};

/**
 * Names in the source are presentation only. Each resolves to a qualified native address.
 * @param {AnalysisProjectShards} shards Validated project metadata.
 * @returns {readonly DisassemblyAnnotationLocation[]} Distinct native label/function choices.
 */
export const namedAnnotationLocations = (
  shards: AnalysisProjectShards,
): readonly DisassemblyAnnotationLocation[] => {
  const names = projectSourceLabelNames(shards.labels);
  const locations: DisassemblyAnnotationLocation[] = shards.labels.map((label) => ({
    addressSpace: label.addressSpace,
    address: label.address,
    labelId: label.id,
    name: names.get(label.id),
  }));
  const addressed = new Set(
    locations.map((location) => `${location.addressSpace}:${location.address}`),
  );
  for (const record of shards.analysis) {
    if (record.kind !== "function" || addressed.has(`${record.addressSpace}:${record.address}`)) {
      continue;
    }
    locations.push({
      addressSpace: record.addressSpace,
      address: record.address,
      name: `Fn_${record.address.toString(16).toUpperCase().padStart(6, "0")}`,
    });
    addressed.add(`${record.addressSpace}:${record.address}`);
  }
  return locations;
};

/**
 * Resolve definitions/references or exact instruction lines. Only zero-byte generated metadata
 * may separate a label from the next mapped line. Never step over org/data/instructions.
 * The caller must verify source bytes, ROM identity, and map fingerprint first.
 * @param {DebugMap} map Current ROM-matched debug map.
 * @param {number} sourceId Source identity within the map.
 * @param {string} text Hash-checked source text.
 * @param {number} line One-based source line.
 * @param {number} column Zero-based cursor column.
 * @param {AnalysisProjectShards} shards Validated native metadata.
 * @param {ReadonlyMap<number, string>} sources Other hash-checked sources for cross-file references.
 * @param {readonly string[]} fileAddressSpaces Native spaces explicitly declared as file offsets.
 * @param {AnnotationNodeLookup} [readNodes] Optional bounded SQLite lookup, replacing a full CFG scan.
 * @returns {readonly DisassemblyAnnotationLocation[]} Exact native address choices. Empty when unresolved.
 */
export const annotationLocationsForSource = (
  map: DebugMap,
  sourceId: number,
  text: string,
  line: number,
  column: number,
  shards: AnalysisProjectShards,
  sources: ReadonlyMap<number, string> = new Map([[sourceId, text]]),
  fileAddressSpaces: readonly string[] = [],
  readNodes?: AnnotationNodeLookup,
): readonly DisassemblyAnnotationLocation[] => {
  const lines = text.split(/\r?\n/);
  const named = namedAnnotationLocations(shards);
  const reference = annotationReferenceAt(text, line, column);
  if (reference) {
    const locations: DisassemblyAnnotationLocation[] = [];
    // Resolve through the definitions in the exact built source, not today's label names, which
    // may have changed or been reused since the last export.
    for (const [id, source] of sources) {
      source.split(/\r?\n/).forEach((value, index) => {
        if (value.match(/^\s*([A-Z_a-z]\w*)\s*:/)?.[1] === reference) {
          // A generated line may map to many addresses. Preserve all matches without a variadic call.
          for (const location of annotationLocationsForSource(
            map,
            id,
            source,
            index + 1,
            0,
            shards,
            sources,
            fileAddressSpaces,
            readNodes,
          )) {
            locations.push(location);
          }
        }
      });
    }
    return locations;
  }
  let mappedLine = line;
  const metadata = (value: string): boolean => {
    const body = value.split(";")[0].trim();
    return body === "" || /^[A-Z_a-z]\w*\s*:$/.test(body) || /^\.[ai](8|16)$/.test(body);
  };
  while (mappedLine <= lines.length && metadata(lines[mappedLine - 1])) {
    mappedLine++;
  }
  const ranges = map.ranges.filter(
    (range) => range.sourceId === sourceId && range.line === mappedLine,
  );
  const locations = new Map<string, DisassemblyAnnotationLocation>();
  const definitionName = lines[line - 1]?.match(/^\s*([A-Z_a-z]\w*)\s*:/)?.[1];
  for (const range of ranges) {
    const fileLabels = named.filter(
      (entry) =>
        entry.labelId &&
        fileAddressSpaces.includes(entry.addressSpace) &&
        entry.address === range.outputStart,
    );
    const native = readNodes
      ? readNodes(range)
      : shards.analysis.filter(
          (record): record is AnalysisControlFlowNodeRecord =>
            record.kind === "cfg-node" &&
            ((record.addressSpace === range.addressSpace && record.address === range.start) ||
              (range.outputStart !== undefined && record.fileOffset === range.outputStart)),
        );
    const matches = native.length
      ? native.map((record) => ({ addressSpace: record.addressSpace, address: record.address }))
      : [{ addressSpace: range.addressSpace, address: range.start }];
    let candidates = [
      ...fileLabels,
      ...named.filter((entry) =>
        matches.some(
          (match) => entry.addressSpace === match.addressSpace && entry.address === match.address,
        ),
      ),
    ];
    const labels = candidates.filter((entry) => entry.labelId);
    if (labels.length) {
      candidates = labels;
    }
    const selectedDefinition = candidates.filter((entry) => entry.name === definitionName);
    if (selectedDefinition.length) {
      candidates = selectedDefinition;
    }
    for (const location of candidates.length ? candidates : matches) {
      locations.set(
        `${location.addressSpace}:${location.address}:${"labelId" in location ? (location.labelId ?? "") : ""}`,
        location,
      );
    }
  }
  return [...locations.values()];
};
