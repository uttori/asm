import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  Assembler,
  definePlugin,
  PLUGIN_API_VERSION,
  PluginError,
  type AssemblerPlugin,
} from "@uttori/asm-core";

import { parseCliArguments, runCli } from "../../../src/cli.js";
import { test } from "../../../tests/ava-helper.js";
import {
  NodePluginLoader,
  loadProjectEnvironment,
  validateProjectConfiguration,
} from "../src/index.js";

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const fixturePluginPath = path.join(fixtures, "relative-plugin.mjs");

const assemble = (
  loaded: Awaited<ReturnType<NodePluginLoader["loadProjectEnvironment"]>>,
  source: string,
) => {
  const assembler = new Assembler({
    environment: loaded.environment,
    target: loaded.target,
    architecture: loaded.architecture,
    targetOptions: loaded.targetOptions,
  });
  try {
    assembler.assembleSource(source, "fixture.asm");
    return assembler.getBinaryOutput();
  } finally {
    assembler.dispose();
  }
};

test("configuration validation rejects unknown keys and malformed plugin entries", (t) => {
  const unknown = t.throws(() => validateProjectConfiguration({ pluginz: [] }), {
    instanceOf: PluginError,
  });
  t.is(unknown.code, "PLUGIN_CONFIGURATION_INVALID");
  t.regex(unknown.message, /unknown field.*pluginz/i);

  const malformed = t.throws(
    () => validateProjectConfiguration({ plugins: [{ module: "ok", extra: true }] }),
    { instanceOf: PluginError },
  );
  t.regex(malformed.message, /plugins\[0\].*unknown field.*extra/i);
});

test("generic CLI options parse repeatable plugins, includes, and namespaced values", (t) => {
  const parsed = parseCliArguments([
    "input.asm",
    "--config=project.json",
    "--plugin",
    "first-plugin",
    "--plugin=second-plugin",
    "--target",
    "fixture.target",
    "--architecture=fixture.architecture",
    "--base-image",
    "base.bin",
    "--include-path=one",
    "--include-path",
    "two",
    "--plugin-option",
    "fixture.plugin:byte=126",
    "--verbose",
  ]);
  t.is(parsed.input, "input.asm");
  t.deepEqual(parsed.plugins, ["first-plugin", "second-plugin"]);
  t.deepEqual(parsed.includePaths, ["one", "two"]);
  t.is(parsed.target, "fixture.target");
  t.is(parsed.architecture, "fixture.architecture");
  t.is(parsed.baseImage, "base.bin");
  t.deepEqual(parsed.pluginOptions, { "fixture.plugin": { byte: 126 } });
  t.true(parsed.verbose);
});

test("relative file plugins resolve from the configuration directory", async (t) => {
  const loader = new NodePluginLoader();
  const project = path.join(fixtures, "relative-project");
  const loaded = await loader.loadProjectEnvironment({ cwd: project });
  t.is(loaded.target, "loader.fixture-target");
  t.is(loaded.architecture, "loader.fixture-architecture");
  t.true(loaded.configuration.plugins[0]!.resolvedModule.startsWith("file:"));
  t.true(loaded.configuration.plugins[0]!.resolvedModule.endsWith("relative-plugin.mjs"));
  t.deepEqual(loaded.includePaths, [path.join(project, "include")]);
  t.deepEqual([...assemble(loaded, "org 0\nfix")], [0x5a]);
  await loaded.dispose();
});

test("absolute file plugins load without scanning node_modules", async (t) => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-loader-absolute-"));
  const loader = new NodePluginLoader();
  try {
    const unrequestedPackage = path.join(project, "node_modules", "unrequested-plugin");
    const sideEffectMarker = path.join(project, "unexpected-plugin-load");
    await fs.mkdir(unrequestedPackage, { recursive: true });
    await fs.writeFile(
      path.join(unrequestedPackage, "package.json"),
      JSON.stringify({
        name: "unrequested-plugin",
        version: "1.0.0",
        type: "module",
        main: "index.mjs",
      }),
    );
    await fs.writeFile(
      path.join(unrequestedPackage, "index.mjs"),
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(sideEffectMarker)}, "loaded");`,
    );
    const loaded = await loader.loadProjectEnvironment({
      cwd: project,
      pluginModules: [{ module: fixturePluginPath, options: { byte: 0x71 } }],
    });
    t.is(loaded.configuration.plugins.length, 1);
    t.is(loaded.configuration.plugins[0]!.source, "override");
    t.deepEqual([...assemble(loaded, "org 0\nfix")], [0x71]);
    const sideEffectLoaded = await fs.access(sideEffectMarker).then(
      () => true,
      () => false,
    );
    t.false(sideEffectLoaded);
    await loaded.dispose();
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test("explicit modules append after configuration plugins without reordering", async (t) => {
  const auxiliary = definePlugin({
    manifest: {
      id: "loader.auxiliary-plugin",
      name: "Loader auxiliary plugin",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    activate: () => undefined,
  });
  const loader = new NodePluginLoader();
  const loaded = await loader.loadProjectEnvironment({
    cwd: path.join(fixtures, "relative-project"),
    pluginModules: [{ module: "bundled:auxiliary" }],
    bundledPlugins: new Map<string, AssemblerPlugin>([["bundled:auxiliary", auxiliary]]),
  });
  t.deepEqual(
    loaded.configuration.plugins.map((plugin) => [plugin.pluginId, plugin.source]),
    [
      ["loader.fixture-plugin", "configuration"],
      ["loader.auxiliary-plugin", "override"],
    ],
  );
  await loaded.dispose();
});

test("workspace package specifiers use Node ESM resolution", async (t) => {
  const loader = new NodePluginLoader();
  const loaded = await loader.loadProjectEnvironment({
    cwd: path.join(fixtures, "package-project"),
  });
  t.is(loaded.configuration.plugins[0]!.pluginId, "uttori.asm-plugin-6502-stub");
  t.true(
    loaded.configuration.plugins[0]!.resolvedModule.endsWith("plugins/6502-stub/src/index.ts"),
  );
  const error = t.throws(() => assemble(loaded, "org $8000\nnop"));
  t.regex(error.message, /6502 encoding is not implemented/i);
  await loaded.dispose();
});

test("host-provided bundled plugins win over Node resolution", async (t) => {
  const namespace = (await import("./fixtures/relative-plugin.mjs")) as {
    default: AssemblerPlugin;
  };
  const loader = new NodePluginLoader();
  const loaded = await loader.loadProjectEnvironment({
    cwd: path.join(fixtures, "bundled-project"),
    bundledPlugins: new Map([["bundled:fixture", namespace.default]]),
  });
  t.true(loaded.configuration.plugins[0]!.bundled);
  t.is(loaded.configuration.plugins[0]!.resolvedModule, "bundled:bundled:fixture");
  t.deepEqual([...assemble(loaded, "org 0\nfix")], [0x6b]);
  await loaded.dispose();
});

test("overrides beat project configuration and host defaults", async (t) => {
  const loader = new NodePluginLoader();
  const project = path.join(fixtures, "relative-project");
  const loaded = await loader.loadProjectEnvironment({
    cwd: project,
    defaults: {
      target: "wrong.target",
      architecture: "wrong.architecture",
      includePaths: ["wrong-include"],
    },
    overrides: {
      target: "loader-fixture",
      architecture: "loader-cpu",
      includePaths: ["override-include"],
      pluginOptions: { "loader.fixture-plugin": { byte: 0x7e } },
    },
  });
  t.is(loaded.target, "loader.fixture-target");
  t.is(loaded.architecture, "loader.fixture-architecture");
  t.deepEqual(loaded.includePaths, [path.join(project, "override-include")]);
  t.deepEqual([...assemble(loaded, "org 0\nfix")], [0x7e]);
  await loaded.dispose();
});

test("one environment is cached per normalized snapshot and replacement disposes the previous plugin", async (t) => {
  let activations = 0;
  let disposals = 0;
  const tracked = definePlugin({
    manifest: {
      id: "loader.tracked-plugin",
      name: "Tracked loader plugin",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    validateOptions: (configured) => ({
      byte:
        typeof configured === "object" && configured !== null && "byte" in configured
          ? Number(configured.byte)
          : 1,
    }),
    activate(context) {
      activations++;
      context.registerArchitecture({
        id: "tracked.architecture",
        displayName: "Tracked architecture",
        unknownInstructionBehavior: "throw",
        splitOperands: () => [],
        classifyOperand: ({ operands }, operand) => operands.lowerOperand(operand),
        createEncoder: ({ emission }) => ({
          estimateSize: () => 1,
          encode: () => {
            emission.writeByte(context.options.byte);
            return true;
          },
        }),
        instructions: [],
      });
      context.registerAddressSpace({
        id: "tracked.address-space",
        create: () => ({
          addressWidth: 16,
          defaultOrigin: 0,
          normalizeForWrite: (value) => value,
          advance: (value, amount) => value + amount,
          toOutputOffset: (value) => value,
          fromOutputOffset: (value) => value,
        }),
      });
      context.registerOutputFormat({
        id: "tracked.output",
        create: () => ({
          finalize: () => undefined,
          getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
        }),
      });
      context.registerTarget({
        id: "tracked.target",
        displayName: "Tracked target",
        defaultArchitecture: "tracked.architecture",
        architectures: ["tracked.architecture"],
        addressSpace: "tracked.address-space",
        outputFormat: "tracked.output",
        directiveSets: [],
        expressionSets: [],
        lifecycle: [],
        defaultOutputExtension: ".bin",
      });
      return { dispose: () => void disposals++ };
    },
  });
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-loader-cache-"));
  const loader = new NodePluginLoader();
  try {
    const base = {
      cwd: project,
      defaults: { plugins: [{ module: "bundled:tracked", options: { byte: 1 } }] },
      bundledPlugins: new Map<string, AssemblerPlugin>([["bundled:tracked", tracked]]),
    };
    const first = await loader.loadProjectEnvironment(base);
    const cached = await loader.loadProjectEnvironment(base);
    t.is(cached, first);
    t.is(activations, 1);
    const replacement = await loader.loadProjectEnvironment({
      ...base,
      overrides: { pluginOptions: { "loader.tracked-plugin": { byte: 2 } } },
    });
    t.not(replacement, first);
    t.is(activations, 2);
    t.is(disposals, 1);
    await replacement.dispose();
    t.is(disposals, 2);
  } finally {
    await loader.dispose();
    await fs.rm(project, { recursive: true, force: true });
  }
});

test("load failures name the configuration entry and resolved module", async (t) => {
  const missingLoader = new NodePluginLoader();
  const missing = await t.throwsAsync(
    missingLoader.loadProjectEnvironment({
      cwd: fixtures,
      pluginModules: [{ module: "./missing-plugin.mjs" }],
    }),
    { instanceOf: PluginError },
  );
  t.is(missing.code, "PLUGIN_MODULE_NOT_FOUND");
  t.regex(missing.message, /pluginModules\[0\].*resolved to.*missing-plugin\.mjs/i);

  const invalidLoader = new NodePluginLoader();
  const invalid = await t.throwsAsync(
    invalidLoader.loadProjectEnvironment({
      cwd: fixtures,
      pluginModules: [{ module: "./invalid-export.mjs" }],
    }),
    { instanceOf: PluginError },
  );
  t.is(invalid.code, "PLUGIN_INVALID_EXPORT");
  t.regex(invalid.message, /pluginModules\[0\].*invalid-export\.mjs/i);

  const optionsLoader = new NodePluginLoader();
  const invalidOptions = await t.throwsAsync(
    optionsLoader.loadProjectEnvironment({
      cwd: fixtures,
      pluginModules: [{ module: "@uttori/asm-plugin-snes", options: { checksumMode: "broken" } }],
      overrides: { target: "snes.sfc" },
    }),
    { instanceOf: PluginError },
  );
  t.is(invalidOptions.code, "PLUGIN_CONFIGURATION_INVALID");
  t.is(invalidOptions.pluginId, "uttori.asm-plugin-snes");
  t.regex(invalidOptions.message, /pluginModules\[0\].*plugins\/snes\/src\/index\.ts/i);
});

test("duplicate resolved modules are rejected before activation", async (t) => {
  const loader = new NodePluginLoader();
  const error = await t.throwsAsync(
    loader.loadProjectEnvironment({
      cwd: fixtures,
      pluginModules: [{ module: "./relative-plugin.mjs" }, { module: fixturePluginPath }],
    }),
    { instanceOf: PluginError },
  );
  t.is(error.code, "PLUGIN_CONFIGURATION_INVALID");
  t.regex(error.message, /same module.*relative-plugin\.mjs/i);
});

test("a clean SNES project builds from asm.config.json through the generic CLI", async (t) => {
  const project = path.join(fixtures, "snes-project");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-loader-cli-"));
  const output = path.join(temporary, "main.sfc");
  try {
    const exitCode = await runCli([
      path.join(project, "main.asm"),
      output,
      "--config",
      path.join(project, "asm.config.json"),
      "--verbose",
    ]);
    t.is(exitCode, 0);
    const bytes = await fs.readFile(output);
    t.is(bytes[0], 0x42);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("the CLI host default uses the target output extension when output is omitted", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-loader-default-cli-"));
  const input = path.join(temporary, "default.asm");
  const output = path.join(temporary, "default.sfc");
  try {
    await fs.writeFile(input, "lorom\norg $008000\ndb $73\n");
    const exitCode = await runCli([input]);
    t.is(exitCode, 0);
    const bytes = await fs.readFile(output);
    t.is(bytes[0], 0x73);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("the top-level loader API builds a non-SNES fixture without activating SNES", async (t) => {
  const loaded = await loadProjectEnvironment({
    cwd: path.join(fixtures, "relative-project"),
  });
  t.deepEqual(
    loaded.environment.manifests.map((manifest) => manifest.id),
    ["loader.fixture-plugin"],
  );
  t.false(loaded.environment.getTargetSummaries().some((target) => target.id === "snes.sfc"));
  t.deepEqual([...assemble(loaded, "org 0\nfix")], [0x5a]);
  await loaded.dispose();
});
