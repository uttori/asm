import { test } from "../ava-helper.js";
import { handleDataDirective } from "../../packages/core/src/directives/data.js";
import type { DataDirectiveContext } from "../../packages/core/src/directives/types.js";
import type { DirectiveRuntimeService } from "../../packages/core/src/services/directive-runtime-service.js";
import { createOperandResolver } from "./test-stubs.js";

test("data directives call the injected runtime instead of the assembler", (t) => {
  let call: [string, string[]] | undefined;
  const runtime = {
    handleDataDirective: (keyword: string, args: string[]) => {
      call = [keyword, args];
    },
  } as DirectiveRuntimeService;
  const ctx = {
    session: {},
    operandResolver: createOperandResolver(),
    runtime,
  } as DataDirectiveContext;

  handleDataDirective(ctx, ["dc.w", "$1234"]);
  t.deepEqual(call, ["dc.w", ["$1234"]]);
});
