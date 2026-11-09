import { canonicalEquals, canonicalJson } from "@uttori/asm-core/canonical-json";
import { decodeSqlitePayload, encodeSqlitePayload } from "./sqlite-payload.js";
/** Only overridden observations need a shadow row; runtime evidence is never copied for indexing. */
const SCHEMA = `CREATE TABLE IF NOT EXISTS research_projection (
  collection TEXT NOT NULL, id TEXT NOT NULL, baseline BLOB, projected BLOB,
  PRIMARY KEY(collection,id)
) WITHOUT ROWID;`;
/** Narrow to a non-null, non-array object. */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Allowlist of research collections whose names may be used as SQL identifiers. */
function isResearchCollection(value) {
    return (value === "labels" ||
        value === "comments" ||
        value === "annotations" ||
        value === "regions" ||
        value === "analysis" ||
        value === "evidence");
}
/** SQL table names must come from a fixed allowlist even when restored from local cache rows. */
const collectionName = (value) => {
    if (typeof value !== "string" || !isResearchCollection(value)) {
        throw new Error("Invalid research projection collection.");
    }
    return value;
};
/** Decode only selected metadata. A null shadow denotes that no imported record existed. */
const recordValue = (payload) => payload == null ? null : JSON.parse(decodeSqlitePayload(payload));
/** Names/prose affect presentation; seeded locations, classification and target declarations affect decoding. */
function analysisInput(collection, value) {
    if (value === null || collection === "comments") {
        return null;
    }
    if (!isRecord(value)) {
        throw new Error("Invalid research record.");
    }
    const record = value;
    if (collection === "labels") {
        if (record.analysisEntryPoint === false) {
            return null;
        }
        return {
            id: record.id,
            addressSpace: record.addressSpace,
            address: record.address,
            evidence: record.evidence,
        };
    }
    if (collection === "analysis" &&
        !["target-override", "target-set"].includes(String(record.kind))) {
        return null;
    }
    return record;
}
/** Compare only affected IDs, including removed overrides, before restoring their observation shadows. */
function changesAnalysisInputs(database, snapshot) {
    database.exec(SCHEMA);
    const selected = new Map(snapshot.decisions.map((decision) => [`${decision.collection}:${decision.id}`, decision]));
    const before = new Map();
    for (const row of database
        .prepare("SELECT collection,id,baseline FROM research_projection")
        .iterate()) {
        const collection = collectionName(row.collection);
        const id = String(row.id);
        before.set(`${collection}:${id}`, { collection, id, baseline: recordValue(row.baseline) });
    }
    for (const key of new Set([...selected.keys(), ...before.keys()])) {
        const decision = selected.get(key);
        const previous = before.get(key);
        const { collection, id } = decision ?? previous;
        const current = recordValue(database.prepare(`SELECT payload FROM ${collection} WHERE id=?`).get(id)?.payload);
        const next = decision ? decision.value : previous.baseline;
        if (!canonicalEquals(analysisInput(collection, current), analysisInput(collection, next))) {
            return true;
        }
    }
    return false;
}
/**
 * Restore imported observations before a research-aware import or branch change. Refuse writes
 * outside the projection lifecycle rather than silently treating a database edit as user intent.
 * The caller owns a write transaction and must reapply research before publishing it.
 */
export function clearResearchProjection(database, insert) {
    database.exec(SCHEMA);
    for (const row of database
        .prepare("SELECT * FROM research_projection ORDER BY collection,id")
        .iterate()) {
        const collection = collectionName(row.collection);
        if (typeof row.id !== "string") {
            throw new Error("Invalid research projection record identity.");
        }
        const current = database.prepare(`SELECT payload FROM ${collection} WHERE id=?`).get(row.id);
        if (!canonicalEquals(recordValue(current?.payload), recordValue(row.projected))) {
            throw new Error(`Research index changed outside its authoring files: ${collection}:${row.id}. Reconcile the evidence writer before rebuilding the index.`);
        }
        database.prepare(`DELETE FROM ${collection} WHERE id=?`).run(row.id);
        const baseline = recordValue(row.baseline);
        if (baseline !== null) {
            insert(collection, baseline);
        }
    }
    database.exec("DELETE FROM research_projection; DELETE FROM meta WHERE k IN ('research-inputs','research-index-revision')");
}
/**
 * Materialize Git decisions over retained observations. The entire replacement is atomic in the
 * caller's transaction; validation failure restores both the previous index and its shadow rows.
 */
export function projectResearchInputs(database, snapshot, insert) {
    const changed = changesAnalysisInputs(database, snapshot);
    clearResearchProjection(database, insert);
    const remember = database.prepare("INSERT INTO research_projection VALUES (?,?,?,?)");
    for (const decision of snapshot.decisions) {
        const collection = collectionName(decision.collection);
        const before = database
            .prepare(`SELECT payload FROM ${collection} WHERE id=?`)
            .get(decision.id);
        if (collection === "evidence" && before) {
            const observation = recordValue(before.payload);
            if (!isRecord(observation) || observation.source !== "manual") {
                throw new Error("Git research cannot replace or suppress imported/runtime provenance.");
            }
        }
        const projected = decision.value === null ? null : encodeSqlitePayload(canonicalJson(decision.value));
        remember.run(collection, decision.id, before?.payload ?? null, projected);
        database.prepare(`DELETE FROM ${collection} WHERE id=?`).run(decision.id);
        if (decision.value !== null) {
            insert(collection, decision.value);
        }
    }
    database
        .prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('research-inputs',?)")
        .run(snapshot.hash);
    if (changed) {
        database
            .prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('analysis-dirty',?)")
            .run("Research classification, entry points, targets or evidence changed. Analyze the selected inputs before regenerating or querying the derived graph.");
    }
}
//# sourceMappingURL=sqlite-research-inputs.js.map