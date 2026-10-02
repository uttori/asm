import { test } from "../../../../tests/ava-helper.js";
import { handleDataDirective } from "../../src/directives/data.js";
import type { DataDirectiveContext } from "../../src/directives/types.js";
import type { DirectiveRuntimeService } from "../../src/services/directive-runtime-service.js";
import { createOperandResolver, testDouble } from "./test-stubs.js";

test("data directives call the injected runtime instead of the assembler", (t) => {
  let call: [string, string[]] | undefined;
  const runtime = testDouble<DirectiveRuntimeService>({
    handleDataDirective: (keyword: string, args: string[]) => {
      call = [keyword, args];
    },
  });
  const ctx = testDouble<DataDirectiveContext>({
    session: {},
    operandResolver: createOperandResolver(),
    runtime,
  });

  handleDataDirective(ctx, ["dc.w", "$1234"]);
  t.deepEqual(call, ["dc.w", ["$1234"]]);
});
