import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  createRuntimeInstructionTraceImporter,
  type RuntimeInstructionTraceChunk,
  type RuntimeTraceIndexMode,
} from "../packages/disassembler/src/runtime-trace.js";
import { SqliteAnalysisStore } from "../packages/disassembler/src/sqlite-store.js";
import { createEditorRuntimeTraceSource } from "../packages/vscode-extension/src/runtime/trace-source.js";

/** Read a named option without accepting another flag as its value.
 * @param {string} name Command-line flag, including its leading dashes.
 * @param {string} [fallback] Default when omitted; absent defaults make the option required.
 * @returns {string} Explicit or default value. Malformed options throw.
 */
const option = (name: string, fallback?: string): string => {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? fallback : process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
};

/** Validate bounds before opening the archive or allocating a temporary index.
 * @param {string} name Numeric command-line flag.
 * @param {number} fallback Count used when the flag is omitted.
 * @param {number} minimum Inclusive lower bound; warmups permit zero.
 * @returns {number} Safe integer count. Invalid values throw.
 */
const countOption = (name: string, fallback: number, minimum: number): number => {
  const value = Number(option(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} requires an integer >= ${minimum}.`);
  }
  return value;
};

const trace = path.resolve(option("--trace"));
const output = path.resolve(option("--output"));
const events = countOption("--events", 2_000_000, 1);
const warmups = countOption("--warmups", 1, 0);
const repetitions = countOption("--repetitions", 3, 1);
const indexMode = option("--index-mode", "full") as RuntimeTraceIndexMode;
if (!["full", "65816-analysis", "65816-disassembly"].includes(indexMode)) {
  throw new Error("Unsupported --index-mode.");
}
const baseline = process.argv.includes("--baseline");
const samples = [];
let expected: unknown;

// Only this isolated benchmark process substitutes the previous temporary-table layout.
// Never open a real project here. Fail if production SQL changes instead of silently
// comparing two identical implementations under different names.
// eslint-disable-next-line @typescript-eslint/unbound-method -- Restored below and invoked with the original connection via call().
const originalExec = DatabaseSync.prototype.exec;
if (baseline) {
  DatabaseSync.prototype.exec = function (sql: string): void {
    if (sql.includes("CREATE TEMP TABLE trace_facts")) {
      assert.ok(sql.includes("PRAGMA temp.cache_size=-65536;"));
      assert.ok(sql.includes("id TEXT PRIMARY KEY NOT NULL"));
      assert.ok(sql.includes("); BEGIN;"));
      sql = sql
        .replace("PRAGMA temp.cache_size=-65536;", "PRAGMA temp.cache_size=0;")
        .replace("id TEXT PRIMARY KEY NOT NULL", "id TEXT PRIMARY KEY")
        .replace("); BEGIN;", ") WITHOUT ROWID; BEGIN;");
    }
    originalExec.call(this, sql);
  };
}

try {
  for (let repetition = 0; repetition < warmups + repetitions; repetition++) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-trace-index-benchmark-"));
    const store = new SqliteAnalysisStore(path.join(directory, "analysis.sqlite"));
    try {
      let observedEvents = 0;
      let bytesRead = 0;
      let emittedRecords = 0;
      const source = await createEditorRuntimeTraceSource(trace, {
        maxBytes: Number.MAX_SAFE_INTEGER,
        onProgress: (bytes) => {
          bytesRead = bytes;
        },
      });
      const metrics = {
        hits: 0,
        misses: 0,
        evictions: 0,
        peakEntries: 0,
        sqlStatements: 0,
        payloads: 0,
      };
      const stop = new Error("Benchmark prefix complete");
      global.gc?.();
      const cpu = process.cpuUsage();
      const start = performance.now();
      const importer = await store.indexTrace(async (index) => {
        const importer = createRuntimeInstructionTraceImporter(
          source.metadata,
          {
            projectRomContentSha256: source.metadata.romContentSha256,
            sourceName: path.basename(trace),
            indexMode,
          },
          {
            index,
            onRecord: () => {
              emittedRecords++;
            },
          },
        );
        try {
          await source.read((value) => {
            importer.push(value);
            observedEvents += (value as RuntimeInstructionTraceChunk).addresses.length;
            // Keep complete producer chunks: samples share the same canonical prefix hash.
            // The unconsumed archive tail is intentionally not validated by this benchmark.
            if (observedEvents >= events) {
              throw stop;
            }
          });
        } catch (error) {
          if (error !== stop) {
            throw error;
          }
        }
        assert.ok(observedEvents >= events, "Capture is shorter than the requested prefix.");
        return importer;
      }, metrics);
      const ms = performance.now() - start;
      const used = process.cpuUsage(cpu);
      const memory = process.memoryUsage();
      // Finalization validates/counts the streamed output outside the indexing timer.
      // The sink discards records, so this never merges into a project or holds all facts.
      const result = importer.finish();
      const identity = {
        sourceSha256: result.sourceSha256,
        observedEvents: result.observedEvents,
        imported: result.report.imported,
        emittedRecords,
      };
      expected ??= identity;
      assert.deepEqual(identity, expected);
      const sample = {
        warmup: repetition < warmups,
        ms,
        cpuMs: (used.user + used.system) / 1000,
        bytesRead,
        memory,
        metrics,
        ...identity,
      };
      samples.push(sample);
      console.log(JSON.stringify(sample));
    } finally {
      store.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
} finally {
  DatabaseSync.prototype.exec = originalExec;
}

const times = samples
  .filter((sample) => !sample.warmup)
  .map((sample) => sample.ms)
  .sort((a, b) => a - b);
const middle = Math.floor(times.length / 2);
const medianMs = times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2;
fs.writeFileSync(
  output,
  `${JSON.stringify(
    {
      trace,
      requestedEvents: events,
      indexMode,
      baseline,
      runtime: process.versions,
      scope:
        "Read/decode/hash/temporary SQLite indexing of complete prefix chunks; excludes finalization and project publication; archive tail is not validated",
      medianMs,
      samples,
    },
    null,
    2,
  )}\n`,
);
