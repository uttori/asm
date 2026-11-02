import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import { canonicalEquals, canonicalJson } from "@uttori/asm-core/canonical-json";

import {
  buildAnalysisSourceCatalog,
  type AnalysisSourceGroup,
} from "../analysis/analysis-sources.js";
import {
  explainProjectEvidence,
  type ProjectEvidenceExplanation,
} from "../analysis/project-evidence.js";
import { TraceCache, type TraceIndexMetrics } from "../internal/trace-cache.js";
import { EvidencePool } from "../model/evidence-pool.js";
import {
  ANALYSIS_PROJECT_MANIFEST,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type AnalysisRecord,
  type ImportReport,
  type RuntimeEvidenceRecord,
  type RuntimeStateValue,
  type ShardKind,
} from "../model/project-types.js";
import {
  validateAnalysisProjectManifest,
  validateLoadedShards,
} from "../model/project-validation.js";
import {
  isFiniteNumber,
  isRecord,
  isStringArray,
  requireMetadataRecord,
} from "../model/record-shape.js";
import {
  validateResearchSnapshot,
  type ResearchSnapshot,
  type ResearchCollection,
} from "../research-inputs/inputs.js";
import {
  SNES_ANALYSIS_TRACE_PROFILE,
  SNES_ANALYSIS_STATE_FIELDS,
  SNES_ANALYSIS_STATE_MASKS,
  snesAnalysisTraceState,
} from "../runtime/runtime-analysis-profile.js";
import {
  mergeRuntimeEvidence,
  inspectRuntimeEvidence,
  type RuntimeEvidenceBatch,
  type RuntimeEvidenceConflict,
} from "../runtime/runtime-evidence.js";
import type { RuntimeTraceFactIndex, RuntimeTraceIndexedFact } from "../runtime/runtime-trace.js";
import {
  annotationQueryIndexesReady,
  ensureAnnotationQueryIndexes,
  readSqliteAnnotationView,
  readInstructionExecutionSummary,
  type InstructionExecutionSummaryRow,
  type AnnotationQueryRange,
  type SqliteAnnotationView,
  type InstructionExportRecord,
} from "./sqlite-annotation-query.js";
import { prepareGraph, publishGraph, isCallGraph } from "./sqlite-graph-query.js";
import { queryGraphicsEvidence, type GraphicsEvidenceQuery } from "./sqlite-graphics-query.js";
import {
  encodeSqlitePayload,
  decodeSqlitePayload,
  parseSqlitePayload,
  sqliteRuntimeIdentity,
} from "./sqlite-payload.js";
import { installQueryCache, readQueryCache, writeQueryCache } from "./sqlite-query-cache.js";
import {
  runtimeFromRow,
  analysisAddress,
  compareRuntimeRecordIds,
  isRuntimeEvidenceRecord,
} from "./sqlite-records.js";
import { projectResearchInputs, clearResearchProjection } from "./sqlite-research-inputs.js";
import {
  assertTraceRecordNamespace,
  SqliteRuntimeTraceBatch,
  type RuntimeTracePublicationSink,
} from "./sqlite-runtime-batch.js";
import { runtimeIdentityKey } from "./sqlite-runtime-facts.js";
import {
  collectRuntimeHistory,
  packRuntimeHistory,
  registerRuntimeHistory,
} from "./sqlite-runtime-history.js";
import {
  RUNTIME_RECORD_STREAM_SQL,
  RUNTIME_STORAGE_SCHEMA,
  SqliteRuntimeWriter,
} from "./sqlite-runtime-storage.js";
import { runtimeInstructionSummary } from "./sqlite-runtime-summary.js";
import {
  SOURCE_EXPORT_CACHE,
  clearSourceExportStage,
  publishSourceExportCache,
  sourceExportCacheReady,
  sourceExportCacheRecords,
  stageSourceExportGroups,
  uncachedSourceExportRecords,
} from "./sqlite-source-export.js";
import {
  prepareSourceQueries,
  sourceQueriesReady,
  readSourceSummary,
  readSourcePage,
} from "./sqlite-source-query.js";
import {
  CAPTURE_CATALOG_SCHEMA,
  readStoragePolicy,
  validateStoragePolicy,
  storageSnapshot,
  enforceDatabaseBudget,
  maintainStorageCaches,
  optionalCacheBytes,
  type AnalysisStoragePolicy,
} from "./sqlite-storage-policy.js";
import type { SqliteTraceStage } from "./sqlite-trace-stage.js";

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
] as const;

/** Joins retain bounded SQLite cursors. No project-sized dictionary is loaded on the JS heap. */
const RUNTIME_SELECT = `SELECT r.*, r.rowid AS storage_rowid, p.value AS id_prefix, e.value AS evidence
  FROM runtime AS r LEFT JOIN runtime_prefixes AS p ON p.id=r.prefix_id
  LEFT JOIN runtime_evidence AS e ON e.id=r.evidence_id`;

/**
 * Lookup parameters are the external prefix and binary/text suffix. Resolve both dictionaries
 * before probing observations: filtering the logical view by external ID otherwise scans every
 * observation in that capture, making a growing import quadratic. Full suffix equality protects
 * against truncated hash-key collisions. Signed rowids retain paired-state and deletion semantics.
 */
export const RUNTIME_RECORD_LOOKUP_SQL = `${RUNTIME_SELECT} WHERE r.rowid IN (
  SELECT oid FROM runtime_observations
  WHERE prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?1)
    AND identity_id=(SELECT iid FROM runtime_identities
      WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("?2")}) AND value=?2)
  UNION ALL
  SELECT -oid FROM runtime_observations
  WHERE state_prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?1)
    AND identity_id=(SELECT iid FROM runtime_identities
      WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("?2")}) AND value=?2)
)`;

/**
 * Resolves the sqlite file for a project pointer.
 * @param directory Project root containing analysis.json.
 * @param manifest Validated pointer.
 * @returns Joined sqlite path. Relative directories remain relative to process cwd.
 */
export const analysisProjectSqlitePath = (
  directory: string,
  manifest: Pick<AnalysisProjectManifest, "db">,
): string => {
  const relative = manifest.db ?? ANALYSIS_PROJECT_SQLITE_FILE;
  if (relative !== ANALYSIS_PROJECT_SQLITE_FILE) {
    throw new Error(`Unsupported analysis sqlite path '${relative}'.`);
  }
  return path.join(directory, relative);
};

/**
 * Decode physical storage and parse JSON. Callers validate the semantic record.
 * @param payload SQLite TEXT or a supported versioned BLOB.
 * @returns Parsed record, without semantic validation.
 */
const parseRecord = (payload: unknown): unknown => parseSqlitePayload(payload);

/** Accept an array of finite numbers; byte range is not checked. */
function isByteList(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

/** Accept a register record whose values are strings, booleans or finite numbers. */
function isRuntimeState(value: unknown): value is Readonly<Record<string, RuntimeStateValue>> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => typeof entry === "string" || typeof entry === "boolean" || isFiniteNumber(entry),
    )
  );
}

/**
 * Validate one disk-indexed trace fact and rebuild it without unrecognized fields.
 * @param value Decoded index payload.
 * @returns Execution, instruction or memory fact; execution identity is kept only when present.
 * @throws When the kind is unknown or its fields are malformed.
 */
function requireTraceFact(value: unknown): RuntimeTraceIndexedFact {
  if (!isRecord(value)) {
    throw new Error("Invalid indexed trace fact.");
  }
  if (value.kind === "execution" && isFiniteNumber(value.address)) {
    // Bank-qualified executions must survive the disk index just like in-memory facts.
    // Dropping the suffix here would merge different mappings when publishing a capture.
    if (
      value.identity !== undefined &&
      (typeof value.identity !== "string" || !/^[\da-f]{64}$/.test(value.identity))
    ) {
      throw new Error("Invalid indexed execution mapping identity.");
    }
    return {
      kind: "execution",
      address: value.address,
      ...(value.identity === undefined ? {} : { identity: value.identity }),
    };
  }
  if (
    value.kind === "instruction" &&
    typeof value.identity === "string" &&
    isFiniteNumber(value.address) &&
    isByteList(value.bytes) &&
    isRuntimeState(value.state)
  ) {
    return {
      kind: "instruction",
      identity: value.identity,
      address: value.address,
      bytes: value.bytes,
      state: value.state,
    };
  }
  if (value.kind === "memory" && isRuntimeEvidenceRecord(value.record)) {
    return { kind: "memory", record: value.record };
  }
  throw new Error("Invalid indexed trace fact.");
}

/** Allowlist of shard kinds stored as project collections. */
function isShardKind(value: string): value is ShardKind {
  return (
    value === "analysis" ||
    value === "annotations" ||
    value === "labels" ||
    value === "comments" ||
    value === "regions" ||
    value === "runtime" ||
    value === "evidence" ||
    value === "imports"
  );
}

/** Collections that derived analysis may replace; user-authored labels and regions are excluded. */
function isResearchUpdate(
  value: string,
): value is "analysis" | "annotations" | "comments" | "evidence" {
  return (
    value === "analysis" || value === "annotations" || value === "comments" || value === "evidence"
  );
}

/** Read an import counter; undefined when the report has no such key, so callers can fall back. */
function observedImportCount(
  counts: Readonly<Record<string, number>>,
  key: string,
): number | undefined {
  return Object.hasOwn(counts, key) ? counts[key] : undefined;
}

/** Narrow to a safe integer of any sign. */
function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/** Narrow to a non-null object; arrays are accepted. */
function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validate an indexed CFG node against the manifest before it is used for ROM/source emission.
 * @param value Decoded export projection.
 * @param spaces Address-space sizes; the address must fall below its space's size.
 * @param knownEvidence Evidence IDs every listed provenance entry must resolve to.
 * @returns True when the record is a complete, in-bounds export instruction.
 */
function isIndexedExportInstruction(
  value: unknown,
  spaces: ReadonlyMap<string, number>,
  knownEvidence: ReadonlySet<string>,
): value is InstructionExportRecord {
  if (!isObjectRecord(value)) {
    return false;
  }
  const address = value.address;
  const addressSpace = value.addressSpace;
  const size = value.size;
  const opcode = value.opcode;
  const incomingState = value.incomingState;
  const evidenceList = value.evidence;
  return (
    typeof value.id === "string" &&
    value.id !== "" &&
    value.kind === "cfg-node" &&
    isSafeInteger(value.fileOffset) &&
    value.fileOffset >= 0 &&
    typeof addressSpace === "string" &&
    isSafeInteger(address) &&
    address >= 0 &&
    address < (spaces.get(addressSpace) ?? 0) &&
    isSafeInteger(size) &&
    size >= 1 &&
    isSafeInteger(opcode) &&
    typeof value.specificationId === "string" &&
    typeof incomingState === "object" &&
    incomingState !== null &&
    Array.isArray(evidenceList) &&
    evidenceList.every((id: unknown) => typeof id === "string" && knownEvidence.has(id))
  );
}

/**
 * File identity rejects stale connections after an external restore or atomic replacement.
 * @param file Existing database path.
 * @returns Device/inode identity without integer precision loss.
 */
const sqliteFileIdentity = (file: string): string => {
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
  /** Connection-scoped sharing bounds repeated provenance allocation in metadata query views. */
  readonly #evidencePool = new EvidencePool();
  readonly #database: DatabaseSync;
  readonly #fileIdentity: string;
  /** Block cache is owned by this connection and reset on commit, rollback, and snapshot entry. */
  readonly #clearHistory: () => void;
  /** Database path as supplied at construction. Resolves relative to cwd when not absolute. */
  readonly file: string;
  readonly #insertEvidence: StatementSync;
  readonly #insertLabel: StatementSync;
  readonly #insertComment: StatementSync;
  readonly #insertRegion: StatementSync;
  readonly #insertAnnotation: StatementSync;
  readonly #insertAnalysis: StatementSync;
  readonly #insertImport: StatementSync;
  readonly #runtimeWriter: SqliteRuntimeWriter;
  readonly #findRuntime: StatementSync;
  readonly #dictionaryStatements = new Map<
    string,
    { find: StatementSync; insert: StatementSync }
  >();
  /** Transaction-local cache: rollback or another writer cannot leave stale integer references here. */
  readonly #dictionaryIds = new Map<string, number>();
  #dictionaryCacheBytes = 0;
  /** An import must restore Git decisions in the same transaction before exposing observations. */
  #researchSuspended = false;

  /**
   * Opens or creates a project database.
   * Opening validates physical format, not every semantic record, and may create SQLite journal files.
   * Connections use a 5,000 ms busy timeout. Lock contention can still throw a SQLite error.
   * @param file SQLite path. Parent directory must already exist.
   * @param [createSchema] Defaults to true. Permit initialization of an empty database, never upgrade an existing one.
   */
  constructor(file: string, createSchema = true) {
    if (!createSchema && !fs.existsSync(file)) {
      throw new Error(`Analysis database does not exist: ${file}`);
    }
    this.file = file;
    this.#database = new DatabaseSync(file, { open: true });
    this.#clearHistory = registerRuntimeHistory(this.#database);
    // SQL can inspect packed and compressed payloads without transferring full records to JS callers.
    this.#database.function("analysis_json", { deterministic: true }, (value) =>
      value === null ? "{}" : decodeSqlitePayload(value),
    );
    this.#fileIdentity = sqliteFileIdentity(file);
    try {
      const empty =
        Number(this.#database.prepare("SELECT count(*) AS n FROM sqlite_schema").get()?.n) === 0;
      const initialVersion = Number(
        this.#database.prepare("PRAGMA user_version").get()?.user_version,
      );
      if (createSchema && empty && initialVersion === 0) {
        this.#database.exec(SCHEMA);
        for (const sql of SCHEMA_INDEX_STATEMENTS) {
          this.#database.exec(sql);
        }
      }
      const version = Number(this.#database.prepare("PRAGMA user_version").get()?.user_version);
      if (version !== ANALYSIS_SQLITE_STORAGE_VERSION) {
        throw new Error(
          `Unsupported analysis storage format ${version}. Expected ${ANALYSIS_SQLITE_STORAGE_VERSION}. Only the current storage format is supported.`,
        );
      }
      // TEMP has a separate pager: its 2 MiB default churns on compact ID/projection trees even
      // when main's pages are hot. A 64 MiB target keeps those lookups useful without retaining the
      // full graph in memory; TEMP contents remain file-backed and grow independently on disk.
      this.#database.exec(
        "PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-8192; PRAGMA busy_timeout=5000; PRAGMA temp_store=FILE; PRAGMA temp.cache_size=-65536; PRAGMA journal_size_limit=67108864;",
      );
      this.#insertEvidence = this.#database.prepare(
        "INSERT INTO evidence (id, payload) VALUES (?, ?)",
      );
      this.#insertLabel = this.#database.prepare(
        "INSERT INTO labels (id, address_space, address, name, payload) VALUES (?, ?, ?, ?, ?)",
      );
      this.#insertComment = this.#database.prepare(
        "INSERT INTO comments (id, address_space, address, payload) VALUES (?, ?, ?, ?)",
      );
      this.#insertRegion = this.#database.prepare(
        'INSERT INTO regions (id, address_space, start, "end", payload) VALUES (?, ?, ?, ?, ?)',
      );
      this.#insertAnnotation = this.#database.prepare(
        'INSERT INTO annotations (id, address_space, start, "end", classification, payload) VALUES (?, ?, ?, ?, ?, ?)',
      );
      this.#insertAnalysis = this.#database.prepare(
        "INSERT INTO analysis (id, kind, address_space, address, payload) VALUES (?, ?, ?, ?, ?)",
      );
      this.#insertImport = this.#database.prepare(
        "INSERT INTO imports (id, payload) VALUES (?, ?)",
      );
      for (const table of ["runtime_prefixes", "runtime_evidence"]) {
        this.#dictionaryStatements.set(table, {
          find: this.#database.prepare(`SELECT id FROM ${table} WHERE value=?`),
          insert: this.#database.prepare(`INSERT INTO ${table} (value) VALUES (?)`),
        });
      }
      this.#findRuntime = this.#database.prepare(RUNTIME_RECORD_LOOKUP_SQL);
      this.#runtimeWriter = new SqliteRuntimeWriter(this.#database);
    } catch (error) {
      this.#database.close();
      throw error;
    }
  }

  /**
   * Preserve the triggering error when SQLite has already aborted (for example SQLITE_FULL).
   * A cleanup error must never replace the original failure reported to the user.
   */
  rollback(): void {
    this.#clearDictionaryCache();
    if (!this.#database.isTransaction) {
      return;
    }
    try {
      this.#database.exec("ROLLBACK");
    } catch {
      // Closing the owned connection is the final cleanup if rollback itself fails.
    }
  }

  /** Forget all transaction-owned dictionary references and their bounded text allocation. */
  #clearDictionaryCache(): void {
    this.#clearHistory();
    this.#dictionaryIds.clear();
    this.#dictionaryCacheBytes = 0;
  }

  /**
   * Intern exact text with a bounded cache. Callers hold the SQLite writer lock.
   * @param table One of the two prepared dictionary tables.
   * @param value Exact prefix or serialized evidence list.
   * @returns Transactionally created or existing dictionary rowid.
   */
  #intern(table: string, value: string): number {
    const key = `${table}:${value}`;
    const cached = this.#dictionaryIds.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const statements = this.#dictionaryStatements.get(table)!;
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

  #insertRecord(kind: ShardKind, value: unknown): void {
    if (kind === "evidence") {
      const record = requireMetadataRecord(kind, value);
      this.#insertEvidence.run(record.id, encodeSqlitePayload(JSON.stringify(record)));
      return;
    }
    if (kind === "labels") {
      const record = requireMetadataRecord(kind, value);
      this.#insertLabel.run(
        record.id,
        record.addressSpace,
        record.address,
        record.name,
        encodeSqlitePayload(JSON.stringify(record)),
      );
      return;
    }
    if (kind === "comments") {
      const record = requireMetadataRecord(kind, value);
      this.#insertComment.run(
        record.id,
        record.addressSpace,
        record.address,
        encodeSqlitePayload(JSON.stringify(record)),
      );
      return;
    }
    if (kind === "regions") {
      const record = requireMetadataRecord(kind, value);
      this.#insertRegion.run(
        record.id,
        record.addressSpace,
        record.start,
        record.end,
        encodeSqlitePayload(JSON.stringify(record)),
      );
      return;
    }
    if (kind === "annotations") {
      const record = requireMetadataRecord(kind, value);
      this.#insertAnnotation.run(
        record.id,
        record.addressSpace,
        record.start,
        record.end,
        record.classification,
        encodeSqlitePayload(JSON.stringify(record)),
      );
      return;
    }
    if (kind === "analysis") {
      const record = requireMetadataRecord(kind, value);
      const located = analysisAddress(record);
      this.#insertAnalysis.run(
        record.id,
        record.kind,
        located.addressSpace,
        located.address,
        encodeSqlitePayload(JSON.stringify(record)),
      );
      return;
    }
    if (kind === "imports") {
      const record = requireMetadataRecord(kind, value);
      this.#insertImport.run(record.id, encodeSqlitePayload(JSON.stringify(record)));
      this.recordCaptureReceipt(record);
      return;
    }
    if (!isRuntimeEvidenceRecord(value)) {
      throw new Error("Invalid stored runtime record.");
    }
    this.#runtimeWriter.insert(value, (table, entry) => this.#intern(table, entry));
  }

  /**
   * Run a synchronous unit against one SQLite snapshot. Writers acquire their lock before reading
   * the revision so a competing process cannot slip between the stale check and publication.
   * Throwing rolls back records and manifest changes. Promise/thenable results are rejected. Perform
   * async preparation before entering. Transactions cannot nest. Low-level callbacks must publish
   * the manifest themselves when changing semantic records. Prefer the commitAnalysisProject APIs.
   * @param action Synchronous work. Cursors must be consumed before returning.
   * @param [write] Defaults to true (BEGIN IMMEDIATE). False uses deferred BEGIN for reads, not an enforced read-only connection.
   * @returns Callback result after a successful commit.
   */
  transaction<T>(action: () => T, write = true): T {
    if (sqliteFileIdentity(this.file) !== this.#fileIdentity) {
      throw new Error(
        "Analysis database was replaced. Close this connection and reload the project.",
      );
    }
    this.#clearDictionaryCache();
    this.#database.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
    try {
      const revision = write ? this.revision() : 0;
      const result = action();
      if (this.#researchSuspended) {
        throw new Error("Reapply research inputs before publishing imported evidence.");
      }
      if (
        result !== null &&
        (typeof result === "object" || typeof result === "function") &&
        "then" in result &&
        typeof result.then === "function"
      ) {
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
    } catch (error) {
      this.rollback();
      this.#researchSuspended = false;
      throw error;
    }
  }

  /**
   * Index trace chunks in temporary or privately staged disk counters. This transaction never
   * reads or writes the destination project, allowing other writers during asynchronous parsing.
   * @param action Async parser using only the supplied counter index.
   * @param metrics Optional caller-owned diagnostic counters.
   * @param stage Optional private counters retained across publication failures.
   * @returns Parser result after counters commit. Staged counters survive connection close.
   */
  async indexTrace<T>(
    action: (index: RuntimeTraceFactIndex) => Promise<T>,
    metrics?: TraceIndexMetrics,
    stage?: SqliteTraceStage,
  ): Promise<T> {
    // Keep payloads out of the key B-tree: large full-register traces otherwise scatter
    // each lookup/insert across payload pages. Rowid storage appends those payloads and
    // leaves a smaller ID index. NOT NULL retains WITHOUT ROWID's key constraint.
    // The temp pager has its own cache; main.cache_size does not cover it. Use a 64 MiB
    // page-cache target to reduce churn while keeping the complete fact set backed by disk.
    const database = stage?.database ?? this.#database;
    const table = stage ? "main.trace_facts" : "temp.trace_facts";
    const reused = stage?.checkpoint !== undefined;
    if (!stage) {
      database.exec(`PRAGMA temp.cache_size=-65536;
        CREATE TEMP TABLE trace_facts (
        id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, count INTEGER NOT NULL
      )`);
    }
    if (!reused) {
      database.exec("BEGIN");
    }
    const increment = database.prepare(`UPDATE ${table} SET count=count+1 WHERE id=?`);
    const insert = database.prepare(`INSERT INTO ${table} VALUES (?, ?, 1)`);
    const values = database.prepare(`SELECT payload, count FROM ${table}`);
    const incrementMany = database.prepare(`UPDATE ${table} SET count=count+? WHERE id=?`);
    // Hot traces revisit a small working set millions of times. Keep at most
    // 4096 counter deltas. Payloads and the full distinct index remain on disk.
    const pending = new TraceCache<{ count: number }>(metrics);
    const flushEntry = (key: string, count: number): void => {
      if (!count) {
        return;
      }
      incrementMany.run(count, key);
      if (metrics) {
        metrics.sqlStatements++;
      }
    };
    const flush = (): void => {
      for (const [key, entry] of pending.entries()) {
        flushEntry(key, entry.count);
      }
      pending.clear();
    };
    const index: RuntimeTraceFactIndex = {
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
            fact: requireTraceFact(parseRecord(row.payload)),
            count: Number(row.count),
          };
        }
      },
      clear: () => {
        pending.clear();
        // Sealed counters remain immutable until destination publication succeeds.
        if (!stage?.checkpoint) {
          database.exec(`DELETE FROM ${table}`);
        }
      },
    };
    try {
      const result = await action(index);
      if (!reused) {
        flush();
        database.exec("COMMIT");
      }
      this.#clearDictionaryCache();
      return result;
    } catch (error) {
      this.#clearDictionaryCache();
      try {
        if (database.isTransaction) {
          database.exec("ROLLBACK");
        }
      } catch {
        // A full or damaged disk can abort SQLite itself. Preserve the parser's original error;
        // closing the owned connection remains the final rollback fallback for either database.
      }
      throw error;
    }
  }

  /** Require mutations to belong to an explicitly owned atomic publication. */
  #requireTransaction(): void {
    if (!this.#database.isTransaction) {
      throw new Error("Analysis mutation requires a transaction.");
    }
  }

  /**
   * Apply a selected metadata edit by stable ID. Omitted records are never deleted.
   * Validation and optimistic revision checks belong to the publication API.
   * @param before Original selected view.
   * @param after Edited selected view.
   */
  patchMetadata(before: AnalysisProjectShards, after: AnalysisProjectShards): void {
    this.#requireTransaction();
    for (const kind of [
      "analysis",
      "annotations",
      "labels",
      "comments",
      "regions",
      "evidence",
      "imports",
    ] as const) {
      const previous = new Map(before[kind].map((record) => [record.id, record]));
      const next = new Map(after[kind].map((record) => [record.id, record]));
      const find = this.#database.prepare(`SELECT payload FROM ${kind} WHERE id=?`);
      const remove = this.#database.prepare(`DELETE FROM ${kind} WHERE id=?`);
      for (const id of new Set([...previous.keys(), ...next.keys()])) {
        const prior = previous.get(id),
          record = next.get(id);
        if (canonicalEquals(prior, record)) {
          continue;
        }
        const stored = find.get(id);
        if (!canonicalEquals(stored ? parseRecord(stored.payload) : undefined, prior)) {
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
        if (
          this.#database
            .prepare(
              `SELECT 1 FROM ${table} r,json_each(analysis_json(r.payload),'$.evidence') e WHERE e.value IN (SELECT value FROM json_each(?)) LIMIT 1`,
            )
            .get(ids)
        ) {
          throw new Error("Cannot remove evidence still referenced by retained project records.");
        }
      }
      this.validateRuntimeEvidence();
    }
  }

  /**
   * Rebuild the selected Git research index, without loading runtime history or the CFG. A matching
   * revision is a constant-time no-op. Call inside a transaction and publish the watcher afterward.
   * Research files remain authoritative if the process exits before this cache is refreshed.
   */
  synchronizeResearchInputs(snapshot: ResearchSnapshot): boolean {
    return this.#synchronizeResearchInputs(snapshot);
  }

  /** A revision-pinned analyzer view can validate publication without decoding metadata twice. */
  #synchronizeResearchInputs(snapshot: ResearchSnapshot, view?: AnalysisProjectShards): boolean {
    this.#requireTransaction();
    const manifest = this.manifest();
    if (snapshot.romSha256 !== manifest.rom.contentSha256) {
      throw new Error("Research inputs belong to another ROM.");
    }
    validateResearchSnapshot(snapshot);
    const indexed = this.#database.prepare("SELECT v FROM meta WHERE k='research-inputs'").get()?.v;
    const revision = this.#database
      .prepare("SELECT v FROM meta WHERE k='research-index-revision'")
      .get()?.v;
    if (indexed === snapshot.hash && revision === String(this.revision())) {
      return false;
    }
    projectResearchInputs(this.#database, snapshot, (kind, record) =>
      this.#insertRecord(kind, record),
    );
    this.validateView(
      view ?? {
        labels: this.loadTable("labels"),
        comments: this.loadTable("comments"),
        regions: this.loadTable("regions"),
        annotations: this.loadTable("annotations"),
        evidence: this.loadTable("evidence"),
        analysis: this.analysisByKinds(["target-override", "target-set"]),
        imports: [],
        runtime: [],
      },
    );
    // A deleted manual provenance record must not leave references dangling in retained evidence.
    this.validateRuntimeEvidence();
    const published = this.publishManifest(manifest);
    this.#database
      .prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('research-index-revision',?)")
      .run(String(published.revision));
    this.#researchSuspended = false;
    return true;
  }

  /** Selected Git decision identity for callers pinning a consistent evidence/read snapshot. */
  researchInputsIdentity(): string | undefined {
    const value = this.#database.prepare("SELECT v FROM meta WHERE k='research-inputs'").get()?.v;
    return typeof value === "string" ? value : undefined;
  }

  /** Cheap read-only cache check; callers recheck identity/revision after consuming query results. */
  researchInputsAreCurrent(sha256: string): boolean {
    const revision = this.#database
      .prepare("SELECT v FROM meta WHERE k='research-index-revision'")
      .get()?.v;
    return this.researchInputsIdentity() === sha256 && revision === String(this.revision());
  }

  /** Observations stay usable while derived code is stale; generation and graph views require reanalysis. */
  assertCurrentAnalysis(): void {
    const reason = this.#database.prepare("SELECT v FROM meta WHERE k='analysis-dirty'").get()?.v;
    if (typeof reason === "string") {
      throw new Error(reason);
    }
  }

  /** Invalidate derived code within the same transaction that adds new observations. */
  invalidateAnalysis(): void {
    this.#requireTransaction();
    this.#database
      .prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('analysis-dirty',?)")
      .run(
        "Captured evidence changed. Analyze the selected inputs before regenerating or querying the derived graph.",
      );
  }

  /** Restore observations inside an import transaction; reapply the selected research before commit. */
  suspendResearchInputs(): void {
    this.#requireTransaction();
    this.#researchSuspended = true;
    clearResearchProjection(this.#database, (kind, record) => this.#insertRecord(kind, record));
  }

  /**
   * Publish analyzer output computed from the projected view without adopting Git decisions as
   * imported facts. Overridden IDs retain their observation shadows; removing a decision on a
   * later branch therefore restores the original record. Return the exact projected replacements
   * for validation without reparsing a million-row graph into a second set of JS objects.
   * An optional base view must belong to the revision checked under this writer lock. Its unchanged
   * collections combine with the projected replacements for the same complete publication validation.
   */
  replaceResearchAnalysis(
    snapshot: ResearchSnapshot,
    updates: Partial<
      Pick<AnalysisProjectShards, "analysis" | "annotations" | "comments" | "evidence">
    >,
    onProgress?: (collection: string) => void,
    baseView?: AnalysisProjectShards,
  ): Partial<Pick<AnalysisProjectShards, "analysis" | "annotations" | "comments" | "evidence">> {
    this.#requireTransaction();
    if (this.researchInputsIdentity() !== snapshot.hash) {
      throw new Error("Analysis publication requires the selected Git research snapshot.");
    }
    this.suspendResearchInputs();
    const projected: Partial<
      Pick<AnalysisProjectShards, "analysis" | "annotations" | "comments" | "evidence">
    > = {};
    for (const key of Object.keys(updates)) {
      if (!isResearchUpdate(key)) {
        throw new Error("Analysis may only replace derived metadata collections.");
      }
      const collection = key;
      const protectedIds = new Set(
        snapshot.decisions
          .filter((decision) => decision.collection === collection)
          .map((decision) => decision.id),
      );
      const records: AnalysisProjectShards[ResearchCollection][number][] = (
        updates[collection] ?? []
      ).filter((record) => !protectedIds.has(record.id));
      const current = [...records];
      for (const decision of snapshot.decisions) {
        if (decision.collection === collection && decision.value !== null) {
          current.push(decision.value);
        }
      }
      Object.assign(projected, { [collection]: current });
      const find = this.#database.prepare(`SELECT payload FROM ${collection} WHERE id=?`);
      for (const id of protectedIds) {
        const row = find.get(id);
        if (row) {
          const parsed: unknown = JSON.parse(decodeSqlitePayload(row.payload));
          switch (collection) {
            case "analysis":
              records.push(requireMetadataRecord(collection, parsed));
              break;
            case "annotations":
              records.push(requireMetadataRecord(collection, parsed));
              break;
            case "comments":
              records.push(requireMetadataRecord(collection, parsed));
              break;
            case "evidence":
              records.push(requireMetadataRecord(collection, parsed));
              break;
          }
        }
      }
      // The collection determines the record type; replaceTables retains byte-identical rows.
      this.replaceTables({ [collection]: records });
      onProgress?.(collection);
    }
    this.publishManifest(this.manifest());
    let view: AnalysisProjectShards | undefined;
    if (baseView !== undefined) {
      view = { ...baseView, ...projected, runtime: [] };
    }
    this.#synchronizeResearchInputs(snapshot, view);
    // Publication used this exact selected snapshot. Reapplying its projection is not a new edit.
    this.#database.exec("DELETE FROM meta WHERE k='analysis-dirty'");
    return projected;
  }

  /**
   * Replace only supplied tables, retaining byte-identical rows. The temporary ID set bounds
   * memory and deletes removed rows without rewriting unchanged metadata or runtime history.
   * Semantic validation belongs to the project publication API. This method must run in its transaction.
   * @param shards Validated replacements for explicitly named tables.
   */
  replaceTables(shards: Partial<AnalysisProjectShards>): void {
    this.#requireTransaction();
    this.#database.exec(`CREATE TEMP TABLE IF NOT EXISTS replacement_ids
      (id TEXT PRIMARY KEY,ordinal INTEGER NOT NULL) WITHOUT ROWID;
      CREATE TEMP TABLE IF NOT EXISTS replacement_deletes(id TEXT PRIMARY KEY) WITHOUT ROWID`);
    for (const key of Object.keys(shards)) {
      if (!isShardKind(key)) {
        throw new Error(`Unknown analysis table '${key}'.`);
      }
      const kind = key;
      if (kind === "runtime") {
        this.#replaceRuntime(shards.runtime ?? []);
        continue;
      }
      const records = shards[kind] ?? [];
      if (!this.#database.prepare(`SELECT 1 FROM ${kind} LIMIT 1`).get()) {
        // Initial insertion has nothing to compare. The owning table rejects duplicate IDs.
        for (const record of records) {
          this.#insertRecord(kind, record);
        }
        continue;
      }
      if (records.length === 0) {
        this.#database.exec(`DELETE FROM ${kind}`);
        continue;
      }
      this.#database.exec("DELETE FROM temp.replacement_ids; DELETE FROM temp.replacement_deletes");
      const remember = new Map<number, StatementSync>();
      for (let offset = 0; offset < records.length; offset += 128) {
        const batch = records.slice(offset, offset + 128);
        let insert = remember.get(batch.length);
        if (!insert) {
          insert = this.#database.prepare(
            `INSERT INTO temp.replacement_ids VALUES ${batch.map(() => "(?,?)").join(",")}`,
          );
          remember.set(batch.length, insert);
        }
        insert.run(...batch.flatMap((record, index) => [record.id, offset + index]));
      }
      const unchanged: string[] = [];
      const deleted: string[] = [];
      const statements = new Map<string, StatementSync>();
      /** Keep temporary journal writes bounded without retaining old payloads or a whole-graph Map. */
      const flush = (ids: string[], remove: boolean): void => {
        if (ids.length === 0) {
          return;
        }
        const signature = `${remove}:${ids.length}`;
        let statement = statements.get(signature);
        if (!statement) {
          let sql = `INSERT INTO temp.replacement_deletes VALUES ${ids.map(() => "(?)").join(",")}`;
          if (remove) {
            sql = `DELETE FROM temp.replacement_ids WHERE id IN (${ids.map(() => "?").join(",")})`;
          }
          statement = this.#database.prepare(sql);
          statements.set(signature, statement);
        }
        statement.run(...ids);
        ids.length = 0;
      };
      // Scan wide stored rows once in physical order. A scalar lookup touches only the compact
      // TEMP ID tree; per-record ID probes or IN-list reads churn the main pager on large graphs.
      const rows = this.#database.prepare(`SELECT stored.id,stored.payload,
        (SELECT ordinal FROM temp.replacement_ids WHERE id=stored.id) AS ordinal
        FROM ${kind} stored NOT INDEXED`);
      for (const row of rows.iterate()) {
        const id = String(row.id);
        if (row.ordinal === null) {
          deleted.push(id);
        } else {
          const record = records[Number(row.ordinal)];
          const json = decodeSqlitePayload(row.payload);
          if (json === JSON.stringify(record) || canonicalEquals(JSON.parse(json), record)) {
            unchanged.push(id);
          } else {
            deleted.push(id);
          }
        }
        // Only completed unique IDs leave the lookup tree. The main scan is never mutated while
        // its cursor is active; unchanged rows retain both physical payloads and dependent caches.
        if (unchanged.length === 128) {
          flush(unchanged, true);
        }
        if (deleted.length === 128) {
          flush(deleted, false);
        }
      }
      flush(unchanged, true);
      flush(deleted, false);
      this.#database.exec(
        `DELETE FROM ${kind} WHERE id IN (SELECT id FROM temp.replacement_deletes)`,
      );
      for (const row of this.#database
        .prepare("SELECT ordinal FROM temp.replacement_ids ORDER BY ordinal")
        .iterate()) {
        this.#insertRecord(kind, records[Number(row.ordinal)]);
      }
    }
  }

  /**
   * Replace runtime by interned external identities, including virtual paired-state records.
   * @param records Complete semantic runtime replacement. Duplicate IDs remain errors.
   */
  #replaceRuntime(records: readonly RuntimeEvidenceRecord[]): void {
    this.#database.exec(
      "CREATE TEMP TABLE IF NOT EXISTS replacement_runtime_ids (prefix TEXT, id BLOB, PRIMARY KEY(prefix,id)) WITHOUT ROWID; DELETE FROM replacement_runtime_ids",
    );
    const remember = this.#database.prepare(
      "INSERT OR IGNORE INTO temp.replacement_runtime_ids VALUES (?,?)",
    );
    const remove = this.#database.prepare("DELETE FROM runtime WHERE rowid=?");
    for (const record of records) {
      const identity = sqliteRuntimeIdentity(record.id);
      // Pairing may replace a standalone state's rowid. External IDs remain stable throughout.
      if (!remember.run(identity.prefix, identity.suffix).changes) {
        throw new Error(`Duplicate runtime record ID '${record.id}'.`);
      }
      const prior = this.#findRuntime.get(identity.prefix, identity.suffix);
      if (prior && canonicalEquals(runtimeFromRow(prior), record)) {
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
   * @param record Fully aggregated fact with a source-derived stable ID.
   * @returns True when inserted. Identical facts return false and conflicting facts throw.
   */
  insertRuntime(record: RuntimeEvidenceRecord): boolean {
    this.#requireTransaction();
    const identity = sqliteRuntimeIdentity(record.id);
    const prior = this.#findRuntime.get(identity.prefix, identity.suffix);
    if (prior) {
      if (!canonicalEquals(runtimeFromRow(prior), record)) {
        throw new Error(
          `Runtime record '${record.id}' has changed content for a stable imported ID.`,
        );
      }
      return false;
    }
    this.#insertRecord("runtime", record);
    return true;
  }

  /**
   * Prepare a unique-record batch in one source namespace, inside the publication transaction.
   * New namespaces need no per-record existence query. SQL uniqueness still rejects repeated IDs.
   * Existing/partially pruned sources use full idempotency and collision checks for every record.
   * The callback must not escape its transaction. Any insertion error must abort the whole batch.
   * @param prefix Exact ID prefix including its final colon.
   * @returns Transaction-scoped inserter for validated records with unique suffixes.
   */
  runtimeBatchInserter(prefix: string): (record: RuntimeEvidenceRecord) => boolean {
    this.#requireTransaction();
    if (!prefix || !prefix.endsWith(":")) {
      throw new Error("Invalid runtime batch prefix.");
    }
    // Query the logical view so paired states count as existing observations too.
    // Receipts alone cannot prove completeness: pruning can remove some or all
    // observations without removing their capture's provenance.
    const existing = this.#database
      .prepare(
        "SELECT 1 FROM runtime WHERE prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) LIMIT 1",
      )
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

  /**
   * Prepare bounded bulk publication for a validated distinct instruction trace. All four source
   * namespaces must be empty; receipts cannot prove this after pruning. Retained/partial sources
   * use exact per-record comparisons and repair. Call finish() before the writer transaction commits.
   * The sink and its pending buffers belong to this transaction and must not escape it.
   */
  runtimeTracePublicationSink(sourceSha256: string): RuntimeTracePublicationSink {
    this.#requireTransaction();
    if (!/^[\da-f]{64}$/.test(sourceSha256)) {
      throw new Error("Invalid trace source SHA-256.");
    }
    const root = `runtime:instruction-trace:${sourceSha256}:`;
    const existing = this.#database
      .prepare(`
      SELECT 1 FROM runtime_observations
      WHERE prefix_id IN (SELECT id FROM runtime_prefixes WHERE value IN (?1,?2,?3,?4))
      UNION ALL SELECT 1 FROM runtime_observations
      WHERE state_prefix_id IN (SELECT id FROM runtime_prefixes WHERE value IN (?1,?2,?3,?4))
      LIMIT 1
    `)
      .get(root, `${root}code:`, `${root}state:`, `${root}memory:`);
    if (!existing) {
      const batch = new SqliteRuntimeTraceBatch(this.#database, sourceSha256, (table, value) =>
        this.#intern(table, value),
      );
      return {
        add: (record) => {
          this.#requireTransaction();
          return batch.add(record);
        },
        finish: () => {
          this.#requireTransaction();
          batch.finish();
        },
      };
    }
    let finished = false;
    return {
      add: (record) => {
        this.#requireTransaction();
        if (finished) {
          throw new Error("Runtime trace batch is no longer active.");
        }
        assertTraceRecordNamespace(record, sourceSha256);
        return this.insertRuntime(record);
      },
      finish: () => {
        this.#requireTransaction();
        if (finished) {
          throw new Error("Runtime trace batch is no longer active.");
        }
        finished = true;
      },
    };
  }

  /** Reject evidence removal that would leave retained runtime facts orphaned, without loading them. */
  validateRuntimeEvidence(): void {
    // Materialize only missing dictionary references first. Otherwise SQLite can build a covering
    // index over the entire runtime view even when all referenced evidence IDs are present.
    const missing = this.#database
      .prepare(`
      WITH missing AS MATERIALIZED (
        SELECT sets.id, ref.value AS evidence FROM runtime_evidence AS sets, json_each(sets.value) AS ref
        LEFT JOIN evidence ON evidence.id=ref.value WHERE evidence.id IS NULL
      )
      SELECT evidence FROM missing
      WHERE EXISTS (SELECT 1 FROM runtime_observations WHERE evidence_id=missing.id) LIMIT 1
    `)
      .get();
    if (missing) {
      throw new Error(`Runtime history refers to missing evidence '${String(missing.evidence)}'.`);
    }
  }

  /**
   * Store manifest and counter in the same transaction as the changed records.
   * @param manifest Semantic project identity for this publication.
   * @returns Manifest containing the incremented counter.
   */
  publishManifest(manifest: Omit<AnalysisProjectManifest, "shards">): AnalysisProjectManifest {
    this.#requireTransaction();
    const revision = this.revision() + 1;
    const pointer: AnalysisProjectManifest = {
      ...manifest,
      db: ANALYSIS_PROJECT_SQLITE_FILE,
      revision,
    };
    const insert = this.#database.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)");
    insert.run("revision", String(revision));
    insert.run("manifest", canonicalJson(pointer));
    return pointer;
  }

  /**
   * Current publication counter, or zero before initial publication. It is not a schema version.
   * Read it with related records inside transaction to retain one consistent snapshot.
   * @returns Stored revision.
   */
  revision(): number {
    const row = this.#database.prepare("SELECT v FROM meta WHERE k='revision'").get();
    return Number(row?.v ?? 0);
  }

  /**
   * Authoritative manifest stored in SQLite, including pointer fields. Throws before initial publication.
   * Use a transaction when combining it with other reads. This does not validate the entire project.
   * @returns Pointer manifest.
   */
  manifest(): AnalysisProjectManifest {
    const row = this.#database.prepare("SELECT v FROM meta WHERE k='manifest'").get();
    if (!row) {
      throw new Error("Sqlite analysis project is missing its stored manifest.");
    }
    const parsed = parseRecord(row.v);
    if (!isRecord(parsed)) {
      throw new Error("Sqlite analysis project is missing its stored manifest.");
    }
    validateAnalysisProjectManifest(parsed);
    return { ...parsed, revision: this.revision() };
  }

  /**
   * Stream only requested runtime kinds, avoiding raw-row and decoded-row arrays on the JS heap.
   * @param kinds Runtime discriminators to include. Empty selects nothing.
   * @returns Cursor consumed within the owning read transaction.
   * @yields {RuntimeEvidenceRecord} One matching decoded fact.
   */
  *runtimeRecordsByKinds(
    kinds: readonly RuntimeEvidenceRecord["kind"][],
  ): IterableIterator<RuntimeEvidenceRecord> {
    if (kinds.length === 0) {
      return;
    }
    const statement = this.#database.prepare(
      `${RUNTIME_SELECT} WHERE r.kind IN (${kinds.map(() => "?").join(", ")})`,
    );
    for (const row of statement.iterate(...kinds)) {
      yield runtimeFromRow(row);
    }
  }

  /**
   * Stream runtime facts without retaining the complete table. Consume before the owning transaction
   * returns or the connection closes. An escaped iterator does not preserve its original snapshot.
   * @returns One reconstructed runtime row at a time.
   * @yields {RuntimeEvidenceRecord} One runtime fact.
   */
  *runtimeRecords(): IterableIterator<RuntimeEvidenceRecord> {
    for (const sql of RUNTIME_RECORD_STREAM_SQL) {
      for (const row of this.#database.prepare(sql).iterate()) {
        yield runtimeFromRow(row);
      }
    }
  }

  /**
   * Read one metadata table directly. Sources must not load unrelated CFG or runtime tables.
   * @param kind Metadata table name from the semantic collection contract.
   * @returns Decoded metadata in deterministic display order.
   */
  loadTable(kind: "labels"): AnalysisProjectShards["labels"];
  loadTable(kind: "comments"): AnalysisProjectShards["comments"];
  loadTable(kind: "regions"): AnalysisProjectShards["regions"];
  loadTable(kind: "annotations"): AnalysisProjectShards["annotations"];
  loadTable(kind: "analysis"): AnalysisProjectShards["analysis"];
  loadTable(kind: "evidence"): AnalysisProjectShards["evidence"];
  loadTable(kind: "imports"): AnalysisProjectShards["imports"];
  loadTable(
    kind: Exclude<ShardKind, "runtime">,
  ): readonly AnalysisProjectShards[Exclude<ShardKind, "runtime">][number][] {
    const order: Record<Exclude<ShardKind, "runtime">, string> = {
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
      const record = requireMetadataRecord(kind, parseRecord(row.payload));
      if ("evidence" in record) {
        Object.assign(record, { evidence: this.#evidencePool.intern(record.evidence) });
      }
      records.push(record);
    }
    return records;
  }

  /** Read at most 200 metadata records by stable ID. The cursor belongs to the caller's read snapshot. */
  metadataPage<Kind extends Exclude<ShardKind, "runtime">>(
    kind: Kind,
    after: string | undefined,
    limit = 200,
  ): { records: readonly AnalysisProjectShards[Kind][number][]; next?: string } {
    if (
      !["labels", "comments", "regions", "annotations", "analysis", "evidence", "imports"].includes(
        kind,
      )
    ) {
      throw new Error("Unknown metadata collection.");
    }
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 200 ||
      (after !== undefined && typeof after !== "string")
    ) {
      throw new Error("Metadata pages require a string cursor and a limit from 1 to 200.");
    }
    // Fetch one sentinel row so the caller need not issue an empty final page. Identifiers are
    // unique within each validated collection and avoid OFFSET rescans of preceding payloads.
    const rows = this.#database
      .prepare(`SELECT id,payload FROM ${kind} WHERE id > ? ORDER BY id LIMIT ?`)
      .all(after ?? "", limit + 1);
    const records = rows
      .slice(0, limit)
      .map(
        (row) =>
          requireMetadataRecord(
            kind,
            parseRecord(row.payload),
          ) as AnalysisProjectShards[Kind][number],
      );
    return { records, ...(rows.length > limit ? { next: String(rows[limit - 1].id) } : {}) };
  }

  /**
   * Validate a query view against this read snapshot, including every included provenance reference.
   * @param shards Selected records, with unused collections empty.
   */
  validateView(shards: AnalysisProjectShards): void {
    validateLoadedShards(shards, this.manifest());
  }

  /**
   * Merge an already-parsed offline batch by stable IDs without loading saved runtime history.
   * The caller owns revision checking and publication in the surrounding writer transaction.
   * @param batch Imported facts and metadata.
   * @returns Whether anything changed and per-collection additions/updates.
   */
  mergeEvidenceBatch(batch: RuntimeEvidenceBatch) {
    this.#requireTransaction();
    const base: AnalysisProjectShards = {
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
      .map((row) => requireMetadataRecord("analysis", parseRecord(row.payload)));
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

  /**
   * Produce an explicit complete evidence report one qualified PC at a time.
   * Only report output accumulates. Unused instruction/memory histories and CFG contexts are never loaded.
   * @returns Runtime record count, conflicts, and metadata explanations.
   */
  inspectEvidence() {
    const shards: AnalysisProjectShards = {
      analysis: this.analysisByKinds(["target-override"]),
      annotations: this.loadTable("annotations"),
      evidence: this.loadTable("evidence"),
      labels: [],
      comments: [],
      regions: [],
      imports: [],
      runtime: [],
    };
    const conflicts: RuntimeEvidenceConflict[] = [];
    const rows = this.#database.prepare(
      `${RUNTIME_SELECT} WHERE r.kind IN ('runtime-execution','runtime-cpu-state') AND r.address_space=? AND r.address=? AND r.architecture=?`,
    );
    const sites = this.#database.prepare(
      "SELECT DISTINCT architecture,address_space,address FROM runtime WHERE kind IN ('runtime-execution','runtime-cpu-state')",
    );
    for (const site of sites.iterate()) {
      const runtime: RuntimeEvidenceRecord[] = [];
      for (const row of rows.iterate(site.address_space, site.address, site.architecture)) {
        runtime.push(runtimeFromRow(row));
      }
      for (const conflict of inspectRuntimeEvidence({ ...shards, runtime }).conflicts) {
        conflicts.push(conflict);
      }
    }
    conflicts.sort((a, b) => a.id.localeCompare(b.id));
    return {
      runtimeRecords: Number(this.#database.prepare("SELECT count(*) AS n FROM runtime").get()!.n),
      conflicts,
      explanations: inspectRuntimeEvidence(shards).explanations,
    };
  }

  /**
   * Select record choices before decoding. Explicit IDs bypass unrelated history entirely.
   * @param [selected] Exact context record IDs. Omitted lists the first 200 records per collection.
   * @returns Bounded choice view and complete small provenance catalog.
   */
  evidenceChoices(selected?: Partial<Record<ShardKind, readonly string[]>>): AnalysisProjectShards {
    const shards: AnalysisProjectShards = {
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
    ] as const) {
      const records: unknown[] = [];
      const ids = selected?.[kind];
      if (selected && !ids?.length) {
        continue;
      }
      if (kind === "runtime") {
        if (ids) {
          for (const id of ids.slice(0, 200)) {
            const identity = sqliteRuntimeIdentity(id);
            const row = this.#findRuntime.get(identity.prefix, identity.suffix);
            if (row) {
              records.push(runtimeFromRow(row));
            }
          }
        } else {
          for (const row of this.#database.prepare(`${RUNTIME_SELECT} LIMIT 200`).iterate()) {
            records.push(runtimeFromRow(row));
          }
        }
      } else {
        const sql = ids
          ? `SELECT payload FROM ${kind} WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id LIMIT 200`
          : `SELECT payload FROM ${kind} ORDER BY id LIMIT 200`;
        const parameters = ids ? [JSON.stringify(ids)] : [];
        for (const row of this.#database.prepare(sql).iterate(...parameters)) {
          records.push(requireMetadataRecord(kind, parseRecord(row.payload)));
        }
      }
      Object.assign(shards, { [kind]: records });
    }
    return shards;
  }

  /**
   * Find candidate evidence IDs still owned by retained runtime observations.
   * Reads the small provenance dictionary and physical observation rows without decoding histories.
   * Caller holds the same read snapshot as the metadata being used for a replacement publication.
   * @param ids Evidence candidates; empty input performs no query.
   * @returns Referenced candidate IDs in stable order, bounded by the input size.
   */
  runtimeEvidenceReferences(ids: readonly string[]): string[] {
    if (ids.length === 0) {
      return [];
    }
    return this.#database
      .prepare(`SELECT DISTINCT ref.value AS id
      FROM runtime_evidence AS sets, json_each(sets.value) AS ref
      WHERE ref.value IN (SELECT value FROM json_each(?))
        AND EXISTS (SELECT 1 FROM runtime_observations WHERE evidence_id=sets.id)
      ORDER BY ref.value`)
      .all(JSON.stringify(ids))
      .map((row) => String(row.id));
  }

  /**
   * Explain one record with an exact reference count and a bounded reverse-reference preview.
   * @param kind Selected collection.
   * @param id Stable semantic record ID.
   * @returns Full direct provenance/conflicts, at most 200 reverse links.
   */
  explainEvidence(kind: ShardKind, id: string): ProjectEvidenceExplanation {
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
        this.#database.exec(
          "CREATE TABLE IF NOT EXISTS query_evidence_links(evidence TEXT,collection TEXT,id TEXT,PRIMARY KEY(evidence,collection,id)) WITHOUT ROWID;DELETE FROM query_evidence_links;",
        );
        for (const table of ["analysis", "annotations", "labels", "comments", "regions"]) {
          this.#database.exec(
            `INSERT OR IGNORE INTO query_evidence_links SELECT e.value,'${table}',r.id FROM ${table} r,json_each(analysis_json(r.payload),'$.evidence') e`,
          );
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
          ...this.analysisByKinds(["conflict"]).filter(
            (record) => !shards.analysis.some((other) => other.id === record.id),
          ),
        ],
      };
      const base = explainProjectEvidence(view, kind, id);
      const evidenceIds = JSON.stringify(base.evidence.map((record) => record.id));

      const metadata =
        "SELECT collection||':'||id AS reference FROM query_evidence_links WHERE evidence IN (SELECT value FROM json_each(?)) GROUP BY collection,id";
      const runtime =
        "SELECT 'runtime:'||p.value||CASE typeof(r.id) WHEN 'blob' THEN lower(hex(r.id)) ELSE r.id END AS reference FROM runtime_evidence e JOIN runtime r ON r.evidence_id=e.id JOIN runtime_prefixes p ON p.id=r.prefix_id WHERE EXISTS(SELECT 1 FROM json_each(e.value) value WHERE value.value IN (SELECT value FROM json_each(?)))";
      const metadataRows = this.#database
        .prepare(`${metadata} ORDER BY reference LIMIT 200`)
        .all(evidenceIds);
      const runtimeRows = this.#database
        .prepare(`${runtime} ORDER BY r.prefix_id,r.id LIMIT 200`)
        .all(evidenceIds);
      const referencedBy = [...metadataRows, ...runtimeRows]
        .map((row) => String(row.reference))
        .toSorted((a, b) => a.localeCompare(b))
        .slice(0, 200);
      const metadataCount = Number(
        this.#database.prepare(`SELECT count(*) AS n FROM (${metadata})`).get(evidenceIds)!.n,
      );
      const runtimeCount = Number(
        this.#database
          .prepare(`SELECT count(*) AS n FROM runtime r WHERE r.evidence_id IN
        (SELECT e.id FROM runtime_evidence e WHERE EXISTS(SELECT 1 FROM json_each(e.value) value WHERE value.value IN (SELECT value FROM json_each(?))))`)
          .get(evidenceIds)!.n,
      );
      const referencedByTotal = metadataCount + runtimeCount;
      return { ...base, referencedBy, referencedByTotal };
    }, false);
  }

  /**
   * Persisted call graph plus current labels, without retaining CFG contexts between requests.
   * @returns Functions, calls, unresolved sites, and ownership.
   */
  callGraph() {
    this.assertCurrentAnalysis();
    let graph;
    try {
      graph = this.cachedProjection(
        "graph",
        "3",
        ["analysis"],
        () => prepareGraph(this.#database),
        () => publishGraph(this.#database),
        (value) => {
          if (!isCallGraph(value)) {
            throw new Error("Analysis changed while building the graph. Refresh the view.");
          }
          return value;
        },
      );
      const published = readQueryCache(this.#database, "graph", "3");
      if (!isCallGraph(published)) {
        throw new Error("Analysis changed while building the graph. Refresh the view.");
      }
      graph = published;
    } finally {
      this.#database.exec(
        "DROP TABLE IF EXISTS temp.query_graph_nodes;DROP TABLE IF EXISTS temp.query_graph_edges",
      );
    }
    const labels = this.loadTable("labels");
    return {
      ...graph,
      functions: graph.functions.map((fn) =>
        Object.assign({}, fn, {
          labels: labels
            .filter(
              (label) => label.addressSpace === fn.addressSpace && label.address === fn.address,
            )
            .map(({ id, name }) => ({ id, name }))
            .toSorted((a, b) => a.id.localeCompare(b.id)),
        }),
      ),
    };
  }

  /**
   * Cache a compact target-specific result. Callers declare every persisted input it consumes.
   * Computation uses a deferred transaction so expensive analysis does not hold the writer lock.
   * Concurrent input changes discard cache publication. Results still belong to one read snapshot.
   * @param key Internal stable query name.
   * @param signature Layout/configuration fingerprint.
   * @param dependencies Source collections.
   * @param compute Synchronous reader. Must not open another transaction.
   * @param [publish] Optional short SQL publication for derived rows built in temporary tables.
   * @returns Current projected value.
   */
  cachedProjection<T>(
    key: string,
    signature: string,
    dependencies: readonly ShardKind[],
    compute: () => T & (T extends PromiseLike<unknown> ? never : unknown),
    publish?: () => void,
    restore?: (value: unknown) => T,
  ): T {
    const cached = readQueryCache(this.#database, key, signature);
    if (cached !== undefined) {
      if (!restore) {
        throw new Error(`Query cache '${key}' requires a restore function.`);
      }
      return restore(cached);
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
      if (
        this.#database.prepare("SELECT signature FROM query_cache WHERE name=?").get(key)
          ?.signature === pending
      ) {
        publish?.();
        writeQueryCache(this.#database, key, signature, result);
      }
    });
    return result;
  }

  /**
   * Select a bounded CFG navigation window through its address index.
   * @param space Exact logical address space.
   * @param address Selected PC.
   * @param architectures Optional specification prefixes.
   * @returns Four preceding and 28 following variants, in address order.
   */
  navigationNodes(
    space: string,
    address: number,
    architectures: readonly string[],
  ): AnalysisRecord[] {
    const matches = architectures.length
      ? " AND EXISTS(SELECT 1 FROM json_each(?) h WHERE json_extract(analysis_json(payload),'$.specificationId')=h.value OR substr(json_extract(analysis_json(payload),'$.specificationId'),1,length(h.value)+1)=h.value||'.')"
      : "";
    const parameters: (string | number)[] = [space, address];
    if (architectures.length) {
      parameters.push(JSON.stringify(architectures));
    }
    const before = this.#database
      .prepare(
        `SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address<? ${matches} ORDER BY address DESC,id DESC LIMIT 4`,
      )
      .all(...parameters)
      .toReversed();
    const after = this.#database
      .prepare(
        `SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address>=? ${matches} ORDER BY address,id LIMIT ?`,
      )
      .all(...parameters, 32 - before.length);
    return [...before, ...after].map((row) =>
      requireMetadataRecord("analysis", parseRecord(row.payload)),
    );
  }

  /**
   * Explicit known-code intervals, grouped in SQL for the incomplete-analysis preservation guard.
   * @returns Half-open ROM-content intervals.
   */
  codeRanges(): { start: number; end: number }[] {
    return this.#database
      .prepare(
        "SELECT query_file_offset AS start,MAX(query_file_offset+query_size) AS end FROM analysis INDEXED BY query_instruction_ranges WHERE kind='cfg-node' AND query_file_offset IS NOT NULL GROUP BY query_file_offset",
      )
      .all()
      .map((row) => ({ start: Number(row.start), end: Number(row.end) }));
  }

  /**
   * Select processor MMIO observations before decoding payloads.
   * @param architecture Exact runtime architecture.
   * @param space Instruction and accessed logical space.
   * @param addresses Exact hardware addresses, including target-approved mirrors.
   * @returns SQL-grouped observations. Counts/provenance stay exact.
   * @yields {RuntimeEvidenceRecord} One role-relevant access variant.
   */
  *runtimeMemoryAtAddresses(
    architecture: string,
    space: string,
    addresses: readonly number[],
  ): IterableIterator<RuntimeEvidenceRecord> {
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

  /**
   * Decode-state variants aggregated in SQL. Raw register histories never become a JS array.
   * The signature includes the ordered state fields and architecture. Aliases remain distinct so
   * the target decoder retains its original precedence and validation rules.
   * @param architecture Exact instruction architecture.
   * @param space Exact instruction address space.
   * @param stateFields Only fields the target decoder consumes, including aliases.
   * @param masks Optional decoder bit masks, applied only to valid nonnegative integers up to max.
   * @param [onProgress] Cumulative and total observations when rebuilding; throwing aborts the build.
   * @param [onReadProgress] Representatives staged in storage order; throwing aborts the cursor.
   * @returns SQL cursor over compact variants with exact per-evidence counts.
   * Preparation precedes the consuming read transaction. Standalone iteration owns a snapshot;
   * close a partially consumed cursor to release it.
   */
  runtimeInstructionVariants(
    architecture: string,
    space: string,
    stateFields: readonly string[],
    masks: Readonly<Record<string, { readonly max: number; readonly mask: number }>> = {},
    onProgress?: (observations: number, totalObservations: number) => void,
    onReadProgress?: (representatives: number) => void,
  ): IterableIterator<RuntimeEvidenceRecord> {
    return runtimeInstructionSummary(
      this.#database,
      (action, write) => this.transaction(action, write),
      architecture,
      space,
      stateFields,
      masks,
      onProgress,
      onReadProgress,
      () => this.#clearDictionaryCache(),
    );
  }

  /**
   * Exact execution seed totals grouped by PC, without decoding execution payloads.
   * Stream per-provenance SQL totals into one seed per PC; capture attribution remains in runtime
   * storage. Static seed selection needs their union, not millions of duplicate PC records.
   * @param architecture Target processor.
   * @param space Logical CPU address space.
   * @returns Execution facts reduced to the fields used for seed selection.
   */
  runtimeExecutionSeeds(architecture: string, space: string): RuntimeEvidenceRecord[] {
    const seeds = new Map<number, { count: number; evidence: Set<string> }>();
    const evidenceById = new Map<number, readonly string[]>();
    for (const row of this.#database
      .prepare(`SELECT r.address,SUM(r.count) AS count,r.evidence_id,e.value AS evidence FROM runtime r JOIN runtime_evidence e ON e.id=r.evidence_id
      WHERE r.kind='runtime-execution' AND r.architecture=? AND r.address_space=? GROUP BY r.address,r.evidence_id`)
      .iterate(architecture, space)) {
      const address = Number(row.address);
      const seed = seeds.get(address) ?? { count: 0, evidence: new Set<string>() };
      seed.count += Number(row.count);
      const evidenceId = Number(row.evidence_id);
      let evidence = evidenceById.get(evidenceId);
      if (!evidence) {
        const parsed: unknown = JSON.parse(String(row.evidence));
        if (!isStringArray(parsed)) {
          throw new Error("Invalid runtime evidence list.");
        }
        evidence = this.#evidencePool.intern(parsed);
        evidenceById.set(evidenceId, evidence);
      }
      for (const id of evidence) {
        seed.evidence.add(id);
      }
      seeds.set(address, seed);
    }
    return [...seeds]
      .toSorted(([a], [b]) => a - b)
      .map(([address, seed]) => ({
        id: `query:execution:${address}`,
        kind: "runtime-execution",
        architecture,
        addressSpace: space,
        address,
        count: seed.count,
        evidence: this.#evidencePool.sorted([...seed.evidence]),
      }));
  }

  /** Build additive query indexes once, then refresh only rows invalidated by project writes. */
  prepareAnnotationQueries(): void {
    if (annotationQueryIndexesReady(this.#database)) {
      return;
    }
    this.transaction(() => ensureAnnotationQueryIndexes(this.#database));
  }

  /** Prepare direct source attribution indexes without decoding runtime payloads. */
  prepareSourceQueries(): void {
    if (!sourceQueriesReady(this.#database)) {
      this.transaction(() => prepareSourceQueries(this.#database));
    }
  }

  /**
   * Validated source identities from small catalog tables in the caller's read snapshot.
   * @returns Manifest and sources ordered by their most recent successful import.
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
    const importTimes = new Map(
      this.#database
        .prepare("SELECT sha256,last_seen_at FROM capture_catalog")
        .all()
        .map((row) => [String(row.sha256), Number(row.last_seen_at)] as const),
    );
    return { manifest, sources: buildAnalysisSourceCatalog(shards, importTimes) };
  }

  /**
   * Exact SQL counts for a catalog source. No baseline or inferred static execution.
   * @param sourceId Catalog source ID.
   * @returns Manifest and source counts.
   */
  sourceSummary(sourceId: string) {
    const { manifest, sources } = this.sourceCatalog();
    const source = sources.find(({ id }) => id === sourceId);
    if (!source) {
      throw new Error("Unknown analysis source.");
    }
    return { manifest, summary: readSourceSummary(this.#database, source) };
  }

  /**
   * At most 200 SQL-selected contribution rows, decoded within the caller's read transaction.
   * @param sourceId Catalog source ID.
   * @param group Contribution category.
   * @param offset Nonnegative page offset.
   * @returns Bounded source records.
   */
  sourcePage(sourceId: string, group: AnalysisSourceGroup, offset = 0) {
    const source = this.sourceCatalog().sources.find(({ id }) => id === sourceId);
    if (!source) {
      throw new Error("Unknown analysis source.");
    }
    return readSourcePage(this.#database, source, group, offset);
  }

  /**
   * Read names, comments and provenance for editing without materializing instruction variants.
   * @returns Validated editing metadata from the caller's read transaction.
   */
  annotationEditView(): { manifest: AnalysisProjectManifest; shards: AnalysisProjectShards } {
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

  /**
   * Small export metadata. Instruction candidates are supplied separately by an ordered SQL cursor.
   * @returns Validated manifest, metadata, and an empty runtime collection.
   */
  sourceExportView(): { manifest: AnalysisProjectManifest; shards: AnalysisProjectShards } {
    this.assertCurrentAnalysis();
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
   * Prepare an optional, lossless export projection before opening the rendering read transaction.
   * Dependency triggers reject publication after intervening analysis/provenance edits. Cache misses
   * still use the authoritative ordered cursor; no manifest revision or Git files are changed.
   */
  prepareSourceExport(signal?: AbortSignal): void {
    this.prepareAnnotationQueries();
    signal?.throwIfAborted();
    if (sourceExportCacheReady(this.#database)) {
      return;
    }
    this.sourceExportSnapshot((groups) => {
      for (const group of groups) {
        void group;
      }
    }, signal);
  }

  /**
   * Render inside one read snapshot, staging a lossless projection during the first cursor pass.
   * The callback must synchronously consume all groups. Only a surviving dependency token can
   * publish the staged cache after rendering releases its read lock; concurrent edits win.
   */
  sourceExportSnapshot<T>(
    render: (groups: Iterable<readonly InstructionExportRecord[]>) => T,
    signal?: AbortSignal,
  ): T {
    this.prepareAnnotationQueries();
    signal?.throwIfAborted();
    if (sourceExportCacheReady(this.#database)) {
      const completion = { complete: false };
      const result = this.transaction(() => {
        const records = this.instructionExportGroups();
        const groups = (function* () {
          yield* records;
          completion.complete = true;
        })();
        try {
          return render(groups);
        } finally {
          // Even a failed/partial consumer cannot keep a SQLite cursor alive after its snapshot.
          groups.return();
        }
      }, false);
      if (!completion.complete) {
        throw new Error("Source export did not consume the complete instruction cursor.");
      }
      return result;
    }
    const pending = `pending:${randomUUID()}`;
    this.transaction(() => {
      installQueryCache(this.#database, SOURCE_EXPORT_CACHE.key, ["analysis", "evidence"]);
      writeQueryCache(this.#database, SOURCE_EXPORT_CACHE.key, pending, null);
    });
    const completion = { complete: false };
    try {
      const result = this.transaction(() => {
        const groups = stageSourceExportGroups(
          this.#database,
          this.instructionExportGroups(),
          () => {
            completion.complete = true;
          },
          signal,
        );
        try {
          return render(groups);
        } finally {
          groups.return();
        }
      }, false);
      if (!completion.complete) {
        throw new Error("Source export did not consume the complete instruction cursor.");
      }
      this.transaction(() => {
        signal?.throwIfAborted();
        // As with cachedProjection, a concurrent dependency write or a newer reader's token
        // prevents publication. Rendering still belongs to its original consistent snapshot.
        if (
          this.#database
            .prepare("SELECT signature FROM query_cache WHERE name=?")
            .get(SOURCE_EXPORT_CACHE.key)?.signature === pending
        ) {
          publishSourceExportCache(this.#database);
          writeQueryCache(
            this.#database,
            SOURCE_EXPORT_CACHE.key,
            SOURCE_EXPORT_CACHE.signature,
            true,
          );
        }
      });
      return result;
    } finally {
      clearSourceExportStage(this.#database);
    }
  }

  /**
   * Stream one file-offset group at a time. Do not retain the complete CFG to plan source.
   * The caller prepares annotation indexes first and owns a read transaction until iteration ends.
   * @returns All variants at each explicit output offset.
   * @yields {readonly InstructionExportRecord[]} One complete group, without clipping variants.
   */
  *instructionExportGroups(): IterableIterator<readonly InstructionExportRecord[]> {
    if (!annotationQueryIndexesReady(this.#database)) {
      throw new Error("Instruction inputs changed before export. Prepare a fresh query snapshot.");
    }
    const spaces = new Map(
      this.manifest().addressSpaces.map((space) => [space.id, 2 ** space.addressBits]),
    );
    const evidence = new Set(this.loadTable("evidence").map(({ id }) => id));
    let previous: number | undefined;
    let group: InstructionExportRecord[] = [];
    const records = sourceExportCacheReady(this.#database)
      ? sourceExportCacheRecords(this.#database)
      : uncachedSourceExportRecords(this.#database);
    for (const record of records) {
      if (!isIndexedExportInstruction(record, spaces, evidence)) {
        throw new Error("Invalid indexed export instruction or missing provenance.");
      }
      const offset = record.fileOffset!;
      if (previous !== undefined && previous !== offset) {
        yield group;
        group = [];
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
   * @param ranges Exact visible source/debugger coordinates.
   * @returns Small view. Consume inside the caller's read transaction.
   */
  instructionAnnotationView(ranges: readonly AnnotationQueryRange[]): SqliteAnnotationView {
    const manifest = this.manifest();
    const result = readSqliteAnnotationView(this.#database, manifest, ranges);
    // Viewports intentionally omit function entries and predecessor chains outside visible ranges.
    // Keep all local/provenance checks without requiring another full-graph read on cursor movement.
    validateLoadedShards(result.shards, manifest, "partial");
    return result;
  }

  /**
   * Exact viewport counts without materializing the detailed instruction projection.
   * @param ranges Current mapped coordinates, validated by the query.
   * @returns Bounded locations with exact execution totals.
   */
  instructionExecutionSummary(
    ranges: readonly AnnotationQueryRange[],
  ): readonly InstructionExecutionSummaryRow[] {
    return readInstructionExecutionSummary(this.#database, this.manifest(), ranges);
  }

  /**
   * Read selected metadata kinds through the address index instead of loading the complete CFG.
   * @param kinds Analysis discriminators to include.
   * @returns Matching rows in stable ID order.
   */
  analysisByKinds(kinds: readonly AnalysisRecord["kind"][]): AnalysisRecord[] {
    if (!kinds.length) {
      return [];
    }
    const records: AnalysisRecord[] = [];
    for (const row of this.#database
      .prepare(
        `SELECT payload FROM analysis WHERE kind IN (${kinds.map(() => "?").join(",")}) ORDER BY id`,
      )
      .iterate(...kinds)) {
      records.push(requireMetadataRecord("analysis", parseRecord(row.payload)));
    }
    return records;
  }

  /**
   * Resolve an edit boundary to representative CFG nodes, one per qualified location.
   * Call after preparing query indexes and consume inside a read transaction.
   * @param addressSpace Exact debug-map/native address space.
   * @param address Instruction start in that space.
   * @param [outputOffset] Optional explicit file offset, never an inferred mapper alias.
   * @returns Location representatives. State variants need not be loaded to edit a comment.
   */
  annotationNodesAt(
    addressSpace: string,
    address: number,
    outputOffset?: number,
  ): AnalysisProjectShards["analysis"] {
    // File coordinates must use the compact output index. A kind-only plan scans every node
    // before the annotation form can resolve even one instruction boundary.
    const rows = this.#database
      .prepare(`SELECT payload FROM analysis WHERE rowid IN (
      SELECT MIN(rowid) FROM analysis WHERE kind='cfg-node' AND address_space=? AND address=? GROUP BY address_space,address
      UNION SELECT MIN(rowid) FROM analysis INDEXED BY query_instruction_output
      WHERE kind='cfg-node' AND query_file_offset=? GROUP BY address_space,address)`)
      .all(addressSpace, address, outputOffset ?? null);
    return rows.map((row) => requireMetadataRecord("analysis", parseRecord(row.payload)));
  }

  /**
   * Materialize complete record arrays without semantic validation. Run inside a read transaction.
   * @param [runtime] Defaults to true. False omits runtime and must not be treated as a complete replacement.
   * @returns Decoded record arrays owned by the caller.
   */
  loadShards(runtime = true): AnalysisProjectShards {
    return {
      evidence: this.loadTable("evidence"),
      labels: this.loadTable("labels"),
      comments: this.loadTable("comments"),
      regions: this.loadTable("regions"),
      annotations: this.loadTable("annotations"),
      analysis: this.loadTable("analysis"),
      imports: this.loadTable("imports"),
      runtime: runtime ? [...this.runtimeRecords()].toSorted(compareRuntimeRecordIds) : [],
    };
  }

  /**
   * Table counts for reports.
   * @returns Row counts.
   */
  counts(): Readonly<Record<string, number>> {
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
    const result: Record<string, number> = {};
    for (const table of tables) {
      const row = this.#database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
      result[table] = Number(row?.n ?? 0);
    }
    return result;
  }

  /**
   * Count analysis kinds without inflating or parsing their compressed payloads.
   * @returns Counts by analysis record discriminator.
   */
  analysisCounts(): Readonly<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const row of this.#database
      .prepare("SELECT kind, COUNT(*) AS n FROM analysis GROUP BY kind")
      .iterate()) {
      result[String(row.kind)] = Number(row.n);
    }
    return result;
  }

  /**
   * Summarize per-PC execution facts using stored columns, without reading register history.
   * @returns Fact count and total observed executions in the owning transaction.
   */
  runtimeExecutionCounts(): { records: number; events: number } {
    const row = this.#database
      .prepare(
        "SELECT COUNT(*) AS records, COALESCE(SUM(count), 0) AS events FROM runtime WHERE kind='runtime-execution'",
      )
      .get();
    return { records: Number(row?.records ?? 0), events: Number(row?.events ?? 0) };
  }

  /**
   * Atomically refresh the watcher hint after commit. SQLite is authoritative: a failed hint write
   * is reported as a warning, never as a failed import that could cause an unsafe retry.
   * @param directory Project root for the watcher hint.
   */
  writePointer(directory: string): void {
    const temporary = path.join(directory, `.analysis.json.${randomUUID()}.tmp`);
    try {
      // Serialize watcher refreshes with writers so an older refresher cannot overwrite a newer hint.
      this.transaction(() => {
        fs.writeFileSync(temporary, canonicalJson(this.manifest()), { flag: "wx" });
        fs.renameSync(temporary, path.join(directory, ANALYSIS_PROJECT_MANIFEST));
      });
    } catch (error) {
      process.emitWarning(
        `Analysis database committed, but its watcher pointer could not be refreshed: ${String(error)}`,
      );
    } finally {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {
        /* An abandoned watcher hint must not turn a committed publication into a failure. */
      }
    }
  }

  /** Checkpoint and reclaim unused SQLite pages. Run only during explicit storage maintenance. */
  compact(): void {
    const disk = fs.statfsSync(path.dirname(this.file));
    // VACUUM copies live pages, not the high-water allocation left by retired runtime tables.
    const pageCount =
      Number(this.#database.prepare("PRAGMA page_count").get()?.page_count) -
      Number(this.#database.prepare("PRAGMA freelist_count").get()?.freelist_count);
    const pageSize = Number(this.#database.prepare("PRAGMA page_size").get()?.page_size);
    if (disk.bavail * disk.bsize < 2 * pageCount * pageSize) {
      throw new Error(
        "Insufficient free disk space for SQLite VACUUM. Allow twice the database size.",
      );
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
    // WAL-mode VACUUM shrinks the main file only after its replacement pages checkpoint.
    const checkpoint = this.#database.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
    if (Number(checkpoint?.busy ?? 0) !== 0) {
      throw new Error(
        "Compacted pages are committed; active readers delayed reclamation. Close readers and retry compaction.",
      );
    }
  }

  /**
   * Explicitly consolidate full SNES snapshots into counted decoder variants. A bounded staging
   * database is verified first; one transaction swaps physical runtime tables, avoiding millions
   * of deletion triggers and a database-sized WAL. Metadata, memory facts and research shadows
   * retain their exact payloads. Refresh the portable capture catalog and compact() afterward.
   */
  retainSnesAnalysisEvidence(onProgress?: (message: string) => void): void {
    const manifest = this.manifest();
    if (manifest.target !== "snes.sfc") {
      throw new Error("Analysis retention currently requires a SNES project.");
    }
    const variants = this.runtimeInstructionVariants(
      "snes.65816",
      "snes.cpu",
      SNES_ANALYSIS_STATE_FIELDS,
      SNES_ANALYSIS_STATE_MASKS,
      (processed, total) =>
        onProgress?.(`Grouping ${processed}/${total} instruction observations.`),
    );
    const staging = path.join(
      path.dirname(this.file),
      `.analysis-retention-${randomUUID()}.sqlite`,
    );
    let target: SqliteAnalysisStore | undefined;
    const lifecycle = { attached: false };
    const retainedSources = new Set<string>();
    const secureDelete = Number(
      this.#database.prepare("PRAGMA secure_delete").get()?.secure_delete,
    );
    try {
      target = new SqliteAnalysisStore(staging);
      const destination = target;
      // Finished tables receive a foreign-key check before COMMIT. Disabling implicit DROP TABLE
      // deletes avoids traversing the old history; rollback still protects all original pages.
      // Retired pages are reclaimed by the following VACUUM. Zeroing every page during DROP
      // would first write the entire retired history into WAL, defeating low-space maintenance.
      this.#database.exec("PRAGMA foreign_keys=OFF; PRAGMA secure_delete=OFF");
      this.transaction(() => {
        destination.transaction(() => {
          destination.publishManifest(manifest);
          const batch = new SqliteRuntimeTraceBatch(
            destination.#database,
            undefined,
            (table, value) => destination.#intern(table, value),
          );
          let count = 0;
          let total = 0;
          for (const sample of variants) {
            if (sample.kind !== "runtime-instruction") {
              throw new Error("Invalid retained instruction representative.");
            }
            const match = /^(runtime:instruction-trace:[\da-f]{64}):code:[\da-f]{64}$/.exec(
              sample.id,
            );
            if (!match) {
              throw new Error(
                "Cannot consolidate instructions outside a canonical capture namespace.",
              );
            }
            const state = snesAnalysisTraceState(sample.state);
            retainedSources.add(match[1].slice("runtime:instruction-trace:".length));
            const identity = createHash("sha256")
              .update(
                JSON.stringify(
                  {
                    address: sample.address,
                    bytes: sample.bytes,
                    state,
                  },
                  undefined,
                  2,
                ) + "\n",
              )
              .digest("hex");
            batch.add({ ...sample, state, id: `${match[1]}:code:${identity}` });
            batch.add({
              ...sample,
              state,
              id: `${match[1]}:state:${identity}`,
              kind: "runtime-cpu-state",
            });
            total += sample.count;
            if (++count % 10000 === 0) {
              onProgress?.(`Retained ${count} counted instruction variants.`);
            }
          }
          batch.finish();
          // Only the selected SNES instruction pairs are replaced. Stream both logical branches
          // for other processors, preserving their original paired states and independent facts.
          const retained =
            "(d.kind!='runtime-instruction' OR d.architecture!='snes.65816' OR d.address_space!='snes.cpu')";
          let copied = 0;
          for (const [index, stream] of RUNTIME_RECORD_STREAM_SQL.entries()) {
            const order = index === 0 ? "ORDER BY o.oid DESC" : "ORDER BY o.oid ASC";
            const condition = index === 0 ? `AND ${retained}` : `WHERE ${retained}`;
            const sql = stream
              .replace(
                "FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id",
                `FROM runtime_descriptors d CROSS JOIN runtime_fact_rows owners ON owners.descriptor_id=d.did
               CROSS JOIN runtime_facts f ON f.fid=owners.fid
               CROSS JOIN runtime_observations o ON o.fact_id=f.fid`,
              )
              .replace(order, condition);
            for (const row of this.#database.prepare(sql).iterate()) {
              destination.#insertRecord("runtime", runtimeFromRow(row));
              if (++copied % 10000 === 0) {
                onProgress?.(
                  `Preserved ${copied} execution, memory and independent state records.`,
                );
              }
            }
          }
          const written = destination.#database
            .prepare(`SELECT SUM(o.count) AS n
            FROM runtime_descriptors d CROSS JOIN runtime_fact_rows f ON f.descriptor_id=d.did
            CROSS JOIN runtime_observations o ON o.fact_id=f.fid WHERE d.kind='runtime-instruction'
            AND d.architecture='snes.65816' AND d.address_space='snes.cpu'`)
            .get();
          if (Number(written?.n ?? 0) !== total) {
            throw new Error("Compact instruction observation totals do not match.");
          }
        });
        destination.#database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        if (
          destination.#database.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok" ||
          destination.#database.prepare("PRAGMA foreign_key_check").get()
        ) {
          throw new Error("Retention staging database failed integrity validation.");
        }
        destination.close();
        target = undefined;
        this.#database.prepare("ATTACH DATABASE ? AS retained").run(staging);
        lifecycle.attached = true;
        onProgress?.("Publishing compact runtime tables atomically.");
        // Query projections are disposable application-owned tables. Retire their invalidation
        // triggers before replacement; their consumers rebuild from the retained observations.
        for (const row of this.#database
          .prepare(`SELECT name FROM sqlite_schema WHERE type='trigger'
          AND (name GLOB 'cache_*' OR name GLOB 'query_*' OR name GLOB 'summary_*')`)
          .all()) {
          this.#database.exec(`DROP TRIGGER "${String(row.name).replaceAll('"', '""')}"`);
        }
        for (const row of this.#database
          .prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name GLOB 'query_*'")
          .all()) {
          this.#database.exec(`DROP TABLE "${String(row.name).replaceAll('"', '""')}"`);
        }
        for (const row of this.#database
          .prepare(`SELECT type,name FROM sqlite_schema WHERE
          (type='view' AND name IN ('runtime','runtime_facts','runtime_fact_locations'))
          OR (type='trigger' AND name GLOB 'runtime_*')`)
          .all()) {
          this.#database.exec(
            `DROP ${String(row.type).toUpperCase()} IF EXISTS "${String(row.name).replaceAll('"', '""')}"`,
          );
        }
        const tables = [
          "runtime_observations",
          "runtime_fact_rows",
          "runtime_identities",
          "runtime_descriptors",
          "runtime_history",
          "runtime_prefixes",
          "runtime_evidence",
        ];
        for (const table of tables) {
          this.#database.exec(`DROP TABLE ${table}`);
        }
        this.#database
          .exec(`CREATE TABLE runtime_prefixes(id INTEGER PRIMARY KEY,value TEXT NOT NULL UNIQUE);
          CREATE TABLE runtime_evidence(id INTEGER PRIMARY KEY,value TEXT NOT NULL UNIQUE);
          ${RUNTIME_STORAGE_SCHEMA}`);
        // Owners precede references, even while FK enforcement is deferred until verification.
        for (const table of tables.toReversed()) {
          this.#database.exec(`INSERT INTO ${table} SELECT * FROM retained.${table}`);
        }
        for (const sql of SCHEMA_INDEX_STATEMENTS) {
          this.#database.exec(sql);
        }
        // Metadata columns survive, but their invalidation triggers were retired with the caches.
        // Force the ordinary query preparer to reinstall the complete layout on its next use.
        this.#database.exec("DELETE FROM meta WHERE k='annotation-query-layout'");
        const reports = this.loadTable("imports").map((report) => {
          if (
            report.format !== "uttori-asm-instruction-trace" ||
            !retainedSources.has(report.sourceSha256)
          ) {
            return report;
          }
          return Object.assign({}, report, { indexProfile: SNES_ANALYSIS_TRACE_PROFILE });
        });
        this.replaceTables({ imports: reports });
        this.#database.exec(`UPDATE capture_catalog SET profile='${SNES_ANALYSIS_TRACE_PROFILE}'
          WHERE sha256 IN (SELECT json_extract(analysis_json(payload),'$.sourceSha256') FROM imports
          WHERE json_extract(analysis_json(payload),'$.indexProfile')='${SNES_ANALYSIS_TRACE_PROFILE}')`);
        const current = this.researchInputsAreCurrent(this.researchInputsIdentity() ?? "");
        const published = this.publishManifest(manifest);
        if (current) {
          this.#database
            .prepare("UPDATE meta SET v=? WHERE k='research-index-revision'")
            .run(String(published.revision));
        }
        this.#clearDictionaryCache();
        if (this.#database.prepare("PRAGMA foreign_key_check").get()) {
          throw new Error("Retained runtime tables failed foreign-key validation.");
        }
        onProgress?.("Validated compact runtime tables; committing retention publication.");
      });
    } finally {
      target?.close();
      if (lifecycle.attached) {
        this.#database.exec("DETACH DATABASE retained");
      }
      this.#database.exec("PRAGMA foreign_keys=ON");
      this.#database.exec(`PRAGMA secure_delete=${secureDelete}`);
      for (const suffix of ["", "-wal", "-shm"]) {
        fs.rmSync(`${staging}${suffix}`, { force: true });
      }
    }
  }

  /**
   * Current persisted policy. Defaults do not write or change the semantic revision.
   * @returns Validated defaults and persisted overrides.
   */
  storagePolicy(): AnalysisStoragePolicy {
    return readStoragePolicy(this.#database);
  }

  /**
   * Update only explicit policy fields in the caller's writer transaction.
   * @param patch Explicit limits, in bytes/days/counts.
   * @returns Complete policy saved without changing the edit revision.
   */
  setStoragePolicy(patch: Partial<AnalysisStoragePolicy>): AnalysisStoragePolicy {
    this.#requireTransaction();
    const policy = validateStoragePolicy({ ...this.storagePolicy(), ...patch });
    this.#database
      .prepare("INSERT OR REPLACE INTO meta VALUES('storage-policy',?)")
      .run(JSON.stringify(policy));
    return policy;
  }

  /**
   * Storage accounting avoids decoding runtime or analysis payloads.
   * @returns Physical allocation and logical retention counts.
   */
  storageSnapshot() {
    return storageSnapshot(this.#database, this.file);
  }

  /**
   * Optional projection allocation, including secondary indexes. Reserved for explicit accounting.
   * @returns Allocated cache bytes, excluding permanent editor/export indexes.
   */
  storageCacheBytes(): number {
    return optionalCacheBytes(this.#database);
  }

  /**
   * Durable receipt lookup survives source-file removal and cache eviction.
   * @param sha256 Canonical capture identity.
   * @returns Retained import identity and counts.
   */
  captureReceipt(sha256: string) {
    return this.#database.prepare("SELECT * FROM capture_catalog WHERE sha256=?").get(sha256);
  }

  /** Bounded physical-code joins; graphics never imply that a CPU instruction executed. */
  graphicsEvidence(query: GraphicsEvidenceQuery) {
    return this.transaction(() => queryGraphicsEvidence(this.#database, query), false);
  }

  /** Small durable import receipts in import order. */
  captureCatalog() {
    return this.#database
      .prepare("SELECT * FROM capture_catalog ORDER BY imported_at,sha256")
      .all();
  }

  /**
   * Record the first successful import atomically with its facts. Reimports only refresh last-seen time.
   * @param report Successfully validated native trace import.
   */
  recordCaptureReceipt(report: ImportReport): void {
    this.#requireTransaction();
    if (
      !["uttori-asm-instruction-trace", "uttori-asm-bus-trace", "uttori-nes-ppu-evidence"].includes(
        report.format,
      )
    ) {
      return;
    }
    const now = Date.now();
    this.#database
      .prepare(`INSERT INTO capture_catalog(sha256,profile,source_name,imported_at,last_seen_at,observed_events,dropped_events)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(sha256) DO UPDATE SET last_seen_at=excluded.last_seen_at`)
      .run(
        report.sourceSha256,
        report.indexProfile ?? "full",
        report.sourceName,
        now,
        now,
        observedImportCount(report.imported, "graphicsEvents") ??
          observedImportCount(report.imported, "busEvents") ??
          observedImportCount(report.imported, "executionEvents") ??
          0,
        report.unsupported.find((entry) => entry.field === "instruction-addresses")?.count ?? 0,
      );
  }

  /**
   * Drop disposable projections after publication, then recycle WAL without waiting on active readers.
   * @returns Cache eviction totals and whether readers delayed WAL truncation.
   */
  maintainStorage() {
    const caches = this.transaction(() => maintainStorageCaches(this.#database));
    const previousTimeout = Number(this.#database.prepare("PRAGMA busy_timeout").get()!.timeout);
    try {
      this.#database.exec("PRAGMA busy_timeout=0; PRAGMA wal_checkpoint(PASSIVE)");
      const checkpoint = this.#database.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
      return { ...caches, checkpointBusy: Number(checkpoint?.busy ?? 0) !== 0 };
    } finally {
      this.#database.exec(`PRAGMA busy_timeout=${previousTimeout}`);
    }
  }

  /** Close once in finally, releasing statements and any active transaction. Further use throws. */
  close(): void {
    this.#database.close();
  }
}
