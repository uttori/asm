import { test } from "../ava-helper.js";
import { handlePullTable, handlePushTable } from "../../packages/core/src/directives/misc.js";
import { createOperandResolver, runtimeStub } from "./test-stubs.js";

const createContext = () => ({
  session: {
    tableStack: [] as Map<string, number>[],
    characterMappings: new Map([["A", 1]]),
    currentTable: null,
    includeSource: {
      readFile: () => "",
    },
  },
  operandResolver: createOperandResolver(),
  runtime: runtimeStub,
});

test("table directives save and restore mappings without an assembler", (t) => {
  const ctx = createContext();
  handlePushTable(ctx);
  ctx.session.characterMappings.set("A", 2);
  handlePullTable(ctx);

  t.is(ctx.session.characterMappings.get("A"), 1);
});

test("pulltable rejects an empty stack", (t) => {
  const error = t.throws(() => handlePullTable(createContext()));
  t.is(error.message, "pulltable without pushtable");
});
