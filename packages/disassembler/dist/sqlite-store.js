import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildAnalysisSourceCatalog } from "./analysis-sources.js";
import { canonicalJson, canonicalValue } from "./canonical-json.js";
import { explainProjectEvidence } from "./project-edit.js";
import { ANALYSIS_PROJECT_MANIFEST, } from "./project-types.js";
import { validateLoadedShards } from "./project-validation.js";
import { mergeRuntimeEvidence, inspectRuntimeEvidence, } from "./runtime-evidence.js";
import { annotationQueryIndexesReady, ensureAnnotationQueryIndexes, readSqliteAnnotationView, readInstructionExecutionSummary, } from "./sqlite-annotation-query.js";
import { cachedCoverage, prepareCoverage, coveragePage, coverageSignature, publishCoverage, } from "./sqlite-coverage-query.js";
import { prepareGraph, publishGraph } from "./sqlite-graph-query.js";
import { encodeSqlitePayload, decodeSqlitePayload, parseSqlitePayload, sqliteRuntimeIdentity, } from "./sqlite-payload.js";
import { installQueryCache, readQueryCache, writeQueryCache } from "./sqlite-query-cache.js";
import { runtimeFromRow, analysisAddress, compareRuntimeRecordIds } from "./sqlite-records.js";
import { runtimeIdentityKey } from "./sqlite-runtime-facts.js";
import { collectRuntimeHistory, packRuntimeHistory, registerRuntimeHistory, } from "./sqlite-runtime-history.js";
import { RUNTIME_RECORD_STREAM_SQL, RUNTIME_STORAGE_SCHEMA, SqliteRuntimeWriter, } from "./sqlite-runtime-storage.js";
import { runtimeInstructionSummary } from "./sqlite-runtime-summary.js";
import { prepareSourceQueries, sourceQueriesReady, readSourceSummary, readSourcePage, } from "./sqlite-source-query.js";
import { CAPTURE_CATALOG_SCHEMA, readStoragePolicy, validateStoragePolicy, storageSnapshot, enforceDatabaseBudget, maintainStorageCaches, optionalCacheBytes, } from "./sqlite-storage-policy.js";
import { TraceCache } from "./trace-cache.js";
/** On-disk sqlite filename stored in `analysis.json` `db`. */
export const ANALYSIS_PROJECT_SQLITE_FILE = "analysis.sqlite";
/** Physical SQLite layout version, independent of semantic manifest schema and edit revisions. */
export const ANALYSIS_SQLITE_STORAGE_VERSION = 4;
const SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT NOT NULL PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS labels (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  address INTEGER NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  address INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS regions (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  classification TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analysis (
  id TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL,
  address_space TEXT,
  address INTEGER,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS imports (
  id TEXT NOT NULL PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runtime_prefixes (
  id INTEGER PRIMARY KEY,
  value TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS runtime_evidence (
  id INTEGER PRIMARY KEY,
  value TEXT NOT NULL UNIQUE
);
${RUNTIME_STORAGE_SCHEMA}
${CAPTURE_CATALOG_SCHEMA}
PRAGMA user_version=4;
`;
// Metadata queries only order records by location. Analysis records are loaded by stable ID.
// retaining unused kind/address indexes there would duplicate every metadata ID on disk.
const SCHEMA_INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS labels_addr ON labels (address_space, address)",
    "CREATE INDEX IF NOT EXISTS comments_addr ON comments (address_space, address)",
    'CREATE INDEX IF NOT EXISTS regions_range ON regions (address_space, start, "end")',
    'CREATE INDEX IF NOT EXISTS annotations_range ON annotations (address_space, start, "end")',
    // Point lookups through the virtual-state branch need an index on its exposed negative ID.
    "CREATE INDEX IF NOT EXISTS runtime_state_row ON runtime_observations((-oid)) WHERE state_prefix_id IS NOT NULL",
];
/** Joins retain bounded SQLite cursors. No project-sized dictionary is loaded on the JS heap. */
const RUNTIME_SELECT = `SELECT r.*, r.rowid AS storage_rowid, p.value AS id_prefix, e.value AS evidence
  FROM runtime AS r LEFT JOIN runtime_prefixes AS p ON p.id=r.prefix_id
  LEFT JOIN runtime_evidence AS e ON e.id=r.evidence_id`;
/**
 * Resolves the sqlite file for a project pointer.
 * @param {string} directory Project root containing analysis.json.
 * @param {Pick<AnalysisProjectManifest, "db">} manifest Validated pointer.
 * @returns {string} Joined sqlite path. Relative directories remain relative to process cwd.
 */
export const analysisProjectSqlitePath = (directory, manifest) => {
    const relative = manifest.db ?? ANALYSIS_PROJECT_SQLITE_FILE;
    if (relative !== ANALYSIS_PROJECT_SQLITE_FILE) {
        throw new Error(`Unsupported analysis sqlite path '${relative}'.`);
    }
    return path.join(directory, relative);
};
/**
 * Decode physical storage and parse JSON. The project API owns semantic record validation.
 * @param {unknown} payload SQLite TEXT or a supported versioned BLOB.
 * @returns {T} Parsed record, without asserting semantic validity.
 */
const parseRecord = (payload) => parseSqlitePayload(payload);
/** File identity rejects stale connections after an external restore or atomic replacement.
 * @param {string} file Existing database path.
 * @returns {string} Device/inode identity without integer precision loss.
 */
const sqliteFileIdentity = (file) => {
    const stat = fs.statSync(file, { bigint: true });
    return `${stat.dev}:${stat.ino}`;
};
/**
 * Owned synchronous SQLite connection for one project. Close it once in finally. Do not share a
 * connection across overlapping operations. Queries decode records but do not all validate them.
 * Use project snapshot/publication helpers for semantic validation and revision-checked edits.
 * Low-level mutations require a transaction and do not publish a revision or refresh the pointer
 * automatically. WAL readers can retain old snapshots and delay checkpoint/truncation.
 */
export class SqliteAnalysisStore {
    #database;
    #fileIdentity;
    /** Block cache is owned by this connection and reset on commit, rollback, and snapshot entry. */
    #clearHistory;
    /** Database path as supplied at construction. Resolves relative to cwd when not absolute. */
    file;
    #insertEvidence;
    #insertLabel;
    #insertComment;
    #insertRegion;
    #insertAnnotation;
    #insertAnalysis;
    #insertImport;
    #runtimeWriter;
    #findRuntime;
    #dictionaryStatements = new Map();
    /** Transaction-local cache: rollback or another writer cannot leave stale integer references here. */
    #dictionaryIds = new Map();
    #dictionaryCacheBytes = 0;
    /**
     * Opens or creates a project database.
     * Opening validates physical format, not every semantic record, and may create SQLite journal files.
     * Connections use a 5,000 ms busy timeout. Lock contention can still throw a SQLite error.
     * @param {string} file SQLite path. Parent directory must already exist.
     * @param {boolean} [createSchema] Defaults to true. Permit initialization of an empty database, never upgrade an existing one.
     */
    constructor(file, createSchema = true) {
        if (!createSchema && !fs.existsSync(file)) {
            throw new Error(`Analysis database does not exist: ${file}`);
        }
        this.file = file;
        this.#database = new DatabaseSync(file, { open: true });
        this.#clearHistory = registerRuntimeHistory(this.#database);
        // SQL can inspect packed and compressed payloads without transferring full records to JS callers.
        this.#database.function("analysis_json", { deterministic: true }, (value) => value === null ? "{}" : decodeSqlitePayload(value));
        this.#fileIdentity = sqliteFileIdentity(file);
        try {
            const empty = Number(this.#database.prepare("SELECT count(*) AS n FROM sqlite_schema").get()?.n) === 0;
            const initialVersion = Number(this.#database.prepare("PRAGMA user_version").get()?.user_version);
            if (createSchema && empty && initialVersion === 0) {
                this.#database.exec(SCHEMA);
                for (const sql of SCHEMA_INDEX_STATEMENTS) {
                    this.#database.exec(sql);
                }
            }
            const version = Number(this.#database.prepare("PRAGMA user_version").get()?.user_version);
            if (version !== ANALYSIS_SQLITE_STORAGE_VERSION) {
                throw new Error(`Unsupported analysis storage format ${version}. Expected ${ANALYSIS_SQLITE_STORAGE_VERSION}. Only the current storage format is supported.`);
            }
            this.#database.exec("PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-8192; PRAGMA busy_timeout=5000; PRAGMA temp_store=FILE; PRAGMA journal_size_limit=67108864;");
            this.#insertEvidence = this.#database.prepare("INSERT INTO evidence (id, payload) VALUES (?, ?)");
            this.#insertLabel = this.#database.prepare("INSERT INTO labels (id, address_space, address, name, payload) VALUES (?, ?, ?, ?, ?)");
            this.#insertComment = this.#database.prepare("INSERT INTO comments (id, address_space, address, payload) VALUES (?, ?, ?, ?)");
            this.#insertRegion = this.#database.prepare('INSERT INTO regions (id, address_space, start, "end", payload) VALUES (?, ?, ?, ?, ?)');
            this.#insertAnnotation = this.#database.prepare('INSERT INTO annotations (id, address_space, start, "end", classification, payload) VALUES (?, ?, ?, ?, ?, ?)');
            this.#insertAnalysis = this.#database.prepare("INSERT INTO analysis (id, kind, address_space, address, payload) VALUES (?, ?, ?, ?, ?)");
            this.#insertImport = this.#database.prepare("INSERT INTO imports (id, payload) VALUES (?, ?)");
            for (const table of ["runtime_prefixes", "runtime_evidence"]) {
                this.#dictionaryStatements.set(table, {
                    find: this.#database.prepare(`SELECT id FROM ${table} WHERE value=?`),
                    insert: this.#database.prepare(`INSERT INTO ${table} (value) VALUES (?)`),
                });
            }
            this.#findRuntime = this.#database.prepare(`${RUNTIME_SELECT}
        WHERE r.prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) AND (${runtimeIdentityKey("r.id")})=(${runtimeIdentityKey("?2")}) AND r.id=?2`);
            this.#runtimeWriter = new SqliteRuntimeWriter(this.#database);
        }
        catch (error) {
            this.#database.close();
            throw error;
        }
    }
    /**
     * Preserve the triggering error when SQLite has already aborted (for example SQLITE_FULL).
     * A cleanup error must never replace the original failure reported to the user.
     */
    rollback() {
        this.#clearDictionaryCache();
        if (!this.#database.isTransaction) {
            return;
        }
        try {
            this.#database.exec("ROLLBACK");
        }
        catch {
            // Closing the owned connection is the final cleanup if rollback itself fails.
        }
    }
    /** Forget all transaction-owned dictionary references and their bounded text allocation. */
    #clearDictionaryCache() {
        this.#clearHistory();
        this.#dictionaryIds.clear();
        this.#dictionaryCacheBytes = 0;
    }
    /**
     * Intern exact text with a bounded cache. Callers hold the SQLite writer lock.
     * @param {string} table One of the two prepared dictionary tables.
     * @param {string} value Exact prefix or serialized evidence list.
     * @returns {number} Transactionally created or existing dictionary rowid.
     */
    #intern(table, value) {
        const key = `${table}:${value}`;
        const cached = this.#dictionaryIds.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const statements = this.#dictionaryStatements.get(table);
        const found = statements.find.get(value);
        const id = found ? Number(found.id) : Number(statements.insert.run(value).lastInsertRowid);
        const bytes = Buffer.byteLength(key);
        if (this.#dictionaryIds.size >= 256 || this.#dictionaryCacheBytes + bytes > 512 * 1024) {
            this.#clearDictionaryCache();
        }
        // A single unusually large ID/evidence set must not turn the cache into a second record store.
        if (bytes <= 512 * 1024) {
            this.#dictionaryIds.set(key, id);
            this.#dictionaryCacheBytes += bytes;
        }
        return id;
    }
    #insertRecord(kind, value) {
        if (kind === "evidence") {
            const record = value;
            this.#insertEvidence.run(record.id, encodeSqlitePayload(JSON.stringify(record)));
            return;
        }
        if (kind === "labels") {
            const record = value;
            this.#insertLabel.run(record.id, record.addressSpace, record.address, record.name, encodeSqlitePayload(JSON.stringify(record)));
            return;
        }
        if (kind === "comments") {
            const record = value;
            this.#insertComment.run(record.id, record.addressSpace, record.address, encodeSqlitePayload(JSON.stringify(record)));
            return;
        }
        if (kind === "regions") {
            const record = value;
            this.#insertRegion.run(record.id, record.addressSpace, record.start, record.end, encodeSqlitePayload(JSON.stringify(record)));
            return;
        }
        if (kind === "annotations") {
            const record = value;
            this.#insertAnnotation.run(record.id, record.addressSpace, record.start, record.end, record.classification, encodeSqlitePayload(JSON.stringify(record)));
            return;
        }
        if (kind === "analysis") {
            const record = value;
            const located = analysisAddress(record);
            this.#insertAnalysis.run(record.id, record.kind, located.addressSpace, located.address, encodeSqlitePayload(JSON.stringify(record)));
            return;
        }
        if (kind === "imports") {
            const record = value;
            this.#insertImport.run(record.id, encodeSqlitePayload(JSON.stringify(record)));
            this.recordCaptureReceipt(record);
            return;
        }
        const record = value;
        this.#runtimeWriter.insert(record, (table, value) => this.#intern(table, value));
    }
    /**
     * Run a synchronous unit against one SQLite snapshot. Writers acquire their lock before reading
     * the revision so a competing process cannot slip between the stale check and publication.
     * Throwing rolls back records and manifest changes. Promise/thenable results are rejected. Perform
     * async preparation before entering. Transactions cannot nest. Low-level callbacks must publish
     * the manifest themselves when changing semantic records. Prefer the commitAnalysisProject APIs.
     * @param {Function} action Synchronous work. Cursors must be consumed before returning.
     * @param {boolean} [write] Defaults to true (BEGIN IMMEDIATE). False uses deferred BEGIN for reads, not an enforced read-only connection.
     * @returns {T} Callback result after a successful commit.
     */
    transaction(action, write = true) {
        if (sqliteFileIdentity(this.file) !== this.#fileIdentity) {
            throw new Error("Analysis database was replaced. Close this connection and reload the project.");
        }
        this.#clearDictionaryCache();
        this.#database.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
        try {
            const revision = write ? this.revision() : 0;
            const result = action();
            if (result !== null &&
                (typeof result === "object" || typeof result === "function") &&
                "then" in result &&
                typeof result.then === "function") {
                // An async callback would otherwise commit before its work finishes. Roll back now,
                // and observe its eventual rejection so this misuse cannot also crash the host later.
                void Promise.resolve(result).catch(() => undefined);
                throw new TypeError("Analysis transactions require a synchronous callback, not a Promise.");
            }
            if (write) {
                packRuntimeHistory(this.#database);
            }
            if (write && this.revision() !== revision) {
                enforceDatabaseBudget(this.#database);
            }
            this.#database.exec("COMMIT");
            this.#clearDictionaryCache();
            return result;
        }
        catch (error) {
            this.rollback();
            throw error;
        }
    }
    /**
     * Index trace chunks in a connection-local disk table. This transaction never reads or writes
     * main, allowing other project writers to proceed during asynchronous capture parsing.
     * @param {Function} action Async parser using only the supplied temporary counter index.
     * @param {TraceIndexMetrics} metrics Optional caller-owned diagnostic counters.
     * @returns {Promise} Parser result after temporary counters commit. The index lives until connection close.
     */
    async indexTrace(action, metrics) {
        this.#database.exec(`CREATE TEMP TABLE trace_facts (
      id TEXT PRIMARY KEY, payload TEXT NOT NULL, count INTEGER NOT NULL
    ) WITHOUT ROWID; BEGIN;`);
        const increment = this.#database.prepare("UPDATE temp.trace_facts SET count=count+1 WHERE id=?");
        const insert = this.#database.prepare("INSERT INTO temp.trace_facts VALUES (?, ?, 1)");
        const values = this.#database.prepare("SELECT payload, count FROM temp.trace_facts");
        const incrementMany = this.#database.prepare("UPDATE temp.trace_facts SET count=count+? WHERE id=?");
        // Hot traces revisit a small working set millions of times. Keep at most
        // 4096 counter deltas. Payloads and the full distinct index remain on disk.
        const pending = new TraceCache(metrics);
        const flushEntry = (key, count) => {
            if (!count) {
                return;
            }
            incrementMany.run(count, key);
            if (metrics) {
                metrics.sqlStatements++;
            }
        };
        const flush = () => {
            for (const [key, entry] of pending.entries()) {
                flushEntry(key, entry.count);
            }
            pending.clear();
        };
        const index = {
            diskBacked: true,
            add: (key, create) => {
                const entry = pending.get(key);
                if (entry !== undefined) {
                    if (!Number.isSafeInteger(entry.count + 1)) {
                        throw new Error("Trace count exceeds exact integer range.");
                    }
                    // Keep the same entry on hits: no replacement allocation or Map rewrite
                    // is needed for the repeated-key path that dominates dense captures.
                    entry.count++;
                    return false;
                }
                // Flush only the displaced delta. A scan just beyond capacity must not
                // discard the other 4095 counters or materialize their payloads again.
                // Zero means no deferred repeats yet: the miss's own observation is
                // counted by UPDATE or INSERT below, so initializing to one would double it.
                const displaced = pending.insert(key, { count: 0 });
                if (displaced) {
                    flushEntry(displaced.key, displaced.value.count);
                }
                if (metrics) {
                    metrics.sqlStatements++;
                }
                // A cache miss may still be a disk-index hit. UPDATE first keeps create()
                // lazy. An eager UPSERT payload would serialize repeats unnecessarily.
                // A speculative membership filter was benchmarked without a useful gain.
                if (increment.run(key).changes !== 0) {
                    return false;
                }
                insert.run(key, JSON.stringify(create()));
                if (metrics) {
                    metrics.sqlStatements++;
                    metrics.payloads++;
                }
                return true;
            },
            values: function* () {
                // Reconcile deferred counts before streaming rows. The complete distinct
                // set stays on disk instead of being materialized just to finalize it.
                flush();
                for (const row of values.iterate()) {
                    yield {
                        fact: parseRecord(row.payload),
                        count: Number(row.count),
                    };
                }
            },
            clear: () => {
                pending.clear();
                this.#database.exec("DELETE FROM temp.trace_facts");
            },
        };
        try {
            const result = await action(index);
            flush();
            this.#database.exec("COMMIT");
            this.#clearDictionaryCache();
            return result;
        }
        catch (error) {
            this.rollback();
            throw error;
        }
    }
    /** Require mutations to belong to an explicitly owned atomic publication. */
    #requireTransaction() {
        if (!this.#database.isTransaction) {
            throw new Error("Analysis mutation requires a transaction.");
        }
    }
    /** Apply a selected metadata edit by stable ID. Omitted records are never deleted.
     * Validation and optimistic revision checks belong to the publication API.
     * @param {AnalysisProjectShards} before Original selected view.
     * @param {AnalysisProjectShards} after Edited selected view.
     */
    patchMetadata(before, after) {
        this.#requireTransaction();
        for (const kind of [
            "analysis",
            "annotations",
            "labels",
            "comments",
            "regions",
            "evidence",
            "imports",
        ]) {
            const previous = new Map(before[kind].map((record) => [record.id, record]));
            const next = new Map(after[kind].map((record) => [record.id, record]));
            const find = this.#database.prepare(`SELECT payload FROM ${kind} WHERE id=?`);
            const remove = this.#database.prepare(`DELETE FROM ${kind} WHERE id=?`);
            for (const id of new Set([...previous.keys(), ...next.keys()])) {
                const prior = previous.get(id), record = next.get(id);
                if (canonicalJson(prior) === canonicalJson(record)) {
                    continue;
                }
                const stored = find.get(id);
                if (canonicalJson(stored ? parseRecord(stored.payload) : undefined) !== canonicalJson(prior)) {
                    throw new Error(`Selected ${kind} record '${id}' changed. Reload before editing.`);
                }
                remove.run(id);
                if (record) {
                    this.#insertRecord(kind, record);
                }
            }
        }
        // Undo can remove newly-created provenance. Check retained references in SQL before committing.
        // ordinary edits append evidence and never scan the retained analysis/runtime history.
        const retained = new Set(after.evidence.map((record) => record.id));
        const removed = before.evidence
            .filter((record) => !retained.has(record.id))
            .map((record) => record.id);
        if (removed.length) {
            const ids = JSON.stringify(removed);
            for (const table of ["analysis", "annotations", "labels", "comments", "regions"]) {
                if (this.#database
                    .prepare(`SELECT 1 FROM ${table} r,json_each(analysis_json(r.payload),'$.evidence') e WHERE e.value IN (SELECT value FROM json_each(?)) LIMIT 1`)
                    .get(ids)) {
                    throw new Error("Cannot remove evidence still referenced by retained project records.");
                }
            }
            this.validateRuntimeEvidence();
        }
    }
    /**
     * Replace only supplied tables, retaining byte-identical rows. The temporary ID set bounds
     * memory and deletes removed rows without rewriting unchanged metadata or runtime history.
     * Semantic validation belongs to the project publication API. This method must run in its transaction.
     * @param {Partial<AnalysisProjectShards>} shards Validated replacements for explicitly named tables.
     */
    replaceTables(shards) {
        this.#requireTransaction();
        this.#database.exec("CREATE TEMP TABLE IF NOT EXISTS replacement_ids (id TEXT PRIMARY KEY) WITHOUT ROWID");
        const remember = this.#database.prepare("INSERT INTO temp.replacement_ids VALUES (?)");
        const tables = new Set([
            "analysis",
            "annotations",
            "labels",
            "comments",
            "regions",
            "runtime",
            "evidence",
            "imports",
        ]);
        for (const kind of Object.keys(shards)) {
            if (!tables.has(kind)) {
                throw new Error(`Unknown analysis table '${kind}'.`);
            }
            if (kind === "runtime") {
                this.#replaceRuntime(shards.runtime ?? []);
                continue;
            }
            // A new or emptied table has nothing to compare or delete. Its primary key still rejects
            // duplicate IDs, and the owning writer transaction rolls back a failed initial insertion.
            if (!this.#database.prepare(`SELECT 1 FROM ${kind} LIMIT 1`).get()) {
                for (const record of shards[kind] ?? []) {
                    this.#insertRecord(kind, record);
                }
                continue;
            }
            this.#database.exec("DELETE FROM temp.replacement_ids");
            // Derived export columns can be large. Comparison needs only the authoritative payload.
            const find = this.#database.prepare(`SELECT payload FROM ${kind} WHERE id=?`);
            const remove = this.#database.prepare(`DELETE FROM ${kind} WHERE id=?`);
            for (const record of shards[kind] ?? []) {
                remember.run(record.id);
                const prior = find.get(record.id);
                if (prior) {
                    // Reanalysis usually reproduces the same serialized record. Compare its decoded JSON
                    // before parsing/sorting both objects. Retain canonical comparison for reordered keys.
                    const json = decodeSqlitePayload(prior.payload);
                    if (json === JSON.stringify(record)) {
                        continue;
                    }
                    const before = JSON.parse(json);
                    // Comparison is internal: preserve canonical key/undefined semantics without allocating
                    // the pretty-printed identity format for every large CFG context twice.
                    if (JSON.stringify(canonicalValue(before)) === JSON.stringify(canonicalValue(record))) {
                        continue;
                    }
                    remove.run(record.id);
                }
                this.#insertRecord(kind, record);
            }
            this.#database.exec(`DELETE FROM ${kind} WHERE id NOT IN (SELECT id FROM temp.replacement_ids)`);
        }
    }
    /**
     * Replace runtime by interned external identities, including virtual paired-state records.
     * @param {Array} records Complete semantic runtime replacement. Duplicate IDs remain errors.
     */
    #replaceRuntime(records) {
        this.#database.exec("CREATE TEMP TABLE IF NOT EXISTS replacement_runtime_ids (prefix TEXT, id BLOB, PRIMARY KEY(prefix,id)) WITHOUT ROWID; DELETE FROM replacement_runtime_ids");
        const remember = this.#database.prepare("INSERT OR IGNORE INTO temp.replacement_runtime_ids VALUES (?,?)");
        const remove = this.#database.prepare("DELETE FROM runtime WHERE rowid=?");
        for (const record of records) {
            const identity = sqliteRuntimeIdentity(record.id);
            // Pairing may replace a standalone state's rowid. External IDs remain stable throughout.
            if (!remember.run(identity.prefix, identity.suffix).changes) {
                throw new Error(`Duplicate runtime record ID '${record.id}'.`);
            }
            const prior = this.#findRuntime.get(identity.prefix, identity.suffix);
            if (prior && canonicalJson(runtimeFromRow(prior)) === canonicalJson(record)) {
                continue;
            }
            if (prior) {
                remove.run(prior.storage_rowid);
            }
            this.#insertRecord("runtime", record);
        }
        this.#database.exec(`DELETE FROM runtime WHERE NOT EXISTS (
      SELECT 1 FROM temp.replacement_runtime_ids keep JOIN runtime_prefixes p ON p.value=keep.prefix
      WHERE p.id=runtime.prefix_id AND keep.id=runtime.id)`);
    }
    /**
     * Insert a content-addressed runtime fact once. An ID collision with different content is an
     * error, never a silent no-op. Count values are already aggregated within the source capture.
     * @param {RuntimeEvidenceRecord} record Fully aggregated fact with a source-derived stable ID.
     * @returns {boolean} True when inserted. Identical facts return false and conflicting facts throw.
     */
    insertRuntime(record) {
        this.#requireTransaction();
        const identity = sqliteRuntimeIdentity(record.id);
        const prior = this.#findRuntime.get(identity.prefix, identity.suffix);
        if (prior) {
            if (canonicalJson(runtimeFromRow(prior)) !== canonicalJson(record)) {
                throw new Error(`Runtime record '${record.id}' has changed content for a stable imported ID.`);
            }
            return false;
        }
        this.#insertRecord("runtime", record);
        return true;
    }
    /** Prepare a unique-record batch in one source namespace, inside the publication transaction.
     * New namespaces need no per-record existence query. SQL uniqueness still rejects repeated IDs.
     * Existing/partially pruned sources use full idempotency and collision checks for every record.
     * The callback must not escape its transaction. Any insertion error must abort the whole batch.
     * @param {string} prefix Exact ID prefix including its final colon.
     * @returns {Function} Transaction-scoped inserter for validated records with unique suffixes.
     */
    runtimeBatchInserter(prefix) {
        this.#requireTransaction();
        if (!prefix || !prefix.endsWith(":")) {
            throw new Error("Invalid runtime batch prefix.");
        }
        // Query the logical view so paired states count as existing observations too.
        // Receipts alone cannot prove completeness: pruning can remove some or all
        // observations without removing their capture's provenance.
        const existing = this.#database
            .prepare("SELECT 1 FROM runtime WHERE prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) LIMIT 1")
            .get(prefix);
        return (record) => {
            this.#requireTransaction();
            if (!record.id.startsWith(prefix) || record.id.lastIndexOf(":") !== prefix.length - 1) {
                throw new Error("Runtime record escaped its batch prefix.");
            }
            // Retained rows require exact comparison. Missing rows in a partial import
            // must be repaired. A matching source hash is not permission to skip either.
            if (existing) {
                return this.insertRuntime(record);
            }
            // The caller emits a distinct temporary index under a freshly checked
            // namespace. The surrounding writer transaction excludes competing inserts.
            this.#insertRecord("runtime", record);
            return true;
        };
    }
    /** Reject evidence removal that would leave retained runtime facts orphaned, without loading them. */
    validateRuntimeEvidence() {
        const missing = this.#database
            .prepare(`
      SELECT ref.value AS evidence FROM runtime_evidence AS sets, json_each(sets.value) AS ref
      LEFT JOIN evidence ON evidence.id=ref.value
      WHERE evidence.id IS NULL AND EXISTS (SELECT 1 FROM runtime WHERE evidence_id=sets.id) LIMIT 1
    `)
            .get();
        if (missing) {
            throw new Error(`Runtime history refers to missing evidence '${String(missing.evidence)}'.`);
        }
    }
    /**
     * Store manifest and counter in the same transaction as the changed records.
     * @param {object} manifest Semantic project identity for this publication.
     * @returns {AnalysisProjectManifest} Manifest containing the incremented counter.
     */
    publishManifest(manifest) {
        this.#requireTransaction();
        const revision = this.revision() + 1;
        const pointer = {
            ...manifest,
            db: ANALYSIS_PROJECT_SQLITE_FILE,
            revision,
            shards: [],
        };
        const insert = this.#database.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)");
        insert.run("revision", String(revision));
        insert.run("manifest", canonicalJson(pointer));
        return pointer;
    }
    /**
     * Current publication counter, or zero before initial publication. It is not a schema version.
     * Read it with related records inside transaction to retain one consistent snapshot.
     * @returns {number} Stored revision.
     */
    revision() {
        const row = this.#database.prepare("SELECT v FROM meta WHERE k='revision'").get();
        return Number(row?.v ?? 0);
    }
    /**
     * Authoritative manifest stored in SQLite, including pointer fields. Throws before initial publication.
     * Use a transaction when combining it with other reads. This does not validate the entire project.
     * @returns {AnalysisProjectManifest} Pointer manifest.
     */
    manifest() {
        const row = this.#database.prepare("SELECT v FROM meta WHERE k='manifest'").get();
        if (!row) {
            throw new Error("Sqlite analysis project is missing its stored manifest.");
        }
        return { ...parseRecord(row.v), revision: this.revision() };
    }
    /**
     * Stream only requested runtime kinds, avoiding raw-row and decoded-row arrays on the JS heap.
     * @param {Array} kinds Runtime discriminators to include. Empty selects nothing.
     * @returns {IterableIterator} Cursor consumed within the owning read transaction.
     * @yields {RuntimeEvidenceRecord} One matching decoded fact.
     */
    *runtimeRecordsByKinds(kinds) {
        if (kinds.length === 0) {
            return;
        }
        const statement = this.#database.prepare(`${RUNTIME_SELECT} WHERE r.kind IN (${kinds.map(() => "?").join(", ")})`);
        for (const row of statement.iterate(...kinds)) {
            yield runtimeFromRow(row);
        }
    }
    /**
     * Stream runtime facts without retaining the complete table. Consume before the owning transaction
     * returns or the connection closes. An escaped iterator does not preserve its original snapshot.
     * @returns {IterableIterator<RuntimeEvidenceRecord>} One reconstructed runtime row at a time.
     * @yields {RuntimeEvidenceRecord} One runtime fact.
     */
    *runtimeRecords() {
        for (const sql of RUNTIME_RECORD_STREAM_SQL) {
            for (const row of this.#database.prepare(sql).iterate()) {
                yield runtimeFromRow(row);
            }
        }
    }
    /**
     * Read one metadata table directly. Sources must not load unrelated CFG or runtime tables.
     * @param {string} kind Metadata table name from the semantic collection contract.
     * @returns {Array} Decoded metadata in deterministic display order.
     */
    loadTable(kind) {
        const order = {
            labels: "address_space, address, id",
            comments: "address_space, address, id",
            annotations: 'address_space, start, "end", id',
            regions: 'address_space, start, "end", id',
            analysis: "id",
            evidence: "id",
            imports: "id",
        };
        if (!Object.hasOwn(order, kind)) {
            throw new Error(`Unknown analysis table '${kind}'.`);
        }
        const records = [];
        for (const row of this.#database
            .prepare(`SELECT payload FROM ${kind} ORDER BY ${order[kind]}`)
            .iterate()) {
            records.push(parseRecord(row.payload));
        }
        return records;
    }
    /** Validate a query view against this read snapshot, including every included provenance reference.
     * @param {AnalysisProjectShards} shards Selected records, with unused collections empty.
     */
    validateView(shards) {
        validateLoadedShards(shards, this.manifest());
    }
    /** Merge an already-parsed offline batch by stable IDs without loading saved runtime history.
     * The caller owns revision checking and publication in the surrounding writer transaction.
     * @param {RuntimeEvidenceBatch} batch Imported facts and metadata.
     * @returns {object} Whether anything changed and per-collection additions/updates.
     */
    mergeEvidenceBatch(batch) {
        this.#requireTransaction();
        const base = {
            analysis: [],
            annotations: this.loadTable("annotations"),
            labels: this.loadTable("labels"),
            comments: this.loadTable("comments"),
            regions: this.loadTable("regions"),
            evidence: this.loadTable("evidence"),
            imports: this.loadTable("imports"),
            runtime: [],
        };
        const ids = JSON.stringify((batch.analysis ?? []).map((record) => record.id));
        const analysis = this.#database
            .prepare("SELECT payload FROM analysis WHERE id IN (SELECT value FROM json_each(?))")
            .all(ids)
            .map((row) => parseRecord(row.payload));
        const before = { ...base, analysis };
        const merged = mergeRuntimeEvidence(before, { ...batch, runtime: [] });
        this.validateView({ ...merged.shards, runtime: batch.runtime ?? [] });
        this.patchMetadata(before, merged.shards);
        let runtime = 0;
        for (const record of batch.runtime ?? []) {
            if (this.insertRuntime(record)) {
                runtime++;
            }
        }
        return {
            changed: merged.changed || runtime > 0,
            added: { ...merged.added, runtime },
            updated: merged.updated,
        };
    }
    /** Produce an explicit complete evidence report one qualified PC at a time.
     * Only report output accumulates. Unused instruction/memory histories and CFG contexts are never loaded.
     * @returns {object} Runtime record count, conflicts, and metadata explanations.
     */
    inspectEvidence() {
        const shards = {
            analysis: this.analysisByKinds(["target-override"]),
            annotations: this.loadTable("annotations"),
            evidence: this.loadTable("evidence"),
            labels: [],
            comments: [],
            regions: [],
            imports: [],
            runtime: [],
        };
        const conflicts = [];
        const rows = this.#database.prepare(`${RUNTIME_SELECT} WHERE r.kind IN ('runtime-execution','runtime-cpu-state') AND r.address_space=? AND r.address=? AND r.architecture=?`);
        const sites = this.#database.prepare("SELECT DISTINCT architecture,address_space,address FROM runtime WHERE kind IN ('runtime-execution','runtime-cpu-state')");
        for (const site of sites.iterate()) {
            const runtime = [];
            for (const row of rows.iterate(site.address_space, site.address, site.architecture)) {
                runtime.push(runtimeFromRow(row));
            }
            for (const conflict of inspectRuntimeEvidence({ ...shards, runtime }).conflicts) {
                conflicts.push(conflict);
            }
        }
        conflicts.sort((a, b) => a.id.localeCompare(b.id));
        return {
            runtimeRecords: Number(this.#database.prepare("SELECT count(*) AS n FROM runtime").get().n),
            conflicts,
            explanations: inspectRuntimeEvidence(shards).explanations,
        };
    }
    /** Select record choices before decoding. Explicit IDs bypass unrelated history entirely.
     * @param {Partial<Record<ShardKind, readonly string[]>>} [selected] Exact context record IDs. Omitted lists the first 200 records per collection.
     * @returns {AnalysisProjectShards} Bounded choice view and complete small provenance catalog.
     */
    evidenceChoices(selected) {
        const shards = {
            analysis: [],
            annotations: [],
            labels: [],
            comments: [],
            regions: [],
            runtime: [],
            imports: [],
            evidence: this.loadTable("evidence"),
        };
        for (const kind of [
            "analysis",
            "annotations",
            "labels",
            "comments",
            "regions",
            "runtime",
            "imports",
        ]) {
            const records = [];
            const ids = selected?.[kind];
            if (selected && !ids?.length) {
                continue;
            }
            if (kind === "runtime") {
                if (ids) {
                    const find = this.#database.prepare(`${RUNTIME_SELECT} WHERE r.prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?)
              AND (${runtimeIdentityKey("r.id")})=(${runtimeIdentityKey("?2")}) AND r.id=?2`);
                    for (const id of ids.slice(0, 200)) {
                        const identity = sqliteRuntimeIdentity(id);
                        const row = find.get(identity.prefix, identity.suffix);
                        if (row) {
                            records.push(runtimeFromRow(row));
                        }
                    }
                }
                else {
                    for (const row of this.#database.prepare(`${RUNTIME_SELECT} LIMIT 200`).iterate()) {
                        records.push(runtimeFromRow(row));
                    }
                }
            }
            else {
                const sql = ids
                    ? `SELECT payload FROM ${kind} WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id LIMIT 200`
                    : `SELECT payload FROM ${kind} ORDER BY id LIMIT 200`;
                const parameters = ids ? [JSON.stringify(ids)] : [];
                for (const row of this.#database.prepare(sql).iterate(...parameters)) {
                    records.push(parseRecord(row.payload));
                }
            }
            Object.assign(shards, { [kind]: records });
        }
        return shards;
    }
    /** Explain one record with an exact reference count and a bounded reverse-reference preview.
     * @param {ShardKind} kind Selected collection.
     * @param {string} id Stable semantic record ID.
     * @returns {ProjectEvidenceExplanation} Full direct provenance/conflicts, at most 200 reverse links.
     */
    explainEvidence(kind, id) {
        // Metadata reverse links are a persistent SQL index. Runtime already has dictionary/source
        // indexes, so explaining evidence never decodes CPU-state or memory-history payloads.
        const signature = "1";
        if (!readQueryCache(this.#database, "evidence_links", signature)) {
            this.transaction(() => {
                installQueryCache(this.#database, "evidence_links", [
                    "analysis",
                    "annotations",
                    "labels",
                    "comments",
                    "regions",
                ]);
                this.#database.exec("CREATE TABLE IF NOT EXISTS query_evidence_links(evidence TEXT,collection TEXT,id TEXT,PRIMARY KEY(evidence,collection,id)) WITHOUT ROWID;DELETE FROM query_evidence_links;");
                for (const table of ["analysis", "annotations", "labels", "comments", "regions"]) {
                    this.#database.exec(`INSERT OR IGNORE INTO query_evidence_links SELECT e.value,'${table}',r.id FROM ${table} r,json_each(analysis_json(r.payload),'$.evidence') e`);
                }
                writeQueryCache(this.#database, "evidence_links", signature, true);
            });
        }
        return this.transaction(() => {
            const shards = this.evidenceChoices({ [kind]: [id] });
            const view = {
                ...shards,
                analysis: [
                    ...shards.analysis,
                    ...this.analysisByKinds(["conflict"]).filter((record) => !shards.analysis.some((other) => other.id === record.id)),
                ],
            };
            const base = explainProjectEvidence(view, kind, id);
            const evidenceIds = JSON.stringify(base.evidence.map((record) => record.id));
            const metadata = "SELECT collection||':'||id AS reference FROM query_evidence_links WHERE evidence IN (SELECT value FROM json_each(?)) GROUP BY collection,id";
            const runtime = "SELECT 'runtime:'||p.value||CASE typeof(r.id) WHEN 'blob' THEN lower(hex(r.id)) ELSE r.id END AS reference FROM runtime_evidence e JOIN runtime r ON r.evidence_id=e.id JOIN runtime_prefixes p ON p.id=r.prefix_id WHERE EXISTS(SELECT 1 FROM json_each(e.value) value WHERE value.value IN (SELECT value FROM json_each(?)))";
            const metadataRows = this.#database
                .prepare(`${metadata} ORDER BY reference LIMIT 200`)
                .all(evidenceIds);
            const runtimeRows = this.#database
                .prepare(`${runtime} ORDER BY r.prefix_id,r.id LIMIT 200`)
                .all(evidenceIds);
            const referencedBy = [...metadataRows, ...runtimeRows]
                .map((row) => String(row.reference))
                .sort((a, b) => a.localeCompare(b))
                .slice(0, 200);
            const metadataCount = Number(this.#database.prepare(`SELECT count(*) AS n FROM (${metadata})`).get(evidenceIds).n);
            const runtimeCount = Number(this.#database
                .prepare(`SELECT count(*) AS n FROM runtime r WHERE r.evidence_id IN
        (SELECT e.id FROM runtime_evidence e WHERE EXISTS(SELECT 1 FROM json_each(e.value) value WHERE value.value IN (SELECT value FROM json_each(?))))`)
                .get(evidenceIds).n);
            const referencedByTotal = metadataCount + runtimeCount;
            return { ...base, referencedBy, referencedByTotal };
        }, false);
    }
    /** Exact coverage totals. Build only when classifications, code, or runtime facts changed.
     * @returns {object} Persisted summary and detail count.
     */
    coverageSummary() {
        const cached = cachedCoverage(this.#database, this.manifest());
        if (cached) {
            return cached;
        }
        this.prepareAnnotationQueries();
        try {
            this.cachedProjection("coverage", coverageSignature(this.manifest()), ["analysis", "annotations", "regions", "runtime"], () => prepareCoverage(this.#database, this.manifest()), () => publishCoverage(this.#database));
            const published = cachedCoverage(this.#database, this.manifest());
            if (!published) {
                throw new Error("Project changed while building coverage. Refresh the view.");
            }
            return published;
        }
        finally {
            this.#database.exec("DROP TABLE IF EXISTS temp.query_coverage_segments;DROP TABLE IF EXISTS temp.query_coverage_details");
        }
    }
    /** Read at most 200 coverage rows from a current projection.
     * @param {"segments" | "details"} kind Collection to page.
     * @param {number} offset Nonnegative row offset.
     * @returns {unknown[]} Persisted rows, never the full ROM map.
     */
    coveragePage(kind, offset = 0) {
        this.coverageSummary();
        return this.transaction(() => coveragePage(this.#database, kind, offset), false);
    }
    /** Persisted call graph plus current labels, without retaining CFG contexts between requests.
     * @returns {object} Functions, calls, unresolved sites, and ownership.
     */
    callGraph() {
        let graph;
        try {
            graph = this.cachedProjection("graph", "2", ["analysis"], () => prepareGraph(this.#database), () => publishGraph(this.#database));
            const published = readQueryCache(this.#database, "graph", "2");
            if (!published) {
                throw new Error("Analysis changed while building the graph. Refresh the view.");
            }
            graph = published;
        }
        finally {
            this.#database.exec("DROP TABLE IF EXISTS temp.query_graph_nodes;DROP TABLE IF EXISTS temp.query_graph_edges");
        }
        const labels = this.loadTable("labels");
        return {
            ...graph,
            functions: graph.functions.map((fn) => ({
                ...fn,
                labels: labels
                    .filter((label) => label.addressSpace === fn.addressSpace && label.address === fn.address)
                    .map(({ id, name }) => ({ id, name }))
                    .sort((a, b) => a.id.localeCompare(b.id)),
            })),
        };
    }
    /** Cache a compact target-specific result. Callers declare every persisted input it consumes.
     * Computation uses a deferred transaction so expensive analysis does not hold the writer lock.
     * Concurrent input changes discard cache publication. Results still belong to one read snapshot.
     * @param {string} key Internal stable query name.
     * @param {string} signature Layout/configuration fingerprint.
     * @param {readonly ShardKind[]} dependencies Source collections.
     * @param {Function} compute Synchronous reader. Must not open another transaction.
     * @param {Function} [publish] Optional short SQL publication for derived rows built in temporary tables.
     * @returns {T} Current projected value.
     */
    cachedProjection(key, signature, dependencies, compute, publish) {
        const cached = readQueryCache(this.#database, key, signature);
        if (cached !== undefined) {
            return cached;
        }
        const pending = `pending:${randomUUID()}`;
        this.transaction(() => {
            installQueryCache(this.#database, key, dependencies);
            writeQueryCache(this.#database, key, pending, null);
        });
        const result = this.transaction(compute, false);
        // Releasing the read snapshot before the short publication avoids SQLITE_BUSY_SNAPSHOT when
        // unrelated editor writes occur during a long computation. Dependency triggers erase the token
        // if an input changes. Another reader's newer result also wins over this publication.
        this.transaction(() => {
            if (this.#database.prepare("SELECT signature FROM query_cache WHERE name=?").get(key)
                ?.signature === pending) {
                publish?.();
                writeQueryCache(this.#database, key, signature, result);
            }
        });
        return result;
    }
    /** CPU architectures at one PC from indexed scalar columns. Register payloads are untouched.
     * @param {string} space Exact logical address space.
     * @param {number} address Instruction address.
     * @returns {string[]} Distinct observed architecture IDs.
     */
    runtimeArchitecturesAt(space, address) {
        return this.#database
            .prepare("SELECT architecture FROM query_runtime_architectures WHERE address_space=? AND address=? ORDER BY architecture")
            .all(space, address)
            .map((row) => String(row.architecture));
    }
    /** Build distinct processor/location hints once instead of rescanning hot-PC register rows per function. */
    prepareRuntimeArchitectures() {
        try {
            this.cachedProjection("runtime_architectures", "2", ["runtime"], () => {
                this.#database
                    .exec(`CREATE TEMP TABLE runtime_architectures_pending(address_space TEXT,address INTEGER,architecture TEXT,PRIMARY KEY(address_space,address,architecture)) WITHOUT ROWID;
          INSERT OR IGNORE INTO temp.runtime_architectures_pending SELECT address_space,address,architecture FROM runtime NOT INDEXED WHERE kind IN ('runtime-execution','runtime-instruction','runtime-cpu-state');`);
                return true;
            }, () => {
                this.#database
                    .exec(`CREATE TABLE IF NOT EXISTS query_runtime_architectures(address_space TEXT,address INTEGER,architecture TEXT,PRIMARY KEY(address_space,address,architecture)) WITHOUT ROWID;
          DELETE FROM query_runtime_architectures;
          INSERT INTO query_runtime_architectures SELECT * FROM temp.runtime_architectures_pending;`);
            });
            if (!readQueryCache(this.#database, "runtime_architectures", "2")) {
                throw new Error("Runtime changed while building processor hints. Refresh the view.");
            }
        }
        finally {
            this.#database.exec("DROP TABLE IF EXISTS temp.runtime_architectures_pending");
        }
    }
    /** Select a bounded CFG navigation window through its address index.
     * @param {string} space Exact logical address space.
     * @param {number} address Selected PC.
     * @param {readonly string[]} architectures Optional specification prefixes.
     * @returns {AnalysisRecord[]} Four preceding and 28 following variants, in address order.
     */
    navigationNodes(space, address, architectures) {
        const matches = architectures.length
            ? " AND EXISTS(SELECT 1 FROM json_each(?) h WHERE json_extract(analysis_json(payload),'$.specificationId')=h.value OR substr(json_extract(analysis_json(payload),'$.specificationId'),1,length(h.value)+1)=h.value||'.')"
            : "";
        const parameters = [space, address];
        if (architectures.length) {
            parameters.push(JSON.stringify(architectures));
        }
        const before = this.#database
            .prepare(`SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address<? ${matches} ORDER BY address DESC,id DESC LIMIT 4`)
            .all(...parameters)
            .reverse();
        const after = this.#database
            .prepare(`SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address>=? ${matches} ORDER BY address,id LIMIT ?`)
            .all(...parameters, 32 - before.length);
        return [...before, ...after].map((row) => parseRecord(row.payload));
    }
    /** Explicit known-code intervals, grouped in SQL for the incomplete-analysis preservation guard.
     * @returns {Array} Half-open ROM-content intervals.
     */
    codeRanges() {
        return this.#database
            .prepare("SELECT file_offset AS start,MAX(file_offset+size) AS end FROM query_instruction_nodes WHERE file_offset IS NOT NULL GROUP BY file_offset")
            .all()
            .map((row) => ({ start: Number(row.start), end: Number(row.end) }));
    }
    /** Select processor MMIO observations before decoding payloads.
     * @param {string} architecture Exact runtime architecture.
     * @param {string} space Instruction and accessed logical space.
     * @param {readonly number[]} addresses Exact hardware addresses, including target-approved mirrors.
     * @returns {IterableIterator<RuntimeEvidenceRecord>} SQL-grouped observations. Counts/provenance stay exact.
     * @yields {RuntimeEvidenceRecord} One role-relevant access variant.
     */
    *runtimeMemoryAtAddresses(architecture, space, addresses) {
        // Values do not affect register-role detection. Keep access/actor/channel, site and provenance paired.
        const sql = `WITH candidates AS MATERIALIZED (SELECT r.*,analysis_json(r.payload) AS json FROM runtime r
      WHERE r.kind='runtime-memory-access' AND r.architecture=? AND r.instruction_address_space=? AND r.accessed_address_space=?
      AND r.accessed_address IN (SELECT value FROM json_each(?))), grouped AS (
      SELECT *,SUM(count) AS total FROM candidates GROUP BY instruction_address,accessed_address,evidence_id,
      json_extract(json,'$.access'),json_extract(json,'$.actor'),json_extract(json,'$.channel'))
      SELECT g.*,p.value AS id_prefix,e.value AS evidence FROM grouped g JOIN runtime_prefixes p ON p.id=g.prefix_id JOIN runtime_evidence e ON e.id=g.evidence_id`;
        for (const row of this.#database
            .prepare(sql)
            .iterate(architecture, space, space, JSON.stringify(addresses))) {
            yield runtimeFromRow({ ...row, count: row.total });
        }
    }
    /** Decode-state variants aggregated in SQL. Raw register histories never become a JS array.
     * The signature includes the ordered state fields and architecture. Aliases remain distinct so
     * the target decoder retains its original precedence and validation rules.
     * @param {string} architecture Exact instruction architecture.
     * @param {string} space Exact instruction address space.
     * @param {readonly string[]} stateFields Only fields the target decoder consumes, including aliases.
     * @param {Readonly<Record>} masks Optional decoder bit masks, applied only to valid nonnegative integers up to max.
     * @returns {IterableIterator<RuntimeEvidenceRecord>} SQL cursor over compact variants with exact per-evidence counts.
     * Prepare before starting the consuming read transaction.
     */
    runtimeInstructionVariants(architecture, space, stateFields, masks = {}) {
        return runtimeInstructionSummary(this.#database, (action, write) => this.transaction(action, write), architecture, space, stateFields, masks);
    }
    /** Exact execution seed totals grouped by PC and provenance, without decoding execution payloads.
     * @param {string} architecture Target processor.
     * @param {string} space Logical CPU address space.
     * @returns {RuntimeEvidenceRecord[]} Execution facts reduced to the fields used for seed selection.
     */
    runtimeExecutionSeeds(architecture, space) {
        return this.#database
            .prepare(`SELECT r.address,SUM(r.count) AS count,r.evidence_id,e.value AS evidence FROM runtime r JOIN runtime_evidence e ON e.id=r.evidence_id
      WHERE r.kind='runtime-execution' AND r.architecture=? AND r.address_space=? GROUP BY r.address,r.evidence_id`)
            .all(architecture, space)
            .map((row) => ({
            id: `query:execution:${String(row.address)}:${String(row.evidence_id)}`,
            kind: "runtime-execution",
            architecture,
            addressSpace: space,
            address: Number(row.address),
            count: Number(row.count),
            evidence: JSON.parse(String(row.evidence)),
        }));
    }
    /** Build additive query indexes once, then refresh only rows invalidated by project writes. */
    prepareAnnotationQueries() {
        if (annotationQueryIndexesReady(this.#database)) {
            return;
        }
        this.transaction(() => ensureAnnotationQueryIndexes(this.#database));
    }
    /** Prepare direct source attribution indexes without decoding runtime payloads. */
    prepareSourceQueries() {
        if (!sourceQueriesReady(this.#database)) {
            this.transaction(() => prepareSourceQueries(this.#database));
        }
    }
    /** Validated source identities from small catalog tables in the caller's read snapshot.
     * @returns {object} Manifest and sources ordered by their most recent successful import.
     */
    sourceCatalog() {
        const manifest = this.manifest();
        const shards = {
            imports: this.loadTable("imports"),
            evidence: this.loadTable("evidence"),
            analysis: [],
            labels: [],
            comments: [],
            annotations: [],
            regions: [],
            runtime: [],
        };
        validateLoadedShards(shards, manifest);
        const importTimes = new Map(this.#database
            .prepare("SELECT sha256,last_seen_at FROM capture_catalog")
            .all()
            .map((row) => [String(row.sha256), Number(row.last_seen_at)]));
        return { manifest, sources: buildAnalysisSourceCatalog(shards, importTimes) };
    }
    /** Exact SQL counts for a catalog source. No baseline or inferred static execution.
     * @param {string} sourceId Catalog source ID.
     * @returns {object} Manifest and source counts.
     */
    sourceSummary(sourceId) {
        const { manifest, sources } = this.sourceCatalog();
        const source = sources.find(({ id }) => id === sourceId);
        if (!source) {
            throw new Error("Unknown analysis source.");
        }
        return { manifest, summary: readSourceSummary(this.#database, source) };
    }
    /** At most 200 SQL-selected contribution rows, decoded within the caller's read transaction.
     * @param {string} sourceId Catalog source ID.
     * @param {AnalysisSourceGroup} group Contribution category.
     * @param {number} offset Nonnegative page offset.
     * @returns {Array} Bounded source records.
     */
    sourcePage(sourceId, group, offset = 0) {
        const source = this.sourceCatalog().sources.find(({ id }) => id === sourceId);
        if (!source) {
            throw new Error("Unknown analysis source.");
        }
        return readSourcePage(this.#database, source, group, offset);
    }
    /**
     * Read names, comments and provenance for editing without materializing instruction variants.
     * @returns {object} Validated editing metadata from the caller's read transaction.
     */
    annotationEditView() {
        const manifest = this.manifest();
        const shards = {
            labels: this.loadTable("labels"),
            comments: this.loadTable("comments"),
            evidence: this.loadTable("evidence"),
            analysis: this.analysisByKinds(["function"]),
            annotations: [],
            regions: [],
            imports: [],
            runtime: [],
        };
        validateLoadedShards(shards, manifest);
        return { manifest, shards };
    }
    /** Small export metadata. Instruction candidates are supplied separately by an ordered SQL cursor.
     * @returns {object} Validated manifest, metadata, and an empty runtime collection.
     */
    sourceExportView() {
        const manifest = this.manifest();
        const shards = {
            labels: this.loadTable("labels"),
            comments: this.loadTable("comments"),
            evidence: this.loadTable("evidence"),
            regions: this.loadTable("regions"),
            annotations: this.loadTable("annotations"),
            analysis: this.analysisByKinds(["function", "conflict"]),
            imports: [],
            runtime: [],
        };
        validateLoadedShards(shards, manifest);
        return { manifest, shards };
    }
    /**
     * Stream one file-offset group at a time. Do not retain the complete CFG to plan source.
     * The caller prepares annotation indexes first and owns a read transaction until iteration ends.
     * @returns {IterableIterator<readonly InstructionExportRecord[]>} All variants at each explicit output offset.
     * @yields {readonly InstructionExportRecord[]} One complete group, without clipping variants.
     */
    *instructionExportGroups() {
        const spaces = new Map(this.manifest().addressSpaces.map((space) => [space.id, 2 ** space.addressBits]));
        const evidence = new Set(this.loadTable("evidence").map(({ id }) => id));
        let previous;
        let group = [];
        for (const row of this.#database
            .prepare("SELECT file_offset,data FROM query_instruction_nodes WHERE file_offset IS NOT NULL ORDER BY file_offset")
            .iterate()) {
            const offset = Number(row.file_offset);
            if (previous !== undefined && previous !== offset) {
                yield group;
                group = [];
            }
            const record = parseRecord(row.data);
            if (typeof record.id !== "string" ||
                !record.id ||
                !Number.isSafeInteger(record.address) ||
                record.address < 0 ||
                record.address >= (spaces.get(record.addressSpace) ?? 0) ||
                !Number.isSafeInteger(record.size) ||
                record.size < 1 ||
                !Number.isSafeInteger(record.opcode) ||
                typeof record.specificationId !== "string" ||
                !record.incomingState ||
                typeof record.incomingState !== "object" ||
                !Array.isArray(record.evidence) ||
                record.evidence.some((id) => typeof id !== "string" || !evidence.has(id))) {
                throw new Error("Invalid indexed export instruction or missing provenance.");
            }
            group.push(record);
            previous = offset;
        }
        if (group.length) {
            yield group;
        }
    }
    /**
     * Read and validate only the requested instruction metadata and bounded runtime details.
     * @param {readonly AnnotationQueryRange[]} ranges Exact visible source/debugger coordinates.
     * @returns {SqliteAnnotationView} Small view. Consume inside the caller's read transaction.
     */
    instructionAnnotationView(ranges) {
        const manifest = this.manifest();
        const result = readSqliteAnnotationView(this.#database, manifest, ranges);
        validateLoadedShards(result.shards, manifest);
        return result;
    }
    /**
     * Exact viewport counts without materializing the detailed instruction projection.
     * @param {readonly AnnotationQueryRange[]} ranges Current mapped coordinates, validated by the query.
     * @returns {readonly InstructionExecutionSummaryRow[]} Bounded locations with exact execution totals.
     */
    instructionExecutionSummary(ranges) {
        return readInstructionExecutionSummary(this.#database, this.manifest(), ranges);
    }
    /**
     * Read selected metadata kinds through the address index instead of loading the complete CFG.
     * @param {readonly AnalysisRecord["kind"][]} kinds Analysis discriminators to include.
     * @returns {AnalysisRecord[]} Matching rows in stable ID order.
     */
    analysisByKinds(kinds) {
        if (!kinds.length) {
            return [];
        }
        const records = [];
        for (const row of this.#database
            .prepare(`SELECT payload FROM analysis WHERE kind IN (${kinds.map(() => "?").join(",")}) ORDER BY id`)
            .iterate(...kinds)) {
            records.push(parseRecord(row.payload));
        }
        return records;
    }
    /**
     * Resolve an edit boundary to representative CFG nodes, one per qualified location.
     * Call after preparing query indexes and consume inside a read transaction.
     * @param {string} addressSpace Exact debug-map/native address space.
     * @param {number} address Instruction start in that space.
     * @param {number} [outputOffset] Optional explicit file offset, never an inferred mapper alias.
     * @returns {AnalysisProjectShards["analysis"]} Location representatives. State variants need not be loaded to edit a comment.
     */
    annotationNodesAt(addressSpace, address, outputOffset) {
        // File coordinates must use the compact output index. A kind-only plan scans every node
        // before the annotation form can resolve even one instruction boundary.
        const rows = this.#database
            .prepare(`SELECT payload FROM analysis WHERE rowid IN (
      SELECT MIN(rowid) FROM analysis WHERE kind='cfg-node' AND address_space=? AND address=? GROUP BY address_space,address
      UNION SELECT MIN(rowid) FROM analysis INDEXED BY query_instruction_output
      WHERE kind='cfg-node' AND query_file_offset=? GROUP BY address_space,address)`)
            .all(addressSpace, address, outputOffset ?? null);
        return rows.map((row) => parseRecord(row.payload));
    }
    /**
     * Materialize complete record arrays without semantic validation. Run inside a read transaction.
     * @param {boolean} [runtime] Defaults to true. False omits runtime and must not be treated as a complete replacement.
     * @returns {AnalysisProjectShards} Decoded record arrays owned by the caller.
     */
    loadShards(runtime = true) {
        return {
            evidence: this.loadTable("evidence"),
            labels: this.loadTable("labels"),
            comments: this.loadTable("comments"),
            regions: this.loadTable("regions"),
            annotations: this.loadTable("annotations"),
            analysis: this.loadTable("analysis"),
            imports: this.loadTable("imports"),
            runtime: runtime ? [...this.runtimeRecords()].sort(compareRuntimeRecordIds) : [],
        };
    }
    /**
     * Table counts for reports.
     * @returns {Readonly<Record<string, number>>} Row counts.
     */
    counts() {
        const tables = [
            "evidence",
            "labels",
            "comments",
            "regions",
            "annotations",
            "analysis",
            "imports",
            "runtime",
        ];
        const result = {};
        for (const table of tables) {
            const row = this.#database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
            result[table] = Number(row?.n ?? 0);
        }
        return result;
    }
    /**
     * Count analysis kinds without inflating or parsing their compressed payloads.
     * @returns {Readonly<Record<string, number>>} Counts by analysis record discriminator.
     */
    analysisCounts() {
        const result = {};
        for (const row of this.#database
            .prepare("SELECT kind, COUNT(*) AS n FROM analysis GROUP BY kind")
            .iterate()) {
            result[String(row.kind)] = Number(row.n);
        }
        return result;
    }
    /**
     * Summarize per-PC execution facts using stored columns, without reading register history.
     * @returns {object} Fact count and total observed executions in the owning transaction.
     */
    runtimeExecutionCounts() {
        const row = this.#database
            .prepare("SELECT COUNT(*) AS records, COALESCE(SUM(count), 0) AS events FROM runtime WHERE kind='runtime-execution'")
            .get();
        return { records: Number(row?.records ?? 0), events: Number(row?.events ?? 0) };
    }
    /**
     * Atomically refresh the watcher hint after commit. SQLite is authoritative: a failed hint write
     * is reported as a warning, never as a failed import that could cause an unsafe retry.
     * @param {string} directory Project root for the watcher hint.
     */
    writePointer(directory) {
        const temporary = path.join(directory, `.analysis.json.${randomUUID()}.tmp`);
        try {
            // Serialize watcher refreshes with writers so an older refresher cannot overwrite a newer hint.
            this.transaction(() => {
                fs.writeFileSync(temporary, canonicalJson(this.manifest()), { flag: "wx" });
                fs.renameSync(temporary, path.join(directory, ANALYSIS_PROJECT_MANIFEST));
            });
        }
        catch (error) {
            process.emitWarning(`Analysis database committed, but its watcher pointer could not be refreshed: ${String(error)}`);
        }
        finally {
            try {
                fs.rmSync(temporary, { force: true });
            }
            catch {
                /* An abandoned watcher hint must not turn a committed publication into a failure. */
            }
        }
    }
    /** Checkpoint and reclaim unused SQLite pages. Run only during explicit storage maintenance. */
    compact() {
        const disk = fs.statfsSync(path.dirname(this.file));
        const pageCount = Number(this.#database.prepare("PRAGMA page_count").get()?.page_count);
        const pageSize = Number(this.#database.prepare("PRAGMA page_size").get()?.page_size);
        if (disk.bavail * disk.bsize < 2 * pageCount * pageSize) {
            throw new Error("Insufficient free disk space for SQLite VACUUM. Allow twice the database size.");
        }
        this.transaction(() => {
            collectRuntimeHistory(this.#database);
            // Retired provenance/prefix sets may remain after complete runtime replacements. Prune with
            // set queries so compaction does not perform one full runtime scan per dictionary entry.
            this.#database.exec(`
        DELETE FROM runtime_prefixes WHERE id NOT IN (SELECT DISTINCT prefix_id FROM runtime);
        DELETE FROM runtime_evidence WHERE id NOT IN (SELECT DISTINCT evidence_id FROM runtime);
      `);
        });
        this.#database.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
    }
    /** Current persisted policy. Defaults do not write or change the semantic revision.
     * @returns {AnalysisStoragePolicy} Validated defaults and persisted overrides.
     */
    storagePolicy() {
        return readStoragePolicy(this.#database);
    }
    /** Update only explicit policy fields in the caller's writer transaction.
     * @param {Partial<AnalysisStoragePolicy>} patch Explicit limits, in bytes/days/counts.
     * @returns {AnalysisStoragePolicy} Complete policy saved without changing the edit revision.
     */
    setStoragePolicy(patch) {
        this.#requireTransaction();
        const policy = validateStoragePolicy({ ...this.storagePolicy(), ...patch });
        this.#database
            .prepare("INSERT OR REPLACE INTO meta VALUES('storage-policy',?)")
            .run(JSON.stringify(policy));
        return policy;
    }
    /** Storage accounting avoids decoding runtime or analysis payloads.
     * @returns {object} Physical allocation and logical retention counts.
     */
    storageSnapshot() {
        return storageSnapshot(this.#database, this.file);
    }
    /** Optional projection allocation, including secondary indexes. Reserved for explicit accounting.
     * @returns {number} Allocated cache bytes, excluding permanent editor/export indexes.
     */
    storageCacheBytes() {
        return optionalCacheBytes(this.#database);
    }
    /** Durable receipt lookup survives source-file removal and cache eviction.
     * @param {string} sha256 Canonical capture identity.
     * @returns {object | undefined} Retained import identity and counts.
     */
    captureReceipt(sha256) {
        return this.#database.prepare("SELECT * FROM capture_catalog WHERE sha256=?").get(sha256);
    }
    /** Catalog rows contain small import provenance metadata, never capture contents.
     * @returns {object[]} Small capture metadata rows in import order.
     */
    captureCatalog() {
        return this.#database
            .prepare("SELECT * FROM capture_catalog ORDER BY imported_at,sha256")
            .all();
    }
    /** Record the first successful import atomically with its facts. Reimports only refresh last-seen time.
     * @param {ImportReport} report Successfully validated native trace import.
     */
    recordCaptureReceipt(report) {
        this.#requireTransaction();
        if (!["uttori-asm-instruction-trace", "uttori-asm-bus-trace"].includes(report.format)) {
            return;
        }
        const now = Date.now();
        this.#database
            .prepare(`INSERT INTO capture_catalog(sha256,profile,source_name,imported_at,last_seen_at,observed_events,dropped_events)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(sha256) DO UPDATE SET last_seen_at=excluded.last_seen_at`)
            .run(report.sourceSha256, report.indexProfile ?? "full", report.sourceName, now, now, report.imported.busEvents ?? report.imported.executionEvents ?? 0, report.unsupported.find((entry) => entry.field === "instruction-addresses")?.count ?? 0);
    }
    /** Drop disposable projections after publication, then recycle WAL without waiting on active readers.
     * @returns {object} Cache eviction totals and whether readers delayed WAL truncation.
     */
    maintainStorage() {
        const caches = this.transaction(() => maintainStorageCaches(this.#database));
        const previousTimeout = Number(this.#database.prepare("PRAGMA busy_timeout").get().timeout);
        try {
            this.#database.exec("PRAGMA busy_timeout=0; PRAGMA wal_checkpoint(PASSIVE)");
            const checkpoint = this.#database.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
            return { ...caches, checkpointBusy: Number(checkpoint?.busy ?? 0) !== 0 };
        }
        finally {
            this.#database.exec(`PRAGMA busy_timeout=${previousTimeout}`);
        }
    }
    /** Close once in finally, releasing statements and any active transaction. Further use throws. */
    close() {
        this.#database.close();
    }
}
//# sourceMappingURL=sqlite-store.js.map