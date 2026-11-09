/** Dedupe and lexicographically sort string identities for stable catalog output. */
const sorted = (values) => [...new Set(values)].toSorted();
/** Build a deterministic grouping key from catalog identity parts. */
const key = (...values) => JSON.stringify(values);
/**
 * Join sources by immutable artifact identity, never by a display filename or import order.
 * Legacy imports can also link evidence through an exact report ID or full content hash.
 * @param shards Source metadata.
 * @param [importTimes] Durable capture receipt times by content hash.
 * @returns Newest imports first. Undated sources and ties use name/identity order.
 */
export const buildAnalysisSourceCatalog = (shards, importTimes = new Map()) => {
    const sources = new Map();
    const ensure = (id, name, format, sha256) => {
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
    const reportSources = new Map();
    for (const report of shards.imports) {
        const id = key("artifact", report.format, report.sourceSha256);
        ensure(id, report.sourceName, report.format, report.sourceSha256).reports.push(report);
        reportSources.set(report.id, id);
    }
    for (const evidence of shards.evidence) {
        const artifact = evidence.artifact;
        const legacy = !artifact
            ? shards.imports.filter((report) => report.id === evidence.id || report.sourceSha256 === evidence.sourceId)
            : [];
        let id = key("producer", evidence.source, evidence.sourceId);
        if (artifact) {
            id = key("artifact", artifact.format, artifact.sha256);
        }
        else if (legacy.length === 1) {
            id = reportSources.get(legacy[0].id);
        }
        const source = sources.get(id) ?? ensure(id, evidence.sourceId, artifact?.format, artifact?.sha256);
        source.kinds.add(evidence.source);
        source.evidenceIds.push(evidence.id);
    }
    return ([...sources.values()]
        .map((source) => Object.assign({}, source, source.sha256 && importTimes.has(source.sha256)
        ? { lastImportedAt: importTimes.get(source.sha256) }
        : {}, {
        names: sorted(source.names),
        name: sorted(source.names).join(" / "),
        kinds: [...source.kinds].toSorted(),
        evidenceIds: sorted(source.evidenceIds),
        reports: source.reports.toSorted((a, b) => a.id.localeCompare(b.id)),
    }))
        // Missing dates cannot establish recency. Keep legacy sources deterministic after dated imports.
        .toSorted((a, b) => (b.lastImportedAt ?? -1) - (a.lastImportedAt ?? -1) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)));
};
//# sourceMappingURL=analysis-sources.js.map