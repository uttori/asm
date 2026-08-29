import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import snesPlugin, { SNES_TARGET_ID } from "@uttori/asm-plugin-snes";
import { test } from "./ava-helper.js";
import { ProjectEnvironmentController } from "../language-server/src/project-environment.js";
import { completionsFor } from "../language-server/src/providers.js";
import { createFixturePlugin } from "./plugin/fixture-plugin.js";

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

    const fixtureCompletions = completionsFor(fixture.index).map((entry) => entry.label);
    t.true(fixtureCompletions.includes("FIX"));
    t.true(fixtureCompletions.includes("fixturebyte"));
    t.false(fixtureCompletions.includes("LDA"));
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
    const snesCompletions = completionsFor(snes.index).map((entry) => entry.label);
    t.true(snesCompletions.includes("LDA"));
    t.false(snesCompletions.includes("FIX"));
    t.false(snesCompletions.includes("fixturebyte"));

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
    const ids = snes.index.toolingCatalog.getTargets().map((target) => target.id);
    t.true(ids.includes(SNES_TARGET_ID));
    t.true(ids.includes("fixture.raw-target"));
  } finally {
    await controller.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
