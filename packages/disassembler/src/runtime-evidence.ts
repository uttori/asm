import { canonicalJson } from "./project-store.js";
import {
  type AnalysisProjectShards,
  type AnalysisRecord,
  type EvidenceRecord,
  type ImportReport,
  type IntervalAnnotation,
  type ProjectComment,
  type ProjectLabel,
  type ProjectRegion,
  type RuntimeEvidenceRecord,
  type RuntimeStateValue,
} from "./project-types.js";

/** Shard records produced by one offline runtime-evidence import. */
export interface RuntimeEvidenceBatch {
  readonly analysis?: readonly AnalysisRecord[];
  readonly annotations?: readonly IntervalAnnotation[];
  readonly labels?: readonly ProjectLabel[];
  readonly comments?: readonly ProjectComment[];
  readonly regions?: readonly ProjectRegion[];
  readonly runtime?: readonly RuntimeEvidenceRecord[];
  readonly evidence?: readonly EvidenceRecord[];
  readonly imports?: readonly ImportReport[];
}

/** One differing value observed at the same runtime fact location. */
export interface RuntimeConflictValue {
  readonly value: RuntimeStateValue;
  readonly records: readonly string[];
  readonly evidence: readonly string[];
}

/** Deterministic, non-destructive report of mutually different observations. */
export interface RuntimeEvidenceConflict {
  readonly id: string;
  readonly kind: "cpu-state" | "instruction-size" | "opcode";
  readonly architecture: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly field: string;
  readonly values: readonly RuntimeConflictValue[];
}

/** Human-readable link between imported evidence and a derived project fact. */
export interface RuntimeEvidenceExplanation {
  readonly recordId: string;
  readonly detail: string;
  readonly evidence: readonly string[];
}

/** Result of an idempotent merge. The original project object is not mutated. */
export interface RuntimeEvidenceMergeResult {
  readonly shards: AnalysisProjectShards;
  readonly changed: boolean;
  readonly added: Readonly<Record<keyof AnalysisProjectShards, number>>;
  readonly updated: Readonly<Record<keyof AnalysisProjectShards, number>>;
  readonly existing: Readonly<Record<keyof AnalysisProjectShards, number>>;
  /** Computed and cached on first access. May expand millions of per-register observations. */
  readonly conflicts: readonly RuntimeEvidenceConflict[];
  /** Computed and cached on first access. Maintenance callers can merge without building this report. */
  readonly explanations: readonly RuntimeEvidenceExplanation[];
}

const emptyCounts = (): Record<keyof AnalysisProjectShards, number> => ({
  analysis: 0,
  annotations: 0,
  labels: 0,
  comments: 0,
  regions: 0,
  runtime: 0,
  evidence: 0,
  imports: 0,
});

const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const stateValueKey = (value: RuntimeStateValue): string => `${typeof value}:${String(value)}`;

interface ConflictObservation {
  readonly architecture: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly field: string;
  readonly value: RuntimeStateValue;
  readonly record: string;
  readonly evidence: readonly string[];
}

const conflictReport = (
  runtime: readonly RuntimeEvidenceRecord[],
): readonly RuntimeEvidenceConflict[] => {
  const observations: ConflictObservation[] = [];
  for (const record of runtime) {
    if (record.kind === "runtime-cpu-state") {
      for (const [field, value] of Object.entries(record.state)) {
        observations.push({
          architecture: record.architecture,
          addressSpace: record.addressSpace,
          address: record.address,
          field,
          value,
          record: record.id,
          evidence: record.evidence,
        });
      }
    } else if (record.kind === "runtime-execution") {
      if (record.size !== undefined) {
        observations.push({
          architecture: record.architecture,
          addressSpace: record.addressSpace,
          address: record.address,
          field: "instruction-size",
          value: record.size,
          record: record.id,
          evidence: record.evidence,
        });
      }
      if (record.opcode !== undefined) {
        observations.push({
          architecture: record.architecture,
          addressSpace: record.addressSpace,
          address: record.address,
          field: "opcode",
          value: record.opcode,
          record: record.id,
          evidence: record.evidence,
        });
      }
    }
  }

  const groups = new Map<string, ConflictObservation[]>();
  for (const observation of observations) {
    const key = [
      observation.architecture,
      observation.addressSpace,
      observation.address,
      observation.field,
    ].join(":");
    const group = groups.get(key);
    if (group) {
      group.push(observation);
    } else {
      groups.set(key, [observation]);
    }
  }

  const conflicts: RuntimeEvidenceConflict[] = [];
  for (const [key, group] of groups) {
    const byValue = new Map<string, ConflictObservation[]>();
    for (const observation of group) {
      const valueKey = stateValueKey(observation.value);
      const entries = byValue.get(valueKey);
      if (entries) {
        entries.push(observation);
      } else {
        byValue.set(valueKey, [observation]);
      }
    }
    if (byValue.size < 2) {
      continue;
    }
    const first = group[0];
    conflicts.push({
      id: `runtime-conflict:${key}`,
      kind:
        first.field === "instruction-size" || first.field === "opcode" ? first.field : "cpu-state",
      architecture: first.architecture,
      addressSpace: first.addressSpace,
      address: first.address,
      field: first.field,
      values: [...byValue.values()]
        .map((entries) => ({
          value: entries[0].value,
          records: sortedUnique(entries.map((entry) => entry.record)),
          evidence: sortedUnique(entries.flatMap((entry) => entry.evidence)),
        }))
        .sort((left, right) => stateValueKey(left.value).localeCompare(stateValueKey(right.value))),
    });
  }
  return conflicts.sort((left, right) => left.id.localeCompare(right.id));
};

const explanationReport = (
  shards: AnalysisProjectShards,
): readonly RuntimeEvidenceExplanation[] => {
  const runtimeEvidence = new Set(
    shards.evidence.filter((record) => record.source === "runtime").map((record) => record.id),
  );
  const explanations: RuntimeEvidenceExplanation[] = [];
  for (const annotation of shards.annotations) {
    const evidence = annotation.evidence.filter((id) => runtimeEvidence.has(id));
    if (evidence.length === 0) {
      continue;
    }
    const stateFields = Object.keys(annotation.state ?? {}).sort();
    explanations.push({
      recordId: annotation.id,
      detail:
        stateFields.length > 0
          ? `Runtime observation supplies ${stateFields.join(", ")} state.`
          : `Runtime observation classifies bytes as ${annotation.classification}.`,
      evidence: sortedUnique(evidence),
    });
  }
  for (const record of shards.analysis) {
    if (record.kind !== "target-override") {
      continue;
    }
    const evidence = record.evidence.filter((id) => runtimeEvidence.has(id));
    if (evidence.length === 0) {
      continue;
    }
    explanations.push({
      recordId: record.id,
      detail: `Runtime observation resolves control flow to ${record.targets
        .map((target) => `$${target.toString(16).toUpperCase().padStart(6, "0")}`)
        .join(", ")}.`,
      evidence: sortedUnique(evidence),
    });
  }
  return explanations.sort((left, right) => left.recordId.localeCompare(right.recordId));
};

const mergeRecords = <T extends { readonly id: string }>(
  kind: keyof AnalysisProjectShards,
  prior: readonly T[],
  incoming: readonly T[],
  added: Record<keyof AnalysisProjectShards, number>,
  updated: Record<keyof AnalysisProjectShards, number>,
  existing: Record<keyof AnalysisProjectShards, number>,
): readonly T[] => {
  const records = new Map(prior.map((record) => [record.id, record]));
  for (const record of incoming) {
    const current = records.get(record.id);
    if (!current) {
      records.set(record.id, record);
      added[kind]++;
    } else if (canonicalJson(current) === canonicalJson(record)) {
      existing[kind]++;
    } else if (
      kind === "analysis" &&
      "kind" in current &&
      "kind" in record &&
      current.kind === "target-override" &&
      record.kind === "target-override" &&
      current.id.startsWith("runtime:target-override:")
    ) {
      const left = current as unknown as AnalysisRecord & { readonly kind: "target-override" };
      const right = record as unknown as AnalysisRecord & { readonly kind: "target-override" };
      if (left.addressSpace !== right.addressSpace || left.address !== right.address) {
        throw new Error(`Runtime target override '${record.id}' changed its control-flow site.`);
      }
      const merged = {
        ...left,
        targets: [...new Set([...left.targets, ...right.targets])].sort((a, b) => a - b),
        evidence: sortedUnique([...left.evidence, ...right.evidence]),
      } as unknown as T;
      if (canonicalJson(current) === canonicalJson(merged)) {
        existing[kind]++;
      } else {
        records.set(record.id, merged);
        updated[kind]++;
      }
    } else {
      throw new Error(
        `Runtime evidence id '${record.id}' in '${kind}' changed content. Use a content-derived id.`,
      );
    }
  }
  return [...records.values()];
};

/**
 * Merges an offline evidence batch by stable id. Existing claims are never removed or rewritten.
 * Reimporting an identical batch returns `changed: false`. Differing observations remain separate
 * and are surfaced through `conflicts`. Diagnostic getters are lazy. Reading or serializing
 * them can require substantially more memory than merging the facts alone.
 * @param {AnalysisProjectShards} shards Existing native project shards.
 * @param {RuntimeEvidenceBatch} batch Normalized imported and derived records.
 * @returns {RuntimeEvidenceMergeResult} New shards plus deterministic merge diagnostics.
 */
export const mergeRuntimeEvidence = (
  shards: AnalysisProjectShards,
  batch: RuntimeEvidenceBatch,
): RuntimeEvidenceMergeResult => {
  // Profiles share a source hash and some record IDs. Reject mixing before merging any shards,
  // or overlapping observations could be counted twice under different byte/state identities.
  const traceProfiles = new Map<string, string | undefined>();
  for (const report of [...shards.imports, ...(batch.imports ?? [])]) {
    if (report.format !== "uttori-asm-instruction-trace") {
      continue;
    }
    if (
      traceProfiles.has(report.sourceSha256) &&
      traceProfiles.get(report.sourceSha256) !== report.indexProfile
    ) {
      throw new Error(
        `Trace '${report.sourceName}' was already imported with a different index profile. Reuse that profile or import into a separate project. Mixing projections would double-count observations.`,
      );
    }
    traceProfiles.set(report.sourceSha256, report.indexProfile);
  }
  const added = emptyCounts();
  const updated = emptyCounts();
  const existing = emptyCounts();
  const merged: AnalysisProjectShards = {
    analysis: mergeRecords(
      "analysis",
      shards.analysis,
      batch.analysis ?? [],
      added,
      updated,
      existing,
    ),
    annotations: mergeRecords(
      "annotations",
      shards.annotations,
      batch.annotations ?? [],
      added,
      updated,
      existing,
    ),
    labels: mergeRecords("labels", shards.labels, batch.labels ?? [], added, updated, existing),
    comments: mergeRecords(
      "comments",
      shards.comments,
      batch.comments ?? [],
      added,
      updated,
      existing,
    ),
    regions: mergeRecords("regions", shards.regions, batch.regions ?? [], added, updated, existing),
    runtime: mergeRecords("runtime", shards.runtime, batch.runtime ?? [], added, updated, existing),
    evidence: mergeRecords(
      "evidence",
      shards.evidence,
      batch.evidence ?? [],
      added,
      updated,
      existing,
    ),
    imports: mergeRecords("imports", shards.imports, batch.imports ?? [], added, updated, existing),
  };
  // Maintenance imports only use the merged records and counts. Materializing
  // per-register conflict reports for millions of prior snapshots can exceed
  // the entire import working set even when nobody requested those reports.
  let conflicts: readonly RuntimeEvidenceConflict[] | undefined;
  let explanations: readonly RuntimeEvidenceExplanation[] | undefined;
  return {
    shards: merged,
    changed:
      Object.values(added).some((count) => count > 0) ||
      Object.values(updated).some((count) => count > 0),
    added,
    updated,
    existing,
    get conflicts() {
      return (conflicts ??= conflictReport(merged.runtime));
    },
    get explanations() {
      return (explanations ??= explanationReport(merged));
    },
  };
};

/**
 * Recomputes conflict and provenance explanations for a previously merged project.
 * @param {AnalysisProjectShards} shards Native project shards to inspect.
 * @returns {Pick<RuntimeEvidenceMergeResult, "conflicts" | "explanations">} Stable diagnostics.
 */
export const inspectRuntimeEvidence = (
  shards: AnalysisProjectShards,
): Pick<RuntimeEvidenceMergeResult, "conflicts" | "explanations"> => ({
  conflicts: conflictReport(shards.runtime),
  explanations: explanationReport(shards),
});
