import { test } from "../ava-helper.js";
import {
  handleFill,
  handleFillPattern,
  handlePad,
  handlePadPattern,
} from "../../src/directives/fill-pad.js";
import type { FillPadDirectiveContext } from "../../src/directives/types.js";
import { createOperandResolver, runtimeStub } from "./test-stubs.js";

const createContext = () => {
  const written: number[] = [];
  const session = {
    fillbyte: new Array<number>(12).fill(0),
    padbyte: new Array<number>(4).fill(0),
    padUnit: 1,
    currentTargetAddress: 0x808000,
    romWriter: {
      convertTargetAddressToRomOffset: (address: number) => address - 0x808000,
    },
    resolvedefines: (input: string) => input,
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

test("fill handlers build and emit a repeating multi-byte pattern", t => {
  const { ctx, written } = createContext();
  handleFillPattern(ctx, ["fillword", "$1234"]);
  handleFill(ctx, ["fill", "5"]);

  t.deepEqual(written, [0x34, 0x12, 0x34, 0x12, 0x34]);
});

test("pad handlers emit through an explicit target address", t => {
  const { ctx, session, written } = createContext();
  handlePadPattern(ctx, ["padword", "$BBAA"]);
  handlePad(ctx, ["pad", "$808004"]);

  t.is(session.padUnit, 2);
  t.deepEqual(written, [0xAA, 0xBB, 0xAA, 0xBB]);
});
