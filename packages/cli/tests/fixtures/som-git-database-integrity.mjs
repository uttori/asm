/** Verify the compact evidence store after all research/query projections have been rebuilt. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const directory = path.join(
  application,
  "experiments/secret-of-mana-git-workflow-full/.verification/rebuild-evidence",
);
const reportFile = path.join(directory, "integrity-after-rebuild.json");
assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "rebuild.json"))).success, true);
assert.equal(fs.existsSync(reportFile), false, "Preserve prior verification before rerunning.");
const databaseFile = path.join(directory, "analysis.sqlite");
const db = new DatabaseSync(databaseFile, { readOnly: true });
const report = { started: new Date().toISOString(), bytes: fs.statSync(databaseFile).size };
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
const start = performance.now();
try {
  db.exec("PRAGMA query_only=ON");
  report.integrity = db.prepare("PRAGMA integrity_check").all();
  report.foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
  report.pages = db.prepare("PRAGMA page_count").get().page_count;
  report.freePages = db.prepare("PRAGMA freelist_count").get().freelist_count;
  report.pageSize = db.prepare("PRAGMA page_size").get().page_size;
  report.objects = db
    .prepare(
      "SELECT name, count(*) AS pages, sum(pgsize) AS bytes FROM dbstat GROUP BY name ORDER BY bytes DESC",
    )
    .all();
  assert.deepEqual(
    report.integrity.map((row) => row.integrity_check),
    ["ok"],
  );
  assert.deepEqual(report.foreignKeys, []);
  report.success = true;
} finally {
  db.close();
  report.elapsedMs = performance.now() - start;
  report.finished = new Date().toISOString();
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
