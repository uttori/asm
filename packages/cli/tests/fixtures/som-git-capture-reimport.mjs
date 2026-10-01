/**
 * Reimport each available archive through the production source service in the independent clone.
 * Persist each completed receipt immediately: a later failure must not erase earlier evidence.
 * Canonical capture identities differ from archive byte hashes; compare importer receipts to the
 * retained catalog, never infer identity from a matching filename.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeSourceOperation } from "@uttori/asm-cli/source";
import {
  openAnalysisProjectStore,
  sourceContentHash,
  fingerprintSourceCapture,
  readSourceCaptureCatalog,
  reconcileSourceCaptureCatalog,
  writeSourceCaptureCatalog,
} from "@uttori/asm-disassembler";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const root = path.join(application, "experiments/secret-of-mana-git-workflow-full");
assert.ok(fs.existsSync(path.join(root, ".verification/seed.json")));
const captureDirectory = path.join(root, "disassembly/captures");
const evidence = path.join(root, "disassembly/analysis");
const reportFile = path.join(root, ".verification/capture-reimport.json");
const report = fs.existsSync(reportFile)
  ? JSON.parse(fs.readFileSync(reportFile, "utf8"))
  : { started: new Date().toISOString(), captures: [] };

/** Large execution summaries are compared by content identity; keep reports compact and reviewable. */
function compactResult(result) {
  if (!Array.isArray(result.execution)) {
    return result;
  }
  const { execution, ...rest } = result;
  return {
    ...rest,
    execution: { count: execution.length, sha256: sourceContentHash(JSON.stringify(execution)) },
  };
}

/** Read compact durable identities; runtime rows stay in SQLite throughout the rehearsal. */
function snapshot() {
  const store = openAnalysisProjectStore(evidence);
  try {
    return {
      manifest: store.manifest(),
      storage: store.storageSnapshot(),
      catalog: store.captureCatalog().map(({ last_seen_at: _lastSeen, ...identity }) => identity),
    };
  } finally {
    store.close();
  }
}

/** Atomic report replacement keeps a complete prior receipt even if this test process is killed. */
function save() {
  fs.writeFileSync(`${reportFile}.tmp`, JSON.stringify(report, null, 2) + "\n");
  fs.renameSync(`${reportFile}.tmp`, reportFile);
}

report.before ??= snapshot();
save();
const files = fs
  .readdirSync(captureDirectory)
  .filter((name) => name.endsWith(".act2"))
  .sort(
    (a, b) =>
      fs.statSync(path.join(captureDirectory, a)).size -
      fs.statSync(path.join(captureDirectory, b)).size,
  );
assert.equal(files.length, 9, "Review the available archive inventory if it changes.");
for (const name of files) {
  if (report.captures.some((capture) => capture.name === name && capture.success)) {
    continue;
  }
  const started = performance.now();
  const item = { name, started: new Date().toISOString() };
  report.captures.push(item);
  save();
  try {
    assert.ok(fs.statSync(path.join(captureDirectory, `${name}.context`)).isDirectory());
    const result = await executeSourceOperation({
      action: "import",
      directory: root,
      capture: path.join(captureDirectory, name),
      onProgress: (message) => console.log(`${name}: ${message}`),
    });
    item.result = compactResult(result);
    assert.ok(
      report.before.catalog.some((capture) => capture.sha256 === result.sourceSha256),
      "An available archive must resolve to an existing canonical capture identity.",
    );
    assert.equal(result.changed, false);
    assert.deepEqual(result.added, { runtime: 0, evidence: 0 });
    assert.equal(result.storage.newFacts, 0);
    item.success = true;
  } catch (error) {
    item.error = String(error);
    throw error;
  } finally {
    item.elapsedMs = performance.now() - started;
    item.memory = process.memoryUsage();
    save();
  }
}
report.after = snapshot();
assert.deepEqual(report.after.manifest, report.before.manifest);
assert.deepEqual(report.after.catalog, report.before.catalog);
for (const key of ["facts", "observations", "pairedStates"]) {
  assert.equal(report.after.storage[key], report.before.storage[key]);
}
report.success = true;
for (const item of report.captures) {
  item.result = compactResult(item.result);
}
if (process.argv.includes("--bind-catalog")) {
  const seed = JSON.parse(fs.readFileSync(path.join(root, ".verification/seed.json"), "utf8"));
  const snapshot = readSourceCaptureCatalog(
    root,
    ".uttori/captures.json",
    seed.romSha256 ?? report.after.manifest.rom.contentSha256,
  );
  let catalog = snapshot.catalog;
  const store = openAnalysisProjectStore(evidence);
  let imports;
  try {
    imports = store.loadTable("imports");
  } finally {
    store.close();
  }
  for (const item of report.captures) {
    assert.equal(item.success, true);
    const archive = await fingerprintSourceCapture(
      path.join(captureDirectory, item.name),
      undefined,
      8 * 1024 ** 3,
    );
    const seeded = seed.captures.find(
      (entry) => entry.path === `disassembly/captures/${item.name}`,
    );
    const companion = seed.captures.find(
      (entry) => entry.path === `disassembly/captures/${item.name}.context/manifest.json`,
    );
    assert.equal(archive.sha256, seeded.sha256);
    assert.equal(archive.bytes, seeded.bytes);
    assert.equal(archive.companionSha256, companion.sha256);
    catalog = reconcileSourceCaptureCatalog(catalog, imports, {
      sourceSha256: item.result.sourceSha256,
      archive,
    });
    console.log(`Bound verified archive: ${item.name}`);
  }
  writeSourceCaptureCatalog(root, ".uttori/captures.json", catalog, snapshot.fileSha256);
  report.portableCatalog = {
    identities: catalog.captures.length,
    boundArchives: catalog.captures.reduce((count, capture) => count + capture.archives.length, 0),
    retainedEvidenceRequired: catalog.captures.filter((capture) => capture.archives.length === 0)
      .length,
  };
}
save();
console.log(
  JSON.stringify({
    success: true,
    archives: files.length,
    identities: report.after.catalog.length,
  }),
);
