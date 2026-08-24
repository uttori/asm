import { test } from "./ava-helper.js";

import {
  definePlugin,
  PluginError,
  PluginManager,
  PLUGIN_API_VERSION,
  type AssemblerPlugin,
} from "../packages/core/src/plugin/index.js";
import { createFixturePlugin } from "./plugin/fixture-plugin.js";
import type { FixturePluginOptions } from "./plugin/fixture-plugin.js";

const errorCode = (error: unknown): string | undefined =>
  error instanceof PluginError ? error.code : undefined;

test("plugin manager activates a complete fixture plugin and freezes its environment", async (t) => {
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: createFixturePlugin(), options: { byte: 0x7f } }]);
  const environment = manager.freeze();

  t.true(Object.isFrozen(environment));
  t.true(Object.isFrozen(environment.manifests));
  t.true(Object.isFrozen(environment.getArchitecture("fixture.one-byte")));
  const architecture = environment.getArchitecture("fixture.one-byte") as {
    displayName: string;
  };
  t.throws(() => {
    architecture.displayName = "mutated";
  });
  t.is(environment.resolveTargetId("fixture"), "fixture.raw-target");
  t.is(environment.resolveArchitectureId("fixture.raw-target", "fixture-cpu"), "fixture.one-byte");
  t.is(environment.getTarget("fixture")?.defaultOutputExtension, ".bin");

  const catalog = environment.getToolingCatalog("fixture");
  t.deepEqual(
    catalog.getInstructions("fixture-cpu").map((item) => item.mnemonic),
    ["FIX"],
  );
  t.deepEqual(
    catalog.getDirectives().map((item) => item.keyword),
    ["fixturebyte"],
  );
  t.deepEqual(
    catalog.getExpressionFunctions().map((item) => item.name),
    ["fixturevalue"],
  );
  t.deepEqual(
    catalog.getArchitectures().map((item) => item.id),
    ["fixture.one-byte"],
  );
});

test("plugin manager validates module default exports and API versions", async (t) => {
  const missingDefault = await t.throwsAsync(
    new PluginManager().activateModules([{ module: {}, pluginModule: "missing-default" }]),
  );
  t.is(errorCode(missingDefault), "PLUGIN_INVALID_EXPORT");

  const incompatible = createFixturePlugin({
    manifest: {
      id: "fixture.incompatible",
      name: "Incompatible",
      version: "1.0.0",
      apiVersion: 2 as typeof PLUGIN_API_VERSION,
    },
  });
  const apiError = await t.throwsAsync(
    new PluginManager().activateModules([
      { module: { default: incompatible }, pluginModule: "incompatible" },
    ]),
  );
  t.is(errorCode(apiError), "PLUGIN_API_INCOMPATIBLE");
});

test("plugin manager rejects malformed manifests and unvalidated options", async (t) => {
  const malformed = createFixturePlugin({
    manifest: {
      id: "fixture.bad-version",
      name: "Bad version",
      version: "latest",
      apiVersion: PLUGIN_API_VERSION,
    },
  });
  const manifestError = await t.throwsAsync(
    new PluginManager().activatePlugins([{ plugin: malformed }]),
  );
  t.is(errorCode(manifestError), "PLUGIN_INVALID_MANIFEST");

  const noOptions = definePlugin({
    manifest: {
      id: "fixture.no-options",
      name: "No options",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    activate: () => undefined,
  });
  const optionsError = await t.throwsAsync(
    new PluginManager().activatePlugins([{ plugin: noOptions, options: { enabled: true } }]),
  );
  t.is(errorCode(optionsError), "PLUGIN_CONFIGURATION_INVALID");
});

test("plugin dependencies activate in dependency order and validate ranges", async (t) => {
  const order: string[] = [];
  const dependency = definePlugin({
    manifest: {
      id: "fixture.dependency",
      name: "Dependency",
      version: "2.1.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    activate: () => {
      order.push("dependency");
    },
  });
  const consumer = definePlugin({
    manifest: {
      id: "fixture.consumer",
      name: "Consumer",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      requires: [{ pluginId: "fixture.dependency", version: "^2.0.0" }],
    },
    activate: () => {
      order.push("consumer");
    },
  });
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: consumer }, { plugin: dependency }]);
  t.deepEqual(order, ["dependency", "consumer"]);

  const missingError = await t.throwsAsync(
    new PluginManager().activatePlugins([{ plugin: consumer }]),
  );
  t.is(errorCode(missingError), "PLUGIN_DEPENDENCY_MISSING");

  const oldDependency = {
    ...dependency,
    manifest: { ...dependency.manifest, version: "1.9.0" },
  };
  const rangeError = await t.throwsAsync(
    new PluginManager().activatePlugins([{ plugin: oldDependency }, { plugin: consumer }]),
  );
  t.is(errorCode(rangeError), "PLUGIN_DEPENDENCY_INCOMPATIBLE");
});

test("plugin IDs and contribution IDs are globally unique", async (t) => {
  const duplicatePluginManager = new PluginManager();
  const duplicatePluginError = await t.throwsAsync(
    duplicatePluginManager.activatePlugins([
      { plugin: createFixturePlugin() },
      { plugin: createFixturePlugin() },
    ]),
  );
  t.is(errorCode(duplicatePluginError), "PLUGIN_CONTRIBUTION_DUPLICATE");

  const owner = definePlugin({
    manifest: {
      id: "fixture.owner",
      name: "Owner",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    activate: (context) => {
      context.registerAddressSpace({
        id: "shared.contribution",
        create: () => ({
          addressWidth: 8,
          defaultOrigin: 0,
          normalizeForWrite: (value) => value,
          advance: (value, amount) => value + amount,
          toOutputOffset: (value) => value,
          fromOutputOffset: (value) => value,
        }),
      });
    },
  });
  const intruder = definePlugin({
    manifest: {
      id: "fixture.intruder",
      name: "Intruder",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    activate: (context) => {
      context.registerOutputFormat({
        id: "shared.contribution",
        create: () => ({ finalize: () => undefined, getOutput: () => new Uint8Array() }),
      });
    },
  });
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: owner }]);
  const contributionError = await t.throwsAsync(manager.activatePlugins([{ plugin: intruder }]));
  t.is(errorCode(contributionError), "PLUGIN_CONTRIBUTION_DUPLICATE");
  t.is((contributionError as PluginError).pluginId, "fixture.intruder");
});

test("failed plugin activation is transactional and disposes returned resources", async (t) => {
  let disposed = false;
  const invalid = definePlugin({
    manifest: {
      id: "fixture.transaction",
      name: "Transaction",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    activate: (context) => {
      const contribution = {
        id: "fixture.duplicate",
        create: () => ({ finalize: () => undefined, getOutput: () => new Uint8Array() }),
      };
      context.registerOutputFormat(contribution);
      context.registerOutputFormat(contribution);
      return {
        dispose: () => {
          disposed = true;
        },
      };
    },
  });
  const manager = new PluginManager();
  const activationError = await t.throwsAsync(manager.activatePlugins([{ plugin: invalid }]));
  t.is(errorCode(activationError), "PLUGIN_CONTRIBUTION_DUPLICATE");
  t.true(disposed);
  t.deepEqual(manager.activatedPlugins, []);
  t.deepEqual(manager.freeze().manifests, []);
});

test("target freezing rejects alias, directive, expression, and reference collisions", async (t) => {
  const cases: Array<{
    name: string;
    mutate: (plugin: AssemblerPlugin<FixturePluginOptions>) => void;
  }> = [
    {
      name: "directive",
      mutate: (plugin) => {
        const activate = plugin.activate.bind(plugin);
        plugin.activate = async (context, options) => {
          await activate(context, options);
          context.registerDirectiveSet({
            id: "fixture.extra-directives",
            directives: [
              {
                id: "fixture.directive.collision",
                keywords: ["fixturebyte"],
                phase: "lowered",
                createHandler: () => () => undefined,
                tooling: [],
              },
            ],
          });
        };
      },
    },
    {
      name: "expression",
      mutate: (plugin) => {
        const activate = plugin.activate.bind(plugin);
        plugin.activate = async (context, options) => {
          await activate(context, options);
          context.registerExpressionSet({
            id: "fixture.extra-expressions",
            functions: [
              {
                name: "fixture_value",
                signature: { parameters: [] },
                summary: "Collision",
                evaluate: () => 0,
              },
            ],
          });
        };
      },
    },
  ];

  for (const item of cases) {
    const fixture = createFixturePlugin();
    item.mutate(fixture);
    const originalActivate = fixture.activate.bind(fixture);
    fixture.activate = async (context, options) => {
      await originalActivate(context, options);
      context.registerTarget({
        id: `fixture.${item.name}-target`,
        displayName: "Collision target",
        defaultArchitecture: "fixture.one-byte",
        architectures: ["fixture.one-byte"],
        addressSpace: "fixture.flat",
        outputFormat: "fixture.raw",
        directiveSets:
          item.name === "directive"
            ? ["fixture.directives", "fixture.extra-directives"]
            : ["fixture.directives"],
        expressionSets:
          item.name === "expression"
            ? ["fixture.expressions", "fixture.extra-expressions"]
            : ["fixture.expressions"],
        lifecycle: ["fixture.lifecycle"],
        defaultOutputExtension: ".bin",
      });
    };
    const manager = new PluginManager();
    await manager.activatePlugins([{ plugin: fixture }]);
    const collision = t.throws(() => manager.freeze());
    t.is(errorCode(collision), "PLUGIN_TARGET_INVALID");
  }
});

test("target and architecture aliases fail with owner-rich diagnostics", async (t) => {
  const duplicateTargetAlias = createFixturePlugin();
  const activateTargets = duplicateTargetAlias.activate.bind(duplicateTargetAlias);
  duplicateTargetAlias.activate = async (context, options) => {
    await activateTargets(context, options);
    context.registerTarget({
      id: "fixture.second-target",
      aliases: ["fixture"],
      displayName: "Second target",
      defaultArchitecture: "fixture.one-byte",
      architectures: ["fixture.one-byte"],
      addressSpace: "fixture.flat",
      outputFormat: "fixture.raw",
      directiveSets: ["fixture.directives"],
      expressionSets: ["fixture.expressions"],
      lifecycle: ["fixture.lifecycle"],
      defaultOutputExtension: ".bin",
    });
  };
  const targetManager = new PluginManager();
  await targetManager.activatePlugins([{ plugin: duplicateTargetAlias }]);
  const targetError = t.throws(() => targetManager.freeze());
  t.is(errorCode(targetError), "PLUGIN_ALIAS_DUPLICATE");
  t.is((targetError as PluginError).targetId, "fixture.second-target");

  const duplicateArchitectureAlias = createFixturePlugin();
  const activateArchitectures = duplicateArchitectureAlias.activate.bind(
    duplicateArchitectureAlias,
  );
  duplicateArchitectureAlias.activate = async (context, options) => {
    await activateArchitectures(context, options);
    context.registerArchitecture({
      id: "fixture.second-cpu",
      aliases: ["fixture-cpu"],
      displayName: "Second CPU",
      unknownInstructionBehavior: "throw",
      splitOperands: () => [],
      classifyOperand: ({ operands }, operand) => operands.lowerOperand(operand),
      createEncoder: () => ({ estimateSize: () => 0, encode: () => true }),
      instructions: [],
    });
    context.registerTarget({
      id: "fixture.alias-target",
      displayName: "Alias target",
      defaultArchitecture: "fixture.one-byte",
      architectures: ["fixture.one-byte", "fixture.second-cpu"],
      addressSpace: "fixture.flat",
      outputFormat: "fixture.raw",
      directiveSets: ["fixture.directives"],
      expressionSets: ["fixture.expressions"],
      lifecycle: ["fixture.lifecycle"],
      defaultOutputExtension: ".bin",
    });
  };
  const architectureManager = new PluginManager();
  await architectureManager.activatePlugins([{ plugin: duplicateArchitectureAlias }]);
  const architectureError = t.throws(() => architectureManager.freeze());
  t.is(errorCode(architectureError), "PLUGIN_ALIAS_DUPLICATE");
  t.is((architectureError as PluginError).targetId, "fixture.alias-target");
});

test("plugin disposal runs in reverse activation order and is idempotent", async (t) => {
  const order: string[] = [];
  const plugin = (id: string): AssemblerPlugin =>
    definePlugin({
      manifest: { id, name: id, version: "1.0.0", apiVersion: PLUGIN_API_VERSION },
      activate: () => ({ dispose: () => order.push(id) }),
    });
  const manager = new PluginManager();
  await manager.activatePlugins([
    { plugin: plugin("fixture.first") },
    { plugin: plugin("fixture.second") },
  ]);
  await manager.dispose();
  await manager.dispose();
  t.deepEqual(order, ["fixture.second", "fixture.first"]);
});

test("lifecycle contributions resolve in activation and registration order", async (t) => {
  const orderingPlugin = definePlugin({
    manifest: {
      id: "fixture.ordering",
      name: "Ordering",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      requires: [{ pluginId: "fixture.plugin", version: "^1.0.0" }],
    },
    activate: (context) => {
      context.registerLifecycle({ id: "fixture.lifecycle-first", create: () => ({}) });
      context.registerLifecycle({ id: "fixture.lifecycle-second", create: () => ({}) });
      context.registerTarget({
        id: "fixture.ordering-target",
        displayName: "Ordering target",
        defaultArchitecture: "fixture.one-byte",
        architectures: ["fixture.one-byte"],
        addressSpace: "fixture.flat",
        outputFormat: "fixture.raw",
        directiveSets: ["fixture.directives"],
        expressionSets: ["fixture.expressions"],
        lifecycle: ["fixture.lifecycle-second", "fixture.lifecycle", "fixture.lifecycle-first"],
        defaultOutputExtension: ".bin",
      });
    },
  });
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: orderingPlugin }, { plugin: createFixturePlugin() }]);

  t.deepEqual(
    manager
      .freeze()
      .getTargetLifecycles("fixture.ordering-target")
      .map((item) => item.contributionId),
    ["fixture.lifecycle", "fixture.lifecycle-first", "fixture.lifecycle-second"],
  );
});
