import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { setImmediate } from "node:timers/promises";
import { canonicalJson } from "./canonical-json.js";
import { parseAnalysisProjectManifest } from "./project-store.js";
import { createRuntimeRecordValidator, validateLoadedShards } from "./project-validation.js";
import { RUNTIME_ANALYSIS_PROFILE } from "./runtime-trace-profile.js";
import { SQLITE_MIGRATION_BACKUP, SQLITE_MIGRATION_DIRECTORY, sqliteFileIdentity, syncSqlitePath, } from "./sqlite-maintenance.js";
import { decodeSqlitePayload } from "./sqlite-payload.js";
import { runtimeFromRow } from "./sqlite-records.js";
import { RuntimeDigest, migrationRuntimeQuery, prepareRuntimeConversion, convertedRuntimeRecords, } from "./sqlite-runtime-conversion.js";
import { ANALYSIS_PROJECT_SQLITE_FILE, ANALYSIS_SQLITE_STORAGE_VERSION, SqliteAnalysisStore, } from "./sqlite-store.js";
const TABLES = [
    "evidence",
    "labels",
    "comments",
    "regions",
    "annotations",
    "analysis",
    "imports",
    "runtime",
];
const RESERVE_BYTES = 256 * 1024 * 1024;
/**
 * Publish a small recovery record only after its file contents and directory entry are durable.
 * @param {string} stage Owned staging directory.
 * @param {MigrationJournal} journal Source/destination identities and completed validation results.
 */
const writeJournal = (stage, journal) => {
    const temporary = path.join(stage, "journal.tmp");
    fs.writeFileSync(temporary, JSON.stringify(journal), { mode: 0o600 });
    syncSqlitePath(temporary);
    fs.renameSync(temporary, path.join(stage, "journal.json"));
    syncSqlitePath(stage);
};
/**
 * Treat inaccessible processes as live; only ESRCH permits automatic crash recovery.
 * @param {number} pid Recorded owner process.
 * @returns {boolean} Whether ownership may still be active.
 */
const processAlive = (pid) => {
    if (!Number.isSafeInteger(pid) || pid <= 0)
        throw new Error("Invalid SQLite migration owner.");
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error.code !== "ESRCH";
    }
};
/**
 * Read the authoritative header while the source connection owns its exclusive snapshot.
 * @param {DatabaseSync} database Existing project database.
 * @returns {AnalysisProjectManifest} Validated manifest with the actual publication counter.
 */
const sourceManifest = (database) => {
    const manifest = JSON.parse(String(database.prepare("SELECT v FROM meta WHERE k='manifest'").get()?.v));
    const revision = Number(database.prepare("SELECT v FROM meta WHERE k='revision'").get()?.v);
    return parseAnalysisProjectManifest({ ...manifest, revision });
};
/**
 * Stream supported SQLite layouts, optionally substituting the explicitly requested working index.
 * @param {DatabaseSync} database Format-zero source under an exclusive SQLite lock.
 * @param {ShardKind} kind Table selected from the fixed semantic table inventory.
 * @returns {IterableIterator} Stable-ID-ordered semantic records.
 * @yields {object} One decoded record with its original external identity.
 * @param {number} version Supported source layout.
 * @param {boolean} convert Use the completed native working-index projection.
 */
function* legacyRecords(database, kind, version, convert = false) {
    if (kind === "runtime") {
        if (convert)
            yield* convertedRuntimeRecords(database);
        else
            for (const row of database.prepare(migrationRuntimeQuery(version)).iterate())
                yield runtimeFromRow(row);
        return;
    }
    for (const row of database.prepare(`SELECT * FROM ${kind} ORDER BY id`).iterate()) {
        let record = JSON.parse(decodeSqlitePayload(row.payload));
        if (record.id !== row.id)
            throw new Error(`Stored ${kind} ID differs from its payload.`);
        if (convert &&
            kind === "imports" &&
            "format" in record &&
            record.format === "uttori-asm-instruction-trace" &&
            database
                .prepare("SELECT 1 FROM temp.converted_captures WHERE sha256=?")
                .get(record.sourceSha256))
            record = { ...record, indexProfile: RUNTIME_ANALYSIS_PROFILE };
        yield record;
    }
}
/**
 * Recover only staging paths whose persisted inode identities prove they belong to this migration.
 * @param {string} directory Project root.
 * @returns {SqliteMigrationResult | undefined} A completed publication, or undefined after discarding an interrupted copy.
 */
const recoverMigration = (directory) => {
    const stage = path.join(directory, SQLITE_MIGRATION_DIRECTORY);
    const file = path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE);
    const backup = path.join(directory, SQLITE_MIGRATION_BACKUP);
    const journal = JSON.parse(fs.readFileSync(path.join(stage, "journal.json"), "utf8"));
    if (!journal.released && processAlive(journal.pid))
        throw new Error("Another process owns the analysis storage migration.");
    const identity = sqliteFileIdentity(file);
    if (identity === journal.targetIdentity && journal.result) {
        const database = new DatabaseSync(file, { readOnly: true });
        try {
            if (createHash("sha256")
                .update(canonicalJson(sourceManifest(database)))
                .digest("hex") !== journal.manifestSha256)
                throw new Error("Published migration identity differs from its recovery journal.");
        }
        finally {
            database.close();
        }
        if (sqliteFileIdentity(backup) !== journal.sourceIdentity)
            throw new Error("Migration backup identity differs from its recovery journal.");
        fs.rmSync(stage, { recursive: true });
        syncSqlitePath(directory);
        return { ...journal.result, recovered: true };
    }
    if (identity !== journal.sourceIdentity)
        throw new Error("Analysis database identity changed outside the recorded migration; preserving recovery files.");
    // A crash after linking the backup but before the atomic replacement leaves two names for the
    // unchanged source. Remove only that proven duplicate link, never an unrelated backup file.
    if (fs.existsSync(backup)) {
        if (sqliteFileIdentity(backup) !== identity)
            throw new Error("An unrelated migration backup already exists; preserving both databases.");
        fs.unlinkSync(backup);
    }
    fs.rmSync(stage, { recursive: true });
    syncSqlitePath(directory);
    return undefined;
};
/**
 * Convert supported SQLite layouts with per-table content digests; optional runtime projection is explicit.
 * The process gate blocks new clients; switching WAL to DELETE under exclusive locking also requires
 * existing SQLite readers to release the source. No source row or logical revision is changed.
 * @param {string} directory Existing project root, on a filesystem supporting same-directory hard links.
 * @param {SqliteMigrationOptions} [options] Cancellation and progress reporting.
 * @returns {Promise<SqliteMigrationResult>} Published sizes, content digests, and retained original path.
 */
export const migrateAnalysisProjectStorage = async (directory, options = {}) => {
    directory = path.resolve(directory);
    const file = path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE);
    const stage = path.join(directory, SQLITE_MIGRATION_DIRECTORY);
    const backup = path.join(directory, SQLITE_MIGRATION_BACKUP);
    if (fs.existsSync(stage)) {
        const recovered = recoverMigration(directory);
        if (recovered)
            return recovered;
    }
    options.signal?.throwIfAborted();
    if (fs.lstatSync(file).isSymbolicLink())
        throw new Error("Migrate a regular analysis database file, not a symbolic link.");
    // Checking the header is read-only; opening the normal store would correctly reject this old format.
    const probe = new DatabaseSync(file, { readOnly: true });
    let version;
    let manifest;
    try {
        version = Number(probe.prepare("PRAGMA user_version").get()?.user_version);
        if (![0, 1, ANALYSIS_SQLITE_STORAGE_VERSION].includes(version))
            throw new Error(`Cannot migrate unsupported analysis storage format ${version}.`);
        manifest = sourceManifest(probe);
    }
    finally {
        probe.close();
    }
    let beforeBytes = fs.statSync(file).size;
    if (version === ANALYSIS_SQLITE_STORAGE_VERSION && !options.convertRuntime)
        return {
            changed: false,
            recovered: false,
            storageVersion: version,
            beforeBytes,
            afterBytes: beforeBytes,
            tables: {},
            warnings: [],
        };
    if (fs.existsSync(backup))
        throw new Error(`Migration backup already exists: ${backup}`);
    const disk = fs.statfsSync(directory);
    // The sample-based format budget reserves half the source for the destination, another quarter
    // for index construction, plus a fixed safety margin. Runtime checks handle estimation error.
    const required = Math.ceil(beforeBytes * 0.75) + RESERVE_BYTES;
    if (disk.bavail * disk.bsize < required)
        throw new Error(`Insufficient migration workspace: need an estimated ${Math.ceil(required / 1024 / 1024)} MiB free.`);
    fs.mkdirSync(stage, { mode: 0o700 });
    let journal = {
        pid: process.pid,
        sourceIdentity: sqliteFileIdentity(file),
        beforeBytes,
        manifestSha256: createHash("sha256").update(canonicalJson(manifest)).digest("hex"),
    };
    let source;
    let destination;
    let linked = false;
    let published = false;
    let failed = false;
    const warnings = [];
    const notes = [];
    try {
        writeJournal(stage, journal);
        syncSqlitePath(directory);
        source = new DatabaseSync(file);
        try {
            source.exec("PRAGMA busy_timeout=1000; PRAGMA locking_mode=EXCLUSIVE; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE;");
        }
        catch (cause) {
            throw new Error(`Cannot acquire exclusive migration access; close clients using this analysis database and retry. ${String(cause)}`, { cause });
        }
        manifest = sourceManifest(source);
        beforeBytes = fs.statSync(file).size;
        // Recheck after acquiring SQLite's lock: a writer may have committed between the read-only probe
        // and creation of the migration gate. That commit belongs in the migrated snapshot.
        journal = {
            ...journal,
            beforeBytes,
            manifestSha256: createHash("sha256").update(canonicalJson(manifest)).digest("hex"),
        };
        writeJournal(stage, journal);
        const stagedFile = path.join(stage, ANALYSIS_PROJECT_SQLITE_FILE);
        destination = new SqliteAnalysisStore(stagedFile, true, true);
        const timings = [];
        const tables = {};
        if (options.convertRuntime) {
            const started = performance.now();
            const validateOriginal = createRuntimeRecordValidator(manifest, [...legacyRecords(source, "evidence", version)], false);
            try {
                // Projection must not turn a malformed original (for example a negative count) into a
                // plausible aggregate. Validate before omitting fields or combining equivalent variants.
                await prepareRuntimeConversion(source, version, {
                    signal: options.signal,
                    validateRecord: validateOriginal,
                    onProgress: (records) => options.onProgress?.({ phase: "project", table: "runtime", records }),
                });
            }
            finally {
                validateOriginal.close();
            }
            timings.push({
                step: "Project native runtime detail",
                durationMs: performance.now() - started,
            });
            notes.push("Full register-index detail was converted to 65816-analysis-v2. The original database is retained in the migration backup.");
        }
        for (const kind of TABLES) {
            const started = performance.now();
            const hash = kind === "runtime" ? new RuntimeDigest() : createHash("sha256");
            let count = 0;
            let bytes = 0;
            let batch = [];
            const flush = async () => {
                if (batch.length === 0)
                    return;
                options.signal?.throwIfAborted();
                const available = fs.statfsSync(directory);
                if (available.bavail * available.bsize < RESERVE_BYTES)
                    throw new Error("Migration stopped before exhausting free disk space.");
                destination.transaction(() => destination.appendRecords(kind, batch));
                batch = [];
                bytes = 0;
                options.onProgress?.({ phase: "copy", table: kind, records: count });
                await setImmediate();
            };
            for (const record of legacyRecords(source, kind, version, options.convertRuntime)) {
                const json = canonicalJson(record);
                hash.update(json);
                bytes += Buffer.byteLength(json);
                batch.push(record);
                count++;
                if (batch.length >= 2000 || bytes >= 4 * 1024 * 1024)
                    await flush();
            }
            await flush();
            tables[kind] = { records: count, sha256: String(hash.digest("hex")) };
            timings.push({ step: `Copy ${kind}`, durationMs: performance.now() - started });
        }
        destination.transaction(() => destination.initializeMigratedManifest(manifest));
        // Only provenance and region ancestry need cross-record context. Large CFG/annotation tables
        // use the existing validator in bounded batches; runtime retains no complete record collection.
        const context = {
            evidence: destination.loadTable("evidence"),
            regions: destination.loadTable("regions"),
            labels: [],
            comments: [],
            annotations: [],
            analysis: [],
            imports: [],
            runtime: [],
        };
        validateLoadedShards(context, manifest);
        const validateRuntime = createRuntimeRecordValidator(manifest, context.evidence, false);
        for (const kind of TABLES) {
            const started = performance.now();
            const hash = kind === "runtime" ? new RuntimeDigest() : createHash("sha256");
            let records = 0;
            let batch = [];
            let batchBytes = 0;
            const validateBatch = () => {
                if (batch.length !== 0)
                    validateLoadedShards({ ...context, [kind]: batch }, manifest);
                batch = [];
                batchBytes = 0;
            };
            for (const record of destination.records(kind)) {
                const json = canonicalJson(record);
                hash.update(json);
                if (kind === "runtime")
                    validateRuntime(record);
                else if (kind !== "evidence" && kind !== "regions") {
                    batch.push(record);
                    batchBytes += Buffer.byteLength(json);
                }
                records++;
                if (records % 2000 === 0 || batchBytes >= 4 * 1024 * 1024) {
                    validateBatch();
                    options.signal?.throwIfAborted();
                    options.onProgress?.({ phase: "verify", table: kind, records });
                    await setImmediate();
                }
            }
            validateBatch();
            if (records !== tables[kind].records || hash.digest("hex") !== tables[kind].sha256)
                throw new Error(`Migrated ${kind} records differ from the original database.`);
            timings.push({ step: `Verify ${kind}`, durationMs: performance.now() - started });
        }
        validateRuntime.close();
        destination.transaction(() => {
            for (const report of destination.loadTable("imports"))
                destination.recordCaptureReceipt(report);
        });
        if (version === ANALYSIS_SQLITE_STORAGE_VERSION) {
            const staged = new DatabaseSync(stagedFile);
            try {
                staged.exec("BEGIN IMMEDIATE");
                const save = staged.prepare("INSERT OR REPLACE INTO capture_catalog VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
                for (const row of source.prepare("SELECT * FROM capture_catalog").iterate())
                    save.run(...Object.values({
                        ...row,
                        profile: options.convertRuntime &&
                            source
                                .prepare("SELECT 1 FROM temp.converted_captures WHERE sha256=?")
                                .get(row.sha256)
                            ? RUNTIME_ANALYSIS_PROFILE
                            : row.profile,
                    }));
                const policy = source.prepare("SELECT v FROM meta WHERE k='storage-policy'").get()?.v;
                if (policy)
                    staged.prepare("INSERT OR REPLACE INTO meta VALUES('storage-policy',?)").run(policy);
                staged.exec("COMMIT");
            }
            finally {
                staged.close();
            }
        }
        options.signal?.throwIfAborted();
        options.onProgress?.({ phase: "indexes" });
        options.signal?.throwIfAborted();
        const indexStarted = performance.now();
        destination.finishMigration();
        timings.push({
            step: "Build indexes and verify SQLite integrity",
            durationMs: performance.now() - indexStarted,
        });
        // Index construction is synchronous native work. Yield once before publication so a queued
        // cancellation from the host can be delivered, then discard the staged file if it was requested.
        await setImmediate();
        options.signal?.throwIfAborted();
        destination.close();
        destination = undefined;
        syncSqlitePath(stagedFile);
        const result = {
            changed: true,
            recovered: false,
            storageVersion: ANALYSIS_SQLITE_STORAGE_VERSION,
            beforeBytes,
            afterBytes: fs.statSync(stagedFile).size,
            backupFile: backup,
            tables,
            warnings,
            notes,
            timings,
        };
        journal = { ...journal, targetIdentity: sqliteFileIdentity(stagedFile), result };
        writeJournal(stage, journal);
        options.signal?.throwIfAborted();
        options.onProgress?.({ phase: "publish" });
        options.signal?.throwIfAborted();
        // COMMIT leaves the exclusive connection lock held. The old database is now journal-free;
        // linking it retains a backup without copying 10 GiB or leaving a gap at the live pathname.
        source.exec("COMMIT");
        fs.linkSync(file, backup);
        linked = true;
        syncSqlitePath(directory);
        fs.renameSync(stagedFile, file);
        published = true;
        syncSqlitePath(directory);
        return result;
    }
    catch (error) {
        if (published && journal.result) {
            warnings.push(`Storage was published, but final housekeeping failed: ${String(error)}`);
            return { ...journal.result, warnings };
        }
        failed = true;
        throw error;
    }
    finally {
        try {
            try {
                destination?.close();
            }
            finally {
                // A staging close failure must not keep the original database exclusively locked.
                source?.close();
            }
            // Release logical ownership before removing the directory so a cleanup failure is retryable
            // even in a long-lived host. A killed process instead leaves its live-owner journal intact.
            writeJournal(stage, { ...journal, released: true });
            if (linked && !published && sqliteFileIdentity(file) === journal.sourceIdentity)
                fs.unlinkSync(backup);
            fs.rmSync(stage, { recursive: true, force: true });
            syncSqlitePath(directory);
        }
        catch (error) {
            const message = `SQLite migration cleanup needs recovery via project-migrate: ${String(error)}`;
            // As with transaction rollback, housekeeping must not hide the original disk/publication error.
            if (failed)
                process.emitWarning(message);
            else
                warnings.push(message);
        }
    }
};
//# sourceMappingURL=sqlite-migration.js.map