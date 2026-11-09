import { isRecord, isStringArray } from "../model/record-shape.js";
import { parseSqlitePayload } from "./sqlite-payload.js";
import { readQueryCache } from "./sqlite-query-cache.js";
/**
 * Narrow a decoded value to an array without validating its elements.
 * @param value Decoded payload of unknown shape.
 * @returns True when the value is an array.
 */
function isUnknownArray(value) {
    return Array.isArray(value);
}
/**
 * Stream every authoritative projection in output order when no dependency-valid cache exists.
 * @yields {unknown} Decoded projection requiring address and provenance validation.
 */
export function* uncachedSourceExportRecords(database) {
    // The general location index can win SQLite's cost estimate and force a large temporary sort.
    // The prepared output index is the explicit ordering contract of this cursor.
    for (const row of database
        .prepare("SELECT query_data FROM analysis INDEXED BY query_instruction_output WHERE kind='cfg-node' AND query_file_offset IS NOT NULL ORDER BY query_file_offset,id")
        .iterate()) {
        yield parseSqlitePayload(row.query_data);
    }
}
/** Layout includes the complete incoming state; targets still check every variant against ROM. */
export const SOURCE_EXPORT_CACHE = { key: "source_export", signature: "1" };
/**
 * Build connection-local rows while rendering the same stream, without a second CFG pass.
 * @yields {readonly InstructionExportRecord[]} One complete validated instruction group.
 */
export function* stageSourceExportGroups(database, groups, complete, signal) {
    database.exec(`CREATE TEMP TABLE source_export_rows (
    file_offset INTEGER NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,
    PRIMARY KEY(file_offset,id)) WITHOUT ROWID;
    CREATE TEMP TABLE source_export_evidence (id INTEGER PRIMARY KEY,payload TEXT NOT NULL);`);
    const insert = database.prepare("INSERT INTO temp.source_export_rows VALUES(?,?,?)");
    const dictionary = database.prepare("INSERT INTO temp.source_export_evidence VALUES(?,?)");
    const evidenceSets = new Map();
    let nextId = 0;
    let retainedBytes = 0;
    for (const group of groups) {
        signal?.throwIfAborted();
        for (const record of group) {
            const { evidence, ...instruction } = record;
            const key = JSON.stringify(evidence);
            let id = evidenceSets.get(key);
            if (id === undefined) {
                id = nextId++;
                const bytes = key.length * 2;
                // Interning is optional compression. Cap retained JS keys at eight MiB and 4,096 entries;
                // unusual all-unique provenance remains correct through additional disk dictionary rows.
                if (evidenceSets.size < 4096 && retainedBytes + bytes <= 8 * 1024 ** 2) {
                    evidenceSets.set(key, id);
                    retainedBytes += bytes;
                }
                dictionary.run(id, key);
            }
            // Repeated provenance dominates CFG projections. Intern exact ordered arrays, retaining
            // every ID and all state fields rather than reducing the variants that exporters must vote on.
            insert.run(record.fileOffset, record.id, JSON.stringify([instruction, id]));
        }
        yield group;
    }
    // A consumer that stops early must never publish an apparently complete projection.
    complete();
}
/** Publish only after the dependency token survives the read snapshot; rollback retains the old cache. */
export function publishSourceExportCache(database) {
    database.exec(`DROP TABLE IF EXISTS query_source_export_rows;
    DROP TABLE IF EXISTS query_source_export_evidence;
    CREATE TABLE query_source_export_rows (
      file_offset INTEGER NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,
      PRIMARY KEY(file_offset,id)) WITHOUT ROWID;
    CREATE TABLE query_source_export_evidence (id INTEGER PRIMARY KEY,payload TEXT NOT NULL);
    INSERT INTO query_source_export_rows SELECT * FROM temp.source_export_rows;
    INSERT INTO query_source_export_evidence SELECT * FROM temp.source_export_evidence;`);
}
/** Release provisional rows even when validation, cancellation, or publication fails. */
export function clearSourceExportStage(database) {
    database.exec("DROP TABLE IF EXISTS temp.source_export_rows; DROP TABLE IF EXISTS temp.source_export_evidence");
}
/** A missing marker means a dependency changed or maintenance evicted the disposable projection. */
export function sourceExportCacheReady(database) {
    return readQueryCache(database, SOURCE_EXPORT_CACHE.key, SOURCE_EXPORT_CACHE.signature) === true;
}
/**
 * Stream detached values from the current read snapshot; callers validate address and provenance contracts.
 * @yields {unknown} Independent instruction record with its complete ordered provenance.
 */
export function* sourceExportCacheRecords(database) {
    const evidence = new Map();
    let retainedBytes = 0;
    const dictionary = database.prepare("SELECT payload FROM query_source_export_evidence WHERE id=?");
    for (const row of database
        .prepare("SELECT payload FROM query_source_export_rows ORDER BY file_offset,id")
        .iterate()) {
        // Derived rows retain the authoritative decoder's per-record size and representation checks.
        const value = parseSqlitePayload(row.payload);
        if (!isUnknownArray(value) ||
            value.length !== 2 ||
            !isRecord(value[0]) ||
            typeof value[1] !== "number" ||
            !Number.isSafeInteger(value[1])) {
            throw new Error("Invalid cached export instruction.");
        }
        const id = value[1];
        let ids = evidence.get(id);
        if (!ids) {
            const dictionaryRow = dictionary.get(id);
            if (!dictionaryRow) {
                throw new Error("Missing cached export provenance.");
            }
            const text = String(dictionaryRow.payload);
            const decoded = parseSqlitePayload(dictionaryRow.payload);
            if (!isStringArray(decoded)) {
                throw new Error("Invalid cached export provenance.");
            }
            ids = decoded;
            // Never load a project-sized dictionary into JS merely to stream a projection.
            if (evidence.size < 4096 && retainedBytes + text.length * 2 <= 8 * 1024 ** 2) {
                evidence.set(id, ids);
                retainedBytes += text.length * 2;
            }
        }
        // Iterators return independent mutable records, matching the uncached decoder's ownership.
        yield { ...value[0], evidence: [...ids] };
    }
}
//# sourceMappingURL=sqlite-source-export.js.map