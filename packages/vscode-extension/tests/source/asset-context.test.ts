import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { sourceContentHash } from "@uttori/asm-disassembler/source-project";

import { test } from "../../../../tests/ava-helper.js";
import {
  type SourceProcessOptions,
  type SourceProcessOperation,
  SourceProcessClient,
} from "../../src/source/process-client.js";
import { host, resetHost, document } from "../helpers/editor-host.js";

const { SourceAssetCoordinator } = await import("../../src/source/asset-coordinator.js");
const { SourceProjectSession } = await import("../../src/source/session.js");

test.serial(
  "asset probes ignore output echoes, reuse checked menus and invalidate changed bytes",
  async (t) => {
    resetHost();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-menu-cache-"));
    t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, ".uttori"));
    fs.writeFileSync(path.join(root, ".uttori/project.json"), "{}");
    const worker = path.join(root, "worker.mjs");
    fs.writeFileSync(worker, "fixture");
    const dependency = path.join(root, "palette.bin");
    fs.writeFileSync(dependency, "first");
    const doc = document(
      path.join(root, "main.asm"),
      "includeAsset(\n  file\n)\n\nincludeAsset(other)",
    );
    const editor = { viewColumn: 1, document: doc, selection: { active: { line: 0 } } };
    host.activeEditor = editor;
    const session = new SourceProjectSession();
    session.root = root;
    session.worker = new SourceProcessClient(worker);
    t.teardown(() => {
      clearTimeout(session.assetContextTimer);
      session.assetContextAbort?.abort();
      session.worker.dispose();
    });
    const coordinator = new SourceAssetCoordinator(session, {
      select: async () => {},
      refresh: async () => {},
      assetEditorVersions: () => [],
      output: { warn: () => {} },
    });
    let runs = 0;
    let cancellations = 0;
    const aborted = (): void => {
      cancellations++;
    };
    session.worker.run = (async (
      _operation: SourceProcessOperation,
      options: SourceProcessOptions,
    ) => {
      runs++;
      const signal = options.signal;
      signal?.addEventListener("abort", aborted, { once: true });
      // A worker startup message can cause a duplicate editor notification before its response.
      queueMicrotask(() => coordinator.scheduleAssetContext());
      await delay(10);
      signal?.removeEventListener("abort", aborted);
      return {
        representation: "indexed-png",
        menus: [
          { file: "main.asm", line: 1, endLine: 3, representation: "indexed-png" },
          { file: "main.asm", line: 5, endLine: 5, representation: "aseprite" },
        ],
        inputs: [{ path: "palette.bin", sha256: sourceContentHash(fs.readFileSync(dependency)) }],
      };
    }) as SourceProcessClient["run"];
    coordinator.scheduleAssetContext();
    await delay(500);
    t.is(runs, 1);
    t.is(cancellations, 0);
    coordinator.scheduleAssetContext();
    await delay(450);
    t.is(runs, 1);
    editor.selection.active.line = 4;
    coordinator.scheduleAssetContext();
    await delay(500);
    t.is(runs, 1);
    t.deepEqual(host.commands.at(-1), ["setContext", "asm.assetSourceRepresentation", "aseprite"]);
    editor.selection.active.line = 0;
    coordinator.scheduleAssetContext();
    await delay(500);
    t.is(runs, 1, "Returning to a saved target reuses its byte-checked result.");
    editor.selection.active.line = 1;
    coordinator.scheduleAssetContext();
    await delay(450);
    const stat = fs.statSync(dependency);
    fs.writeFileSync(dependency, "other");
    fs.utimesSync(dependency, stat.atime, stat.mtime);
    editor.selection.active.line = 0;
    coordinator.scheduleAssetContext();
    await delay(500);
    t.is(runs, 2, "A same-size dependency edit invalidates the cache without watcher help.");
    session.epoch++;
    coordinator.scheduleAssetContext();
    await delay(500);
    t.is(runs, 3);
    Object.assign(doc, { isDirty: true });
    coordinator.scheduleAssetContext();
    await delay(450);
    t.is(runs, 3, "Dirty source never starts a saved-source menu probe.");
    Object.assign(doc, { isDirty: false });
    session.busy = "build";
    coordinator.scheduleAssetContext();
    await delay(450);
    t.is(runs, 3, "Foreground builds take precedence over menu inspection.");
    session.busy = undefined;
    coordinator.scheduleAssetContext();
    await delay(500);
    t.is(runs, 3, "A foreground operation can resume a fresh advisory result.");
  },
);
