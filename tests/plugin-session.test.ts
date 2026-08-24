import { test } from "./ava-helper.js";

import { Assembler } from "../packages/core/src/assembler.js";
import { PluginManager, type SessionStateKey } from "../packages/core/src/plugin/index.js";
import { buildCompletionEntries } from "../packages/core/src/lsp/catalog.js";
import { WorkspaceIndex } from "../packages/core/src/lsp/workspace-index.js";
import { createFixturePlugin } from "./plugin/fixture-plugin.js";

type FixtureState = { count: number; history: { values: number[] } };

const fixtureStateKey = { id: "fixture.state" } as SessionStateKey<FixtureState>;

test("environment-driven fixture sessions emit bytes with isolated factories and state", async (t) => {
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: createFixturePlugin(), options: { byte: 0x7f } }]);
  const environment = manager.freeze();
  const assembler = new Assembler({ environment, target: "fixture" });
  const tooling = assembler.createToolingSession();

  t.is(assembler.environment, tooling.environment);
  t.not(
    assembler.architectureRegistry.getDefinition("fixture-cpu")?.encoder,
    tooling.architectureRegistry.getDefinition("fixture-cpu")?.encoder,
  );
  t.not(assembler.pluginState.get(fixtureStateKey), tooling.pluginState.get(fixtureStateKey));

  assembler.pluginState.get(fixtureStateKey).count = 9;
  t.is(tooling.pluginState.get(fixtureStateKey).count, 0);
  assembler.activateStage("resolveLayout");
  t.is(assembler.pluginState.get(fixtureStateKey).count, 0);

  assembler.directiveRegistry.dispatch("fixturebyte", ["fixturebyte"], "fixturebyte");
  tooling.directiveRegistry.dispatch("fixturebyte", ["fixturebyte"], "fixturebyte");
  t.is(assembler.pluginState.get(fixtureStateKey).count, 1);
  t.is(tooling.pluginState.get(fixtureStateKey).count, 1);
  t.is(assembler.mathCore.math("fixturevalue()"), 0x7f);
  t.is(tooling.mathCore.math("fixture_value()"), 0x7f);
  t.true(assembler.directiveRegistry.has("include"));
  t.false(assembler.directiveRegistry.has("lorom"));
  t.false(assembler.shouldEndifCloseInnermostWhile("while", 3, 1));
  t.throws(() => assembler.mathCore.math("snestopc($808000)"), {
    message: /unknown built-in function 'snestopc'/i,
  });

  const index = new WorkspaceIndex({ environment, target: "fixture" });
  const completionLabels = buildCompletionEntries(
    index.architecture,
    { getInstructionCatalog: (name) => index.toolingCatalog.getInstructions(name) },
    index.directiveCatalog,
    index.toolingCatalog.getExpressionFunctions(),
  ).map((entry) => entry.label);
  t.true(completionLabels.includes("fixturebyte"));
  t.true(completionLabels.includes("fixturevalue"));
  t.true(completionLabels.includes("fixture_value"));
  t.false(completionLabels.includes("lorom"));
  t.false(completionLabels.includes("snestopc"));

  assembler.assembleSource("org $0000\nfix", "fixture.asm");
  t.deepEqual([...assembler.getBinaryOutput()], [0x7f]);

  tooling.dispose();
  assembler.dispose();
  await manager.dispose();
});

test("plugin state snapshots clone and restore independently", async (t) => {
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: createFixturePlugin() }]);
  const assembler = new Assembler({ environment: manager.freeze(), target: "fixture" });
  const state = assembler.pluginState.get(fixtureStateKey);
  state.count = 3;
  state.history.values.push(1);
  const snapshot = assembler.pluginState.cloneSnapshot();
  state.count = 8;
  state.history.values.push(2);

  assembler.pluginState.restore(snapshot);
  t.is(assembler.pluginState.get(fixtureStateKey).count, 3);
  t.deepEqual(assembler.pluginState.get(fixtureStateKey).history.values, [1]);
  t.not(assembler.pluginState.get(fixtureStateKey), state);
  t.not(assembler.pluginState.get(fixtureStateKey).history, state.history);

  assembler.dispose();
  await manager.dispose();
});

test("stage snapshots preserve and independently clone nontrivial plugin state", async (t) => {
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: createFixturePlugin() }]);
  const assembler = new Assembler({ environment: manager.freeze(), target: "fixture" });
  const program = assembler.buildProgramModel("fixturebyte", "fixture.asm");

  assembler.assembleProgram(program);

  const collect = assembler.stageExecutionStates.get("collectDefinitions")?.pluginState.get(
    fixtureStateKey.id,
  ) as FixtureState;
  const layout = assembler.stageExecutionStates.get("resolveLayout")?.pluginState.get(
    fixtureStateKey.id,
  ) as FixtureState;
  const emit = assembler.stageExecutionStates.get("emitProgram")?.pluginState.get(
    fixtureStateKey.id,
  ) as FixtureState;

  t.deepEqual(collect.history.values, [1]);
  t.deepEqual(layout.history.values, [1, 1]);
  t.deepEqual(emit.history.values, [1, 1, 1]);
  t.not(collect.history, layout.history);
  t.not(layout.history, emit.history);

  assembler.dispose();
  await manager.dispose();
});
