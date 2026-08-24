import { test } from "../ava-helper.js";
import {
  handleFill,
  handleFillPattern,
  handlePad,
  handlePadPattern,
  registerFillPadDirectives,
} from "../../src/directives/fill-pad.js";
import type { FillPadDirectiveContext } from "../../src/directives/types.js";
import { DirectiveRegistry } from "../../src/directives/registry.js";
import { createOperandResolver, runtimeStub } from "./test-stubs.js";

type FillPadSessionOverrides = {
  currentTargetAddress?: number;
  toOutputOffset?: (address: number) => number;
  resolvedefines?: (input: string) => string;
};

const createContext = (overrides: FillPadSessionOverrides = {}) => {
  const written: number[] = [];
  const session = {
    fillbyte: new Array<number>(12).fill(0),
    padbyte: new Array<number>(4).fill(0),
    padUnit: 1,
    currentTargetAddress: overrides.currentTargetAddress ?? 0x808000,
    outputWriter: {
      toOutputOffset:
        overrides.toOutputOffset ?? ((address: number) => address - 0x808000),
    },
    resolvedefines: overrides.resolvedefines ?? ((input: string) => input),
    write1: (value: number) => written.push(value),
  };
  return {
    ctx: {
      session,
      operandResolver: createOperandResolver(() => session.currentTargetAddress),
      runtime: runtimeStub,
    } as FillPadDirectiveContext,
    session,
    written,
  };
};

test("fillbyte tiles a single byte across the 12-byte fill pattern", (t) => {
  const { ctx, session } = createContext();
  handleFillPattern(ctx, ["fillbyte", "$AA"]);
  t.deepEqual(session.fillbyte, Array(12).fill(0xaa));
});

test("fillword tiles a little-endian word across the 12-byte fill pattern", (t) => {
  const { ctx, session } = createContext();
  handleFillPattern(ctx, ["fillword", "$1234"]);
  t.deepEqual(
    session.fillbyte,
    [0x34, 0x12, 0x34, 0x12, 0x34, 0x12, 0x34, 0x12, 0x34, 0x12, 0x34, 0x12],
  );
});

test("filllong tiles a little-endian long across the 12-byte fill pattern", (t) => {
  const { ctx, session } = createContext();
  handleFillPattern(ctx, ["filllong", "$123456"]);
  t.deepEqual(
    session.fillbyte,
    [0x56, 0x34, 0x12, 0x56, 0x34, 0x12, 0x56, 0x34, 0x12, 0x56, 0x34, 0x12],
  );
});

test("filldword tiles a little-endian dword across the 12-byte fill pattern", (t) => {
  const { ctx, session } = createContext();
  handleFillPattern(ctx, ["filldword", "$12345678"]);
  t.deepEqual(
    session.fillbyte,
    [0x78, 0x56, 0x34, 0x12, 0x78, 0x56, 0x34, 0x12, 0x78, 0x56, 0x34, 0x12],
  );
});

test("fill emits a wrapping multi-byte pattern", (t) => {
  const { ctx, written } = createContext();
  handleFillPattern(ctx, ["fillword", "$1234"]);
  handleFill(ctx, ["fill", "5"]);

  t.deepEqual(written, [0x34, 0x12, 0x34, 0x12, 0x34]);
});

test("fill of zero bytes is a no-op", (t) => {
  const { ctx, written } = createContext();
  handleFillPattern(ctx, ["fillbyte", "$FF"]);
  handleFill(ctx, ["fill", "0"]);
  t.deepEqual(written, []);
});

test("fill pattern and fill resolve defines before evaluating", (t) => {
  const { ctx, written } = createContext({
    resolvedefines: (input) => {
      if (input === "!pat") return "$AABB";
      if (input === "!count") return "3";
      return input;
    },
  });
  handleFillPattern(ctx, ["fillword", "!pat"]);
  handleFill(ctx, ["fill", "!count"]);
  t.deepEqual(written, [0xbb, 0xaa, 0xbb]);
});

test("fill pattern rejects unknown keywords and wrong arity", (t) => {
  const { ctx } = createContext();
  t.is(
    t.throws(() => handleFillPattern(ctx, ["fillfoo", "$00"])).message,
    "Unrecognized fill directive.",
  );
  t.is(
    t.throws(() => handleFillPattern(ctx, ["padbyte", "$00"])).message,
    "Unrecognized fill directive.",
  );
  t.is(
    t.throws(() => handleFillPattern(ctx, ["fillword"])).message,
    "FILLWORD directive requires exactly one parameter.",
  );
  t.is(
    t.throws(() => handleFillPattern(ctx, ["fillword", "$00", "$01"])).message,
    "FILLWORD directive requires exactly one parameter.",
  );
});

test("fill rejects missing and extra operands", (t) => {
  const { ctx } = createContext();
  t.is(
    t.throws(() => handleFill(ctx, ["fill"])).message,
    "FILL directive requires exactly one parameter (number of bytes to fill).",
  );
  t.is(
    t.throws(() => handleFill(ctx, ["fill", "1", "2"])).message,
    "FILL directive requires exactly one parameter (number of bytes to fill).",
  );
});

test("pad pattern handlers store the unit and little-endian bytes", (t) => {
  const { ctx, session } = createContext();

  handlePadPattern(ctx, ["padbyte", "$EE"]);
  t.is(session.padUnit, 1);
  t.is(session.padbyte[0], 0xee);

  handlePadPattern(ctx, ["padword", "$BBAA"]);
  t.is(session.padUnit, 2);
  t.deepEqual(session.padbyte.slice(0, 2), [0xaa, 0xbb]);

  handlePadPattern(ctx, ["padlong", "$123456"]);
  t.is(session.padUnit, 3);
  t.deepEqual(session.padbyte.slice(0, 3), [0x56, 0x34, 0x12]);

  handlePadPattern(ctx, ["paddword", "$89ABCDEF"]);
  t.is(session.padUnit, 4);
  t.deepEqual(session.padbyte, [0xef, 0xcd, 0xab, 0x89]);
});

test("pad emits through an explicit target address", (t) => {
  const { ctx, session, written } = createContext();
  handlePadPattern(ctx, ["padword", "$BBAA"]);
  handlePad(ctx, ["pad", "$808004"]);

  t.is(session.padUnit, 2);
  t.deepEqual(written, [0xaa, 0xbb, 0xaa, 0xbb]);
});

test("pad to the current or an earlier mapped address is a no-op", (t) => {
  const { ctx, written } = createContext({
    toOutputOffset: (address) => address,
  });
  handlePadPattern(ctx, ["padbyte", "$42"]);
  handlePad(ctx, ["pad", "$808000"]);
  handlePad(ctx, ["pad", "$800000"]);
  t.deepEqual(written, []);
});

test("pad rejects an unmapped target address", (t) => {
  const { ctx } = createContext({
    toOutputOffset: () => -1,
  });
  t.is(
    t.throws(() => handlePad(ctx, ["pad", "$808010"])).message,
    "Target SNES address 808010 does not map to ROM.",
  );
});

test("pad without an address fills the rest of the 64K bank", (t) => {
  const { ctx, written } = createContext({ currentTargetAddress: 0x80fffe });
  handlePadPattern(ctx, ["padbyte", "$00"]);
  handlePad(ctx, ["pad"]);
  t.deepEqual(written, [0x00, 0x00]);
});

test("pad without an address writes one byte at the last bank offset", (t) => {
  const { ctx, written } = createContext({ currentTargetAddress: 0x80ffff });
  handlePadPattern(ctx, ["padbyte", "$7F"]);
  handlePad(ctx, ["pad"]);
  t.deepEqual(written, [0x7f]);
});

test("pad without an address wraps a multi-byte pattern through mid-bank", (t) => {
  const { ctx, written } = createContext({ currentTargetAddress: 0x808000 });
  handlePadPattern(ctx, ["padword", "$BBAA"]);
  handlePad(ctx, ["pad"]);
  t.is(written.length, 0x8000);
  t.deepEqual(written.slice(0, 4), [0xaa, 0xbb, 0xaa, 0xbb]);
  t.deepEqual(written.slice(-2), [0xaa, 0xbb]);
});

test("pad without an address writes a full bank from a bank-aligned address", (t) => {
  const { ctx, written } = createContext({ currentTargetAddress: 0x810000 });
  handlePadPattern(ctx, ["padbyte", "$00"]);
  handlePad(ctx, ["pad"]);
  t.is(written.length, 0x10000);
});

test("pad resolves defines on the target address", (t) => {
  const { ctx, written } = createContext({
    resolvedefines: (input) => (input === "!end" ? "$808002" : input),
  });
  handlePadPattern(ctx, ["padbyte", "$11"]);
  handlePad(ctx, ["pad", "!end"]);
  t.deepEqual(written, [0x11, 0x11]);
});

test("pad pattern rejects unknown keywords and wrong arity", (t) => {
  const { ctx } = createContext();
  t.is(
    t.throws(() => handlePadPattern(ctx, ["padfoo", "$00"])).message,
    "Unrecognized pad directive.",
  );
  t.is(
    t.throws(() => handlePadPattern(ctx, ["fillbyte", "$00"])).message,
    "Unrecognized pad directive.",
  );
  t.is(
    t.throws(() => handlePadPattern(ctx, ["padlong"])).message,
    "PADLONG directive requires exactly one parameter.",
  );
});

test("pad rejects more than one parameter", (t) => {
  const { ctx } = createContext();
  t.is(
    t.throws(() => handlePad(ctx, ["pad", "$808010", "$808020"])).message,
    "PAD directive accepts zero or one parameter.",
  );
});

test("fill and pad directive registration exposes all aliases", (t) => {
  const registry = new DirectiveRegistry();
  const { ctx } = createContext();
  registerFillPadDirectives(registry, ctx);

  for (const directive of [
    "fillbyte",
    "fillword",
    "filllong",
    "filldword",
    "fill",
    "padbyte",
    "padword",
    "padlong",
    "paddword",
    "pad",
  ]) {
    t.true(registry.has(directive));
  }
});
