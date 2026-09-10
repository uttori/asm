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
  type RuntimeStateValue,
  type ShardKind,
} from "./project-types.js";
import type { RuntimeTraceFactIndex, RuntimeTraceIndexedFact } from "./runtime-trace.js";

/** On-disk sqlite filename stored in `analysis.json` `db`. */
export const ANALYSIS_PROJECT_SQLITE_FILE = "analysis.sqlite";

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
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  address_space TEXT NOT NULL,
  address INTEGER NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  address_space TEXT NOT NULL,
  address INTEGER NOT NULL,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  address_space TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  address_space TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  classification TEXT NOT NULL,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS analysis (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  address_space TEXT,
  address INTEGER,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS runtime (
  id TEXT PRIMARY KEY,
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
  evidence TEXT NOT NULL,
  payload TEXT
) WITHOUT ROWID;
`;

const SCHEMA_INDEX_STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS labels_addr ON labels (address_space, address)",
  "CREATE INDEX IF NOT EXISTS comments_addr ON comments (address_space, address)",
  'CREATE INDEX IF NOT EXISTS regions_range ON regions (address_space, start, "end")',
  'CREATE INDEX IF NOT EXISTS annotations_range ON annotations (address_space, start, "end")',
  "CREATE INDEX IF NOT EXISTS analysis_addr ON analysis (address_space, address)",
  "CREATE INDEX IF NOT EXISTS analysis_kind ON analysis (kind)",
  "CREATE INDEX IF NOT EXISTS runtime_lookup ON runtime (kind, address_space, address, start)",
  "CREATE INDEX IF NOT EXISTS runtime_from ON runtime (from_address_space, from_address)",
] as const;

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

const parseRecord = <T>(payload: unknown): T => JSON.parse(payload as string) as T;

/**
 * Store searchable coordinates as columns and variant-only fields as a bounded payload.
 * Unused coordinate columns stay null so one record kind cannot masquerade as another.
 * @param {RuntimeEvidenceRecord} record Validated semantic runtime fact.
 * @returns {object} Column bindings with absent variant fields omitted from the payload.
 */
const runtimeColumns = (
  record: RuntimeEvidenceRecord,
): {
  addressSpace: string | null;
  address: number | null;
  start: number | null;
  end: number | null;
  fromAddressSpace: string | null;
  fromAddress: number | null;
  toAddressSpace: string | null;
  toAddress: number | null;
  instructionAddressSpace: string | null;
  instructionAddress: number | null;
  accessedAddressSpace: string | null;
  accessedAddress: number | null;
  coverage: string | null;
  payload: string | null;
} => {
  switch (record.kind) {
    case "runtime-execution":
      return {
        addressSpace: record.addressSpace,
        address: record.address,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: JSON.stringify({
          ...(record.fileOffset === undefined ? {} : { fileOffset: record.fileOffset }),
          ...(record.size === undefined ? {} : { size: record.size }),
          ...(record.opcode === undefined ? {} : { opcode: record.opcode }),
        }),
      };
    case "runtime-instruction":
      return {
        addressSpace: record.addressSpace,
        address: record.address,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: JSON.stringify({ bytes: record.bytes, state: record.state }),
      };
    case "runtime-memory-access":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: record.instructionAddressSpace,
        instructionAddress: record.instructionAddress,
        accessedAddressSpace: record.accessedAddressSpace,
        accessedAddress: record.accessedAddress,
        coverage: null,
        payload: JSON.stringify({
          access: record.access,
          width: record.width,
          ...(record.actor === undefined ? {} : { actor: record.actor }),
          ...(record.channel === undefined ? {} : { channel: record.channel }),
          ...(record.value === undefined ? {} : { value: record.value }),
        }),
      };
    case "runtime-cpu-state":
      return {
        addressSpace: record.addressSpace,
        address: record.address,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: JSON.stringify({ state: record.state }),
      };
    case "runtime-coverage":
      return {
        addressSpace: record.addressSpace,
        address: null,
        start: record.start,
        end: record.end,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: record.coverage,
        payload: null,
      };
    case "runtime-control-target":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: record.fromAddressSpace,
        fromAddress: record.fromAddress,
        toAddressSpace: record.toAddressSpace,
        toAddress: record.toAddress,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: JSON.stringify({ flowKind: record.flowKind, indirect: record.indirect }),
      };
  }
  throw new Error("Unsupported runtime evidence kind.");
};

/**
 * Reconstruct a semantic fact without inventing absent optional fields; stable-ID comparisons
 * depend on preserving the same payload across inserts and subsequent reads.
 * @param {object} row SQLite runtime row selected with all columns.
 * @returns {RuntimeEvidenceRecord} Decoded fact in its original discriminated shape.
 */
const runtimeFromRow = (row: object): RuntimeEvidenceRecord => {
  const fields = row as Record<string, unknown>;
  const extra =
    fields.payload === null || fields.payload === undefined
      ? {}
      : (JSON.parse(fields.payload as string) as Record<string, unknown>);
  const evidence = JSON.parse(fields.evidence as string) as readonly string[];
  const kind = fields.kind as RuntimeEvidenceRecord["kind"];
  const architecture = fields.architecture as string;
  const count = Number(fields.count);
  const id = fields.id as string;
  if (kind === "runtime-execution") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space as string,
      address: Number(fields.address),
      ...(extra as {
        fileOffset?: number;
        size?: number;
        opcode?: number;
      }),
    };
  }
  if (kind === "runtime-instruction") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space as string,
      address: Number(fields.address),
      bytes: extra.bytes as readonly number[],
      state: extra.state as Readonly<Record<string, RuntimeStateValue>>,
    };
  }
  if (kind === "runtime-memory-access") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      instructionAddressSpace: fields.instruction_address_space as string,
      instructionAddress: Number(fields.instruction_address),
      accessedAddressSpace: fields.accessed_address_space as string,
      accessedAddress: Number(fields.accessed_address),
      access: extra.access as "read" | "write" | "read-write" | "unknown",
      width: extra.width as number,
      ...(extra.actor === undefined ? {} : { actor: extra.actor as "cpu" | "dma" | "hdma" }),
      ...(extra.channel === undefined ? {} : { channel: extra.channel as number }),
      ...(extra.value === undefined ? {} : { value: extra.value as number }),
    };
  }
  if (kind === "runtime-cpu-state") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space as string,
      address: Number(fields.address),
      state: extra.state as Readonly<Record<string, RuntimeStateValue>>,
    };
  }
  if (kind === "runtime-coverage") {
    return {
      id,
      kind,
      architecture,
      count,
      evidence,
      addressSpace: fields.address_space as string,
      start: Number(fields.start),
      end: Number(fields.end),
      coverage: fields.coverage as "executed" | "operand" | "read" | "written",
    };
  }
  return {
    id,
    kind: "runtime-control-target",
    architecture,
    count,
    evidence,
    fromAddressSpace: fields.from_address_space as string,
    fromAddress: Number(fields.from_address),
    toAddressSpace: fields.to_address_space as string,
    toAddress: Number(fields.to_address),
    flowKind: extra.flowKind as string,
    indirect: Boolean(extra.indirect),
  };
};

const analysisAddress = (
  record: AnalysisRecord,
): { addressSpace: string | null; address: number | null } => {
  if ("addressSpace" in record && "address" in record)
    return { addressSpace: record.addressSpace, address: record.address };
  if ("addressSpace" in record && "fromAddress" in record)
    return { addressSpace: record.addressSpace, address: record.fromAddress };
  return { addressSpace: null, address: null };
};

/**
 * Columnar sqlite working store for one analysis project.
 */
export class SqliteAnalysisStore {
  readonly #database: DatabaseSync;
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

  /**
   * Opens or creates a project database.
   * @param {string} file Absolute sqlite path.
   * @param {boolean} [createSchema] Whether to apply DDL.
   */
  constructor(file: string, createSchema = true) {
    if (!createSchema && !fs.existsSync(file))
      throw new Error(`Analysis database does not exist: ${file}`);
    this.file = file;
    this.#database = new DatabaseSync(file, { open: true });
    try {
      if (createSchema) {
        this.#database.exec(SCHEMA);
        for (const sql of SCHEMA_INDEX_STATEMENTS) this.#database.exec(sql);
      }
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
      this.#findRuntime = this.#database.prepare("SELECT * FROM runtime WHERE id=?");
      this.#insertRuntime = this.#database.prepare(
        `INSERT INTO runtime (
          id, kind, architecture, count, address_space, address, start, "end",
          from_address_space, from_address, to_address_space, to_address,
          instruction_address_space, instruction_address, accessed_address_space, accessed_address,
          coverage, evidence, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    if (!this.#database.isTransaction) return;
    try {
      this.#database.exec("ROLLBACK");
    } catch {
      // Closing the owned connection is the final cleanup if rollback itself fails.
    }
  }

  #insertRecord(kind: ShardKind, value: unknown): void {
    if (kind === "evidence") {
      const record = value as EvidenceRecord;
      this.#insertEvidence.run(record.id, JSON.stringify(record));
      return;
    }
    if (kind === "labels") {
      const record = value as ProjectLabel;
      this.#insertLabel.run(
        record.id,
        record.addressSpace,
        record.address,
        record.name,
        JSON.stringify(record),
      );
      return;
    }
    if (kind === "comments") {
      const record = value as ProjectComment;
      this.#insertComment.run(
        record.id,
        record.addressSpace,
        record.address,
        JSON.stringify(record),
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
        JSON.stringify(record),
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
        JSON.stringify(record),
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
        JSON.stringify(record),
      );
      return;
    }
    if (kind === "imports") {
      const record = value as ImportReport;
      this.#insertImport.run(record.id, JSON.stringify(record));
      return;
    }
    const record = value as RuntimeEvidenceRecord;
    const columns = runtimeColumns(record);
    this.#insertRuntime.run(
      record.id,
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
      JSON.stringify(record.evidence),
      columns.payload,
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
    this.#database.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
    try {
      const result = action();
      this.#database.exec("COMMIT");
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
      this.#database.exec("DELETE FROM temp.replacement_ids");
      const find = this.#database.prepare(`SELECT * FROM ${kind} WHERE id=?`);
      const remove = this.#database.prepare(`DELETE FROM ${kind} WHERE id=?`);
      for (const record of shards[kind] ?? []) {
        remember.run(record.id);
        const prior = find.get(record.id);
        if (prior) {
          const before = kind === "runtime" ? runtimeFromRow(prior) : parseRecord(prior.payload);
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
   * Insert a content-addressed runtime fact once; an ID collision with different content is an
   * error, never a silent no-op. Count values are already aggregated within the source capture.
   * @param {RuntimeEvidenceRecord} record Fully aggregated fact with a source-derived stable ID.
   * @returns {boolean} True when inserted; identical facts return false and conflicting facts throw.
   */
  insertRuntime(record: RuntimeEvidenceRecord): boolean {
    this.#requireTransaction();
    const prior = this.#findRuntime.get(record.id);
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
      SELECT runtime.id, ref.value AS evidence FROM runtime, json_each(runtime.evidence) AS ref
      LEFT JOIN evidence ON evidence.id=ref.value WHERE evidence.id IS NULL LIMIT 1
    `)
      .get();
    if (missing)
      throw new Error(
        `Analysis record '${String(missing.id)}' refers to missing evidence '${String(missing.evidence)}'.`,
      );
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
      `SELECT * FROM runtime WHERE kind IN (${kinds.map(() => "?").join(", ")})`,
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
      SELECT * FROM runtime WHERE kind IN ('runtime-execution', 'runtime-instruction', 'runtime-cpu-state')
        AND address_space=? AND address=?
      UNION ALL SELECT * FROM runtime WHERE kind='runtime-coverage' AND address_space=? AND start<=? AND "end">?
      UNION ALL SELECT * FROM runtime WHERE kind='runtime-memory-access' AND instruction_address_space=? AND instruction_address=?
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
    for (const row of this.#database.prepare("SELECT * FROM runtime").iterate())
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
      runtime: runtime ? [...this.runtimeRecords()] : [],
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
    this.#database.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
  }

  /** Close prepared statements and the database. */
  close(): void {
    this.#database.close();
  }
}
