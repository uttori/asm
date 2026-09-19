import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { setImmediate } from "node:timers/promises";

import { canonicalJson } from "./canonical-json.js";
import type { RuntimeEvidenceRecord } from "./project-types.js";
import { project65816AnalysisState } from "./runtime-trace-profile.js";
import { sqliteRuntimeIdentity } from "./sqlite-payload.js";
import { runtimeFromRow } from "./sqlite-records.js";

/** Runtime reader for supported physical layouts. Migration holds the source snapshot throughout.
 * @param {number} version Supported physical SQLite layout.
 * @returns {string} Internal SELECT that reconstructs runtime dictionaries when needed.
 */
export const migrationRuntimeQuery = (version: number): string =>
  version === 0
    ? "SELECT r.* FROM runtime r"
    : `SELECT r.*,p.value AS id_prefix,e.value AS evidence FROM runtime r
     LEFT JOIN runtime_prefixes p ON p.id=r.prefix_id LEFT JOIN runtime_evidence e ON e.id=r.evidence_id`;

/** Order-independent SHA-256 sum, with record count checked separately by migration.
 * Physical pairing changes cursor order. Hashing each canonical record preserves multiset verification
 * without sorting millions of expanded JSON records into a second temporary database.
 */
export class RuntimeDigest {
  #sum = 0n;
  update(json: string): void {
    this.#sum =
      (this.#sum + BigInt(`0x${createHash("sha256").update(json).digest("hex")}`)) % (1n << 256n);
  }
  digest(_encoding: "hex"): string {
    return this.#sum.toString(16).padStart(64, "0");
  }
}

/**
 * Build a bounded-on-heap projection in a temporary SQLite table. Only native trace code and its
 * matching state are narrowed; standalone states, bus facts, other CPUs and execution totals survive.
 * The durable source is untouched, and the original database remains the forensic migration backup.
 * @param {DatabaseSync} db Exclusively held source snapshot; only connection-local temporary tables are written.
 * @param {number} version Source physical layout.
 * @param {object} options Cancellation and bounded progress callbacks.
 */
export const prepareRuntimeConversion = async (
  db: DatabaseSync,
  version: number,
  options: {
    readonly signal?: AbortSignal;
    readonly onProgress?: (records: number) => void;
    /** Validate original semantics before projection can merge counts or omit state fields. */
    readonly validateRecord: (record: RuntimeEvidenceRecord) => void;
  },
): Promise<void> => {
  db.exec("CREATE TEMP TABLE converted_captures(sha256 TEXT PRIMARY KEY) WITHOUT ROWID");
  const remember = db.prepare("INSERT OR IGNORE INTO temp.converted_captures VALUES(?)");
  db.exec(
    "CREATE TEMP TABLE converted_runtime(id TEXT PRIMARY KEY,payload TEXT NOT NULL,count INTEGER NOT NULL) WITHOUT ROWID",
  );
  const insert = db.prepare(`INSERT INTO temp.converted_runtime VALUES(?,?,?)
    ON CONFLICT(id) DO UPDATE SET count=count+excluded.count WHERE payload=excluded.payload`);
  const base = migrationRuntimeQuery(version);
  const counterpart = db.prepare(
    `${base} WHERE ${version === 0 ? "r.id=?" : "r.prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) AND r.id=?"}`,
  );
  let records = 0;
  for (const row of db.prepare(base).iterate()) {
    options.signal?.throwIfAborted();
    let record = runtimeFromRow(row);
    options.validateRecord(record);
    const match = /^runtime:instruction-trace:([\da-f]{64}):(code|state):([\da-f]{64})$/.exec(
      record.id,
    );
    if (
      match &&
      record.architecture === "snes.65816" &&
      (record.kind === "runtime-instruction" || record.kind === "runtime-cpu-state") &&
      record.addressSpace === "snes.cpu"
    ) {
      let bytes: readonly number[] | undefined;
      if (record.kind === "runtime-instruction") {
        bytes = record.bytes;
      } else {
        const codeId = `runtime:instruction-trace:${match[1]}:code:${match[3]}`;
        const identity = sqliteRuntimeIdentity(codeId);
        const otherRow =
          version === 0
            ? counterpart.get(codeId)
            : counterpart.get(identity.prefix, identity.suffix);
        const other = otherRow ? runtimeFromRow(otherRow) : undefined;
        // A state with no exact byte/state counterpart is independent evidence, not a trace pair.
        if (
          other?.kind === "runtime-instruction" &&
          other.architecture === record.architecture &&
          other.addressSpace === record.addressSpace &&
          other.address === record.address &&
          canonicalJson(other.state) === canonicalJson(record.state)
        ) {
          bytes = other.bytes;
        }
      }
      if (bytes) {
        remember.run(match[1]);
        const state = project65816AnalysisState(record.state);
        const identity = createHash("sha256")
          .update(canonicalJson({ address: record.address, bytes, state }))
          .digest("hex");
        record = {
          ...record,
          state,
          id: `runtime:instruction-trace:${match[1]}:${match[2]}:${identity}`,
        };
      }
    }
    // Counts are the only additive field. Any conflicting stable identity aborts conversion.
    if (insert.run(record.id, canonicalJson({ ...record, count: 0 }), record.count).changes !== 1) {
      throw new Error(`Conflicting projected runtime identity '${record.id}'.`);
    }
    if (++records % 5000 === 0) {
      options.onProgress?.(records);
      await setImmediate();
    }
  }
  if (
    db
      .prepare(
        "SELECT 1 FROM temp.converted_runtime WHERE typeof(count)!='integer' OR count>9007199254740991 LIMIT 1",
      )
      .get()
  ) {
    throw new Error("Projected execution count exceeds the exact integer range.");
  }
};

/** Read the finished projection once; no collection of full runtime history reaches the JS heap.
 * @param {DatabaseSync} db Connection containing the finished temporary projection.
 * @yields {RuntimeEvidenceRecord} One canonical variant with its exact aggregate count.
 */
export function* convertedRuntimeRecords(
  db: DatabaseSync,
): IterableIterator<RuntimeEvidenceRecord> {
  for (const row of db.prepare("SELECT payload,count FROM temp.converted_runtime").iterate()) {
    yield { ...JSON.parse(String(row.payload)), count: Number(row.count) } as RuntimeEvidenceRecord;
  }
}
