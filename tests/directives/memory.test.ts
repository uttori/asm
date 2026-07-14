import { test } from "../ava-helper.js";
import { handleFreespaceByte, handleFreespace } from "../../src/directives/memory.js";
import type { MemoryDirectiveContext } from "../../src/directives/types.js";
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
