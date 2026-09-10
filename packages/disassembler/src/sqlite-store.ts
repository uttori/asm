import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import { canonicalJson } from "./canonical-json.js";
import {
  ANALYSIS_PROJECT_MANIFEST,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type AnalysisRecord,
  type EvidenceRecord,
  type ImportReport,
  type IntervalAnnotation,
  type ProjectComment,
  type ProjectLabel,
  type ProjectRegion,
  type RuntimeEvidenceRecord,
  type ShardKind,
} from "./project-types.js";
import type { RuntimeTraceFactIndex, RuntimeTraceIndexedFact } from "./runtime-trace.js";
import { assertNoSqliteMigration, sqliteFileIdentity } from "./sqlite-maintenance.js";
import {
  encodeSqlitePayload,
  decodeSqlitePayload,
  sqliteRuntimeIdentity,
} from "./sqlite-payload.js";
import {
  runtimeColumns,
  runtimeFromRow,
  analysisAddress,
  compareRuntimeRecordIds,
} from "./sqlite-records.js";

/** On-disk sqlite filename stored in `analysis.json` `db`. */
export const ANALYSIS_PROJECT_SQLITE_FILE = "analysis.sqlite";

/** Physical SQLite layout version, independent of semantic manifest schema and edit revisions. */
export const ANALYSIS_SQLITE_STORAGE_VERSION = 1;

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
CREATE TABLE IF NOT EXISTS runtime (
  prefix_id INTEGER NOT NULL REFERENCES runtime_prefixes(id),
  id BLOB NOT NULL,
  kind TEXT NOT NULL,
  architecture TEXT NOT NULL,
  count INTEGER NOT NULL,
  address_space TEXT,
  address INTEGER,
  start INTEGER,
  "end" INTEGER,
  from_address_space TEXT,
  from_address INTEGER,
  to_address_space TEXT,
  to_address INTEGER,
  instruction_address_space TEXT,
  instruction_address INTEGER,
  accessed_address_space TEXT,
  accessed_address INTEGER,
  coverage TEXT,
  evidence_id INTEGER NOT NULL REFERENCES runtime_evidence(id),
  payload BLOB,
  UNIQUE (prefix_id, id)
);
PRAGMA user_version=1;
`;

// Metadata queries only order records by location. Analysis records are loaded by stable ID;
// retaining unused kind/address indexes there would duplicate every metadata ID on disk.
const SCHEMA_INDEX_STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS labels_addr ON labels (address_space, address)",
  "CREATE INDEX IF NOT EXISTS comments_addr ON comments (address_space, address)",
  'CREATE INDEX IF NOT EXISTS regions_range ON regions (address_space, start, "end")',
  'CREATE INDEX IF NOT EXISTS annotations_range ON annotations (address_space, start, "end")',
  "CREATE INDEX IF NOT EXISTS runtime_lookup ON runtime (kind, address_space, address, start)",
  "CREATE INDEX IF NOT EXISTS runtime_memory ON runtime (instruction_address_space, instruction_address) WHERE kind='runtime-memory-access'",
] as const;

/** Joins retain bounded SQLite cursors; no project-sized dictionary is loaded on the JS heap. */
const RUNTIME_SELECT = `SELECT r.*, r.rowid AS storage_rowid, p.value AS id_prefix, e.value AS evidence
  FROM runtime AS r LEFT JOIN runtime_prefixes AS p ON p.id=r.prefix_id
  LEFT JOIN runtime_evidence AS e ON e.id=r.evidence_id`;

/**
 * Resolves the sqlite file for a project pointer.
 * @param {string} directory Project root containing analysis.json.
 * @param {Pick<AnalysisProjectManifest, "db">} manifest Validated pointer.
 * @returns {string} Absolute sqlite path.
 */
export const analysisProjectSqlitePath = (
  directory: string,
  manifest: Pick<AnalysisProjectManifest, "db">,
): string => {
  const relative = manifest.db ?? ANALYSIS_PROJECT_SQLITE_FILE;
  if (relative !== ANALYSIS_PROJECT_SQLITE_FILE)
    throw new Error(`Unsupported analysis sqlite path '${relative}'.`);
  return path.join(directory, relative);
};

/**
 * Decode physical storage and parse JSON; the project API owns semantic record validation.
 * @param {unknown} payload SQLite TEXT or a versioned compressed BLOB.
 * @returns {T} Parsed record, without asserting semantic validity.
 */
const parseRecord = <T>(payload: unknown): T => JSON.parse(decodeSqlitePayload(payload)) as T;

/**
 * Columnar sqlite working store for one analysis project.
 */
export class SqliteAnalysisStore {
  readonly #database: DatabaseSync;
  readonly #fileIdentity: string;
  readonly file: string;
  readonly #insertEvidence: StatementSync;
  readonly #insertLabel: StatementSync;
  readonly #insertComment: StatementSync;
  readonly #insertRegion: StatementSync;
  readonly #insertAnnotation: StatementSync;
  readonly #insertAnalysis: StatementSync;
  readonly #insertImport: StatementSync;
  readonly #insertRuntime: StatementSync;
  readonly #findRuntime: StatementSync;
  readonly #dictionaryStatements = new Map<
    string,
    { find: StatementSync; insert: StatementSync }
  >();
  /** Transaction-local cache: rollback or another writer cannot leave stale integer references here. */
  readonly #dictionaryIds = new Map<string, number>();
  #dictionaryCacheBytes = 0;

  /**
   * Opens or creates a project database.
   * @param {string} file Absolute sqlite path.
   * @param {boolean} [createSchema] Permit initialization of an empty database; never upgrade an existing one.
   * @param {boolean} [deferIndexes] Migration-only bulk load; finishMigration must build indexes before publication.
   */
  constructor(file: string, createSchema = true, deferIndexes = false) {
    assertNoSqliteMigration(file);
    if (!createSchema && !fs.existsSync(file))
      throw new Error(`Analysis database does not exist: ${file}`);
    this.file = file;
    this.#database = new DatabaseSync(file, { open: true });
    this.#fileIdentity = sqliteFileIdentity(file);
    try {
      const empty =
        Number(this.#database.prepare("SELECT count(*) AS n FROM sqlite_schema").get()?.n) === 0;
      const initialVersion = Number(
        this.#database.prepare("PRAGMA user_version").get()?.user_version,
      );
      if (createSchema && empty && initialVersion === 0) {
        this.#database.exec(SCHEMA);
        if (!deferIndexes) for (const sql of SCHEMA_INDEX_STATEMENTS) this.#database.exec(sql);
      }
      const version = Number(this.#database.prepare("PRAGMA user_version").get()?.user_version);
      if (version !== ANALYSIS_SQLITE_STORAGE_VERSION)
        throw new Error(
          `Unsupported analysis storage format ${version}; expected ${ANALYSIS_SQLITE_STORAGE_VERSION}. Run uttori-asm project-migrate <project-directory> for an older SQLite project.`,
        );
      this.#database.exec(
        "PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-8192; PRAGMA busy_timeout=5000; PRAGMA temp_store=FILE;",
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
      this.#findRuntime = this.#database.prepare(`${RUNTIME_SELECT}
        WHERE r.prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) AND r.id=?`);
      this.#insertRuntime = this.#database.prepare(
        `INSERT INTO runtime (
          prefix_id, id, kind, architecture, count, address_space, address, start, "end",
          from_address_space, from_address, to_address_space, to_address,
          instruction_address_space, instruction_address, accessed_address_space, accessed_address,
          coverage, evidence_id, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
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
    if (!this.#database.isTransaction) return;
    try {
      this.#database.exec("ROLLBACK");
    } catch {
      // Closing the owned connection is the final cleanup if rollback itself fails.
    }
  }

  /** Forget all transaction-owned dictionary references and their bounded text allocation. */
  #clearDictionaryCache(): void {
    this.#dictionaryIds.clear();
    this.#dictionaryCacheBytes = 0;
  }

  /**
   * Intern exact text with a bounded cache; callers hold the SQLite writer lock.
   * @param {string} table One of the two prepared dictionary tables.
   * @param {string} value Exact prefix or serialized evidence list.
   * @returns {number} Transactionally created or existing dictionary rowid.
   */
  #intern(table: string, value: string): number {
    const key = `${table}:${value}`;
    const cached = this.#dictionaryIds.get(key);
    if (cached !== undefined) return cached;
    const statements = this.#dictionaryStatements.get(table)!;
    const found = statements.find.get(value);
    const id = found ? Number(found.id) : Number(statements.insert.run(value).lastInsertRowid);
    const bytes = Buffer.byteLength(key);
    if (this.#dictionaryIds.size >= 256 || this.#dictionaryCacheBytes + bytes > 512 * 1024)
      this.#clearDictionaryCache();
    // A single unusually large ID/evidence set must not turn the cache into a second record store.
    if (bytes <= 512 * 1024) {
      this.#dictionaryIds.set(key, id);
      this.#dictionaryCacheBytes += bytes;
    }
    return id;
  }

  #insertRecord(kind: ShardKind, value: unknown): void {
    if (kind === "evidence") {
      const record = value as EvidenceRecord;
      this.#insertEvidence.run(record.id, encodeSqlitePayload(JSON.stringify(record)));
      return;
    }
    if (kind === "labels") {
      const record = value as ProjectLabel;
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
      const record = value as ProjectComment;
      this.#insertComment.run(
        record.id,
        record.addressSpace,
        record.address,
        encodeSqlitePayload(JSON.stringify(record)),
      );
      return;
    }
    if (kind === "regions") {
      const record = value as ProjectRegion;
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
      const record = value as IntervalAnnotation;
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
      const record = value as AnalysisRecord;
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
      const record = value as ImportReport;
      this.#insertImport.run(record.id, encodeSqlitePayload(JSON.stringify(record)));
      return;
    }
    const record = value as RuntimeEvidenceRecord;
    const columns = runtimeColumns(record);
    const identity = sqliteRuntimeIdentity(record.id);
    this.#insertRuntime.run(
      this.#intern("runtime_prefixes", identity.prefix),
      identity.suffix,
      record.kind,
      record.architecture,
      record.count,
      columns.addressSpace,
      columns.address,
      columns.start,
      columns.end,
      columns.fromAddressSpace,
      columns.fromAddress,
      columns.toAddressSpace,
      columns.toAddress,
      columns.instructionAddressSpace,
      columns.instructionAddress,
      columns.accessedAddressSpace,
      columns.accessedAddress,
      columns.coverage,
      this.#intern("runtime_evidence", JSON.stringify(record.evidence)),
      columns.payload === null ? null : encodeSqlitePayload(columns.payload),
    );
  }

  /**
   * Run a synchronous unit against one SQLite snapshot. Writers acquire their lock before reading
   * the revision so a competing process cannot slip between the stale check and publication.
   * @param {Function} action Synchronous work; cursors must be consumed before returning.
   * @param {boolean} [write] Acquire the writer lock immediately; false creates a read snapshot.
   * @returns {T} Callback result after a successful commit.
   */
  transaction<T>(action: () => T, write = true): T {
    assertNoSqliteMigration(this.file);
    if (sqliteFileIdentity(this.file) !== this.#fileIdentity)
      throw new Error(
        "Analysis database was replaced; close this connection and reload the project.",
      );
    this.#clearDictionaryCache();
    this.#database.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
    try {
      const result = action();
      this.#database.exec("COMMIT");
      this.#clearDictionaryCache();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  /**
   * Index trace chunks in a connection-local disk table. This transaction never reads or writes
   * main, allowing other project writers to proceed during asynchronous capture parsing.
   * @param {Function} action Async parser using only the supplied temporary counter index.
   * @returns {Promise} Parser result after temporary counters commit; the index lives until connection close.
   */
  async indexTrace<T>(action: (index: RuntimeTraceFactIndex) => Promise<T>): Promise<T> {
    this.#database.exec(`CREATE TEMP TABLE trace_facts (
      id TEXT PRIMARY KEY, payload TEXT NOT NULL, count INTEGER NOT NULL
    ) WITHOUT ROWID; BEGIN;`);
    const increment = this.#database.prepare(
      "UPDATE temp.trace_facts SET count=count+1 WHERE id=?",
    );
    const insert = this.#database.prepare("INSERT INTO temp.trace_facts VALUES (?, ?, 1)");
    const values = this.#database.prepare("SELECT payload, count FROM temp.trace_facts");
    const index: RuntimeTraceFactIndex = {
      add: (key, create) => {
        if (increment.run(key).changes !== 0) return false;
        insert.run(key, JSON.stringify(create()));
        return true;
      },
      values: function* () {
        for (const row of values.iterate())
          yield {
            fact: parseRecord<RuntimeTraceIndexedFact>(row.payload),
            count: Number(row.count),
          };
      },
      clear: () => this.#database.exec("DELETE FROM temp.trace_facts"),
    };
    try {
      const result = await action(index);
      this.#database.exec("COMMIT");
      this.#clearDictionaryCache();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  /** Require mutations to belong to an explicitly owned atomic publication. */
  #requireTransaction(): void {
    if (!this.#database.isTransaction) throw new Error("Analysis mutation requires a transaction.");
  }

  /**
   * Replace only supplied tables, retaining byte-identical rows. The temporary ID set bounds
   * memory and deletes removed rows without rewriting unchanged metadata or runtime history.
   * Semantic validation belongs to the project publication API; this method must run in its transaction.
   * @param {Partial<AnalysisProjectShards>} shards Validated replacements for explicitly named tables.
   */
  replaceTables(shards: Partial<AnalysisProjectShards>): void {
    this.#requireTransaction();
    this.#database.exec(
      "CREATE TEMP TABLE IF NOT EXISTS replacement_ids (id TEXT PRIMARY KEY) WITHOUT ROWID",
    );
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
    for (const kind of Object.keys(shards) as ShardKind[]) {
      if (!tables.has(kind)) throw new Error(`Unknown analysis table '${kind}'.`);
      if (kind === "runtime") {
        this.#replaceRuntime(shards.runtime ?? []);
        continue;
      }
      this.#database.exec("DELETE FROM temp.replacement_ids");
      const find = this.#database.prepare(`SELECT * FROM ${kind} WHERE id=?`);
      const remove = this.#database.prepare(`DELETE FROM ${kind} WHERE id=?`);
      for (const record of shards[kind] ?? []) {
        remember.run(record.id);
        const prior = find.get(record.id);
        if (prior) {
          const before = parseRecord(prior.payload);
          if (canonicalJson(before) === canonicalJson(record)) continue;
          remove.run(record.id);
        }
        this.#insertRecord(kind, record);
      }
      this.#database.exec(
        `DELETE FROM ${kind} WHERE id NOT IN (SELECT id FROM temp.replacement_ids)`,
      );
    }
  }

  /**
   * Replace runtime by integer storage IDs, keeping the temporary retention set compact.
   * @param {Array} records Complete semantic runtime replacement; duplicate IDs remain errors.
   */
  #replaceRuntime(records: readonly RuntimeEvidenceRecord[]): void {
    this.#database.exec(
      "CREATE TEMP TABLE IF NOT EXISTS replacement_runtime_ids (id INTEGER PRIMARY KEY); DELETE FROM replacement_runtime_ids",
    );
    const remember = this.#database.prepare("INSERT INTO temp.replacement_runtime_ids VALUES (?)");
    const seen = this.#database.prepare("SELECT 1 FROM temp.replacement_runtime_ids WHERE id=?");
    const remove = this.#database.prepare("DELETE FROM runtime WHERE rowid=?");
    for (const record of records) {
      const identity = sqliteRuntimeIdentity(record.id);
      let prior = this.#findRuntime.get(identity.prefix, identity.suffix);
      // Detect repetition before replacement can assign a different rowid to the same semantic ID.
      if (prior && seen.get(prior.storage_rowid))
        throw new Error(`Duplicate runtime record ID '${record.id}'.`);
      if (prior && canonicalJson(runtimeFromRow(prior)) !== canonicalJson(record)) {
        remove.run(prior.storage_rowid);
        prior = undefined;
      }
      if (!prior) {
        this.#insertRecord("runtime", record);
        prior = this.#findRuntime.get(identity.prefix, identity.suffix)!;
      }
      remember.run(prior.storage_rowid);
    }
    this.#database.exec(
      "DELETE FROM runtime WHERE rowid NOT IN (SELECT id FROM temp.replacement_runtime_ids)",
    );
  }

  /**
   * Append validated migration rows without materializing a complete table or comparing absent IDs.
   * @param {ShardKind} kind Destination semantic table.
   * @param {Iterable} records Bounded batch or lazy cursor; uniqueness is enforced by SQLite.
   */
  appendRecords<K extends ShardKind>(
    kind: K,
    records: Iterable<AnalysisProjectShards[K][number]>,
  ): void {
    this.#requireTransaction();
    for (const record of records) this.#insertRecord(kind, record);
  }

  /**
   * Insert a content-addressed runtime fact once; an ID collision with different content is an
   * error, never a silent no-op. Count values are already aggregated within the source capture.
   * @param {RuntimeEvidenceRecord} record Fully aggregated fact with a source-derived stable ID.
   * @returns {boolean} True when inserted; identical facts return false and conflicting facts throw.
   */
  insertRuntime(record: RuntimeEvidenceRecord): boolean {
    this.#requireTransaction();
    const identity = sqliteRuntimeIdentity(record.id);
    const prior = this.#findRuntime.get(identity.prefix, identity.suffix);
    if (prior) {
      if (canonicalJson(runtimeFromRow(prior)) !== canonicalJson(record))
        throw new Error(
          `Runtime record '${record.id}' has changed content for a stable imported ID.`,
        );
      return false;
    }
    this.#insertRecord("runtime", record);
    return true;
  }

  /** Reject evidence removal that would leave retained runtime facts orphaned, without loading them. */
  validateRuntimeEvidence(): void {
    const missing = this.#database
      .prepare(`
      SELECT ref.value AS evidence FROM runtime_evidence AS sets, json_each(sets.value) AS ref
      LEFT JOIN evidence ON evidence.id=ref.value
      WHERE evidence.id IS NULL AND EXISTS (SELECT 1 FROM runtime WHERE evidence_id=sets.id) LIMIT 1
    `)
      .get();
    if (missing)
      throw new Error(`Runtime history refers to missing evidence '${String(missing.evidence)}'.`);
  }

  /**
   * Store manifest and counter in the same transaction as the changed records.
   * @param {object} manifest Semantic project identity for this publication.
   * @returns {AnalysisProjectManifest} Manifest containing the incremented counter.
   */
  publishManifest(manifest: Omit<AnalysisProjectManifest, "shards">): AnalysisProjectManifest {
    this.#requireTransaction();
    const revision = this.revision() + 1;
    const pointer: AnalysisProjectManifest = {
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
   * Current publication counter.
   * @returns {number} Stored revision.
   */
  revision(): number {
    const row = this.#database.prepare("SELECT v FROM meta WHERE k='revision'").get();
    return Number(row?.v ?? 0);
  }

  /**
   * Manifest stored in meta, including sqlite pointer fields.
   * @returns {AnalysisProjectManifest} Pointer manifest.
   */
  manifest(): AnalysisProjectManifest {
    const row = this.#database.prepare("SELECT v FROM meta WHERE k='manifest'").get();
    if (!row) throw new Error("Sqlite analysis project is missing its stored manifest.");
    return { ...parseRecord<AnalysisProjectManifest>(row.v), revision: this.revision() };
  }

  /**
   * Stream only requested runtime kinds, avoiding raw-row and decoded-row arrays on the JS heap.
   * @param {Array} kinds Runtime discriminators to include; empty selects nothing.
   * @returns {IterableIterator} Cursor consumed within the owning read transaction.
   * @yields {RuntimeEvidenceRecord} One matching decoded fact.
   */
  *runtimeRecordsByKinds(
    kinds: readonly RuntimeEvidenceRecord["kind"][],
  ): IterableIterator<RuntimeEvidenceRecord> {
    if (kinds.length === 0) return;
    const statement = this.#database.prepare(
      `${RUNTIME_SELECT} WHERE r.kind IN (${kinds.map(() => "?").join(", ")})`,
    );
    for (const row of statement.iterate(...kinds)) yield runtimeFromRow(row);
  }

  /**
   * Read runtime observations at a selected location, including containing coverage ranges.
   * @param {string} addressSpace Logical address-space ID.
   * @param {number} address Nonnegative address in that space.
   * @returns {IterableIterator} Cursor over matching point and interval facts.
   * @yields {RuntimeEvidenceRecord} A fact associated with the selected location.
   */
  *runtimeAt(addressSpace: string, address: number): IterableIterator<RuntimeEvidenceRecord> {
    const query = this.#database.prepare(`
      ${RUNTIME_SELECT} WHERE r.kind IN ('runtime-execution', 'runtime-instruction', 'runtime-cpu-state')
        AND r.address_space=? AND r.address=?
      UNION ALL ${RUNTIME_SELECT} WHERE r.kind='runtime-coverage' AND r.address_space=? AND r.address IS NULL AND r.start<=? AND r."end">?
      UNION ALL ${RUNTIME_SELECT} WHERE r.kind='runtime-memory-access' AND r.instruction_address_space=? AND r.instruction_address=?
    `);
    for (const row of query.iterate(
      addressSpace,
      address,
      addressSpace,
      address,
      address,
      addressSpace,
      address,
    ))
      yield runtimeFromRow(row);
  }

  /**
   * Stream runtime facts without retaining the complete table.
   * @returns {IterableIterator<RuntimeEvidenceRecord>} One reconstructed runtime row at a time.
   * @yields {RuntimeEvidenceRecord} One runtime fact.
   */
  *runtimeRecords(): IterableIterator<RuntimeEvidenceRecord> {
    for (const row of this.#database.prepare(`${RUNTIME_SELECT} ORDER BY r.rowid`).iterate())
      yield runtimeFromRow(row);
  }

  /**
   * Read one metadata table directly; Sources must not load unrelated CFG or runtime tables.
   * @param {string} kind Metadata table name from the semantic collection contract.
   * @returns {Array} Decoded metadata in deterministic display order.
   */
  loadTable<K extends Exclude<ShardKind, "runtime">>(kind: K): AnalysisProjectShards[K] {
    const order: Record<Exclude<ShardKind, "runtime">, string> = {
      labels: "address_space, address, id",
      comments: "address_space, address, id",
      annotations: 'address_space, start, "end", id',
      regions: 'address_space, start, "end", id',
      analysis: "id",
      evidence: "id",
      imports: "id",
    };
    if (!Object.hasOwn(order, kind)) throw new Error(`Unknown analysis table '${kind}'.`);
    const records = [];
    for (const row of this.#database
      .prepare(`SELECT payload FROM ${kind} ORDER BY ${order[kind]}`)
      .iterate())
      records.push(parseRecord(row.payload));
    return records as AnalysisProjectShards[K];
  }

  /**
   * Stream decoded records in insertion order for migration digest verification.
   * @param {ShardKind} kind Semantic table to traverse.
   * @returns {IterableIterator} Cursor retaining only the current decoded record.
   * @yields {object} Original semantic record.
   */
  *records<K extends ShardKind>(kind: K): IterableIterator<AnalysisProjectShards[K][number]> {
    if (kind === "runtime") {
      yield* this.runtimeRecords() as IterableIterator<AnalysisProjectShards[K][number]>;
      return;
    }
    if (
      !["evidence", "labels", "comments", "regions", "annotations", "analysis", "imports"].includes(
        kind,
      )
    )
      throw new Error(`Unknown analysis table '${kind}'.`);
    for (const row of this.#database
      .prepare(`SELECT payload FROM ${kind} ORDER BY rowid`)
      .iterate())
      yield parseRecord<AnalysisProjectShards[K][number]>(row.payload);
  }

  /**
   * Initialize a migrated project's unchanged logical identity once, inside its first publication.
   * @param {AnalysisProjectManifest} manifest Validated authoritative source manifest and revision.
   */
  initializeMigratedManifest(manifest: AnalysisProjectManifest): void {
    this.#requireTransaction();
    if (this.#database.prepare("SELECT 1 FROM meta LIMIT 1").get())
      throw new Error("Migration manifest can only initialize an empty metadata header.");
    const insert = this.#database.prepare("INSERT INTO meta (k,v) VALUES (?,?)");
    insert.run("revision", String(manifest.revision ?? 0));
    insert.run("manifest", canonicalJson(manifest));
  }

  /**
   * Build deferred indexes and check all physical structures before closing a staged migration file.
   * Switching through DELETE verifies that no staging reader retains a WAL dependency; the closed
   * file retains WAL mode for ordinary clients, with all committed pages checkpointed into main.
   */
  finishMigration(): void {
    for (const sql of SCHEMA_INDEX_STATEMENTS) this.#database.exec(sql);
    const integrity = this.#database.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok")
      throw new Error("Migrated SQLite database failed integrity validation.");
    if (this.#database.prepare("PRAGMA foreign_key_check").get())
      throw new Error("Migrated SQLite database contains an invalid dictionary reference.");
    this.#database.exec(
      "PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; PRAGMA journal_mode=WAL;",
    );
  }

  /**
   * Materialize metadata once; full runtime history is opt-in for callers that need it.
   * @param {boolean} [runtime] Include complete runtime history; false keeps it on disk.
   * @returns {AnalysisProjectShards} Decoded record arrays owned by the caller.
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
      runtime: runtime ? [...this.runtimeRecords()].sort(compareRuntimeRecordIds) : [],
    };
  }

  /**
   * Table counts for reports.
   * @returns {Readonly<Record<string, number>>} Row counts.
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
   * Atomically refresh the watcher hint after commit. SQLite is authoritative: a failed hint write
   * is reported as a warning, never as a failed import that could cause an unsafe retry.
   * @param {string} directory Project root for the watcher hint.
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

  /** Checkpoint and reclaim unused SQLite pages; run only during explicit storage maintenance. */
  compact(): void {
    const disk = fs.statfsSync(path.dirname(this.file));
    const pageCount = Number(this.#database.prepare("PRAGMA page_count").get()?.page_count);
    const pageSize = Number(this.#database.prepare("PRAGMA page_size").get()?.page_size);
    if (disk.bavail * disk.bsize < 2 * pageCount * pageSize)
      throw new Error(
        "Insufficient free disk space for SQLite VACUUM; allow twice the database size.",
      );
    this.transaction(() => {
      // Retired provenance/prefix sets may remain after complete runtime replacements. Prune with
      // set queries so compaction does not perform one full runtime scan per dictionary entry.
      this.#database.exec(`
        DELETE FROM runtime_prefixes WHERE id NOT IN (SELECT DISTINCT prefix_id FROM runtime);
        DELETE FROM runtime_evidence WHERE id NOT IN (SELECT DISTINCT evidence_id FROM runtime);
      `);
    });
    this.#database.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
  }

  /** Close prepared statements and the database. */
  close(): void {
    this.#database.close();
  }
}
