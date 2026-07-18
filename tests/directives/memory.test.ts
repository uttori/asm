import { test } from "../ava-helper.js";
import {
  handleFreespaceByte,
  handleFreespace,
  handleProt,
  registerMemoryDirectives,
} from "../../src/directives/memory.js";
import type { MemoryDirectiveContext } from "../../src/directives/types.js";
import { DirectiveRegistry } from "../../src/directives/registry.js";
import { createOperandResolver, runtimeStub } from "./test-stubs.js";

test("freespacebyte only requires expression and ROM fill state", t => {
  const session = {
    defaultFreespaceByte: 0,
    resolvedefines: (input: string) => input,
  };
  const ctx = {
    session,
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  } as MemoryDirectiveContext;

  handleFreespaceByte(ctx, ["freespacebyte", "$A5"]);
  t.is(session.defaultFreespaceByte, 0xA5);
});

test("freespace compatibility policy rejects norom before emission", t => {
  const ctx = {
    session: {
      inSpcblock: false,
      mapper: "norom",
    },
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  } as MemoryDirectiveContext;

  const error = t.throws(() => handleFreespace(ctx, ["freespace"]));
  t.is(error.message, "No freespace available in norom.");
});

test("freespace rejects SPC blocks and unmappable allocation starts", t => {
  const ctx = {
    session: {
      inSpcblock: true,
      mapper: "lorom",
    },
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  } as MemoryDirectiveContext;

  t.is(
    t.throws(() => handleFreespace(ctx, ["freecode"])).message,
    "freecode is unavailable inside spcblock.",
  );

  const unmappable = createMemoryContext({ pctosnes: () => -1 });
  t.is(
    t.throws(() => handleFreespace(unmappable.ctx, ["freespace"])).message,
    "Unable to map freespace start to SNES address.",
  );
});

test("freespace expands short ROMs and emits a placeholder RATS tag", t => {
  const { ctx, session, bytes, expansions } = createMemoryContext();

  handleFreespace(ctx, ["freedata"]);

  t.deepEqual(expansions, [[0x100000, 0xA5]]);
  t.deepEqual(bytes, [0x53, 0x54, 0x41, 0x52, 0x00, 0x00, 0xFF, 0xFF]);
  t.is(session.activeFreespaceStartPc, 0x90000);
  t.is(session.activeFreespaceContentStartPc, 0x90008);
  t.is(session.currentTargetAddress, 0x908000);
  t.is(session.currentTargetBaseAddress, 0x908000);
  t.is(session.currentTargetStartAddress, 0x908000);
  t.is(session.currentTargetBaseStartAddress, 0x908000);
});

test("freespace uses ROM data length without expanding an existing large ROM", t => {
  const { ctx, session, expansions } = createMemoryContext({
    targetRom: new Uint8Array(),
    romdata: new Uint8Array(0x110000),
  });

  handleFreespace(ctx, ["freespace"]);

  t.deepEqual(expansions, []);
  t.is(session.activeFreespaceStartPc, 0x110000);
});

test("freespacebyte validates arity and masks resolved values", t => {
  const session = {
    defaultFreespaceByte: 0,
    resolvedefines: (input: string) => input === "!fill" ? "$1A5" : input,
  };
  const ctx = {
    session,
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  } as MemoryDirectiveContext;

  t.throws(() => handleFreespaceByte(ctx, ["freespacebyte"]));
  t.throws(() => handleFreespaceByte(ctx, ["freespacebyte", "$00", "$01"]));
  handleFreespaceByte(ctx, ["freespacebyte", "!fill"]);
  t.is(session.defaultFreespaceByte, 0xA5);
});

test("prot validates labels and emits resolved and deferred addresses", t => {
  const bytes: number[] = [];
  const ctx = {
    session: {
      write1: (value: number) => bytes.push(value),
      write3: (value: number) => bytes.push(value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF),
      symbolScope: {
        getLabelValue: (label: string) => {
          if (label === "forward") {
            throw new Error("not resolved");
          }
          return 0x1234567;
        },
      },
    },
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  } as MemoryDirectiveContext;

  t.throws(() => handleProt(ctx, ["prot"]));
  t.throws(() => handleProt(ctx, ["prot", ",", ","]));
  handleProt(ctx, ["prot", "known,", "forward"]);

  t.deepEqual(bytes, [
    0x50, 0x52, 0x4F, 0x54, 0x06,
    0x67, 0x45, 0x23,
    0x00, 0x00, 0x00,
    0x53, 0x54, 0x4F, 0x50, 0x00,
  ]);
});

test("memory directive registration exposes all aliases", t => {
  const registry = new DirectiveRegistry();
  const { ctx } = createMemoryContext();
  registerMemoryDirectives(registry, ctx);

  for (const directive of ["freecode", "freespace", "freedata", "freespacebyte", "prot"]) {
    t.true(registry.has(directive));
  }
});

type MemoryContextOverrides = {
  targetRom?: Uint8Array;
  romdata?: Uint8Array;
  pctosnes?: (address: number) => number;
};

const createMemoryContext = (overrides: MemoryContextOverrides = {}) => {
  const bytes: number[] = [];
  const expansions: Array<[number, number]> = [];
  const session = {
    inSpcblock: false,
    mapper: "lorom",
    targetRom: overrides.targetRom ?? new Uint8Array(0x90000),
    romdata: overrides.romdata ?? new Uint8Array(0x80000),
    defaultFreespaceByte: 0xA5,
    activeFreespaceStartPc: null as number | null,
    activeFreespaceContentStartPc: null as number | null,
    currentTargetAddress: 0,
    currentTargetBaseAddress: 0,
    currentTargetStartAddress: 0,
    currentTargetBaseStartAddress: 0,
    romWriter: {
      pctosnes: overrides.pctosnes ?? ((address: number) => address + 0x878000),
    },
    expandRom: (size: number, fill: number) => expansions.push([size, fill]),
    write1: (value: number) => bytes.push(value),
  };
  const ctx = {
    session,
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  } as MemoryDirectiveContext;
  return { ctx, session, bytes, expansions };
};
