import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";

import {
  handleA8,
  handleA16,
  handleAccu,
  handleI8,
  handleI16,
  handleIndex,
  handleSmart,
  handleSetcpu,
  handlePushcpu,
  handlePopcpu,
  resolveSnesCpuName,
} from "../../src/directives/ca65-compat.js";
import { Arch65816 } from "../../src/architectures/65816.js";

// ---------------------------------------------------------------------------
// Arch65816 width-state methods (unit tests, no session needed)
// ---------------------------------------------------------------------------

test("Arch65816 exposes setAccumulatorWidth and setIndexWidth", (t) => {
  const assembler = new Assembler();
  const arch = assembler.arch65816;

  t.false(arch.m16, "m16 starts false");
  arch.setAccumulatorWidth(true);
  t.true(arch.m16, "setAccumulatorWidth(true) sets m16");
  arch.setAccumulatorWidth(false);
  t.false(arch.m16, "setAccumulatorWidth(false) clears m16");

  t.false(arch.x16, "x16 starts false");
  arch.setIndexWidth(true);
  t.true(arch.x16, "setIndexWidth(true) sets x16");
  arch.setIndexWidth(false);
  t.false(arch.x16, "setIndexWidth(false) clears x16");
});

test("Arch65816 smart mode is on by default and controls SEP/REP tracking", (t) => {
  const assembler = new Assembler();
  const arch = assembler.arch65816;

  t.true(arch.smartMode, "smartMode starts true");

  // Smart mode on: SEP #$30 should set both 8-bit
  arch.m16 = true;
  arch.x16 = true;
  arch.applySepRep("SEP", "#$30");
  t.false(arch.m16, "SEP #$30 clears m16 when smartMode is on");
  t.false(arch.x16, "SEP #$30 clears x16 when smartMode is on");

  // Smart mode off: SEP/REP should be no-op
  arch.setSmartMode(false);
  arch.m16 = false;
  arch.x16 = false;
  arch.applySepRep("REP", "#$30");
  t.false(arch.m16, "REP #$30 does not set m16 when smartMode is off");
  t.false(arch.x16, "REP #$30 does not set x16 when smartMode is off");

  // Smart mode back on: REP should track again
  arch.setSmartMode(true);
  arch.applySepRep("REP", "#$30");
  t.true(arch.m16, "REP #$30 sets m16 after smartMode re-enabled");
  t.true(arch.x16, "REP #$30 sets x16 after smartMode re-enabled");
});

// ---------------------------------------------------------------------------
// Accumulator width directive handlers
// ---------------------------------------------------------------------------

test(".a8 / .a16 set accumulator width via handler", (t) => {
  const assembler = new Assembler();
  const arch = assembler.arch65816;

  arch.m16 = true;
  handleA8(assembler);
  t.false(arch.m16, "handleA8 clears m16");

  handleA16(assembler);
  t.true(arch.m16, "handleA16 sets m16");
});

test(".accu 8|16 works as alias for .a8/.a16", (t) => {
  const assembler = new Assembler();
  const arch = assembler.arch65816;

  handleAccu(assembler, [".accu", "16"]);
  t.true(arch.m16, ".accu 16 sets m16");

  handleAccu(assembler, [".accu", "8"]);
  t.false(arch.m16, ".accu 8 clears m16");
});

test(".accu rejects invalid arguments", (t) => {
  const assembler = new Assembler();
  t.throws(() => handleAccu(assembler, [".accu"]), { message: /requires an argument/ });
  t.throws(() => handleAccu(assembler, [".accu", "32"]), { message: /requires an argument/ });
});

// ---------------------------------------------------------------------------
// Index width directive handlers
// ---------------------------------------------------------------------------

test(".i8 / .i16 set index width via handler", (t) => {
  const assembler = new Assembler();
  const arch = assembler.arch65816;

  arch.x16 = true;
  handleI8(assembler);
  t.false(arch.x16, "handleI8 clears x16");

  handleI16(assembler);
  t.true(arch.x16, "handleI16 sets x16");
});

test(".index 8|16 works as alias for .i8/.i16", (t) => {
  const assembler = new Assembler();
  const arch = assembler.arch65816;

  handleIndex(assembler, [".index", "16"]);
  t.true(arch.x16, ".index 16 sets x16");

  handleIndex(assembler, [".index", "8"]);
  t.false(arch.x16, ".index 8 clears x16");
});

test(".index rejects invalid arguments", (t) => {
  const assembler = new Assembler();
  t.throws(() => handleIndex(assembler, [".index"]), { message: /requires an argument/ });
  t.throws(() => handleIndex(assembler, [".index", "32"]), { message: /requires an argument/ });
});

// ---------------------------------------------------------------------------
// Smart mode directive handler
// ---------------------------------------------------------------------------

test(".smart enables/disables SEP/REP auto-tracking", (t) => {
  const assembler = new Assembler();
  const arch = assembler.arch65816;

  t.true(arch.smartMode, "smartMode starts true");

  handleSmart(assembler, [".smart", "off"]);
  t.false(arch.smartMode, ".smart off disables tracking");

  handleSmart(assembler, [".smart", "on"]);
  t.true(arch.smartMode, ".smart on re-enables tracking");

  // Without argument defaults to on
  arch.setSmartMode(false);
  handleSmart(assembler, [".smart"]);
  t.true(arch.smartMode, ".smart with no argument re-enables tracking");
});

// ---------------------------------------------------------------------------
// Width state directives wired into the directive registry
// ---------------------------------------------------------------------------

test("ca65 width directives are registered in the SNES assembler", (t) => {
  const assembler = new Assembler();
  for (const kw of [".a8", ".a16", ".i8", ".i16", ".accu", ".index", ".smart", ".setcpu", ".pushcpu", ".popcpu"]) {
    t.true(assembler.directiveRegistry.has(kw), `${kw} is registered`);
  }
});

test("ca65 width directives work end-to-end via directiveRegistry.dispatch", (t) => {
  const assembler = new Assembler();
  const arch = assembler.arch65816;

  assembler.directiveRegistry.dispatch(".a16", [".a16"], ".a16");
  t.true(arch.m16, ".a16 via dispatch sets m16");

  assembler.directiveRegistry.dispatch(".i16", [".i16"], ".i16");
  t.true(arch.x16, ".i16 via dispatch sets x16");

  assembler.directiveRegistry.dispatch(".a8", [".a8"], ".a8");
  t.false(arch.m16, ".a8 via dispatch clears m16");

  assembler.directiveRegistry.dispatch(".i8", [".i8"], ".i8");
  t.false(arch.x16, ".i8 via dispatch clears x16");

  assembler.directiveRegistry.dispatch(".accu", [".accu", "16"], ".accu 16");
  t.true(arch.m16, ".accu 16 via dispatch sets m16");

  assembler.directiveRegistry.dispatch(".index", [".index", "16"], ".index 16");
  t.true(arch.x16, ".index 16 via dispatch sets x16");
});

// ---------------------------------------------------------------------------
// .setcpu name resolution
// ---------------------------------------------------------------------------

test("resolveSnesCpuName maps ca65 CPU names to SNES architecture ids", (t) => {
  t.is(resolveSnesCpuName("65816"), "snes.65816");
  t.is(resolveSnesCpuName("65C816"), "snes.65816");
  t.is(resolveSnesCpuName("65c816"), "snes.65816");
  t.is(resolveSnesCpuName("65802"), "snes.65816");
  t.is(resolveSnesCpuName("spc700"), "snes.spc700");
  t.is(resolveSnesCpuName("superfx"), "snes.superfx");
  t.is(resolveSnesCpuName("6502"), undefined, "non-SNES CPU returns undefined");
  t.is(resolveSnesCpuName("huc6280"), undefined, "non-SNES CPU returns undefined");
});

test(".setcpu switches to the named SNES architecture", (t) => {
  const assembler = new Assembler();
  t.is(assembler.arch, "65816", "starts on 65816");

  handleSetcpu(assembler, [".setcpu", '"spc700"']);
  t.is(assembler.arch, "spc700", ".setcpu spc700 switches to spc700");

  handleSetcpu(assembler, [".setcpu", '"65816"']);
  t.is(assembler.arch, "65816", ".setcpu 65816 switches back to 65816");

  // 65802 and 65C816 are aliases for the same snes.65816 architecture
  handleSetcpu(assembler, [".setcpu", '"65802"']);
  t.is(assembler.arch, "65816", ".setcpu 65802 resolves to 65816 arch");

  handleSetcpu(assembler, [".setcpu", '"65C816"']);
  t.is(assembler.arch, "65816", ".setcpu 65C816 resolves to 65816 arch");
});

test(".setcpu rejects unknown or non-SNES CPUs", (t) => {
  const assembler = new Assembler();
  t.throws(() => handleSetcpu(assembler, [".setcpu", '"6502"']), {
    message: /not available on the SNES target/,
  });
  t.throws(() => handleSetcpu(assembler, [".setcpu"]), {
    message: /requires a CPU name/,
  });
});

// ---------------------------------------------------------------------------
// Architecture aliases (arch 65C816, arch 65802)
// ---------------------------------------------------------------------------

test("snes.65816 is accessible via 65C816 and 65802 aliases", (t) => {
  const assembler = new Assembler();
  // selectArchitecture in test-assembler resolves via architectureRegistry
  assembler.selectArchitecture("65c816");
  t.is(assembler.arch, "65816", "65c816 alias resolves to 65816 arch");
  t.truthy(assembler.arch65816 instanceof Arch65816, "encoder is still Arch65816");

  assembler.selectArchitecture("65802");
  t.is(assembler.arch, "65816", "65802 alias resolves to 65816 arch");
});

// ---------------------------------------------------------------------------
// .pushcpu / .popcpu
// ---------------------------------------------------------------------------

test(".pushcpu saves and .popcpu restores the active architecture", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;

  t.is(assembler.arch, "65816");
  t.deepEqual(state.cpuStack, []);

  handlePushcpu(assembler, state);
  t.is(state.cpuStack.length, 1, ".pushcpu pushed one entry");

  assembler.selectArchitecture("snes.spc700");
  t.is(assembler.arch, "spc700");

  handlePopcpu(assembler, state);
  t.deepEqual(state.cpuStack, [], ".popcpu emptied the stack");
  t.is(assembler.arch, "65816", ".popcpu restored the original architecture");
});

test(".pushcpu / .popcpu support nested saves", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;

  handlePushcpu(assembler, state);              // save 65816
  assembler.selectArchitecture("snes.spc700");
  handlePushcpu(assembler, state);              // save spc700
  assembler.selectArchitecture("snes.superfx");

  handlePopcpu(assembler, state);
  t.is(assembler.arch, "spc700", "first .popcpu restores spc700");

  handlePopcpu(assembler, state);
  t.is(assembler.arch, "65816", "second .popcpu restores 65816");
  t.deepEqual(state.cpuStack, []);
});

test(".popcpu on an empty stack throws", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;
  t.throws(() => handlePopcpu(assembler, state), { message: /CPU stack is empty/ });
});

test(".pushcpu / .popcpu wired in the directive registry", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;

  assembler.directiveRegistry.dispatch(".pushcpu", [".pushcpu"], ".pushcpu");
  t.is(state.cpuStack.length, 1, ".pushcpu via dispatch pushes the current arch");

  assembler.selectArchitecture("snes.spc700");
  assembler.directiveRegistry.dispatch(".popcpu", [".popcpu"], ".popcpu");
  t.is(assembler.arch, "65816", ".popcpu via dispatch restores the arch");
});
