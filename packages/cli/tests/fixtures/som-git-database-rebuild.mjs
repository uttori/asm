/** Full-clone acceptance: rebuild disposable SQLite projections while guarding retained evidence. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { readResearchInputs } from "../../../disassembler/src/research-inputs/inputs.ts";
import { registerRuntimeHistory } from "../../../disassembler/src/storage/sqlite-runtime-history.ts";
import { SqliteAnalysisStore } from "../../../disassembler/src/storage/sqlite-store.ts";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const clone = path.join(application, "experiments/secret-of-mana-git-workflow-full");
const directory = path.join(clone, ".verification/rebuild-evidence");
const databaseFile = path.join(directory, "analysis.sqlite");
const reportFile = path.join(directory, "rebuild.json");
assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "snapshot.json"))).complete, true);
const integrity = JSON.parse(fs.readFileSync(path.join(directory, "integrity.json")));
assert.deepEqual(integrity.integrity, [{ integrity_check: "ok" }]);
assert.deepEqual(integrity.foreignKeys, []);
const resume = process.argv[2] === "resume";
let report;
if (resume) {
  report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  assert.ok(report.before);
  assert.equal(report.success, undefined);
  assert.ok(
    ["remove disposable query projections", "after: all decoder-state variants"].includes(
      report.phases.at(-1).name,
    ),
  );
  assert.equal(report.phases.at(-1).elapsedMs, undefined);
  fs.copyFileSync(reportFile, reportFile + `.resume-${Date.now()}`);
} else {
  assert.equal(
    fs.existsSync(reportFile),
    false,
    "Keep the previous report; explicitly review before rerunning.",
  );
  report = { started: new Date().toISOString(), phases: [] };
}

/** Save progress before expensive synchronous queries so interrupted runs remain diagnosable. */
function phase(name, action) {
  const entry = { name, started: new Date().toISOString() };
  report.phases.push(entry);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
  console.log(name);
  const start = performance.now();
  const result = action();
  entry.elapsedMs = performance.now() - start;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
  return result;
}

/** Hash ordered semantic records incrementally; large query results need no second retained array. */
function fingerprint(records) {
  const hash = createHash("sha256");
  let count = 0;
  for (const record of records) {
    hash.update(canonicalJson(record));
    hash.update("\n");
    count++;
  }
  return { count, sha256: hash.digest("hex") };
}

const db = new DatabaseSync(databaseFile);
registerRuntimeHistory(db);
const store = new SqliteAnalysisStore(databaseFile, false);
const resumeAfterPreparation =
  resume && report.phases.at(-1).name === "after: all decoder-state variants";
const cachedSignature = db
  .prepare("SELECT signature FROM query_cache WHERE name='instruction_variants'")
  .get()?.signature;
const signature = cachedSignature ? JSON.parse(cachedSignature) : report.decoder;
assert.ok(Array.isArray(signature));
report.decoder = signature;
const [, architecture, space, fields, masks] = signature;
const guards = [];
try {
  // Any accidental edit to irreplaceable history aborts, including writes through compatibility views.
  // Runtime query columns are intentionally excluded: those are the disposable projections under test.
  for (const table of [
    "runtime_prefixes",
    "runtime_evidence",
    "runtime_history",
    "runtime_descriptors",
    "runtime_fact_rows",
    "runtime_identities",
    "runtime_observations",
    "capture_catalog",
  ]) {
    const columns = db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((column) => column.name)
      .filter((name) => !name.startsWith("query_"));
    for (const action of ["INSERT", "DELETE", `UPDATE OF ${columns.join(",")}`]) {
      const name = `acceptance_guard_${guards.length}`;
      db.exec(
        `CREATE TRIGGER IF NOT EXISTS ${name} BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'Acceptance must preserve retained evidence'); END`,
      );
      guards.push(name);
    }
  }
  const snapshot = readResearchInputs(clone, [".uttori/research"], {
    project: "secret-of-mana",
    romSha256: store.manifest().rom.contentSha256,
  });
  if (resume) {
    assert.equal(report.research.hash, snapshot.hash);
    assert.equal(store.researchInputsAreCurrent(snapshot.hash), true);
  } else {
    report.research = { hash: snapshot.hash, decisions: snapshot.decisions.length };
    report.beforeRevision = store.revision();
  }

  /** Capture every authored record and catalog identity, plus complete compact and bounded UI queries. */
  function capture(label) {
    const result = {};
    phase(`${label}: prepare source and annotation indexes`, () => {
      store.prepareAnnotationQueries();
      store.prepareSourceQueries();
    });
    result.metadata = phase(`${label}: semantic metadata`, () =>
      Object.fromEntries(
        ["labels", "comments", "regions", "annotations", "evidence", "imports"].map((name) => [
          name,
          fingerprint(store.loadTable(name)),
        ]),
      ),
    );
    result.analysisDecisions = fingerprint(
      store.analysisByKinds(["target-override", "target-set"]),
    );
    result.catalog = fingerprint(store.captureCatalog());
    const sources = store.sourceCatalog().sources;
    result.sources = fingerprint(sources);
    result.analysisCounts = store.analysisCounts();
    result.variants = phase(`${label}: all decoder-state variants`, () =>
      fingerprint(
        store.runtimeInstructionVariants(architecture, space, fields, masks, (count) => {
          if (count % 262144 === 0) {
            console.log(`Grouped ${count} runtime observations`);
          }
        }),
      ),
    );
    result.seeds = phase(`${label}: all execution seeds`, () =>
      fingerprint(store.runtimeExecutionSeeds(architecture, space)),
    );
    result.graph = phase(`${label}: complete call graph`, () => fingerprint([store.callGraph()]));
    const addresses = [0xc0389c, 0xc22614, 0xc8e13e, 0xc8e2b5];
    result.navigation = addresses.map((address) =>
      fingerprint(store.navigationNodes(space, address, [architecture])),
    );
    result.annotations = addresses.map((address) =>
      store.transaction(() => {
        const ranges = [
          {
            architecture,
            addressSpace: space,
            start: address,
            end: address + 8,
            outputStart: address - 0xc00000,
            outputEnd: address - 0xc00000 + 8,
          },
        ];
        const view = store.instructionAnnotationView(ranges);
        return fingerprint([
          { ...view, executionCounts: [...view.executionCounts] },
          store.instructionExecutionSummary(ranges),
        ]);
      }, false),
    );
    result.contributions = phase(`${label}: every source's metadata page`, () =>
      sources.map((source) => ({
        id: source.id,
        page: fingerprint(store.sourcePage(source.id, "contributions")),
      })),
    );
    // Exercise both retained JSON-era history and available ACT2 provenance without materializing traces.
    const selected = [
      sources.find((source) => source.name.includes("chest") && source.name.endsWith(".act2")),
      sources.find((source) => source.name === "square-logo.json"),
    ].filter(Boolean);
    assert.equal(selected.length, 2);
    result.sourceDetails = phase(`${label}: source observation queries`, () =>
      selected.map((source) => ({
        id: source.id,
        summary: store.sourceSummary(source.id).summary,
        instructions: fingerprint(store.sourcePage(source.id, "instructions")),
        memory: fingerprint(store.sourcePage(source.id, "memory")),
      })),
    );
    return result;
  }

  if (!resume) {
    report.before = capture("before");
    phase("rebuild research projection from Git", () => {
      // Invalidate only its cache receipt. The production rebuild restores observation shadows before
      // reapplying every decision; deleting shadow rows directly would lose original imported names.
      db.prepare("DELETE FROM meta WHERE k='research-index-revision'").run();
      assert.equal(
        store.transaction(() => store.synchronizeResearchInputs(snapshot)),
        true,
      );
      assert.equal(store.researchInputsAreCurrent(snapshot.hash), true);
      store.assertCurrentAnalysis();
    });
  }
  if (!resumeAfterPreparation) {
    phase("remove disposable query projections", () => {
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const row of db
          .prepare(
            "SELECT name FROM sqlite_schema WHERE type='trigger' AND name GLOB 'query_source_*'",
          )
          .all()) {
          db.exec(`DROP TRIGGER ${row.name}`);
        }
        db.exec(`DROP TABLE query_source_links; DROP TABLE query_source_rows;
        DELETE FROM query_cache;
        DELETE FROM query_runtime_variant_sources; DELETE FROM query_runtime_variant_keys; DELETE FROM query_runtime_variant_pending;
        DELETE FROM meta WHERE k='annotation-query-layout';
        UPDATE analysis SET query_file_offset=NULL,query_size=NULL,query_data=NULL,query_ready=0 WHERE kind='cfg-node';
        UPDATE runtime_observations SET query_file_offset=NULL,query_size=NULL,query_data=NULL,query_ready=0
          WHERE fact_id IN (SELECT fid FROM runtime_facts WHERE kind='runtime-execution');`);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    });
  }
  report.after = capture("after");
  assert.deepEqual(report.after, report.before);
  report.afterRevision = store.revision();
  store.writePointer(directory);
  report.success = true;
} finally {
  for (const name of guards) {
    db.exec(`DROP TRIGGER ${name}`);
  }
  store.close();
  db.close();
  report.finished = new Date().toISOString();
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
}
