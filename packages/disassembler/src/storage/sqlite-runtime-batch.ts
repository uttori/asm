import type { DatabaseSync, StatementSync } from "node:sqlite";

import { canonicalEquals } from "@uttori/asm-core/canonical-json";

import type { RuntimeEvidenceRecord, RuntimeInstructionRecord } from "../model/project-types.js";
import { sqliteRuntimeIdentity } from "./sqlite-payload.js";
import { runtimeColumns } from "./sqlite-records.js";
import { RUNTIME_DESCRIPTOR_COLUMNS, runtimeIdentityKey } from "./sqlite-runtime-facts.js";
import { encodeRuntimeFactPayload, runtimeFactFingerprint } from "./sqlite-runtime-storage.js";

/** A transaction-owned provisional sink. finish() must run before committing its buffered rows. */
export interface RuntimeTracePublicationSink {
  /** Accept one validated distinct logical record; true means provisionally added. */
  add(record: RuntimeEvidenceRecord): boolean;
  /** Flush all pending pairs and rows. A failure must roll back the enclosing transaction. */
  finish(): void;
}

/** Staging must drive these joins; rebuilding a full-history automatic index per batch is quadratic. */
export const RUNTIME_TRACE_BATCH_OBSERVATIONS_SQL = `
  INSERT INTO runtime_observations(fact_id,prefix_id,identity_id,evidence_id,count,state_prefix_id,query_ready)
    SELECT f.fid,b.prefix_id,i.iid,b.evidence_id,b.count,b.state_prefix_id,b.query_ready
    FROM temp.runtime_trace_batch b CROSS JOIN runtime_fact_rows f
      ON substr(f.fingerprint,1,8)=substr(b.fingerprint,1,8) AND f.fingerprint=b.fingerprint
    CROSS JOIN runtime_identities i
      ON (${runtimeIdentityKey("i.value")})=(${runtimeIdentityKey("b.identity_value")}) AND i.value=b.identity_value
    ORDER BY b.position
`;

/**
 * Restrict a trace batch to the four namespaces emitted by the instruction importer.
 * A namespace check is still necessary on the existing-source fallback before comparing stable IDs.
 */
export function assertTraceRecordNamespace(
  record: RuntimeEvidenceRecord,
  sourceSha256: string,
): void {
  const root = `runtime:instruction-trace:${sourceSha256}:`;
  let prefix = root;
  if (record.kind === "runtime-instruction") {
    prefix += "code:";
  } else if (record.kind === "runtime-cpu-state") {
    prefix += "state:";
  } else if (record.kind === "runtime-memory-access") {
    prefix += "memory:";
  } else if (record.kind !== "runtime-execution") {
    throw new Error("Unsupported instruction trace batch record.");
  }
  const suffix = record.id.slice(prefix.length);
  // Execution IDs use uppercase, padded PCs; content identities use lowercase SHA-256.
  let validSuffix = /^[\da-f]{64}$/.test(suffix);
  if (record.kind === "runtime-execution") {
    const pc = record.address.toString(16).toUpperCase().padStart(6, "0");
    validSuffix =
      suffix === pc ||
      (record.architecture === "65xx.2a03" &&
        suffix.startsWith(`${pc}:mapping:`) &&
        /^[\da-f]{64}$/.test(suffix.slice(pc.length + 9)));
  }
  if (
    !record.id.startsWith(prefix) ||
    !validSuffix ||
    !canonicalEquals(record.evidence, [root.slice(0, -1)])
  ) {
    throw new Error("Runtime record escaped its trace batch namespace or provenance.");
  }
}

/**
 * Publish a new capture through batches of at most 1024 physical observations, with one pending
 * instruction/state pair. The caller validates each logical record and owns the writer transaction.
 * SQL preserves shared fact/identity interning and observation triggers; no history stays on the heap.
 * Existing source namespaces must use ordinary collision/repair checks instead of this writer.
 */
export class SqliteRuntimeTraceBatch implements RuntimeTracePublicationSink {
  readonly #db: DatabaseSync;
  readonly #source: string;
  readonly #intern: (table: string, value: string) => number;
  readonly #stage: StatementSync;
  #pending: RuntimeInstructionRecord | undefined;
  #rows = 0;
  #finished = false;

  constructor(db: DatabaseSync, source: string, intern: (table: string, value: string) => number) {
    this.#db = db;
    this.#source = source;
    this.#intern = intern;
    // Staging is connection-local and transactional. A failed publication cannot leak source rows.
    db.exec(`CREATE TEMP TABLE runtime_trace_batch (
      position INTEGER PRIMARY KEY, fingerprint BLOB NOT NULL,
      ${RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `"${column}"`).join(",")},
      payload, prefix_id INTEGER NOT NULL, identity_value NOT NULL,
      evidence_id INTEGER NOT NULL, count INTEGER NOT NULL, state_prefix_id INTEGER, query_ready INTEGER NOT NULL
    )`);
    this.#stage = db.prepare(
      `INSERT INTO temp.runtime_trace_batch VALUES (${Array(24).fill("?").join(",")})`,
    );
  }

  /** Accept only the importer's adjacent code/state pairs; validate equality before sharing storage. */
  add(record: RuntimeEvidenceRecord): boolean {
    if (this.#finished || !this.#db.isTransaction) {
      throw new Error("Runtime trace batch is no longer active.");
    }
    assertTraceRecordNamespace(record, this.#source);
    if (this.#pending) {
      const instruction = this.#pending;
      if (
        record.kind !== "runtime-cpu-state" ||
        record.id !== instruction.id.replace(":code:", ":state:") ||
        record.architecture !== instruction.architecture ||
        record.addressSpace !== instruction.addressSpace ||
        record.address !== instruction.address ||
        record.count !== instruction.count ||
        !canonicalEquals(record.state, instruction.state)
      ) {
        throw new Error("Instruction trace batch has an inconsistent code/state pair.");
      }
      this.#pending = undefined;
      this.#append(
        instruction,
        this.#intern("runtime_prefixes", sqliteRuntimeIdentity(record.id).prefix),
      );
    } else if (record.kind === "runtime-instruction") {
      this.#pending = record;
    } else if (record.kind === "runtime-cpu-state") {
      throw new Error("Instruction trace batch state has no preceding instruction.");
    } else {
      this.#append(record, null);
    }
    return true;
  }

  /** Encode once per physical observation; repeated shared facts are resolved together in SQL. */
  #append(record: RuntimeEvidenceRecord, statePrefix: number | null): void {
    const columns = runtimeColumns(record);
    const identity = sqliteRuntimeIdentity(record.id);
    this.#stage.run(
      ++this.#rows,
      runtimeFactFingerprint(record, columns),
      record.kind,
      record.architecture,
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
      encodeRuntimeFactPayload(record, columns.payload),
      this.#intern("runtime_prefixes", identity.prefix),
      identity.suffix,
      this.#intern("runtime_evidence", JSON.stringify(record.evidence)),
      record.count,
      statePrefix,
      record.kind === "runtime-execution" ? 0 : 1,
    );
    if (this.#rows >= 1024) {
      this.#flush();
    }
  }

  /** Full hash/value equality follows each compact index key; collisions never merge distinct facts. */
  #flush(): void {
    if (!this.#rows) {
      return;
    }
    const columns = RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `"${column}"`).join(",");
    const selected = RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `b."${column}"`).join(",");
    // Drive joins from the bounded staging table. An unconstrained join can choose an automatic
    // covering index over all retained facts and rebuild it on every batch as history grows.
    this.#db.exec(`
      INSERT INTO runtime_facts(fingerprint,${columns},payload)
        SELECT DISTINCT b.fingerprint,${selected},CASE WHEN typeof(b.payload)='text' THEN jsonb(b.payload) ELSE b.payload END
        FROM temp.runtime_trace_batch b WHERE NOT EXISTS (
          SELECT 1 FROM runtime_fact_rows f
          WHERE substr(f.fingerprint,1,8)=substr(b.fingerprint,1,8) AND f.fingerprint=b.fingerprint
        );
      INSERT INTO runtime_identities(value)
        SELECT DISTINCT b.identity_value FROM temp.runtime_trace_batch b WHERE NOT EXISTS (
          SELECT 1 FROM runtime_identities i
          WHERE (${runtimeIdentityKey("i.value")})=(${runtimeIdentityKey("b.identity_value")}) AND i.value=b.identity_value
        );
      ${RUNTIME_TRACE_BATCH_OBSERVATIONS_SQL};
      DELETE FROM temp.runtime_trace_batch;
    `);
    this.#rows = 0;
  }

  finish(): void {
    if (this.#finished || !this.#db.isTransaction) {
      throw new Error("Runtime trace batch is no longer active.");
    }
    if (this.#pending) {
      throw new Error("Instruction trace batch ended without its paired state.");
    }
    this.#flush();
    this.#db.exec("DROP TABLE temp.runtime_trace_batch");
    this.#finished = true;
  }
}
