import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { parseSqlitePayload } from "../packages/disassembler/src/sqlite-payload.js";
import { registerRuntimeHistory } from "../packages/disassembler/src/sqlite-runtime-history.js";

/** Read-only experiment for one native decoder signature; never installs a production cache.
 * Run with node --conditions=uttori-source --import=tsx scripts/benchmark-runtime-summary.ts DB REPORT.
 * A disposable database holds summaries; the source stays in one read snapshot throughout.
 */
const sourceFile = path.resolve(
  process.argv[2] ?? "secret-of-mana/disassembly/analysis/analysis.sqlite",
);
const reportFile = process.argv[3];
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-runtime-summary-"));
const summaryFile = path.join(directory, "summary.sqlite");
const source = new DatabaseSync(sourceFile, { readOnly: true });
const summary = new DatabaseSync(summaryFile);
registerRuntimeHistory(source);

/** Prototype rows keep evidence and a stable representative, so projected API records are reproducible. */
interface Group {
  readonly address: number;
  readonly key: string;
  readonly evidence: number;
  readonly total: number;
  readonly observations: number;
  readonly sample: number;
}

try {
  source.exec("PRAGMA cache_size=-8192; PRAGMA temp_store=FILE; BEGIN");
  // Match the current SNES decoder's aliases and valid-value masks exactly. This is an experiment,
  // not a second authoritative normalizer; a production implementation would share that function.
  source.function("summary_key", { deterministic: true }, (value) => {
    const payload = parseSqlitePayload<{ bytes: number[]; state: Record<string, unknown> }>(value);
    const state: Record<string, unknown> = {};
    for (const field of ["p", "P", "e", "E", "db", "DB", "d", "D"]) {
      const value = payload.state[field];
      if (
        (field === "p" || field === "P") &&
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 255
      ) {
        state[field] = value & 0x30;
      } else if (value !== undefined) {
        state[field] = value;
      }
    }
    return JSON.stringify([payload.bytes, state]);
  });
  const selected =
    source
      .prepare(`SELECT p.id,p.value,c.imported_at,c.source_name,c.profile,c.observed_events FROM runtime_prefixes p
    JOIN capture_catalog c ON p.value='runtime:instruction-trace:'||c.sha256||':code:'
    ORDER BY c.imported_at DESC,p.id DESC LIMIT 1`)
      .get() ??
    source
      .prepare(`SELECT id,value FROM runtime_prefixes
      WHERE value GLOB 'runtime:instruction-trace:*:code:' ORDER BY id DESC LIMIT 1`)
      .get();
  if (!selected) {
    throw new Error("No native capture prefix to benchmark.");
  }
  summary.exec(`PRAGMA journal_mode=DELETE; PRAGMA cache_size=-8192;
    CREATE TABLE variants(id INTEGER PRIMARY KEY,address INTEGER NOT NULL,key TEXT NOT NULL,UNIQUE(address,key));
    CREATE TABLE sources(variant INTEGER NOT NULL,evidence INTEGER NOT NULL,total INTEGER NOT NULL,
      observations INTEGER NOT NULL,sample INTEGER NOT NULL,PRIMARY KEY(variant,evidence)) WITHOUT ROWID;`);
  const find = summary.prepare("SELECT id FROM variants WHERE address=? AND key=?");
  const addVariant = summary.prepare("INSERT INTO variants(address,key) VALUES(?,?)");
  const addSource =
    summary.prepare(`INSERT INTO sources VALUES(?,?,?,?,?) ON CONFLICT(variant,evidence)
    DO UPDATE SET total=total+excluded.total,observations=observations+excluded.observations,
      sample=MIN(sample,excluded.sample)`);
  const readSource = summary.prepare("SELECT * FROM sources WHERE variant=? AND evidence=?");
  const grouped = `SELECT f.address,summary_key(CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END) AS key,
    o.evidence_id AS evidence,SUM(o.count) AS total,COUNT(*) AS observations,MIN(o.oid) AS sample
    FROM runtime_facts f JOIN runtime_observations o ON o.fact_id=f.fid
    WHERE f.kind='runtime-instruction' AND f.architecture='snes.65816' AND f.address_space='snes.cpu'`;
  const groupBy = " GROUP BY f.address,o.evidence_id,key";
  const timings: Record<string, number> = {};
  let baselineGroups = 0;
  let deltaGroups = 0;
  let deltaObservations = 0;
  for (const [phase, predicate] of [
    ["baseline", "o.prefix_id<>?"],
    ["captureDelta", "o.prefix_id=?"],
  ]) {
    console.log(`Building ${phase} summary.`);
    const started = performance.now();
    summary.exec("BEGIN");
    for (const raw of source
      .prepare(`${grouped} AND ${predicate}${groupBy}`)
      .iterate(selected.id)) {
      const row = raw as unknown as Group;
      const found = find.get(row.address, row.key);
      const variant = found?.id ?? addVariant.run(row.address, row.key).lastInsertRowid;
      addSource.run(variant, row.evidence, row.total, row.observations, row.sample);
      if (phase === "baseline") {
        baselineGroups++;
      } else {
        deltaGroups++;
        deltaObservations += row.observations;
      }
    }
    summary.exec("COMMIT");
    timings[phase] = performance.now() - started;
    console.log(JSON.stringify({ phase, ms: timings[phase] }));
  }
  // Independently regroup the complete retained history. Verify exact counts and representative
  // selection, rather than assuming that matching grand totals proves correct attribution.
  console.log("Checking incremental result against a complete regroup.");
  let groups = 0;
  const verifyStarted = performance.now();
  for (const raw of source.prepare(grouped + groupBy).iterate()) {
    const row = raw as unknown as Group;
    const variant = find.get(row.address, row.key)?.id;
    const stored = variant === undefined ? undefined : readSource.get(variant, row.evidence);
    if (
      !stored ||
      stored.total !== row.total ||
      stored.observations !== row.observations ||
      stored.sample !== row.sample
    ) {
      throw new Error(`Incremental summary differs at ${row.address}/${row.evidence}.`);
    }
    groups++;
  }
  timings.completeRegroupAndCompare = performance.now() - verifyStarted;
  if (summary.prepare("SELECT COUNT(*) AS n FROM sources").get()!.n !== groups) {
    throw new Error("Incremental summary contains extra groups.");
  }
  const scanStarted = performance.now();
  let events = 0;
  for (const row of summary
    .prepare("SELECT v.address,v.key,s.* FROM sources s JOIN variants v ON v.id=s.variant")
    .iterate()) {
    events += Number(row.total);
  }
  timings.summaryScan = performance.now() - scanStarted;
  const report = {
    sourceFile,
    sourceRevision: source.prepare("SELECT v FROM meta WHERE k='revision'").get()!.v,
    selectedCapture: selected.value,
    selectedCaptureName: selected.source_name,
    selectedCaptureProfile: selected.profile,
    selectedCaptureEvents: selected.observed_events,
    baselineGroups,
    deltaGroups,
    deltaObservations,
    decoderVariants: summary.prepare("SELECT COUNT(*) AS n FROM variants").get()!.n,
    sourceGroups: groups,
    detailedInstructionEvents: events,
    summaryBytes: fs.statSync(summaryFile).size,
    timings,
    verified:
      "Every key, evidence group, count, observation count and minimum representative matches a complete regroup.",
    limitation:
      "Prototype excludes raw-write hooks, deletion repair, concurrency, cache eviction and full API hydration; no production summary is installed.",
  };
  if (reportFile) {
    fs.writeFileSync(reportFile, `${JSON.stringify(report, undefined, 2)}\n`);
  }
  console.log(JSON.stringify(report, undefined, 2));
} finally {
  summary.close();
  source.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
