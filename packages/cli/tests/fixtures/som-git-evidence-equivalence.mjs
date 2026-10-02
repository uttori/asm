/** Compare every retained runtime/catalog row in the compact clone against its source database. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const root = path.join(application, "experiments/secret-of-mana-git-workflow-full");
const directory = path.join(root, ".verification/rebuild-evidence");
const output = path.join(directory, "retained-evidence.json");
assert.equal(
  fs.existsSync(output),
  false,
  "Preserve earlier comparison evidence before rerunning.",
);
const db = new DatabaseSync(path.join(directory, "analysis.sqlite"), { readOnly: true });
db.exec("PRAGMA query_only=ON");
db.prepare("ATTACH DATABASE ? AS original").run(
  path.join(root, "disassembly/analysis/analysis.sqlite"),
);
const quote = (name) => `"${name}"`;

const report = {
  started: new Date().toISOString(),
  method:
    "Exact SQL comparison of every retained runtime/catalog row and stored payload, excluding disposable query columns.",
  tables: [],
};
try {
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
    const start = performance.now();
    const columns = db.prepare(`PRAGMA main.table_info(${table})`).all();
    const key = columns.filter((column) => column.pk).map((column) => column.name);
    assert.equal(key.length, 1);
    const names = columns.map((column) => column.name).filter((name) => !name.startsWith("query_"));
    for (const name of names) {
      assert.match(name, /^[_a-z]+$/);
    }
    const primary = quote(key[0]);
    const rows = db.prepare(`SELECT count(*) n FROM main.${table}`).get().n;
    assert.equal(rows, db.prepare(`SELECT count(*) n FROM original.${table}`).get().n, table);
    // Equal counts plus a unique-key join and null-safe value comparisons prove complete equality,
    // including compressed blobs, without hydrating tens of millions of rows into JavaScript.
    const mismatch = db
      .prepare(`SELECT n.${primary} FROM main.${table} n
      LEFT JOIN original.${table} o ON o.${primary}=n.${primary}
      WHERE o.${primary} IS NULL OR ${names.map((name) => `n.${quote(name)} IS NOT o.${quote(name)}`).join(" OR ")} LIMIT 1`)
      .get();
    assert.equal(mismatch, undefined, table);
    const result = { table, rows, columns: names, elapsedMs: performance.now() - start };
    report.tables.push(result);
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ table, rows, elapsedMs: result.elapsedMs }));
  }
  report.success = true;
} finally {
  db.close();
  report.finished = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
}
