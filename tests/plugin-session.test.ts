import { test } from "./ava-helper.js";

import { Assembler } from "../src/assembler.js";
import { PluginManager, type SessionStateKey } from "../src/plugin/index.js";
import { createFixturePlugin } from "./plugin/fixture-plugin.js";

type FixtureState = { count: number };

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
  const snapshot = assembler.pluginState.cloneSnapshot();
  state.count = 8;

  assembler.pluginState.restore(snapshot);
  t.is(assembler.pluginState.get(fixtureStateKey).count, 3);
  t.not(assembler.pluginState.get(fixtureStateKey), state);

  assembler.dispose();
  await manager.dispose();
});
