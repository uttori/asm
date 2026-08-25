import { test } from "./ava-helper.js";

import { Assembler, PluginManager } from "@uttori/asm-core";
import mos6502StubPlugin, { MOS6502_STUB_TARGET_ID } from "@uttori/asm-plugin-6502-stub";
import snesPlugin, {
  createSnesAssemblerEnvironment,
  SNES_TARGET_ID,
  snesSessionStateKey,
} from "@uttori/asm-plugin-snes";

import { createFixturePlugin } from "./plugin/fixture-plugin.js";

test("SNES behavior appears only after explicit plugin activation", async (t) => {
  const fixtureManager = new PluginManager();
  await fixtureManager.activatePlugins([{ plugin: createFixturePlugin() }]);
  const neutral = new Assembler({ environment: fixtureManager.freeze(), target: "fixture" });
  t.false(neutral.directiveRegistry.has("lorom"));
  t.false(neutral.directiveRegistry.has("spcblock"));
  t.deepEqual(neutral.environment.getToolingCatalog(neutral.targetId).getInstructions("65816"), []);
  t.throws(() => neutral.mathCore.math("snestopc($808000)"), {
    message: /unknown built-in function 'snestopc'/i,
  });

  const snes = new Assembler({
    environment: await createSnesAssemblerEnvironment(),
    target: SNES_TARGET_ID,
  });
  t.is(snes.targetId, SNES_TARGET_ID);
  t.is(snes.pluginState.get(snesSessionStateKey).mapper, "lorom");
  t.true(snes.directiveRegistry.has("lorom"));
  t.true(snes.directiveRegistry.has("spcblock"));
  t.true(snes.directiveRegistry.has("freespace"));
  t.is(snes.mathCore.math("snestopc($808000)"), 0);
  t.truthy(snes.architectureRegistry.getDefinition("65816"));
  t.true(
    snes.environment
      .getToolingCatalog(snes.targetId)
      .getExpressionFunctions()
      .some((expressionFunction) => expressionFunction.name === "snestopc"),
  );

  neutral.dispose();
  snes.dispose();
  await fixtureManager.dispose();
});

test("SNES package has a valid default plugin export", async (t) => {
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: snesPlugin }]);
  t.true(manager.activatedPlugins.some((manifest) => manifest.id === "uttori.asm-plugin-snes"));
  t.is(manager.freeze().resolveTargetId("sfc"), SNES_TARGET_ID);
  await manager.dispose();
});

test("6502 stub is isolated and fails with a clear not-implemented diagnostic", async (t) => {
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: mos6502StubPlugin }]);
  const assembler = new Assembler({
    environment: manager.freeze(),
    target: MOS6502_STUB_TARGET_ID,
  });

  t.truthy(assembler.architectureRegistry.getDefinition("mos6502"));
  t.deepEqual(assembler.architectureRegistry.getInstructionCatalog("6502"), []);
  t.false(assembler.directiveRegistry.has("lorom"));
  t.false(assembler.directiveRegistry.has("spcblock"));
  t.throws(() => assembler.assembleSource("org $8000\nnop", "stub.asm"), {
    message: /6502 encoding is not implemented/i,
  });
  t.throws(() => assembler.mathCore.math("snestopc($8000)"), {
    message: /unknown built-in function 'snestopc'/i,
  });

  assembler.dispose();
  await manager.dispose();
});
