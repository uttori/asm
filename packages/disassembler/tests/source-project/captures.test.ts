import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import type { ImportReport } from "../../src/model/project-types.js";
import {
  fingerprintSourceCapture,
  parseSourceCaptureCatalog,
  readSourceCaptureCatalog,
  reconcileSourceCaptureCatalog,
  writeSourceCaptureCatalog,
  type SourceCaptureCatalog,
} from "../../src/source-project/captures.js";

const romSha256 = "a".repeat(64);
const initial: SourceCaptureCatalog = {
  format: "uttori-capture-catalog",
  version: 1,
  romSha256,
  captures: [],
};
const report: ImportReport = {
  id: "capture-import",
  format: "uttori-asm-instruction-trace",
  sourceName: "/private/captures/chest.act2",
  sourceSha256: "b".repeat(64),
  indexProfile: "historical-profile",
  imported: { executionEvents: 42 },
  unsupported: [{ field: "instruction-addresses", count: 3, reason: "Not indexed" }],
  warnings: [],
};

test("archive fingerprints allow inputs beyond 2 GiB by default and explain explicit project limits", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-catalog-budget-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "large.act2");
  fs.writeFileSync(file, "sparse archive");
  // A sparse file exercises the real size check without allocating or hashing gigabytes.
  fs.truncateSync(file, 3 * 1024 ** 3);
  const canceled = new AbortController();
  const hashing = fingerprintSourceCapture(file, canceled.signal);
  canceled.abort();
  await t.throwsAsync(hashing, { name: "AbortError" });
  await t.throwsAsync(fingerprintSourceCapture(file, undefined, 2 * 1024 ** 3), {
    message: /3\.00 GiB.*byte budget of 2\.00 GiB.*limits\.captureBytes in \.uttori\/project\.json/,
  });
  fs.truncateSync(file, 33 * 1024 ** 3);
  await t.throwsAsync(fingerprintSourceCapture(file), {
    message: /33\.00 GiB.*byte budget of 32\.00 GiB/,
  });
});

test("catalog keeps unavailable evidence identities and binds byte hashes only after a verified import", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-catalog-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "chest.act2");
  fs.writeFileSync(file, "verified archive fixture");
  fs.mkdirSync(`${file}.context`);
  fs.writeFileSync(`${file}.context/manifest.json`, "{}");
  const archive = await fingerprintSourceCapture(file);
  t.not(archive.sha256, report.sourceSha256);
  const extracted = reconcileSourceCaptureCatalog(initial, [report]);
  t.deepEqual(extracted.captures[0], {
    sha256: report.sourceSha256,
    sourceName: "chest.act2",
    profile: "historical-profile",
    observedEvents: 42,
    droppedEvents: 3,
    archives: [],
  });
  const bound = reconcileSourceCaptureCatalog(extracted, [report], {
    sourceSha256: report.sourceSha256,
    archive,
  });
  t.deepEqual(bound.captures[0]!.archives, [archive]);
  t.deepEqual(
    reconcileSourceCaptureCatalog(bound, [report], { sourceSha256: report.sourceSha256, archive }),
    bound,
  );
  t.throws(
    () =>
      reconcileSourceCaptureCatalog(initial, [], { sourceSha256: report.sourceSha256, archive }),
    { message: /successful evidence import/ },
  );
  t.throws(() => reconcileSourceCaptureCatalog(bound, [{ ...report, indexProfile: "full" }]), {
    message: /provenance differs/,
  });
  writeSourceCaptureCatalog(root, ".uttori/captures.json", bound);
  const saved = readSourceCaptureCatalog(root, ".uttori/captures.json", romSha256);
  t.deepEqual(saved.catalog, bound);
  t.throws(() => writeSourceCaptureCatalog(root, ".uttori/captures.json", bound), {
    message: /changed during import/,
  });
  writeSourceCaptureCatalog(root, ".uttori/captures.json", bound, saved.fileSha256);
  t.is(
    readSourceCaptureCatalog(root, ".uttori/captures.json", romSha256).fileSha256,
    saved.fileSha256,
  );
  const canceled = new AbortController();
  canceled.abort();
  await t.throwsAsync(fingerprintSourceCapture(file, canceled.signal));
});

test("catalog rejects duplicate or conflicting archive identities, unsafe paths and symlink ancestors", (t) => {
  const capture = reconcileSourceCaptureCatalog(initial, [report]).captures[0]!;
  t.throws(
    () => parseSourceCaptureCatalog({ ...initial, captures: [capture, capture] }, romSha256),
    { message: /duplicate canonical/ },
  );
  t.throws(
    () =>
      parseSourceCaptureCatalog(
        { ...initial, captures: [{ ...capture, sourceName: "../private" }] },
        romSha256,
      ),
    { message: /canonical capture/ },
  );
  t.throws(() => parseSourceCaptureCatalog(initial, "c".repeat(64)), { message: /original-ROM/ });
  const archive = { name: "test.act2", sha256: "d".repeat(64), bytes: 3 };
  t.throws(
    () =>
      parseSourceCaptureCatalog(
        {
          ...initial,
          captures: [
            { ...capture, archives: [archive] },
            { ...capture, sha256: "e".repeat(64), archives: [archive] },
          ],
        },
        romSha256,
      ),
    { message: /conflicting canonical/ },
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-catalog-symlink-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "outside"));
  fs.mkdirSync(path.join(root, "project"));
  fs.symlinkSync(path.join(root, "outside"), path.join(root, "project/.uttori"), "dir");
  t.throws(
    () => writeSourceCaptureCatalog(path.join(root, "project"), ".uttori/captures.json", initial),
    { message: /symlinks/ },
  );
  t.deepEqual(fs.readdirSync(path.join(root, "outside")), []);
});
