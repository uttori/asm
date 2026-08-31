import { Assembler as CoreAssembler, PluginError } from "@uttori/asm-core";
import { test } from "../../../tests/ava-helper.js";
import {
  Assembler,
  snesTestEnvironment,
} from "../../../tests/test-assembler.js";
import { SNES_TARGET_ID } from "../src/index.js";

const pluginCause = (error: unknown): string =>
  error instanceof PluginError && error.cause instanceof Error ? error.cause.message : "";

test("snestopc and pctosnes reject non-numeric arguments", (t) => {
  const assembler = new Assembler();
  t.is(
    pluginCause(t.throws(() => assembler.mathCore.callFunction("snestopc", ["nope"]))),
    "snestopc() argument 1 must be numeric.",
  );
  t.is(
    pluginCause(t.throws(() => assembler.mathCore.callFunction("pctosnes", ["nope"]))),
    "pctosnes() argument 1 must be numeric.",
  );
});

test("canread / readN use the base image and require check title without a default", (t) => {
  const rom = new Uint8Array(16);
  rom[0] = 0x42;
  const assembler = new Assembler(rom);

  t.is(assembler.mathCore.callFunction("canread1", [0]), 1);
  t.is(assembler.mathCore.callFunction("canread", [0, 4]), 1);
  t.is(assembler.mathCore.callFunction("canread1", [100]), 0);

  t.true(
    pluginCause(t.throws(() => assembler.mathCore.callFunction("read1", [0x808000]))).includes(
      "Esnes_address_out_of_bounds",
    ),
  );
  t.is(assembler.mathCore.callFunction("read1", [0x808000, 99]), 0x42);

  assembler.processCommand("check title");
  t.is(assembler.mathCore.callFunction("read1", [0x808000]), 0x42);
});

test("plugin directive wrappers for .smart .setcpu startpos and prot run via dispatch", (t) => {
  const assembler = new Assembler();

  assembler.directiveRegistry.dispatch(".smart", [".smart", "off"], ".smart off");
  t.false(assembler.arch65816.smartMode);

  assembler.directiveRegistry.dispatch(".setcpu", [".setcpu", '"spc700"'], '.setcpu "spc700"');
  t.is(assembler.arch, "spc700");

  assembler.processCommand("spcblock $0200");
  assembler.directiveRegistry.dispatch("startpos", ["startpos", "$ABCD"], "startpos $ABCD");
  t.is(assembler.targetState.spcBlock?.executeAddress, 0xabcd);

  const protAssembler = new Assembler();
  protAssembler.activateStage("emitProgram");
  protAssembler.currentTargetAddress = 0x808000;
  protAssembler.currentTargetBaseAddress = 0x808000;
  protAssembler.directiveRegistry.dispatch("prot", ["prot", "forward"], "prot forward");
  t.deepEqual([...protAssembler.outputBytes.slice(0, 5)], [0x50, 0x52, 0x4f, 0x54, 0x03]);

  assembler.directiveRegistry.dispatch(
    "freespacebyte",
    ["freespacebyte", "$1A"],
    "freespacebyte $1A",
  );
  t.is(assembler.targetState.outputFillByte, 0x1a);
});

test("invalid checksumMode is rejected by target options", (t) => {
  t.is(
    t.throws(
      () =>
        new CoreAssembler({
          environment: snesTestEnvironment,
          target: SNES_TARGET_ID,
          targetOptions: { checksumMode: "broken" },
        }),
    ).message,
    "checksumMode must be 'asar' or 'simple'.",
  );
});

test("org arch and namespace are unavailable inside an spcblock", (t) => {
  const assembler = new Assembler();
  assembler.processCommand("spcblock $0200");

  t.is(
    pluginCause(t.throws(() => assembler.processCommand("org $8000"))),
    "ORG is unavailable inside spcblock.",
  );
  t.is(
    pluginCause(t.throws(() => assembler.processCommand("arch 65816"))),
    "ARCH is unavailable inside spcblock.",
  );
  t.is(
    pluginCause(t.throws(() => assembler.processCommand("namespace foo"))),
    "NAMESPACE is unavailable inside spcblock.",
  );
});
