import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  openAnalysisProjectStore,
  loadAnalysisProjectSnapshot,
  sourceExportSha256,
  type MetadataEditRequest,
} from "@uttori/asm-disassembler";
import { exportSnesProject, verifySnesProjectRoundTrip } from "@uttori/asm-plugin-snes";

import { test } from "../../../../tests/ava-helper.js";
import { ownershipFixture } from "../../../../tests/helpers/ownership-fixture.js";
import {
  processMetadata,
  type MetadataWorkerInput,
  type MetadataPage,
} from "../../src/disassembly/metadata-data.js";

/** Open a fresh worker connection for every call to exercise persisted identities and receipts. */
const worker = (fixture: ReturnType<typeof ownershipFixture>, input: MetadataWorkerInput): any => {
  const store = openAnalysisProjectStore(fixture.projectDirectory);
  try {
    return processMetadata(store, fixture.projectDirectory, {
      operationId: input.action.startsWith("map-") ? randomUUID() : undefined,
      ...input,
      sourceDirectory: fixture.sourceDirectory,
    });
  } finally {
    store.close();
  }
};
const request = (
  id: string,
  operations: MetadataEditRequest["operations"],
): MetadataEditRequest => ({
  id: `edit:${id}`,
  evidenceId: `evidence:${id}`,
  sourceId: "test",
  description: id,
  operations,
});

test("metadata worker previews without writing, commits twice, retains evidence and guards stale source/revisions", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const page = worker(f, { action: "list" }) as MetadataPage;
  t.is(page.records[0].id, "imported.candy");
  const intent: MetadataWorkerInput = {
    action: "preview",
    revision: page.revision,
    source: { file: f.file, sha256: sourceExportSha256(f.text) },
    request: request("remove", [{ kind: "remove-label", id: "imported.candy" }]),
  };
  const preview = worker(f, intent);
  t.true(preview.receipt.changes[0].after.suppressed);
  t.deepEqual(loadAnalysisProjectSnapshot(f.projectDirectory).revision, page.revision);
  const saved = worker(f, { ...intent, action: "commit" });
  t.is(saved.status, "Metadata saved; regeneration pending.");
  t.deepEqual(worker(f, { ...intent, action: "commit" }), saved);
  const second = worker(f, {
    action: "commit",
    revision: saved.revision,
    request: request("comment", [
      {
        kind: "put",
        shard: "comments",
        record: {
          id: "new:comment",
          addressSpace: "rom.file",
          address: 0x22,
          text: "A data comment with no label or instruction",
          evidence: [],
        },
      },
    ]),
  });
  t.not(second.revision.manifestSha256, saved.revision.manifestSha256);
  const history = worker(f, { action: "list" }) as MetadataPage;
  t.is(history.history.length, 2);
  t.true(
    loadAnalysisProjectSnapshot(f.projectDirectory).shards.evidence.some(
      ({ id }) => id === "guide",
    ),
  );
  fs.appendFileSync(f.file, "; external edit\n");
  t.throws(
    () =>
      worker(f, {
        ...intent,
        revision: second.revision,
        request: request("stale-source", [{ kind: "reset-label", id: "imported.candy" }]),
      }),
    { message: /Source changed/ },
  );
});

test("namespace validation covers constants, layouts, hardware and user-owned references", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const original = f.snapshot.shards.labels[0];
  for (const name of ["FixtureLimit", "PriceLayout", "Prices", "SNES_INIDISP"]) {
    t.throws(
      () =>
        worker(f, {
          action: "preview",
          revision: f.snapshot.revision,
          request: request("rename", [
            { kind: "put", shard: "labels", record: { ...original, sourceName: name } },
          ]),
        }),
      { message: /conflict|reserved|already/ },
    );
  }
  fs.writeFileSync(path.join(f.sourceDirectory, "custom.asm"), "dw L_Item_Price_Candy\n");
  t.throws(
    () =>
      worker(f, {
        action: "preview",
        revision: f.snapshot.revision,
        request: request("rename", [{ kind: "remove-label", id: original.id }]),
      }),
    { message: /user-owned references.*\n.*custom.asm/ },
  );
  t.falsy(loadAnalysisProjectSnapshot(f.projectDirectory).shards.labels[0].suppressed);
});

test("map edits validate full dependencies, reject stale files, and restore exact bytes after reopening", async (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const input = worker(f, {
    action: "map-read",
    map: { name: "struct-map.json", text: "", beforeSha256: "" },
  });
  const value = JSON.parse(input.text);
  value.structures[0].fields[0].description = "Corrected field description";
  const intent: MetadataWorkerInput = {
    action: "map-preview",
    revision: f.snapshot.revision,
    map: {
      name: input.name,
      beforeSha256: input.sha256,
      text: JSON.stringify(value, null, 2) + "\n",
    },
  };
  const preview = worker(f, intent);
  t.is(preview.receipt.before, input.text);
  t.is(fs.readFileSync(path.join(f.sourceDirectory, input.name), "utf8"), input.text);
  const saved = worker(f, { ...intent, action: "map-commit" });
  t.is(worker(f, { action: "map-history" })[0].status, "applied");
  t.throws(() => worker(f, { ...intent, action: "map-commit" }), { message: /map changed/ });
  t.is(
    worker(f, { action: "map-restore-preview", receiptId: saved.receiptId }).receipt.after,
    input.text,
  );
  worker(f, { action: "map-restore", receiptId: saved.receiptId });
  t.is(fs.readFileSync(path.join(f.sourceDirectory, input.name), "utf8"), input.text);
  t.throws(() => worker(f, { action: "map-restore", receiptId: saved.receiptId }), {
    message: /map changed/,
  });
  const broken = JSON.parse(input.text);
  broken.structures = [];
  t.throws(() => worker(f, { ...intent, map: { ...intent.map!, text: JSON.stringify(broken) } }), {
    message: /unknown|Unknown|structure/,
  });
  exportSnesProject({
    projectDirectory: f.projectDirectory,
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
  });
  t.true(
    (await verifySnesProjectRoundTrip({ sourceDirectory: f.sourceDirectory, romFile: f.romFile }))
      .comparison.equal,
  );
});

test("new optional maps can be undone and removed field references block publication", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const file = path.join(f.sourceDirectory, "ram-map.json");
  fs.rmSync(file, { force: true });
  const fresh = worker(f, {
    action: "map-read",
    map: { name: "ram-map.json", beforeSha256: "", text: "" },
  });
  t.is(fresh.sha256, "missing");
  t.false(fs.existsSync(file));
  const saved = worker(f, {
    action: "map-commit",
    map: { name: "ram-map.json", beforeSha256: "missing", text: fresh.text },
  });
  t.true(fs.existsSync(file));
  worker(f, { action: "map-restore", receiptId: saved.receiptId });
  t.false(fs.existsSync(file));
  const input = worker(f, {
    action: "map-read",
    map: { name: "struct-map.json", text: "", beforeSha256: "" },
  });
  const changed = JSON.parse(input.text);
  changed.structures[0].fields[0].name = "cost";
  fs.writeFileSync(path.join(f.sourceDirectory, "custom.asm"), "dw PriceLayout.value\n");
  t.throws(
    () =>
      worker(f, {
        action: "map-preview",
        map: { name: "struct-map.json", beforeSha256: input.sha256, text: JSON.stringify(changed) },
      }),
    { message: /user-owned references/ },
  );
});

test("an invalid externally edited map can be repaired against the verified generated namespace", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const file = path.join(f.sourceDirectory, "struct-map.json");
  const valid = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, "{ unfinished input");
  const input = worker(f, {
    action: "map-read",
    map: { name: "struct-map.json", text: "", beforeSha256: "" },
  });
  const draft = { name: "struct-map.json" as const, beforeSha256: input.sha256, text: valid };
  const preview = worker(f, { action: "map-preview", map: draft });
  t.regex(preview.warning, /saved input is invalid/);
  t.is(fs.readFileSync(file, "utf8"), "{ unfinished input");
  worker(f, { action: "map-commit", map: draft });
  t.is(fs.readFileSync(file, "utf8"), valid);
});
