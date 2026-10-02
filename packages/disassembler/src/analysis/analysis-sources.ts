import type {
  AnalysisProjectShards,
  EvidenceRecord,
  ImportReport,
} from "../model/project-types.js";

/** One immutable imported artifact, or one producer of evidence without an artifact identity. */
export interface AnalysisEvidenceSource {
  readonly id: string;
  readonly name: string;
  readonly names: readonly string[];
  readonly kinds: readonly EvidenceRecord["source"][];
  readonly format?: string;
  readonly sha256?: string;
  /** Latest successful import time in Unix milliseconds. Absent for legacy or non-capture sources. */
  readonly lastImportedAt?: number;
  readonly evidenceIds: readonly string[];
  readonly reports: readonly ImportReport[];
}

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].toSorted();
const key = (...values: (string | number | undefined)[]): string => JSON.stringify(values);

/**
 * Join sources by immutable artifact identity, never by a display filename or import order.
 * Legacy imports can also link evidence through an exact report ID or full content hash.
 * @param {Pick<AnalysisProjectShards, "imports" | "evidence">} shards Source metadata.
 * @param {ReadonlyMap<string, number>} [importTimes] Durable capture receipt times by content hash.
 * @returns {readonly AnalysisEvidenceSource[]} Newest imports first. Undated sources and ties use name/identity order.
 */
export const buildAnalysisSourceCatalog = (
  shards: Pick<AnalysisProjectShards, "imports" | "evidence">,
  importTimes: ReadonlyMap<string, number> = new Map(),
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
    if (artifact) {
      id = key("artifact", artifact.format, artifact.sha256);
    } else if (legacy.length === 1) {
      id = reportSources.get(legacy[0].id)!;
    }
    const source =
      sources.get(id) ?? ensure(id, evidence.sourceId, artifact?.format, artifact?.sha256);
    source.kinds.add(evidence.source);
    source.evidenceIds.push(evidence.id);
  }
  return (
    [...sources.values()]
      .map((source) =>
        Object.assign(
          {},
          source,
          source.sha256 && importTimes.has(source.sha256)
            ? { lastImportedAt: importTimes.get(source.sha256) }
            : {},
          {
            names: sorted(source.names),
            name: sorted(source.names).join(" / "),
            kinds: [...source.kinds].toSorted(),
            evidenceIds: sorted(source.evidenceIds),
            reports: source.reports.toSorted((a, b) => a.id.localeCompare(b.id)),
          },
        ),
      )
      // Missing dates cannot establish recency. Keep legacy sources deterministic after dated imports.
      .toSorted(
        (a, b) =>
          (b.lastImportedAt ?? -1) - (a.lastImportedAt ?? -1) ||
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id),
      )
  );
};

/** Compact, navigable contribution. Full trace records never need to cross into an editor UI. */
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
/** Direct source attribution only. Capture subtraction is intentionally absent. */
export type AnalysisSourceGroup = "instructions" | "memory" | "contributions";

/** Exact SQL counts. Memory counts refer to persisted observations, not inferred access sites. */
export interface AnalysisSourceSummary {
  readonly source: AnalysisEvidenceSource;
  readonly instructionCount: number;
  readonly memoryCount: number;
  readonly contributionCount: number;
}
