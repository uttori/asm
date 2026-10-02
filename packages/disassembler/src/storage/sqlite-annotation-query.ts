/** Indexed, bounded editor projections. Full analysis/export APIs retain their complete views. */
import type { DatabaseSync } from "node:sqlite";

import type {
  AnalysisProjectManifest,
  AnalysisProjectShards,
  AnalysisRecord,
  AnalysisControlFlowNodeRecord,
  RuntimeEvidenceRecord,
} from "../model/project-types.js";
import {
  isFiniteNumber,
  isRecord,
  isStringArray,
  requireAnalysisRecord,
  requireEvidenceRecord,
  requireIntervalAnnotation,
  requireProjectComment,
} from "../model/record-shape.js";
import { encodeSqlitePayload, parseSqlitePayload } from "./sqlite-payload.js";
import { runtimeFromRow } from "./sqlite-records.js";

/** Exact logical/output coordinates from a validated debug map. Ranges are half-open. */
export interface AnnotationQueryRange {
  readonly architecture?: string;
  readonly addressSpace: string;
  readonly start: number;
  readonly end: number;
  readonly outputStart?: number;
  readonly outputEnd?: number;
}

/** A small semantic view plus explicit notice when an editor detail budget was reached. */
export interface SqliteAnnotationView {
  readonly shards: AnalysisProjectShards;
  readonly executionCounts: ReadonlyMap<string, number>;
  readonly limited: boolean;
}

/** Minimal persisted instruction contract needed for ROM/source validation and emission. */
export type InstructionExportRecord = Pick<
  AnalysisControlFlowNodeRecord,
  | "id"
  | "kind"
  | "addressSpace"
  | "address"
  | "fileOffset"
  | "size"
  | "opcode"
  | "specificationId"
  | "incomingState"
  | "evidence"
>;
const QUERY_LAYOUT = "5";

function isPartialInstruction(value: unknown): value is Partial<InstructionExportRecord> {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind !== undefined && value.kind !== "cfg-node") {
    return false;
  }
  if (value.id !== undefined && typeof value.id !== "string") {
    return false;
  }
  if (value.addressSpace !== undefined && typeof value.addressSpace !== "string") {
    return false;
  }
  if (value.specificationId !== undefined && typeof value.specificationId !== "string") {
    return false;
  }
  for (const key of ["address", "fileOffset", "size", "opcode"] as const) {
    if (value[key] !== undefined && !isFiniteNumber(value[key])) {
      return false;
    }
  }
  if (value.incomingState !== undefined && !isRecord(value.incomingState)) {
    return false;
  }
  return value.evidence === undefined || isStringArray(value.evidence);
}

function requirePartialInstruction(value: unknown): Partial<InstructionExportRecord> {
  const parsed = parseSqlitePayload(value);
  if (!isPartialInstruction(parsed)) {
    throw new Error("Invalid indexed instruction.");
  }
  return parsed;
}
/** Reconstruct one physical observation or its paired logical state after filtering shared facts.
 * CROSS JOIN keeps the selective fact lookup ahead of capture relationships. The compatibility
 * UNION view cannot push a state-kind constraint into its paired branch and scans the history.
 * @param {boolean} pairedState Select the paired state's identity and virtual row order instead of its instruction.
 * @returns {string} Internal SELECT prefix. Callers supply indexed coordinate predicates and a limit.
 */
const runtimeSelect = (pairedState = false): string => {
  const kind = pairedState ? "'runtime-cpu-state'" : "f.kind";
  const prefix = pairedState ? "o.state_prefix_id" : "o.prefix_id";
  const row = pairedState ? "-o.oid" : "o.oid";
  return `SELECT ${row} AS storage_rowid,${kind} AS kind,i.value AS id,
    p.value AS id_prefix,e.value AS evidence,o.count,f.architecture,
    f.address_space,f.address,f.start,f."end",f.from_address_space,f.from_address,
    f.to_address_space,f.to_address,f.instruction_address_space,f.instruction_address,
    f.accessed_address_space,f.accessed_address,f.coverage,
    CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
    FROM runtime_facts f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
    LEFT JOIN runtime_identities i ON i.iid=o.identity_id
    LEFT JOIN runtime_prefixes p ON p.id=${prefix}
    LEFT JOIN runtime_evidence e ON e.id=o.evidence_id`;
};

/** Pending offsets belong only to physical execution observations, never virtual CPU states. */
const PENDING_EXECUTIONS = `SELECT o.oid AS row_id,
  CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
  FROM runtime_observations o CROSS JOIN runtime_facts f ON f.fid=o.fact_id
  WHERE o.query_ready=0 AND f.kind='runtime-execution'`;

/**
 * Avoid acquiring a writer lock for ordinary viewport reads after indexes are current.
 * @param {DatabaseSync} database Open analysis connection.
 * @returns {boolean} Whether every persisted node/execution offset is indexed.
 */
export const annotationQueryIndexesReady = (database: DatabaseSync): boolean =>
  Boolean(
    database.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_instruction_nodes'").get(),
  ) &&
  database.prepare("SELECT v FROM meta WHERE k='annotation-query-layout'").get()?.v ===
    QUERY_LAYOUT &&
  !database.prepare("SELECT 1 FROM query_instruction_nodes WHERE ready=0 LIMIT 1").get() &&
  !database.prepare(`${PENDING_EXECUTIONS} LIMIT 1`).get();

/**
 * Install additive query indexes and incrementally extract explicit output offsets.
 * Triggers invalidate only changed rows, including writes from older clients. Authoritative
 * payloads, storage format version, and publication revision are untouched. The caller owns a writer lock.
 * @param {DatabaseSync} database Existing analysis database in a write transaction.
 */
export const ensureAnnotationQueryIndexes = (database: DatabaseSync): void => {
  if (
    database.prepare("SELECT v FROM meta WHERE k='annotation-query-layout'").get()?.v !==
    QUERY_LAYOUT
  ) {
    // Store derived columns alongside their owning rows. VACUUM, REPLACE, and unrelated schema
    // additions then cannot detach offsets or force a complete re-decode of the instruction history.
    database.exec(`DROP TRIGGER IF EXISTS query_instruction_insert; DROP TRIGGER IF EXISTS query_instruction_delete;
      DROP TRIGGER IF EXISTS query_instruction_update; DROP TRIGGER IF EXISTS query_execution_insert;
      DROP TRIGGER IF EXISTS query_execution_delete; DROP TRIGGER IF EXISTS query_execution_update;`);
    for (const name of ["query_instruction_nodes", "query_execution_offsets"]) {
      const row = database.prepare("SELECT type FROM sqlite_schema WHERE name=?").get(name);
      if (row) {
        database.exec(`DROP ${row.type === "view" ? "VIEW" : "TABLE"} ${name}`);
      }
    }
    for (const table of ["analysis", "runtime_observations"]) {
      const columns = new Set(
        database
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .map((row) => String(row.name)),
      );
      for (const [name, type] of [
        ["query_file_offset", "INTEGER"],
        ["query_size", "INTEGER"],
        ["query_data", "TEXT"],
        ["query_ready", "INTEGER NOT NULL DEFAULT 0"],
      ]) {
        if (!columns.has(name)) {
          database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
        }
      }
    }
    database.exec("UPDATE analysis SET query_ready=0 WHERE kind='cfg-node'");
    // Only executions have output offsets to backfill. Leaving every instruction/state marked
    // pending would rescan that unrelated history on each bounded execution batch.
    database.exec(
      "UPDATE runtime_observations SET query_ready=1 WHERE fact_id IN (SELECT fid FROM runtime_facts WHERE kind!='runtime-execution') AND query_ready=0",
    );
    database.exec(`CREATE INDEX IF NOT EXISTS analysis_location ON analysis(kind,address_space,address);
      CREATE INDEX IF NOT EXISTS query_instruction_pending ON analysis(query_ready) WHERE kind='cfg-node' AND query_ready=0;
      CREATE INDEX IF NOT EXISTS query_execution_output ON runtime_observations(query_file_offset) WHERE query_file_offset IS NOT NULL;
      CREATE INDEX IF NOT EXISTS query_execution_pending ON runtime_observations(query_ready) WHERE query_ready=0;
      CREATE VIEW query_instruction_nodes AS SELECT rowid AS row_id,query_file_offset AS file_offset,query_size AS size,query_data AS data,query_ready AS ready FROM analysis WHERE kind='cfg-node';
      CREATE VIEW query_execution_offsets AS SELECT rowid AS row_id,query_file_offset AS file_offset,query_size AS size,query_ready AS ready FROM runtime WHERE kind='runtime-execution';
      CREATE TRIGGER query_instruction_insert AFTER INSERT ON analysis WHEN NEW.kind='cfg-node' BEGIN UPDATE analysis SET query_ready=0 WHERE rowid=NEW.rowid; END;
      CREATE TRIGGER query_instruction_update AFTER UPDATE OF id,kind,address_space,address,payload ON analysis BEGIN UPDATE analysis SET query_ready=0 WHERE rowid=NEW.rowid; END;
      CREATE TRIGGER query_execution_update AFTER UPDATE OF fact_id ON runtime_observations BEGIN UPDATE runtime_observations SET query_ready=0 WHERE oid=NEW.oid; END;
`);
  }
  for (const table of ["analysis", "runtime"]) {
    const pendingSql =
      table === "runtime"
        ? PENDING_EXECUTIONS
        : "SELECT rowid AS row_id,payload FROM analysis WHERE kind='cfg-node' AND query_ready=0";
    const pending = database.prepare(`${pendingSql} LIMIT 1024`);
    const update = database.prepare(
      // Execution rows always have a positive physical observation ID. Updating the compatibility
      // union view here would also search its virtual-state branch once for every execution row.
      `UPDATE ${table === "runtime" ? "runtime_observations" : table} SET query_file_offset=?,query_size=?,query_ready=1 WHERE ${table === "runtime" ? "oid" : "rowid"}=?`,
    );
    const exportData =
      table === "analysis"
        ? database.prepare("UPDATE analysis SET query_data=? WHERE rowid=?")
        : undefined;
    // Fetch bounded batches before updating the pending index. Never mutate a live scan cursor.
    for (let rows = pending.all(); rows.length; rows = pending.all()) {
      for (const row of rows) {
        const record = row.payload === null ? {} : requirePartialInstruction(row.payload);
        const offset = record.fileOffset;
        if (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0)) {
          throw new Error("Invalid persisted instruction output offset.");
        }
        update.run(offset ?? null, record.size ?? null, row.row_id);
        if (exportData) {
          const {
            id,
            kind,
            addressSpace,
            address,
            fileOffset,
            size,
            opcode,
            specificationId,
            incomingState,
            evidence,
          } = record;
          // This cache excludes context trails and outgoing analysis state. Export still validates
          // instruction bytes/size/specification against the ROM, using the original incoming state.
          exportData.run(
            encodeSqlitePayload(
              JSON.stringify({
                id,
                kind,
                addressSpace,
                address,
                fileOffset,
                size,
                opcode,
                specificationId,
                incomingState,
                evidence,
              }),
            ),
            row.row_id,
          );
        }
      }
    }
  }
  if (
    database.prepare("SELECT v FROM meta WHERE k='annotation-query-layout'").get()?.v !==
    QUERY_LAYOUT
  ) {
    // Keep only the ordering key in the index. Compressed export records already live in analysis.
    // Duplicating the full projection here previously cost hundreds of MiB per project.
    database.exec(
      "DROP INDEX IF EXISTS query_instruction_output; CREATE INDEX query_instruction_output ON analysis(query_file_offset,id) WHERE kind='cfg-node'",
    );
  }
  database
    .prepare("INSERT OR REPLACE INTO meta(k,v) VALUES('annotation-query-layout',?)")
    .run(QUERY_LAYOUT);
};

/**
 * Read requested instructions and their evidence, never a whole-project annotation projection.
 * Hot PCs have a bounded preview of variants/state/memory facts. Execution totals remain exact.
 * @param {DatabaseSync} database Connection with initialized indexes, inside a read transaction.
 * @param {AnalysisProjectManifest} manifest Authoritative manifest for this read snapshot.
 * @param {readonly AnnotationQueryRange[]} ranges At most 2000 validated source/debugger ranges.
 * @returns {SqliteAnnotationView} Bounded records suitable for the ordinary semantic annotation builder.
 */
export const readSqliteAnnotationView = (
  database: DatabaseSync,
  manifest: AnalysisProjectManifest,
  ranges: readonly AnnotationQueryRange[],
): SqliteAnnotationView => {
  if (!annotationQueryIndexesReady(database)) {
    throw new Error("Analysis query indexes changed. Refresh the annotation view.");
  }
  validateAnnotationRanges(ranges);
  const fileSpaces = manifest.addressSpaces
    .filter((space) => space.kind === "file")
    .map((space) => space.id);
  const analysis = new Map<string, AnalysisRecord>();
  const locations = new Map<string, { space: string; address: number }>();
  const offsets = new Set<number>();
  let limited = false;
  const locate = (space: string, address: number): void => {
    const key = `${space}:${address}`;
    if (locations.size < 2000 || locations.has(key)) {
      locations.set(key, { space, address });
    } else {
      limited = true;
    }
  };
  const nodes = database.prepare(
    "SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address>=? AND address<? LIMIT ?",
  );
  // Pin the selective offset index: after removing the large covering index, SQLite prefers
  // analysis_location(kind) and reads every CFG payload once per visible source range.
  const outputNodes = database.prepare(
    "SELECT payload FROM analysis INDEXED BY query_instruction_output WHERE kind='cfg-node' AND query_file_offset>=? AND query_file_offset<? LIMIT ?",
  );
  const addNodes = (rows: Iterable<Record<string, unknown>>): void => {
    for (const row of rows) {
      if (analysis.size >= 8192) {
        limited = true;
        break;
      }
      const record = requireAnalysisRecord(parseSqlitePayload(row.payload));
      analysis.set(record.id, record);
      if (record.kind === "cfg-node") {
        locate(record.addressSpace, record.address);
        if (record.fileOffset !== undefined) {
          offsets.add(record.fileOffset);
        }
      }
    }
  };
  const pointLocations = database.prepare(
    "SELECT DISTINCT address FROM runtime_facts WHERE kind=? AND address_space=? AND address>=? AND address<? LIMIT 2001",
  );
  const pairedLocations = database.prepare(
    `SELECT DISTINCT f.address FROM runtime_facts f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
      WHERE f.kind='runtime-instruction' AND f.address_space=? AND f.address>=? AND f.address<? AND o.state_prefix_id IS NOT NULL LIMIT 2001`,
  );
  const memoryLocations = database.prepare(
    "SELECT DISTINCT instruction_address AS address FROM runtime_facts WHERE kind='runtime-memory-access' AND instruction_address_space=? AND instruction_address>=? AND instruction_address<? LIMIT 2001",
  );
  const opcodeLocations = database.prepare(
    "SELECT DISTINCT start AS address FROM annotations WHERE classification='opcode' AND address_space=? AND start>=? AND start<? LIMIT 2001",
  );
  const commentLocations = database.prepare(
    "SELECT DISTINCT address FROM comments WHERE address_space=? AND address>=? AND address<? LIMIT 2001",
  );
  const executionOutputs = database.prepare(
    // Joining the compatibility view to itself materialized every execution for each source line.
    // Start at the physical output-offset index and fetch only each matching observation's fact.
    `SELECT DISTINCT f.address_space,f.address,o.query_file_offset AS file_offset
      FROM runtime_observations o CROSS JOIN runtime_facts f ON f.fid=o.fact_id
      WHERE o.query_file_offset>=? AND o.query_file_offset<? AND f.kind='runtime-execution' LIMIT 2001`,
  );
  for (const range of ranges) {
    addNodes(
      nodes.iterate(range.addressSpace, range.start, range.end, Math.max(1, 8193 - analysis.size)),
    );
    const queries = [{ space: range.addressSpace, start: range.start, end: range.end }];
    if (range.outputStart !== undefined && range.outputEnd !== undefined) {
      addNodes(
        outputNodes.iterate(range.outputStart, range.outputEnd, Math.max(1, 8193 - analysis.size)),
      );
      let outputCount = 0;
      for (const row of executionOutputs.iterate(range.outputStart, range.outputEnd)) {
        // Deduplicate executions before limiting: a hot PC must not crowd out adjacent PCs.
        if (++outputCount > 2000) {
          limited = true;
          break;
        }
        locate(String(row.address_space), Number(row.address));
        offsets.add(Number(row.file_offset));
      }
      for (const space of fileSpaces) {
        queries.push({ space, start: range.outputStart, end: range.outputEnd });
      }
    }
    for (const { space, start, end } of queries) {
      for (const kind of ["runtime-execution", "runtime-cpu-state"]) {
        for (const row of pointLocations.iterate(kind, space, start, end)) {
          locate(space, Number(row.address));
        }
      }
      for (const query of [pairedLocations, memoryLocations, opcodeLocations, commentLocations]) {
        for (const row of query.iterate(space, start, end)) {
          locate(space, Number(row.address));
        }
      }
    }
  }
  for (const row of database
    .prepare("SELECT payload FROM analysis WHERE kind='summary'")
    .iterate()) {
    const record = requireAnalysisRecord(parseSqlitePayload(row.payload));
    analysis.set(record.id, record);
  }
  const runtime = new Map<string, RuntimeEvidenceRecord>();
  const executionCounts = new Map<string, number>();
  const point = database.prepare(
    `${runtimeSelect()} WHERE f.kind=? AND f.address_space=? AND f.address=? ORDER BY o.oid LIMIT ?`,
  );
  const pairedState = database.prepare(
    `${runtimeSelect(true)} WHERE f.kind='runtime-instruction' AND f.address_space=? AND f.address=? AND o.state_prefix_id IS NOT NULL ORDER BY o.oid DESC LIMIT ?`,
  );
  const memory = database.prepare(
    `${runtimeSelect()} WHERE f.kind='runtime-memory-access' AND f.instruction_address_space=? AND f.instruction_address=? ORDER BY o.oid LIMIT ?`,
  );
  const executionCount = database.prepare(
    `SELECT COALESCE(SUM(o.count),0) AS n FROM runtime_facts f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
      WHERE f.kind='runtime-execution' AND f.address_space=? AND f.address=?`,
  );
  /** Preserve virtual-row ordering and one combined preview limit across paired and standalone states.
   * @param {string} space Qualified logical address space, without inferred mapper aliases.
   * @param {number} address Exact instruction start within that space.
   * @param {number} limit Combined row budget, including one overflow sentinel for truncation reporting.
   * @yields {Record<string, unknown>} One undecoded logical state row in stable virtual-row order.
   */
  function* stateRows(space: string, address: number, limit: number) {
    let remaining = limit;
    for (const row of pairedState.iterate(space, address, remaining)) {
      yield row;
      remaining--;
    }
    if (remaining > 0) {
      yield* point.iterate("runtime-cpu-state", space, address, remaining);
    }
  }
  const addRuntime = (rows: Iterable<Record<string, unknown>>, limit: number): void => {
    let count = 0;
    for (const row of rows) {
      if (++count > limit) {
        limited = true;
        break;
      }
      const record = runtimeFromRow(row);
      runtime.set(record.id, record);
      if (record.kind === "runtime-execution" && record.fileOffset !== undefined) {
        offsets.add(record.fileOffset);
      }
    }
  };
  for (const [key, { space, address }] of locations) {
    executionCounts.set(key, Number(executionCount.get(space, address)?.n ?? 0));
    for (const kind of ["runtime-execution", "runtime-cpu-state"]) {
      // Reserve an execution fact even after the detail budget is exhausted so runtime-only
      // locations remain visible. Counts come from SQL. Sampled fact counts are never substituted.
      const minimum = kind === "runtime-execution" ? 1 : 0;
      const budget = Math.min(64, Math.max(minimum, 8192 - runtime.size));
      const rows =
        kind === "runtime-cpu-state"
          ? stateRows(space, address, budget + 1)
          : point.iterate(kind, space, address, budget + 1);
      addRuntime(rows, budget);
    }
    const budget = Math.min(64, Math.max(0, 8192 - runtime.size));
    addRuntime(memory.iterate(space, address, budget + 1), budget);
  }
  const annotations = new Map<string, AnalysisProjectShards["annotations"][number]>();
  const comments = new Map<string, AnalysisProjectShards["comments"][number]>();
  const intervals = database.prepare(
    'SELECT payload FROM annotations WHERE address_space=? AND start<=? AND "end">? LIMIT 1025',
  );
  const comment = database.prepare(
    "SELECT payload FROM comments WHERE address_space=? AND address=? LIMIT 1025",
  );
  const coverage = database.prepare(
    `${runtimeSelect()} WHERE f.kind='runtime-coverage' AND f.address_space=? AND f.address IS NULL AND f.start<=? AND f."end">? LIMIT 1025`,
  );
  const coordinates = new Map(locations);
  for (const offset of offsets) {
    for (const space of fileSpaces) {
      coordinates.set(`${space}:${offset}`, { space, address: offset });
    }
  }
  for (const { space, address } of coordinates.values()) {
    let intervalCount = 0;
    for (const row of intervals.iterate(space, address, address)) {
      if (++intervalCount > 1024 || annotations.size >= 8192) {
        limited = true;
        break;
      }
      const record = requireIntervalAnnotation(parseSqlitePayload(row.payload));
      annotations.set(record.id, record);
    }
    let commentCount = 0;
    for (const row of comment.iterate(space, address)) {
      if (++commentCount > 1024 || comments.size >= 8192) {
        limited = true;
        break;
      }
      const record = requireProjectComment(parseSqlitePayload(row.payload));
      comments.set(record.id, record);
    }
    addRuntime(
      coverage.iterate(space, address, address),
      Math.min(1024, Math.max(0, 16384 - runtime.size)),
    );
  }
  return {
    shards: {
      analysis: [...analysis.values()],
      annotations: [...annotations.values()],
      comments: [...comments.values()],
      evidence: [...database.prepare("SELECT payload FROM evidence").iterate()].map((row) =>
        requireEvidenceRecord(parseSqlitePayload(row.payload)),
      ),
      labels: [],
      regions: [],
      imports: [],
      runtime: [...runtime.values()],
    },
    executionCounts,
    limited,
  };
};

/**
 * Validates bounded, half-open coordinates before any editor query.
 * @param {readonly AnnotationQueryRange[]} ranges At most 2000 nonempty ranges; malformed input throws.
 */
const validateAnnotationRanges = (ranges: readonly AnnotationQueryRange[]): void => {
  if (ranges.length > 2000) {
    throw new Error("At most 2000 visible source ranges may be projected per request.");
  }
  for (const range of ranges) {
    if (
      !range.addressSpace ||
      !Number.isSafeInteger(range.start) ||
      !Number.isSafeInteger(range.end) ||
      range.start < 0 ||
      range.end <= range.start ||
      ((range.outputStart !== undefined || range.outputEnd !== undefined) &&
        (!Number.isSafeInteger(range.outputStart) ||
          !Number.isSafeInteger(range.outputEnd) ||
          range.outputStart! < 0 ||
          range.outputEnd! <= range.outputStart!))
    ) {
      throw new Error("Invalid instruction annotation range.");
    }
  }
};

/** Exact count at a qualified location, with explicit file offsets for mirror attribution. */
export interface InstructionExecutionSummary {
  readonly addressSpace: string;
  readonly address: number;
  readonly outputOffsets: readonly number[];
  readonly executionCount: number;
}

/** One requested span; counts are exact even when the number of displayed locations is bounded. */
export interface InstructionExecutionSummaryRow {
  readonly rangeIndex: number;
  readonly locations: readonly InstructionExecutionSummary[];
  readonly limited: boolean;
}

/**
 * Read only indexed coordinates and aggregate execution counts. No state, CFG payloads, memory,
 * or evidence records are decoded. Aliases retain separate counts instead of being summed.
 * @param {DatabaseSync} database Prepared project connection in the caller's read transaction.
 * @param {AnalysisProjectManifest} manifest Supplies file identities; no mapper inference is performed.
 * @param {readonly AnnotationQueryRange[]} ranges At most 2000 current source spans.
 * @returns {readonly InstructionExecutionSummaryRow[]} Exact counts with bounded, qualified locations.
 */
export const readInstructionExecutionSummary = (
  database: DatabaseSync,
  manifest: AnalysisProjectManifest,
  ranges: readonly AnnotationQueryRange[],
): readonly InstructionExecutionSummaryRow[] => {
  validateAnnotationRanges(ranges);
  const fileSpaces = manifest.addressSpaces.filter((space) => space.kind === "file");
  const count = database.prepare(`SELECT COALESCE(SUM(o.count),0) AS n
    FROM runtime_fact_locations f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
    WHERE f.kind='runtime-execution' AND f.address_space=? AND f.address=?
      AND (? IS NULL OR f.architecture=?)`);
  const aliases = database.prepare(`SELECT DISTINCT f.address_space,f.address,o.query_file_offset
    FROM runtime_observations o CROSS JOIN runtime_fact_locations f ON f.fid=o.fact_id
    WHERE o.query_file_offset>=? AND o.query_file_offset<? AND f.kind='runtime-execution'
      AND (? IS NULL OR f.architecture=?) LIMIT 65`);
  const logical = database.prepare(`SELECT DISTINCT address FROM runtime_fact_locations
    WHERE kind='runtime-execution' AND address_space=? AND address>=? AND address<?
      AND (? IS NULL OR architecture=?) LIMIT 65`);
  const counts = new Map<string, number>();
  return ranges.map((range, rangeIndex) => {
    const locations = new Map<
      string,
      { addressSpace: string; address: number; offsets: Set<number> }
    >();
    let limited = false;
    const add = (addressSpace: string, address: number, offset?: number): void => {
      const key = `${addressSpace}:${address}`;
      let location = locations.get(key);
      if (!location) {
        if (locations.size >= 64) {
          limited = true;
          return;
        }
        location = { addressSpace, address, offsets: new Set() };
        locations.set(key, location);
      }
      if (offset !== undefined) {
        location.offsets.add(offset);
      }
    };
    // The map proves both coordinates exist even when neither has recorded executions.
    if (range.outputStart !== undefined) {
      for (const space of fileSpaces) {
        add(space.id, range.outputStart, range.outputStart);
      }
    }
    add(range.addressSpace, range.start, range.outputStart);
    const architecture = range.architecture ?? null;
    for (const row of logical.iterate(
      range.addressSpace,
      range.start,
      range.end,
      architecture,
      architecture,
    )) {
      add(range.addressSpace, Number(row.address));
    }
    if (range.outputStart !== undefined && range.outputEnd !== undefined) {
      for (const row of aliases.iterate(
        range.outputStart,
        range.outputEnd,
        architecture,
        architecture,
      )) {
        add(String(row.address_space), Number(row.address), Number(row.query_file_offset));
      }
    }
    return {
      rangeIndex,
      limited,
      locations: [...locations.values()].map(({ addressSpace, address, offsets }) => {
        const key = `${architecture}:${addressSpace}:${address}`;
        let executionCount = counts.get(key);
        if (executionCount === undefined) {
          // File-domain evidence can omit an architecture; its qualified location is authoritative.
          const filter = fileSpaces.some((space) => space.id === addressSpace)
            ? null
            : architecture;
          executionCount = Number(count.get(addressSpace, address, filter, filter)?.n ?? 0);
          counts.set(key, executionCount);
        }
        return { addressSpace, address, outputOffsets: [...offsets], executionCount };
      }),
    };
  });
};
