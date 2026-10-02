import { test } from "../../../../tests/ava-helper.js";
import { createFixturePlugin } from "../../../../tests/plugin/fixture-plugin.js";
import { Assembler } from "../../src/assembler.js";
import { buildCompletionEntries } from "../../src/lsp/catalog.js";
import { WorkspaceIndex } from "../../src/lsp/workspace-index.js";
import { PluginManager, type SessionStateKey } from "../../src/plugin/index.js";

type FixtureState = { count: number; history: { values: number[] } };

function isFixtureState(value: unknown): value is FixtureState {
  return (
    typeof value === "object" &&
    value !== null &&
    "count" in value &&
    typeof value.count === "number" &&
    "history" in value &&
    typeof value.history === "object" &&
    value.history !== null &&
    "values" in value.history &&
    Array.isArray(value.history.values)
  );
}

function readFixtureState(value: unknown): FixtureState {
  if (!isFixtureState(value)) {
    throw new Error("Expected fixture session state.");
  }
  return value;
}

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
  const completionLabels = new Set(
    buildCompletionEntries(
      index.architecture,
      { getInstructionCatalog: (name) => index.toolingCatalog.getInstructions(name) },
      index.directiveCatalog,
      index.toolingCatalog.getExpressionFunctions(),
    ).map((entry) => entry.label),
  );
  t.true(completionLabels.has("fixturebyte"));
  t.true(completionLabels.has("fixturevalue"));
  t.true(completionLabels.has("fixture_value"));
  t.false(completionLabels.has("lorom"));
  t.false(completionLabels.has("snestopc"));

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

  const collect = readFixtureState(
    assembler.stageExecutionStates.get("collectDefinitions")?.pluginState.get(fixtureStateKey.id),
  );
  const layout = readFixtureState(
    assembler.stageExecutionStates.get("resolveLayout")?.pluginState.get(fixtureStateKey.id),
  );
  const emit = readFixtureState(
    assembler.stageExecutionStates.get("emitProgram")?.pluginState.get(fixtureStateKey.id),
  );

  t.deepEqual(collect.history.values, [1]);
  t.deepEqual(layout.history.values, [1, 1]);
  t.deepEqual(emit.history.values, [1, 1, 1]);
  t.not(collect.history, layout.history);
  t.not(layout.history, emit.history);

  assembler.dispose();
  await manager.dispose();
});
