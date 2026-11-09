/**
 * List stable reverse links in collection order for evidence inspection and safe undo.
 * @param shards Validated project view, with runtime included only when requested.
 * @param evidenceId Exact provenance ID; no address inference is performed.
 * @returns Qualified collection/record references.
 */
export const evidenceReferences = (shards, evidenceId) => [
    ...shards.analysis
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `analysis:${record.id}`),
    ...shards.annotations
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `annotations:${record.id}`),
    ...shards.labels
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `labels:${record.id}`),
    ...shards.comments
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `comments:${record.id}`),
    ...shards.regions
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `regions:${record.id}`),
    ...shards.runtime
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `runtime:${record.id}`),
];
/** Sort and deduplicate stable reference strings for deterministic inspection output. */
const sortedUnique = (values) => [...new Set(values)].toSorted((left, right) => left.localeCompare(right));
/**
 * Resolves complete evidence records, reverse references, and related persisted conflicts for one
 * stable project record. This is target-neutral and performs no mapper/address inference.
 * @param shards Validated native project records.
 * @param shard Shard containing the requested record.
 * @param recordId Stable record id to explain.
 * @returns Direct provenance, reverse links, and related conflicts.
 */
export const explainProjectEvidence = (shards, shard, recordId) => {
    const records = shards[shard];
    const record = records.find(({ id }) => id === recordId);
    if (!record) {
        throw new Error(`Analysis ${shard} record '${recordId}' does not exist.`);
    }
    let evidenceIds = [];
    if (shard === "evidence") {
        evidenceIds = [record.id];
    }
    else if ("evidence" in record) {
        evidenceIds = record.evidence;
    }
    const evidence = evidenceIds.map((id) => {
        const found = shards.evidence.find((entry) => entry.id === id);
        if (!found) {
            throw new Error(`Analysis record '${recordId}' refers to missing evidence '${id}'.`);
        }
        return found;
    });
    const referencedBy = sortedUnique(evidenceIds.flatMap((id) => evidenceReferences(shards, id)));
    const evidenceSet = new Set(evidenceIds);
    const conflicts = shards.analysis
        .filter((entry) => entry.kind === "conflict" &&
        (entry.id === recordId ||
            entry.nodes.includes(recordId) ||
            entry.evidence.some((id) => evidenceSet.has(id))))
        .toSorted((left, right) => left.id.localeCompare(right.id));
    return { shard, record, evidence, referencedBy, conflicts };
};
//# sourceMappingURL=project-evidence.js.map