import type {
  AnalysisControlFlowNodeRecord,
  AnalysisFunctionRecord,
  AnalysisProjectManifest,
  AnalysisProjectShards,
  EvidenceRecord,
  ImportReport,
} from "./project-types.js";
import { HalfOpenIntervalIndex } from "./interval-index.js";
import { projectSourceLabelNames } from "./project-labels.js";

/** One immutable imported artifact, or one producer of evidence without an artifact identity. */
export interface AnalysisEvidenceSource {
  readonly id: string;
  readonly name: string;
  readonly names: readonly string[];
  readonly kinds: readonly EvidenceRecord["source"][];
  readonly format?: string;
  readonly sha256?: string;
  readonly evidenceIds: readonly string[];
  readonly reports: readonly ImportReport[];
}

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();
const key = (...values: (string | number | undefined)[]): string => JSON.stringify(values);
const addressKey = (space: string, address: number): string => key(space, address);
const hex = (address: number): string => `$${address.toString(16).toUpperCase().padStart(6, "0")}`;

/**
 * Join sources by immutable artifact identity, never by a display filename or import order.
 * Legacy imports can also link evidence through an exact report ID or full content hash.
 * @param {Pick<AnalysisProjectShards, "imports" | "evidence">} shards Source metadata.
 * @returns {readonly AnalysisEvidenceSource[]} Stable source catalog, including sources without runtime coverage.
 */
export const buildAnalysisSourceCatalog = (
  shards: Pick<AnalysisProjectShards, "imports" | "evidence">,
): readonly AnalysisEvidenceSource[] => {
  const sources = new Map<
    string,
    {
      id: string;
      names: Set<string>;
      kinds: Set<EvidenceRecord["source"]>;
      format?: string;
      sha256?: string;
      evidenceIds: string[];
      reports: ImportReport[];
    }
  >();
  const ensure = (id: string, name: string, format?: string, sha256?: string) => {
    let source = sources.get(id);
    if (!source) {
      source = {
        id,
        names: new Set(),
        kinds: new Set(),
        format,
        sha256,
        evidenceIds: [],
        reports: [],
      };
      sources.set(id, source);
    }
    source.names.add(name);
    return source;
  };
  const reportSources = new Map<string, string>();
  for (const report of shards.imports) {
    const id = key("artifact", report.format, report.sourceSha256);
    ensure(id, report.sourceName, report.format, report.sourceSha256).reports.push(report);
    reportSources.set(report.id, id);
  }
  for (const evidence of shards.evidence) {
    const artifact = evidence.artifact;
    const legacy = !artifact
      ? shards.imports.filter(
          (report) => report.id === evidence.id || report.sourceSha256 === evidence.sourceId,
        )
      : [];
    let id = key("producer", evidence.source, evidence.sourceId);
    if (artifact) id = key("artifact", artifact.format, artifact.sha256);
    else if (legacy.length === 1) id = reportSources.get(legacy[0].id)!;
    const source =
      sources.get(id) ?? ensure(id, evidence.sourceId, artifact?.format, artifact?.sha256);
    source.kinds.add(evidence.source);
    source.evidenceIds.push(evidence.id);
  }
  return [...sources.values()]
    .map((source) => ({
      ...source,
      names: sorted(source.names),
      name: sorted(source.names).join(" / "),
      kinds: [...source.kinds].sort(),
      evidenceIds: sorted(source.evidenceIds),
      reports: source.reports.sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
};

/** Compact, navigable contribution; full trace records never need to cross into an editor UI. */
export interface AnalysisSourceEntry {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly detail: string;
  readonly addressSpace?: string;
  readonly address?: number;
  readonly architecture?: string;
  readonly outputOffsets: readonly number[];
  readonly recordIds: readonly string[];
}
export type AnalysisSourceGroup =
  | "uniqueInstructions"
  | "codeRanges"
  | "functions"
  | "sharedInstructions"
  | "memory"
  | "contributions";
export interface AnalysisSourceComparison {
  readonly source: AnalysisEvidenceSource;
  readonly baseline: readonly AnalysisEvidenceSource[];
  readonly instructionCount: number;
  readonly uniqueInstructionCount: number;
  readonly sharedInstructionCount: number;
  readonly knownCodeBytes: number;
  readonly unknownSizeInstructions: number;
  readonly functionCount: number;
  readonly unownedInstructions: number;
  readonly ambiguousInstructions: number;
  readonly uniqueMemoryCount: number;
  readonly contributionCount: number;
  readonly codeRangeCount: number;
  readonly notes: readonly string[];
}
interface Observation {
  readonly sources: Set<string>;
  /** Byte extents directly observed by each source; zero means PC-only. */
  readonly sizes: Map<string, number>;
  readonly architecture: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly bytes: Map<string, readonly number[]>;
  readonly mixedBytes: Set<string>;
}
interface MemorySite {
  readonly sources: Set<string>;
  readonly entry: AnalysisSourceEntry;
}
interface SourceCodeRange {
  architecture: string;
  addressSpace: string;
  start: number;
  end: number;
}
interface ComparisonData {
  summary: AnalysisSourceComparison;
  unique: Observation[];
  shared: Observation[];
  ranges: SourceCodeRange[];
  functions: AnalysisSourceEntry[];
  memory: AnalysisSourceEntry[];
}

/** Read-only index over direct runtime observations and attributed metadata. */
export class AnalysisSourceIndex {
  readonly sources: readonly AnalysisEvidenceSource[];
  readonly #sourceById: Map<string, AnalysisEvidenceSource>;
  readonly #owners = new Map<string, readonly string[]>();
  readonly #observations = new Map<string, Observation>();
  readonly #coverage = new Map<
    string,
    HalfOpenIntervalIndex<{ start: number; end: number; sources: readonly string[] }>
  >();
  readonly #memory = new Map<string, MemorySite>();
  readonly #nodes = new Map<string, AnalysisControlFlowNodeRecord>();
  readonly #nodesAt = new Map<string, AnalysisControlFlowNodeRecord[]>();
  readonly #functionsAt = new Map<string, AnalysisFunctionRecord[]>();
  readonly #labelsAt = new Map<string, string[]>();
  readonly #contributions = new Map<string, AnalysisSourceEntry[]>();
  readonly #sourceInstructions = new Map<string, Observation[]>();
  readonly #runtimeSources = new Set<string>();
  readonly #comparisons = new Map<string, ComparisonData>();
  readonly #manifest: AnalysisProjectManifest;

  constructor(manifest: AnalysisProjectManifest, shards: AnalysisProjectShards) {
    this.#manifest = manifest;
    this.sources = buildAnalysisSourceCatalog(shards);
    this.#sourceById = new Map(this.sources.map((source) => [source.id, source]));
    const sourceOfEvidence = new Map(
      this.sources.flatMap((source) => source.evidenceIds.map((id) => [id, source.id] as const)),
    );
    const sourceSets = new Map<string, readonly string[]>();
    const sourceIds = (evidence: readonly string[]): readonly string[] => {
      const token = JSON.stringify(evidence);
      let ids = sourceSets.get(token);
      if (!ids) {
        ids = sorted(
          evidence.flatMap((id) => (sourceOfEvidence.has(id) ? [sourceOfEvidence.get(id)!] : [])),
        );
        sourceSets.set(token, ids);
      }
      return ids;
    };
    for (const node of shards.analysis) {
      if (node.kind === "cfg-node") {
        this.#nodes.set(node.id, node);
        const location = addressKey(node.addressSpace, node.address);
        const nodes = this.#nodesAt.get(location) ?? [];
        nodes.push(node);
        this.#nodesAt.set(location, nodes);
      } else if (node.kind === "function") {
        const location = addressKey(node.addressSpace, node.address);
        const functions = this.#functionsAt.get(location) ?? [];
        functions.push(node);
        this.#functionsAt.set(location, functions);
      }
    }
    const names = projectSourceLabelNames(shards.labels);
    for (const label of shards.labels) {
      const location = addressKey(label.addressSpace, label.address);
      this.#labelsAt.set(location, [
        ...(this.#labelsAt.get(location) ?? []),
        names.get(label.id) ?? label.name,
      ]);
    }
    const coverage = new Map<
      string,
      { start: number; end: number; sources: readonly string[] }[]
    >();
    // CFG evidence is intentionally NOT execution evidence: static traversal propagates a seed's provenance.
    for (const record of shards.runtime) {
      const ids = sourceIds(record.evidence);
      for (const id of ids) this.#runtimeSources.add(id);
      if (record.kind === "runtime-execution" || record.kind === "runtime-instruction") {
        const location = key(record.architecture, record.addressSpace, record.address);
        let observation = this.#observations.get(location);
        if (!observation) {
          observation = {
            architecture: record.architecture,
            addressSpace: record.addressSpace,
            address: record.address,
            sources: new Set(),
            sizes: new Map(),
            bytes: new Map(),
            mixedBytes: new Set(),
          };
          this.#observations.set(location, observation);
        }
        for (const id of ids) {
          observation.sources.add(id);
          const size =
            record.kind === "runtime-instruction" ? record.bytes.length : (record.size ?? 0);
          observation.sizes.set(id, Math.max(size, observation.sizes.get(id) ?? 0));
        }
        if (record.kind === "runtime-instruction")
          for (const id of ids) {
            const prior = observation.bytes.get(id);
            if (!prior) observation.bytes.set(id, record.bytes);
            else if (prior.join(",") !== record.bytes.join(",")) observation.mixedBytes.add(id);
          }
      } else if (record.kind === "runtime-coverage" && record.coverage === "executed") {
        const location = key(record.architecture, record.addressSpace);
        const list = coverage.get(location) ?? [];
        list.push({ start: record.start, end: record.end, sources: ids });
        coverage.set(location, list);
      } else if (record.kind === "runtime-memory-access") {
        // Values and register states vary constantly. Compare access sites, not per-event values.
        const identity = key(
          record.architecture,
          record.instructionAddressSpace,
          record.instructionAddress,
          record.accessedAddressSpace,
          record.accessedAddress,
          record.access,
          record.width,
          record.actor,
          record.channel,
        );
        let site = this.#memory.get(identity);
        if (!site) {
          const description = `${record.access} ${record.accessedAddressSpace} ${hex(record.accessedAddress)} · ${record.width} byte(s) · ${record.actor ?? "unknown actor"}${record.channel === undefined ? "" : ` ${record.channel}`}`;
          site = {
            sources: new Set(),
            entry: {
              id: identity,
              label: hex(record.instructionAddress),
              description,
              detail: description,
              addressSpace: record.instructionAddressSpace,
              address: record.instructionAddress,
              architecture: record.architecture,
              outputOffsets: [],
              recordIds: [],
            },
          };
          this.#memory.set(identity, site);
        }
        for (const id of ids) site.sources.add(id);
      }
    }
    for (const [id, ranges] of coverage) this.#coverage.set(id, new HalfOpenIntervalIndex(ranges));
    for (const observation of this.#observations.values())
      for (const id of observation.sources) {
        const list = this.#sourceInstructions.get(id) ?? [];
        list.push(observation);
        this.#sourceInstructions.set(id, list);
      }
    for (const list of this.#sourceInstructions.values()) list.sort(compareLocations);
    const addContribution = (
      record: { id: string; evidence: readonly string[] },
      entry: AnalysisSourceEntry,
    ): void => {
      for (const id of sourceIds(record.evidence)) {
        const list = this.#contributions.get(id) ?? [];
        list.push(entry);
        this.#contributions.set(id, list);
      }
    };
    for (const record of shards.labels)
      addContribution(record, {
        id: record.id,
        label: names.get(record.id) ?? record.name,
        description: `Label · ${record.addressSpace} ${hex(record.address)}`,
        detail: [record.comment, record.inlineComment].filter(Boolean).join("\n"),
        addressSpace: record.addressSpace,
        address: record.address,
        outputOffsets: [],
        recordIds: [record.id],
      });
    for (const record of shards.comments)
      addContribution(record, {
        id: record.id,
        label: record.text.split(/\r?\n/)[0],
        description: `Comment · ${record.addressSpace} ${hex(record.address)}`,
        detail: record.text,
        addressSpace: record.addressSpace,
        address: record.address,
        outputOffsets: [],
        recordIds: [record.id],
      });
    for (const record of shards.annotations)
      addContribution(record, {
        id: record.id,
        label: `${hex(record.start)}–${hex(record.end - 1)}`,
        description: `${record.classification} · ${record.addressSpace} · ${record.end - record.start} bytes`,
        detail: `Classified interval from ${hex(record.start)} through ${hex(record.end - 1)}. This is attributed metadata, not proof of execution in this capture.`,
        addressSpace: record.addressSpace,
        address: record.start,
        architecture: record.architecture,
        outputOffsets: [],
        recordIds: [record.id],
      });
  }

  /**
   * Sources with recorded runtime facts; static/imported classifications are not capture baselines.
   * @returns {readonly AnalysisEvidenceSource[]} Sources contributing direct runtime facts.
   */
  runtimeSources(): readonly AnalysisEvidenceSource[] {
    return this.sources.filter((source) => this.#runtimeSources.has(source.id));
  }

  /**
   * Compare direct observations against all other captures or an explicit baseline selection.
   * @param {string} sourceId Selected catalog identity.
   * @param {readonly string[]} [baselineIds] Explicit baseline identities; undefined means all other runtime sources.
   * @returns {AnalysisSourceComparison} Compact counts and interpretation notes.
   */
  compare(sourceId: string, baselineIds?: readonly string[]): AnalysisSourceComparison {
    return this.#comparison(sourceId, baselineIds).summary;
  }

  /**
   * Materialize only a bounded page for an editor tree.
   * @param {string} sourceId Selected source identity.
   * @param {AnalysisSourceGroup} group Contribution group.
   * @param {number} offset Zero-based page start.
   * @param {readonly string[]} [baselineIds] Optional comparison captures.
   * @returns {readonly AnalysisSourceEntry[]} Up to 200 navigable entries.
   */
  page(
    sourceId: string,
    group: AnalysisSourceGroup,
    offset = 0,
    baselineIds?: readonly string[],
  ): readonly AnalysisSourceEntry[] {
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid source page offset.");
    const data = this.#comparison(sourceId, baselineIds);
    const slice = <T>(entries: readonly T[]): T[] => entries.slice(offset, offset + 200);
    switch (group) {
      case "uniqueInstructions":
        return slice(data.unique).map((entry) => this.#instructionEntry(entry, sourceId));
      case "sharedInstructions":
        return slice(data.shared).map((entry) => this.#instructionEntry(entry, sourceId));
      case "codeRanges":
        return slice(data.ranges).map((range) => ({
          id: key(range.architecture, range.addressSpace, range.start),
          label: `${hex(range.start)}–${hex(range.end - 1)}`,
          description: `${range.end - range.start} bytes · ${range.addressSpace}`,
          detail:
            "Known code extent at instruction addresses absent from the selected comparison captures. Addresses remain qualified by architecture and address space; this is not a ROM-file byte total.",
          addressSpace: range.addressSpace,
          address: range.start,
          architecture: range.architecture,
          outputOffsets: [],
          recordIds: [],
        }));
      case "functions":
        return slice(data.functions);
      case "memory":
        return slice(data.memory);
      case "contributions":
        return slice(this.#contributions.get(sourceId) ?? []);
      default:
        throw new Error("Unknown source contribution group.");
    }
  }

  #matchingNodes(observation: Observation): readonly AnalysisControlFlowNodeRecord[] {
    return (
      this.#nodesAt.get(addressKey(observation.addressSpace, observation.address)) ?? []
    ).filter(
      (node) =>
        node.specificationId === observation.architecture ||
        node.specificationId.startsWith(`${observation.architecture}.`),
    );
  }
  #size(observation: Observation, sourceId: string): { size: number; inferred: boolean } {
    const captured = observation.sizes.get(sourceId) ?? 0;
    if (captured) return { size: captured, inferred: false };
    const sizes = new Set(this.#matchingNodes(observation).map(({ size }) => size));
    return sizes.size === 1
      ? { size: [...sizes][0], inferred: true }
      : { size: 0, inferred: false };
  }
  #instructionEntry(observation: Observation, sourceId: string): AnalysisSourceEntry {
    const nodes = this.#matchingNodes(observation);
    const { size, inferred } = this.#size(observation, sourceId);
    const labels = this.#labelsAt.get(addressKey(observation.addressSpace, observation.address));
    const mnemonic = sorted(nodes.map(({ mnemonic }) => mnemonic)).join(" / ");
    const bytes = observation.bytes.get(sourceId);
    const name = labels?.length ? labels.join(" / ") : mnemonic;
    return {
      id: key(observation.architecture, observation.addressSpace, observation.address),
      label: `${hex(observation.address)}${name ? ` ${name}` : ""}`,
      description: `${observation.addressSpace} · ${size ? `${size} byte(s)${inferred ? " (analysis)" : ""}` : "size unknown"}`,
      detail: [
        `${observation.architecture} · ${observation.addressSpace} ${hex(observation.address)}`,
        `Observed in: ${sorted(observation.sources)
          .map((id) => this.#sourceById.get(id)?.name ?? id)
          .join(", ")}`,
        bytes
          ? `Captured bytes${observation.mixedBytes.has(sourceId) ? " (one of multiple variants)" : ""}: ${bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ")}`
          : "No execution-time bytes were saved.",
        inferred
          ? "Byte extent uses the single agreed instruction size in the current analysis."
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      addressSpace: observation.addressSpace,
      address: observation.address,
      architecture: observation.architecture,
      outputOffsets: [
        ...new Set(
          nodes.flatMap((node) => (node.fileOffset === undefined ? [] : [node.fileOffset])),
        ),
      ],
      recordIds: nodes.slice(0, 32).map(({ id }) => id),
    };
  }
  #ownerIds(node: AnalysisControlFlowNodeRecord): readonly string[] {
    const cached = this.#owners.get(node.id);
    if (cached) return cached;
    const path = node.evidencePath.length ? node.evidencePath : [node.id];
    for (let index = path.length - 1; index >= 0; index--) {
      const parent = this.#nodes.get(path[index]);
      if (!parent) continue;
      const owners = this.#functionsAt.get(addressKey(parent.addressSpace, parent.address));
      if (owners?.length) {
        const ids = sorted(owners.map(({ id }) => id));
        this.#owners.set(node.id, ids);
        return ids;
      }
    }
    this.#owners.set(node.id, []);
    return [];
  }
  #comparison(sourceId: string, baselineIds?: readonly string[]): ComparisonData {
    const source = this.#sourceById.get(sourceId);
    if (!source)
      throw new Error("This source no longer exists. Refresh Sources and select it again.");
    const ids = sorted(baselineIds ?? [...this.#runtimeSources].filter((id) => id !== sourceId));
    if (ids.some((id) => id === sourceId || !this.#sourceById.has(id)))
      throw new Error("Invalid source comparison selection.");
    const token = key(sourceId, JSON.stringify(ids));
    const cached = this.#comparisons.get(token);
    if (cached) return cached;
    const baseline = new Set(ids);
    const observations = this.#sourceInstructions.get(sourceId) ?? [];
    const unique: Observation[] = [],
      shared: Observation[] = [];
    for (const observation of observations) {
      const aggregate =
        this.#coverage
          .get(key(observation.architecture, observation.addressSpace))
          ?.at(observation.address) ?? [];
      const present =
        ids.some((id) => observation.sources.has(id)) ||
        aggregate.some((range) => range.sources.some((id) => baseline.has(id)));
      (present ? shared : unique).push(observation);
    }
    const ranges: SourceCodeRange[] = [];
    const functions = new Map<
      string,
      { fn: AnalysisFunctionRecord; count: number; architecture: string }
    >();
    const functionById = new Map([...this.#functionsAt.values()].flat().map((fn) => [fn.id, fn]));
    let unknownSizeInstructions = 0,
      unownedInstructions = 0,
      ambiguousInstructions = 0,
      inferred = 0;
    for (const observation of unique) {
      const size = this.#size(observation, sourceId);
      if (size.inferred) inferred++;
      const maximum = this.#manifest.addressSpaces.find(
        ({ id }) => id === observation.addressSpace,
      );
      let limit = maximum ? 2 ** maximum.addressBits : 0;
      if (maximum?.kind === "file") limit = this.#manifest.rom.contentSize;
      if (size.size && observation.address + size.size <= limit) {
        const prior = ranges.at(-1);
        if (
          prior &&
          prior.architecture === observation.architecture &&
          prior.addressSpace === observation.addressSpace &&
          prior.end >= observation.address
        )
          prior.end = Math.max(prior.end, observation.address + size.size);
        else
          ranges.push({
            architecture: observation.architecture,
            addressSpace: observation.addressSpace,
            start: observation.address,
            end: observation.address + size.size,
          });
      } else unknownSizeInstructions++;
      const nodes = this.#matchingNodes(observation);
      const owners = sorted(nodes.flatMap((node) => this.#ownerIds(node)));
      if (!owners.length) unownedInstructions++;
      else if (owners.length !== 1 || nodes.some((node) => !this.#ownerIds(node).length))
        ambiguousInstructions++;
      else {
        const fn = functionById.get(owners[0])!;
        const prior = functions.get(fn.id);
        functions.set(fn.id, {
          fn,
          count: (prior?.count ?? 0) + 1,
          architecture: observation.architecture,
        });
      }
    }
    const functionEntries = [...functions.values()]
      .sort(
        (a, b) =>
          b.count - a.count || a.fn.address - b.fn.address || a.fn.id.localeCompare(b.fn.id),
      )
      .map(({ fn, count, architecture }): AnalysisSourceEntry => ({
        id: fn.id,
        label:
          this.#labelsAt.get(addressKey(fn.addressSpace, fn.address))?.join(" / ") ??
          `Fn_${fn.address.toString(16).toUpperCase().padStart(6, "0")}`,
        description: `${count} unique instruction(s) · ${hex(fn.address)}`,
        detail:
          "Contains instruction addresses observed only in the selected source relative to the chosen baseline. Other parts of this function may be shared.",
        addressSpace: fn.addressSpace,
        address: fn.address,
        architecture,
        outputOffsets: [],
        recordIds: [fn.id],
      }));
    const memory = [...this.#memory.values()]
      .filter(
        (site) => site.sources.has(sourceId) && ![...site.sources].some((id) => baseline.has(id)),
      )
      .map(({ entry }) => entry)
      .sort((a, b) => a.address! - b.address! || a.id.localeCompare(b.id));
    const summary: AnalysisSourceComparison = {
      source,
      baseline: ids.map((id) => this.#sourceById.get(id)!),
      instructionCount: observations.length,
      uniqueInstructionCount: unique.length,
      sharedInstructionCount: shared.length,
      knownCodeBytes: ranges.reduce((sum, range) => sum + range.end - range.start, 0),
      unknownSizeInstructions,
      functionCount: functionEntries.length,
      unownedInstructions,
      ambiguousInstructions,
      uniqueMemoryCount: memory.length,
      contributionCount: this.#contributions.get(sourceId)?.length ?? 0,
      codeRangeCount: ranges.length,
      notes: [
        "Unique means an instruction start was recorded here and absent from execution observations/coverage in the selected comparison captures. It does not prove behavior-exclusive logic.",
        "Code byte totals merge known extents at unique instruction starts within each architecture/address space. They are not a delta of ROM file bytes or byte values; mirrored addresses stay separate.",
        "Static analysis and imported byte classifications do not count as captured execution. Labels, comments and classifications below show attribution, not exclusivity.",
        ...(inferred
          ? [
              `${inferred} unique instruction(s) use an agreed analysis size because their capture saved only PCs.`,
            ]
          : []),
        ...(unknownSizeInstructions
          ? [
              `${unknownSizeInstructions} unique instruction(s) have an unknown or unprojectable size and are excluded from the byte total.`,
            ]
          : []),
        ...(!ids.length
          ? ["No comparison captures selected; all observed instruction addresses are shown."]
          : []),
        ...[source, ...ids.map((id) => this.#sourceById.get(id)!)].flatMap((entry) =>
          entry.reports.flatMap((report) => [
            ...report.warnings.map((warning) => `${entry.name}: ${warning}`),
            ...report.unsupported.map(
              (loss) => `${entry.name}: ${loss.count} ${loss.field} omitted. ${loss.reason}`,
            ),
          ]),
        ),
      ],
    };
    const data = { summary, unique, shared, ranges, functions: functionEntries, memory };
    // Retain only a few active comparisons; no per-source copies of the full project.
    if (this.#comparisons.size >= 4)
      this.#comparisons.delete(this.#comparisons.keys().next().value!);
    this.#comparisons.set(token, data);
    return data;
  }
}

const compareLocations = (a: Observation, b: Observation): number =>
  a.architecture.localeCompare(b.architecture) ||
  a.addressSpace.localeCompare(b.addressSpace) ||
  a.address - b.address;
