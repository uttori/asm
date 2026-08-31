import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";

import {
  handleCheck,
  handleMapper,
  handleOptimize,
  handleStartpos,
} from "../../src/directives/layout.js";

test("SNES mapper and policy handlers mutate plugin-owned session state", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;

  handleMapper(state, ["norom"]);
  t.is(state.mapper, "norom");
  t.false(state.checksumEnabled);

  handleMapper(state, ["lorom"]);
  handleCheck(state, ["check", "bankcross", "half"]);
  handleOptimize(state, ["optimize", "dp", "always"]);
  t.is(state.mapper, "lorom");
  t.is(state.bankCrossMode, "half");
  t.true(state.optimizeDirectPage);
});

test("SNES mapper handlers apply sa1rom bank slots and reject invalid specs", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;

  handleMapper(state, ["fullsa1rom"]);
  t.is(state.mapper, "bigsa1rom");

  handleMapper(state, ["sa1rom"]);
  t.is(state.mapper, "sa1rom");
  t.deepEqual(state.sa1Banks, [
    0 << 20,
    1 << 20,
    undefined,
    undefined,
    2 << 20,
    3 << 20,
  ]);

  handleMapper(state, ["sa1rom", "4,5,6,7"]);
  t.deepEqual(state.sa1Banks, [
    4 << 20,
    5 << 20,
    undefined,
    undefined,
    6 << 20,
    7 << 20,
  ]);

  t.is(
    t.throws(() => handleMapper(state, ["sa1rom", "0,1,2"])).message,
    "Invalid SA1ROM mapper specification. Expected 4 comma-separated values.",
  );

  state.inSpcBlock = true;
  t.is(
    t.throws(() => handleMapper(state, ["lorom"])).message,
    "Mapper directives are unavailable inside spcblock.",
  );
});

test("SNES check and optimize handlers cover remaining policy branches", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;

  handleCheck(state, ["check", "title"]);
  t.true(state.readFunctionsEnabled);

  handleCheck(state, ["check", "bankcross", "off"]);
  t.is(state.bankCrossMode, "off");
  handleCheck(state, ["check", "bankcross", "full"]);
  t.is(state.bankCrossMode, "full");
  handleCheck(state, ["check", "bankcross", "on"]);
  t.is(state.bankCrossMode, "full");

  t.is(
    t.throws(() => handleCheck(state, ["check"])).message,
    "Invalid CHECK command. Expected: check bankcross <on|off|half|full>",
  );
  t.is(
    t.throws(() => handleCheck(state, ["check", "bankcross"])).message,
    "Invalid CHECK command. Expected: check bankcross <on|off|half|full>",
  );
  t.is(
    t.throws(() => handleCheck(state, ["check", "foo", "on"])).message,
    "Invalid CHECK command. Expected: check bankcross <on|off|half|full>",
  );
  t.is(
    t.throws(() => handleCheck(state, ["check", "bankcross", "maybe"])).message,
    "Invalid parameter for check bankcross: maybe",
  );

  handleOptimize(state, ["optimize", "dp", "none"]);
  t.false(state.optimizeDirectPage);
  handleOptimize(state, ["optimize", "dp", "ram"]);
  t.true(state.optimizeDirectPage);
  handleOptimize(state, ["optimize"]);
  handleOptimize(state, ["optimize", "dp"]);
  handleOptimize(state, ["optimize", "code", "none"]);
  handleOptimize(state, ["optimize", "dp", "bogus"]);
  t.true(state.optimizeDirectPage);
});

test("SNES startpos records execute address only inside an spcblock", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;

  t.is(
    t.throws(() => handleStartpos(assembler, state, ["startpos", "$0200"])).message,
    "startpos used without an active spcblock.",
  );

  state.inSpcBlock = true;
  t.is(
    t.throws(() => handleStartpos(assembler, state, ["startpos", "$0200"])).message,
    "startpos used without an active spcblock.",
  );

  state.spcBlock = {
    destination: 0x200,
    type: "nspc",
    sizeAddress: 0,
    executeAddress: null,
    namespaceBackup: "",
  };
  t.is(
    t.throws(() => handleStartpos(assembler, state, ["startpos"])).message,
    "startpos requires exactly one parameter.",
  );
  t.is(
    t.throws(() => handleStartpos(assembler, state, ["startpos", "$0200", "extra"])).message,
    "startpos requires exactly one parameter.",
  );

  handleStartpos(assembler, state, ["startpos", "$ABCD"]);
  t.is(state.spcBlock.executeAddress, 0xabcd);
});

test("SNES plugin registers mapper and compatibility directives", (t) => {
  const assembler = new Assembler();
  for (const keyword of ["lorom", "hirom", "norom", "check", "optimize", "startpos", "warn"]) {
    t.true(assembler.directiveRegistry.has(keyword));
  }
});
