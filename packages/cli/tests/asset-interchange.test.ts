import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { decodeAsepriteDocument, encodeAsepriteDocument } from "@uttori/asm-assets/aseprite";
import {
  interchangeIdentity,
  type TilemapInterchangeBaseline,
} from "@uttori/asm-assets/interchange";
import { AddressToLineMapping } from "@uttori/asm-core";
import type { SourceRepository } from "@uttori/asm-disassembler/source-project";
import {
  executeAssetOperation,
  registerAssetAdapter,
  readAssetExportManifest,
} from "@uttori/asm-workflows/asset-interchange";

import { test } from "../../../tests/ava-helper.js";
import {
  AssetInterchangeService,
  type AssetSourceAdapter,
  type AssetSourceDraft,
  type AssetSourceHost,
} from "../../workflows/src/asset-interchange/index.js";

const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

/** A second game deliberately uses 3x5 tiles and native transparency 2, unrelated to SNES 4bpp encoding. */
function presentation(data: Uint8Array, exportId: string): TilemapInterchangeBaseline {
  const owners = [0, 1].map((index) => ({
    id: `native-${index}`,
    width: 3,
    height: 5,
    indexes: data.slice(index * 15, index * 15 + 15),
    allowedIndexes: [0, 1, 2],
  }));
  const views = owners.map((owner) => ({
    ...owner,
    id: `view-${owner.id}`,
    owner: owner.id,
    indexMap: [0, 1, 2],
  }));
  const strip = new Uint8Array(45).fill(2);
  views.forEach((view, index) => strip.set(view.indexes, (index + 1) * 15));
  return {
    kind: "tilemap",
    ownership: { owners, views },
    editablePaletteSlots: [],
    nativeTransforms: ["flipX", "flipY"],
    capabilities: {
      pixelEdits: true,
      paletteEdits: false,
      tileReferences: true,
      previewTimeline: false,
    },
    document: {
      width: 3,
      height: 5,
      palette: [
        [8, 8, 8, 255],
        [8, 8, 8, 255],
        [0, 0, 0, 0],
      ],
      transparentIndex: 2,
      exportId,
      tilesets: [
        {
          id: 10,
          flags: 6,
          name: "native inventory",
          baseIndex: 1,
          tileWidth: 3,
          tileHeight: 5,
          tileCount: 3,
          indexes: strip,
          userData: interchangeIdentity.tileset("owners"),
          tileData: [undefined, ...views.map((view) => interchangeIdentity.view(view.id))],
        },
      ],
      layers: [
        {
          kind: "tilemap",
          flags: 3,
          name: "visible owner zero",
          tileset: 10,
          userData: interchangeIdentity.role("inventory"),
        },
      ],
      frames: [
        {
          durationMs: 100,
          cels: [
            {
              kind: "tilemap",
              layer: 0,
              x: 0,
              y: 0,
              zIndex: 0,
              columns: 1,
              rows: 1,
              bits: 32,
              idMask: 0x1fffffff,
              flipXMask: 0x80000000,
              flipYMask: 0x40000000,
              diagonalMask: 0x20000000,
              cells: Uint32Array.of(1),
            },
          ],
        },
      ],
      tags: [],
    },
  };
}

/** Saved-file host fixture preserves unrelated output bytes and records the same snapshots as a normal inspection. */
function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "asset-service-"))),
    file = path.join(root, "native.bin");
  fs.writeFileSync(
    file,
    Uint8Array.from({ length: 30 }, (_, i) => (i < 15 ? i % 3 : 2)),
  );
  fs.writeFileSync(path.join(root, "config.json"), "{}");
  fs.writeFileSync(path.join(root, "unrelated.md"), "independent source history");
  for (const name of ["evidence.json", "plan-proof.json", "verify-proof.json"]) {
    fs.writeFileSync(path.join(root, name), "{}");
  }
  const repository: SourceRepository = {
    root,
    gitDirectory: path.join(root, ".git"),
    stateDirectory: path.join(root, ".git/state"),
  };
  let drafts: AssetSourceDraft[] = [],
    reloads = 0,
    plans = 0,
    forbiddenEffect = false;
  const host: AssetSourceHost = {
    async open() {
      return { repository, project: "second-game" };
    },
    async inspect(_directory, overlays) {
      const data = overlays?.get("native.bin") ?? Uint8Array.from(fs.readFileSync(file));
      const config = Uint8Array.from(fs.readFileSync(path.join(root, "config.json")));
      const output = Uint8Array.of(0xaa, 0xbb, ...data, 0xcc, 0xdd);
      const mapping = new AddressToLineMapping();
      return {
        root,
        output,
        mapping,
        symbols: new Map(),
        diagnostics: [],
        snapshots: new Map([
          [file, data],
          [path.join(root, "config.json"), config],
        ]),
        configurationSha256: hash(config),
        toolchainSha256: hash("source-build-v1"),
      };
    },
    drafts: () => drafts,
    implementationIdentity: () => hash("installed-contract-v1"),
    async completed() {
      reloads++;
    },
  };
  const adapter: AssetSourceAdapter<{ file: string }, { resource: string }> = {
    id: "second-game.rectangular",
    version: 2,
    module: import.meta.filename,
    capabilities: {
      pixelEdits: true,
      paletteEdits: false,
      tileReferences: true,
      previewTimeline: false,
    },
    readSelection(value) {
      if (
        !value ||
        typeof value !== "object" ||
        !("file" in value) ||
        value.file !== "native.bin"
      ) {
        throw new Error("Invalid second-game selection.");
      }
      return { file: value.file };
    },
    readBindings(value) {
      if (
        !value ||
        typeof value !== "object" ||
        !("resource" in value) ||
        value.resource !== "native-grid"
      ) {
        throw new Error("Invalid second-game binding.");
      }
      return { resource: value.resource };
    },
    async export(context, selection, exportId) {
      context.read("evidence.json");
      return {
        asset: "rectangular-grid",
        baseline: presentation(context.read(selection.file), exportId),
        bindings: { resource: "native-grid" },
        dependencies: [selection.file, "config.json"],
      };
    },
    async plan(context, selection, bindings, changes) {
      plans++;
      context.read("plan-proof.json");
      const before = context.read(selection.file),
        after = before.slice();
      for (const change of changes.pixels) {
        const tile = change.owner === "native-0" ? 0 : 1;
        after.set(change.indexes, tile * 15);
      }
      if (!changes.pixels.length) {
        return { files: [], effects: [] };
      }
      return {
        files: [{ path: selection.file, before, after }],
        effects: [
          {
            resource: bindings.resource,
            offset: forbiddenEffect ? 0 : 2,
            before,
            after,
            consumers: ["selected-pose", "unused-fixed-inventory"],
          },
        ],
      };
    },
    async verify(context) {
      context.read("verify-proof.json");
    },
  };
  const service = new AssetInterchangeService(root, adapter, undefined, host),
    outputs = {
      document: path.join(root, "export.aseprite"),
      manifest: path.join(root, "export.json"),
    };
  return {
    root,
    file,
    service,
    adapter,
    host,
    outputs,
    repository,
    plans: () => plans,
    reloads: () => reloads,
    setDrafts(value: AssetSourceDraft[]) {
      drafts = value;
    },
    setForbiddenEffect() {
      forbiddenEffect = true;
    },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

async function paint(file: string): Promise<void> {
  const document = await decodeAsepriteDocument(fs.readFileSync(file));
  document.tilesets[0].indexes[15] = 1;
  fs.writeFileSync(file, await encodeAsepriteDocument(document));
}

test("the injected second game exports, reviews stably across restarts and applies the exact plan", async (t) => {
  const f = fixture();
  try {
    const manifest = await f.service.export({ file: "native.bin" }, f.outputs);
    await paint(f.outputs.document);
    const before = fs.readFileSync(f.file),
      review = await f.service.review(manifest, f.outputs.document);
    t.is(review.files.length, 1);
    t.is(review.effects[0].size, 30);
    t.deepEqual(fs.readFileSync(f.file), before);
    t.is((await f.service.review(manifest, f.outputs.document)).id, review.id);
    const plans = f.plans();
    const result = await f.service.apply(manifest, f.outputs.document, review.id);
    t.is(f.plans(), plans);
    t.truthy(result.transaction);
    t.is(f.reloads(), 1);
    t.is(fs.readFileSync(f.file)[0], 1);
    t.deepEqual(fs.readFileSync(f.file).subarray(15), before.subarray(15));
    await t.throwsAsync(() => f.service.apply(manifest, f.outputs.document, review.id), {
      message: /Stale/,
    });
  } finally {
    f.cleanup();
  }
});

test("no-edit round trips retain unused owners, exact native bytes and source modification times", async (t) => {
  const f = fixture();
  try {
    const before = fs.readFileSync(f.file),
      mtime = fs.statSync(f.file, { bigint: true }).mtimeNs;
    const manifest = await f.service.export({ file: "native.bin" }, f.outputs);
    const review = await f.service.review(manifest, f.outputs.document);
    t.deepEqual(review.files, []);
    t.is((await f.service.apply(manifest, f.outputs.document, review.id)).transaction, undefined);
    t.deepEqual(fs.readFileSync(f.file), before);
    t.is(fs.statSync(f.file, { bigint: true }).mtimeNs, mtime);
    t.is(f.reloads(), 0);
  } finally {
    f.cleanup();
  }
});

test("stale documents, relevant drafts, dependency changes and foreign baselines preserve source", async (t) => {
  const f = fixture();
  try {
    const manifest = await f.service.export({ file: "native.bin" }, f.outputs);
    await paint(f.outputs.document);
    const review = await f.service.review(manifest, f.outputs.document),
      original = fs.readFileSync(f.file);
    f.setDrafts([{ path: "native.bin", opaque: true, version: 4 }]);
    await t.throwsAsync(() => f.service.apply(manifest, f.outputs.document, review.id), {
      message: /opaque editor draft/,
    });
    f.setDrafts([]);
    fs.appendFileSync(f.outputs.document, Uint8Array.of(0));
    await t.throwsAsync(() => f.service.apply(manifest, f.outputs.document, review.id), {
      message: /document.*changed/,
    });
    fs.writeFileSync(path.join(f.root, "config.json"), '{"changed":true}');
    await t.throwsAsync(() => f.service.review(manifest, f.outputs.document), { message: /Stale/ });
    await t.throwsAsync(
      () => f.service.review({ ...manifest, project: "foreign" }, f.outputs.document),
      { message: /baseline/ },
    );
    await t.throwsAsync(() => f.service.review({ ...manifest, version: 90 }, f.outputs.document), {
      message: /re-export/,
    });
    t.deepEqual(fs.readFileSync(f.file), original);
  } finally {
    f.cleanup();
  }
});

test("unrelated source history does not invalidate exports, while undeclared native effects reject", async (t) => {
  const f = fixture();
  try {
    const manifest = await f.service.export({ file: "native.bin" }, f.outputs);
    fs.writeFileSync(path.join(f.root, "unrelated.md"), "a later unrelated commit");
    await paint(f.outputs.document);
    t.truthy(await f.service.review(manifest, f.outputs.document));
    const before = fs.readFileSync(f.file);
    f.setForbiddenEffect();
    await t.throwsAsync(() => f.service.review(manifest, f.outputs.document), {
      message: /unattributed extent/,
    });
    t.deepEqual(fs.readFileSync(f.file), before);
  } finally {
    f.cleanup();
  }
});

test("implicit declaration reads remain dependencies, including reads made only during native verification", async (t) => {
  for (const name of ["evidence.json", "plan-proof.json", "verify-proof.json"]) {
    const f = fixture();
    try {
      const manifest = await f.service.export({ file: "native.bin" }, f.outputs);
      await paint(f.outputs.document);
      const review = await f.service.review(manifest, f.outputs.document),
        original = fs.readFileSync(f.file);
      fs.writeFileSync(path.join(f.root, name), '{"changed":true}');
      await t.throwsAsync(() => f.service.apply(manifest, f.outputs.document, review.id), {
        message: new RegExp(`Stale.*${name.replace(".", "\\.")}`),
      });
      t.deepEqual(fs.readFileSync(f.file), original);
    } finally {
      f.cleanup();
    }
  }
});

test("selected document drafts and absolute source drafts reject without discarding editor state", async (t) => {
  const f = fixture();
  try {
    const manifest = await f.service.export({ file: "native.bin" }, f.outputs);
    await paint(f.outputs.document);
    const review = await f.service.review(manifest, f.outputs.document),
      original = fs.readFileSync(f.file);
    for (const draftPath of [f.outputs.document, f.file, path.join(f.root, "evidence.json")]) {
      f.setDrafts([{ path: draftPath, version: 7, opaque: true }]);
      await t.throwsAsync(() => f.service.review(manifest, f.outputs.document), {
        message: /opaque editor draft/,
      });
      await t.throwsAsync(() => f.service.apply(manifest, f.outputs.document, review.id), {
        message: /opaque editor draft/,
      });
      t.deepEqual(fs.readFileSync(f.file), original);
    }
  } finally {
    f.cleanup();
  }
});

test("the final publication gate rejects live drafts and rechecks dependencies after acknowledgment", async (t) => {
  const f = fixture();
  t.teardown(f.cleanup);
  const manifest = await f.service.export({ file: "native.bin" }, f.outputs);
  await paint(f.outputs.document);
  const review = await f.service.review(manifest, f.outputs.document),
    original = fs.readFileSync(f.file),
    mtime = fs.statSync(f.file, { bigint: true }).mtimeNs;
  f.service.host.beforePublish = async (paths) => {
    t.true(paths.includes(f.file));
    t.true(paths.includes(f.outputs.document));
    f.setDrafts([{ path: f.file, version: 8, opaque: true }]);
  };
  await t.throwsAsync(() => f.service.apply(manifest, f.outputs.document, review.id), {
    message: /opaque editor draft/,
  });
  f.setDrafts([]);
  f.service.host.beforePublish = async () => {
    fs.writeFileSync(path.join(f.root, "plan-proof.json"), '{"changed":true}');
  };
  await t.throwsAsync(() => f.service.apply(manifest, f.outputs.document, review.id), {
    message: /Stale.*plan-proof/,
  });
  t.deepEqual(fs.readFileSync(f.file), original);
  t.is(fs.statSync(f.file, { bigint: true }).mtimeNs, mtime);
  t.is(f.reloads(), 0);
});

test("locally corrupted baseline capabilities cannot enable edits unsupported by the adapter", async (t) => {
  const f = fixture();
  try {
    const manifest = await f.service.export({ file: "native.bin" }, f.outputs),
      directory = path.join(f.root, ".uttori-local/asset-interchange/exports", manifest.id),
      file = path.join(directory, "record.json");
    const metadata: { nodes: { kind: string; values: [string, unknown][] }[] } = JSON.parse(
      fs.readFileSync(file, "utf8"),
    );
    for (const node of metadata.nodes) {
      if (node.kind === "object") {
        for (const pair of node.values) {
          if (pair[0] === "paletteEdits") {
            pair[1] = true;
          }
        }
      }
    }
    fs.writeFileSync(file, JSON.stringify(metadata));
    fs.writeFileSync(path.join(directory, "record.sha256"), hash(fs.readFileSync(file)));
    await t.throwsAsync(
      () =>
        f.service.review(
          { ...manifest, capabilities: { ...manifest.capabilities, paletteEdits: true } },
          f.outputs.document,
        ),
      { message: /Inconsistent private asset baseline/ },
    );
  } finally {
    f.cleanup();
  }
});

// A second game exercises the same host entry used by terminal and editor composition.
test("host registration dispatches an independent game adapter", async (t) => {
  const f = fixture();
  t.teardown(f.cleanup);
  const selection = path.join(f.root, "selection.json");
  fs.writeFileSync(selection, JSON.stringify({ file: "native.bin" }));
  const result = await executeAssetOperation(
    {
      action: "asset-export",
      directory: f.root,
      adapter: f.adapter.id,
      selection,
      document: f.outputs.document,
      manifest: f.outputs.manifest,
    },
    { host: f.host, adapters: [registerAssetAdapter(f.adapter)] },
  );
  const manifest = readAssetExportManifest(result);
  t.is(manifest.adapter.id, "second-game.rectangular");
  t.true(fs.existsSync(f.outputs.document));
});
