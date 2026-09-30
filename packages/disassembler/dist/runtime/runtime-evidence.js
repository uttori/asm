import { canonicalEquals } from "@uttori/asm-core/canonical-json";
import { manuallyOwnedMetadata } from "../edits/metadata-edit.js";
const emptyCounts = () => ({
    analysis: 0,
    annotations: 0,
    labels: 0,
    comments: 0,
    regions: 0,
    runtime: 0,
    evidence: 0,
    imports: 0,
});
const sortedUnique = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right));
const stateValueKey = (value) => `${typeof value}:${String(value)}`;
const conflictReport = (runtime) => {
    const observations = [];
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
        }
        else if (record.kind === "runtime-execution") {
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
    const groups = new Map();
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
        }
        else {
            groups.set(key, [observation]);
        }
    }
    const conflicts = [];
    for (const [key, group] of groups) {
        const byValue = new Map();
        for (const observation of group) {
            const valueKey = stateValueKey(observation.value);
            const entries = byValue.get(valueKey);
            if (entries) {
                entries.push(observation);
            }
            else {
                byValue.set(valueKey, [observation]);
            }
        }
        if (byValue.size < 2) {
            continue;
        }
        const first = group[0];
        conflicts.push({
            id: `runtime-conflict:${key}`,
            kind: first.field === "instruction-size" || first.field === "opcode" ? first.field : "cpu-state",
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
const explanationReport = (shards) => {
    const runtimeEvidence = new Set(shards.evidence.filter((record) => record.source === "runtime").map((record) => record.id));
    const explanations = [];
    for (const annotation of shards.annotations) {
        const evidence = annotation.evidence.filter((id) => runtimeEvidence.has(id));
        if (evidence.length === 0) {
            continue;
        }
        const stateFields = Object.keys(annotation.state ?? {}).sort();
        explanations.push({
            recordId: annotation.id,
            detail: stateFields.length > 0
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
const mergeRecords = (kind, prior, incoming, added, updated, existing) => {
    // A PC-only import usually leaves the much larger CFG and annotation collections untouched.
    // Reuse their readonly arrays instead of indexing and copying every unrelated record.
    if (incoming.length === 0) {
        return prior;
    }
    const records = new Map(prior.map((record) => [record.id, record]));
    for (const record of incoming) {
        const current = records.get(record.id);
        if (!current) {
            records.set(record.id, record);
            added[kind]++;
        }
        else if (canonicalEquals(current, record)) {
            existing[kind]++;
        }
        else if (kind === "analysis" &&
            "kind" in current &&
            "kind" in record &&
            current.kind === "target-override" &&
            record.kind === "target-override" &&
            current.id.startsWith("runtime:target-override:")) {
            const left = current;
            const right = record;
            if (left.addressSpace !== right.addressSpace || left.address !== right.address) {
                throw new Error(`Runtime target override '${record.id}' changed its control-flow site.`);
            }
            const merged = {
                ...left,
                targets: [...new Set([...left.targets, ...right.targets])].sort((a, b) => a - b),
                evidence: sortedUnique([...left.evidence, ...right.evidence]),
            };
            if (canonicalEquals(current, merged)) {
                existing[kind]++;
            }
            else {
                records.set(record.id, merged);
                updated[kind]++;
            }
        }
        else {
            throw new Error(`Runtime evidence id '${record.id}' in '${kind}' changed content. Use a content-derived id.`);
        }
    }
    return [...records.values()];
};
/**
 * Merges an offline evidence batch by stable id. Existing claims are never removed or rewritten.
 * Reimporting an identical batch returns `changed: false`. Differing observations remain separate
 * and are surfaced through `conflicts`. Diagnostic getters are lazy. Reading or serializing
 * them can require substantially more memory than merging the facts alone.
 * Collections without incoming records retain their input arrays. Treat all shared records as readonly.
 * @param {AnalysisProjectShards} shards Valid native project shards with unique IDs in each collection.
 * @param {RuntimeEvidenceBatch} batch Normalized imported and derived records.
 * @returns {RuntimeEvidenceMergeResult} New shards plus deterministic merge diagnostics.
 */
export const mergeRuntimeEvidence = (shards, batch) => {
    // Profiles share a source hash and some record IDs. Reject mixing before merging any shards,
    // or overlapping observations could be counted twice under different byte/state identities.
    const traceProfiles = new Map();
    for (const report of [...shards.imports, ...(batch.imports ?? [])]) {
        if (report.format !== "uttori-asm-instruction-trace") {
            continue;
        }
        if (traceProfiles.has(report.sourceSha256) &&
            traceProfiles.get(report.sourceSha256) !== report.indexProfile) {
            throw new Error(`Trace '${report.sourceName}' was already imported with a different index profile. Reuse that profile or import into a separate project. Mixing projections would double-count observations.`);
        }
        traceProfiles.set(report.sourceSha256, report.indexProfile);
    }
    // Manual corrections and removals pin stable imported IDs. Import receipts/evidence still merge,
    // while the original record remains inspectable in the saved metadata edit receipt.
    const owned = manuallyOwnedMetadata(shards);
    const added = emptyCounts();
    const updated = emptyCounts();
    const existing = emptyCounts();
    const merged = {
        analysis: mergeRecords("analysis", shards.analysis, (batch.analysis ?? []).filter((record) => !owned.has("analysis:" + record.id)), added, updated, existing),
        annotations: mergeRecords("annotations", shards.annotations, (batch.annotations ?? []).filter((record) => !owned.has("annotations:" + record.id)), added, updated, existing),
        labels: mergeRecords("labels", shards.labels, (batch.labels ?? []).filter((record) => !owned.has("labels:" + record.id)), added, updated, existing),
        comments: mergeRecords("comments", shards.comments, (batch.comments ?? []).filter((record) => !owned.has("comments:" + record.id)), added, updated, existing),
        regions: mergeRecords("regions", shards.regions, batch.regions ?? [], added, updated, existing),
        runtime: mergeRecords("runtime", shards.runtime, batch.runtime ?? [], added, updated, existing),
        evidence: mergeRecords("evidence", shards.evidence, batch.evidence ?? [], added, updated, existing),
        imports: mergeRecords("imports", shards.imports, batch.imports ?? [], added, updated, existing),
    };
    // Maintenance imports only use the merged records and counts. Materializing
    // per-register conflict reports for millions of prior snapshots can exceed
    // the entire import working set even when nobody requested those reports.
    let conflicts;
    let explanations;
    return {
        shards: merged,
        changed: Object.values(added).some((count) => count > 0) ||
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
export const inspectRuntimeEvidence = (shards) => ({
    conflicts: conflictReport(shards.runtime),
    explanations: explanationReport(shards),
});
//# sourceMappingURL=runtime-evidence.js.map