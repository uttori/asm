import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { test } from "../../../tests/ava-helper.js";
import { createLinkedBuildFixture } from "../../../tests/fixtures/linked-build.js";
import { bundledProjectOptions } from "../src/bundled-plugins.js";
import { IndexWorkerClient } from "../src/index-worker-client.js";
import { ProjectEnvironmentController } from "../src/project-environment.js";
import { completionsFor } from "../src/providers.js";

test("bundled indexing preserves each native module identity across snapshot publication", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-native-index-worker-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  createLinkedBuildFixture(directory);
  const worker = new IndexWorkerClient(workerFile);
  t.teardown(() => worker.dispose());
  const controller = new ProjectEnvironmentController({
    ...bundledProjectOptions,
    indexer: (settings, overlays) => worker.analyze(settings, overlays),
  });
  t.teardown(() => controller.dispose());
  const state = await controller.replace({
    cwd: directory,
    workspaceTrusted: true,
    linkProject: "build.json",
  });
  t.is(state.index.moduleRoots[path.join(directory, "main.asm")].id, "main");
  t.is(state.index.moduleRoots[path.join(directory, "helper.asm")].id, "helper");
  t.deepEqual(state.index.getDiagnostics(path.join(directory, "main.asm")), []);
});

const workerFile = pathToFileURL(path.resolve("packages/language-server/out/index-worker.mjs"));

test("bundled indexing isolates simultaneous targets and cancels obsolete revisions while readers retain a snapshot", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-index-roots-"));
  const snesRoot = path.join(directory, "snes"),
    nesRoot = path.join(directory, "nes");
  for (const root of [snesRoot, nesRoot]) {
    fs.mkdirSync(root);
  }
  const snesFile = path.join(snesRoot, "main.asm"),
    nesFile = path.join(nesRoot, "main.asm");
  fs.writeFileSync(snesFile, "org $808000\nshared = $1234\nSnesOnly:\nnop\n");
  fs.writeFileSync(nesFile, "org $8000\nshared = $56\nNesOnly:\nnop\n");
  const snesWorker = new IndexWorkerClient(workerFile),
    nesWorker = new IndexWorkerClient(workerFile);
  const controller = new ProjectEnvironmentController({
    ...bundledProjectOptions,
    indexer: (settings, overlays) => snesWorker.analyze(settings, overlays),
  });
  t.teardown(async () => {
    snesWorker.dispose();
    nesWorker.dispose();
    await controller.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const snesSettings = {
    cwd: snesRoot,
    workspaceTrusted: true,
    target: "snes.sfc",
    entryPoints: [snesFile],
  };
  const nesSettings = {
    cwd: nesRoot,
    workspaceTrusted: true,
    target: "65xx.nes",
    plugins: ["@uttori/asm-plugin-65xx"],
    entryPoints: [nesFile],
  };
  const [published, nes] = await Promise.all([
    controller.replace(snesSettings),
    nesWorker.analyze(nesSettings, new Map()),
  ]);
  t.true(published.index.getAllSymbols().some((symbol) => symbol.name === "SnesOnly"));
  t.false(nes.symbols.some((symbol) => symbol.name === "SnesOnly"));
  t.true(nes.symbols.some((symbol) => symbol.name === "NesOnly"));
  const large =
    "org $808000\n" + Array.from({ length: 20000 }, (_, i) => `Label${i}:\nnop`).join("\n");
  const obsolete = snesWorker.analyze(snesSettings, new Map([[snesFile, large]]));
  const obsoleteCheck = t.throwsAsync(obsolete, { message: /superseded/ });
  // The last published snapshot remains usable while a worker owns the next expensive pass.
  t.true(completionsFor(published.index).some((item) => item.label === "SnesOnly"));
  let timerAnswered = false;
  const timer = new Promise<void>((resolve) =>
    setTimeout(() => {
      timerAnswered = true;
      resolve();
    }, 0),
  );
  const latest = snesWorker.analyze(
    snesSettings,
    new Map([[snesFile, "org $808000\nNewest:\nnop\n"]]),
  );
  await timer;
  t.true(timerAnswered);
  const snapshot = await latest;
  await obsoleteCheck;
  t.true(snapshot.symbols.some((symbol) => symbol.name === "Newest"));
  t.false(snapshot.symbols.some((symbol) => symbol.name === "Label19999"));
  const symbols = [...snapshot.symbols];
  const next = controller.publishAnalysis({ ...snapshot, symbols }, new Map());
  symbols.length = 0;
  t.true(next.getAllSymbols().some((symbol) => symbol.name === "Newest"));
  snesWorker.dispose();
  await t.throwsAsync(snesWorker.analyze(snesSettings, new Map()), { message: /disposed/ });
});
