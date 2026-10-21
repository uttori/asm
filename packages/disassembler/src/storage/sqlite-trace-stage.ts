import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { acquireFileLease, type FileLease } from "../internal/durable-files.js";
import type { RuntimeTraceCheckpoint } from "../runtime/runtime-trace.js";

/** Cached counters are exact nonnegative integers, including zero for absent evidence kinds. */
function checkpointCount(value: object, key: string): number {
  const count: unknown = Reflect.get(value, key);
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
    throw new Error("Invalid validated trace checkpoint count.");
  }
  return count;
}

/** Reject incomplete or obsolete summaries before allowing them to replace archive parsing. */
function readCheckpoint(value: unknown): RuntimeTraceCheckpoint {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid validated trace checkpoint.");
  }
  if (
    !("sourceSha256" in value) ||
    typeof value.sourceSha256 !== "string" ||
    !/^[\da-f]{64}$/.test(value.sourceSha256) ||
    !("complete" in value) ||
    typeof value.complete !== "boolean" ||
    ("recovery" in value && value.recovery !== undefined)
  ) {
    // Prefix recovery remains deliberately uncached: its incomplete companion has no final boundary.
    throw new Error("Invalid validated trace checkpoint identity.");
  }
  return {
    sourceSha256: value.sourceSha256,
    complete: value.complete,
    executionRecords: checkpointCount(value, "executionRecords"),
    memoryRecords: checkpointCount(value, "memoryRecords"),
    indexRecords: checkpointCount(value, "indexRecords"),
    observedEvents: checkpointCount(value, "observedEvents"),
    droppedEvents: checkpointCount(value, "droppedEvents"),
    unattributed: checkpointCount(value, "unattributed"),
    detailedEvents: checkpointCount(value, "detailedEvents"),
    memoryLoss: checkpointCount(value, "memoryLoss"),
  };
}

/**
 * Disposable, leased SQLite counters for one content-addressed import. The checkpoint and all
 * counters commit together before destination publication; an interrupted parse has no checkpoint.
 * The cache survives failed publication, and is removed only after a successful destination commit.
 */
export class SqliteTraceStage {
  /** Owned connection; parsing and its checkpoint share one transaction in this database. */
  readonly database: DatabaseSync;
  readonly #lease: FileLease;
  /** Absent until the complete index transaction seals; sealed counters are immutable. */
  checkpoint: RuntimeTraceCheckpoint | undefined;

  constructor(readonly file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.#lease = acquireFileLease(`${file}.lock`);
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(file);
      database.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA cache_size=-65536;
        CREATE TABLE IF NOT EXISTS trace_facts(id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, count INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS trace_checkpoint(payload TEXT NOT NULL);`);
      const row = database.prepare("SELECT payload FROM trace_checkpoint").get();
      if (row) {
        this.checkpoint = readCheckpoint(JSON.parse(String(row.payload)));
      } else {
        // SQLite rolls back a killed parser's transaction on open. Discard any older unsealed rows too.
        database.exec("DELETE FROM trace_facts");
      }
      this.database = database;
    } catch (error) {
      database?.close();
      this.#lease.release();
      throw error;
    }
  }

  /** Called inside the counter transaction, after full source and fingerprint verification. */
  seal(checkpoint: RuntimeTraceCheckpoint): void {
    this.checkpoint = readCheckpoint(checkpoint);
    this.database
      .prepare("INSERT INTO trace_checkpoint VALUES (?)")
      .run(JSON.stringify(checkpoint));
  }

  /** Close on every path. Successful publication discards this optional cache while still holding its lease. */
  close(discard = false): void {
    try {
      this.database.close();
      if (discard) {
        fs.rmSync(this.file, { force: true });
      }
    } finally {
      this.#lease.release();
    }
  }
}
