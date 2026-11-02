import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import snesPlugin, { SNES_TARGET_ID } from "@uttori/asm-plugin-snes";

import { test } from "../../../tests/ava-helper.js";
import {
  createAsarSourceBuildFixture,
  createLinkedBuildFixture,
} from "../../../tests/fixtures/linked-build.js";
import { createFixturePlugin } from "../../../tests/plugin/fixture-plugin.js";
import { ProjectEnvironmentController } from "../src/project-environment.js";
import { completionsFor } from "../src/providers.js";

const createController = (): ProjectEnvironmentController =>
  new ProjectEnvironmentController({
    bundledPlugins: new Map([
      ["@uttori/asm-plugin-snes", snesPlugin],
      ["fixture-plugin", createFixturePlugin()],
    ]),
    defaults: {
      plugins: [{ module: "@uttori/asm-plugin-snes" }],
      target: SNES_TARGET_ID,
      includePaths: ["./"],
    },
  });

test("native build manifests analyze independent modules with their declared identities", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-module-analysis-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  createLinkedBuildFixture(directory);
  const controller = createController();
  t.teardown(() => controller.dispose());
  const state = await controller.replace({
    cwd: directory,
    workspaceTrusted: true,
    linkProject: "build.json",
  });
  t.deepEqual(state.index.moduleRoots, {
    [path.join(directory, "main.asm")]: { id: "main" },
    [path.join(directory, "helper.asm")]: { id: "helper" },
  });
  t.deepEqual(state.index.getDiagnostics(path.join(directory, "main.asm")), []);
  t.deepEqual(state.index.getDiagnostics(path.join(directory, "helper.asm")), []);
  t.true(state.linkInputs?.includes(path.join(directory, "recipe.json")));
  const snapshot = state.index.snapshot();
  const published = controller.publishAnalysis(snapshot, new Map());
  t.deepEqual(published.moduleRoots, state.index.moduleRoots);
  t.deepEqual(published.getDiagnostics(path.join(directory, "main.asm")), []);
  t.throws(
    () =>
      controller.publishAnalysis(
        {
          ...snapshot,
          moduleRoots: {
            ...snapshot.moduleRoots,
            [path.join(directory, "main.asm")]: { id: "changed" },
          },
        },
        new Map(),
      ),
    { message: /different environment/ },
  );
});

test("source adapters survive language-tooling root selection and snapshot publication", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-analysis-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  createAsarSourceBuildFixture(directory);
  const controller = createController();
  t.teardown(() => controller.dispose());
  const state = await controller.replace({
    cwd: directory,
    workspaceTrusted: true,
    linkProject: "build.json",
  });
  const main = path.join(directory, "main.asm");
  t.deepEqual(state.index.moduleRoots[main], { id: "main", sourceAdapter: "asar" });
  t.deepEqual(state.index.getDiagnostics(main), []);
  const snapshot = state.index.snapshot();
  t.is(snapshot.version, 5);
  t.deepEqual(controller.publishAnalysis(snapshot, new Map()).moduleRoots[main], {
    id: "main",
    sourceAdapter: "asar",
  });
  t.throws(
    () =>
      controller.publishAnalysis(
        { ...snapshot, moduleRoots: { ...snapshot.moduleRoots, [main]: { id: "main" } } },
        new Map(),
      ),
    { message: /different environment/ },
  );
});

test("repository editor config discovers the packaged SoM sprite preview format", async (t) => {
  const project = path.resolve("secret-of-mana");
  const settings: unknown = JSON.parse(
    fs.readFileSync(path.join(project, ".vscode/settings.json"), "utf8"),
  );
  if (
    typeof settings !== "object" ||
    settings === null ||
    Array.isArray(settings) ||
    typeof settings["asm.configFile"] !== "string"
  ) {
    throw new Error("Expected editor settings with asm.configFile.");
  }
  const controller = createController();
  try {
    const state = await controller.replace({
      cwd: project,
      configFile: settings["asm.configFile"],
      workspaceTrusted: true,
    });
    t.truthy(state.index.environment.getAssetFormat("som.sprite.frames", state.index.target));
    t.truthy(state.index.environment.getAssetFormat("som.palette.bgr555", state.index.target));
    t.truthy(state.index.environment.getAssetFormat("som.brr.pcm", state.index.target));
    t.truthy(state.index.environment.getAssetFormat("som.brr.segment", state.index.target));
  } finally {
    await controller.dispose();
  }
});

test("language server replaces target tooling and preserves build/analysis parity", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-lsp-environment-"));
  const sourceFile = path.join(directory, "main.asm");
  const controller = createController();

  try {
    const fixture = await controller.replace(
      {
        cwd: directory,
        workspaceTrusted: true,
        plugins: [{ module: "fixture-plugin", options: { byte: 0x5a } }],
        target: "fixture",
        architecture: "fixture-cpu",
      },
      new Map([[sourceFile, "org 0\nFIX\nfixturebyte\n"]]),
    );

    const fixtureCompletions = new Set(completionsFor(fixture.index).map((entry) => entry.label));
    t.true(fixtureCompletions.has("FIX"));
    t.true(fixtureCompletions.has("fixturebyte"));
    t.false(fixtureCompletions.has("LDA"));
    t.deepEqual(
      fixture.index.toolingCatalog.getTargets().map((target) => target.id),
      ["fixture.raw-target"],
    );

    const assembler = controller.createAssembler({ collectSourceMetadata: false });
    try {
      t.is(assembler.environment, fixture.index.environment);
      t.is(assembler.targetId, fixture.index.target);
      t.is(assembler.arch, fixture.index.architecture);
      assembler.setCurrentFile(sourceFile);
      assembler.assembleProgram(
        assembler.buildProgramModel("org 0\nFIX\nfixturebyte\n", sourceFile, 0),
      );
      t.deepEqual([...assembler.getBinaryOutput()], [0x5a]);
    } finally {
      assembler.dispose();
    }

    const snes = await controller.replace(
      {
        cwd: directory,
        workspaceTrusted: true,
        plugins: ["@uttori/asm-plugin-snes"],
        target: SNES_TARGET_ID,
        architecture: "65816",
      },
      new Map([[sourceFile, "org $008000\nLDA #$01\n"]]),
    );
    const snesCompletions = new Set(completionsFor(snes.index).map((entry) => entry.label));
    t.true(snesCompletions.has("LDA"));
    t.false(snesCompletions.has("FIX"));
    t.false(snesCompletions.has("fixturebyte"));

    const stable = controller.current;
    await t.throwsAsync(
      controller.replace({
        cwd: directory,
        workspaceTrusted: true,
        plugins: ["./missing-plugin.mjs"],
      }),
      { message: /module could not be imported|module could not be resolved/ },
    );
    t.is(controller.current, stable);
    t.true(completionsFor(controller.current.index).some((entry) => entry.label === "LDA"));
  } finally {
    await controller.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("SNES include fragments without org emit 0 ROM bytes", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-lsp-empty-rom-"));
  const sourceFile = path.join(directory, "bars.asm");
  const controller = createController();
  try {
    await controller.replace(
      {
        cwd: directory,
        workspaceTrusted: true,
        plugins: ["@uttori/asm-plugin-snes"],
        target: SNES_TARGET_ID,
      },
      new Map([[sourceFile, "org $008000\ncreate:\n"]]),
    );
    const assembler = controller.createAssembler({ collectSourceMetadata: false });
    try {
      assembler.setCurrentFile(sourceFile);
      assembler.assembleProgram(
        assembler.buildProgramModel("org $008000\ncreate:\n", sourceFile, 0),
      );
      t.is(assembler.getBinaryOutput().length, 0);
    } finally {
      assembler.dispose();
    }
  } finally {
    await controller.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("workspace trust gates project plugin configuration until trust is granted", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-lsp-trust-"));
  const sourceFile = path.join(directory, "main.asm");
  const controller = createController();
  fs.writeFileSync(
    path.join(directory, "uttori-asm.config.json"),
    JSON.stringify({
      plugins: [{ module: "fixture-plugin", options: { byte: 0x44 } }],
      target: "fixture",
    }),
  );

  try {
    const restricted = await controller.replace(
      { cwd: directory, workspaceTrusted: false },
      new Map([[sourceFile, "org $008000\nLDA #$01\n"]]),
    );
    t.is(restricted.loaded.target, SNES_TARGET_ID);
    t.regex(restricted.trustNotice ?? "", /disabled until this workspace is trusted/);
    t.false(completionsFor(restricted.index).some((entry) => entry.label === "FIX"));

    const trusted = await controller.replace(
      { cwd: directory, workspaceTrusted: true },
      new Map([[sourceFile, "org 0\nFIX\n"]]),
    );
    t.is(trusted.loaded.target, "fixture.raw-target");
    t.is(trusted.trustNotice, undefined);
    t.true(completionsFor(trusted.index).some((entry) => entry.label === "FIX"));
    t.false(completionsFor(trusted.index).some((entry) => entry.label === "LDA"));
  } finally {
    await controller.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("activateBundledPlugins keeps unused bundled targets in the catalog", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-lsp-bundled-targets-"));
  const sourceFile = path.join(directory, "main.asm");
  const controller = new ProjectEnvironmentController({
    bundledPlugins: new Map([
      ["@uttori/asm-plugin-snes", snesPlugin],
      ["fixture-plugin", createFixturePlugin()],
    ]),
    activateBundledPlugins: true,
    defaults: {
      plugins: [{ module: "@uttori/asm-plugin-snes" }],
      target: SNES_TARGET_ID,
      includePaths: ["./"],
    },
  });
  try {
    const snes = await controller.replace(
      {
        cwd: directory,
        workspaceTrusted: true,
        plugins: ["@uttori/asm-plugin-snes"],
        target: SNES_TARGET_ID,
      },
      new Map([[sourceFile, "org $008000\nLDA #$01\n"]]),
    );
    const ids = new Set(snes.index.toolingCatalog.getTargets().map((target) => target.id));
    t.true(ids.has(SNES_TARGET_ID));
    t.true(ids.has("fixture.raw-target"));
  } finally {
    await controller.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
