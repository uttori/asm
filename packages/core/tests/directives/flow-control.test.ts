import { test } from "../../../../tests/ava-helper.js";
import { handleRelativeLabel } from "../../src/directives/flow-control.js";
import type { FlowControlDirectiveContext } from "../../src/directives/types.js";
import { createOperandResolver, runtimeStub, testDouble } from "./test-stubs.js";

test("relative labels only require the symbol scope capability", (t) => {
  let handled = "";
  const ctx = testDouble<FlowControlDirectiveContext>({
    session: {
      symbolScope: {
        handleRelativeLabel: (raw: string) => {
          handled = raw;
        },
      },
    },
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  });

  handleRelativeLabel(ctx, ["+"], "++:");
  t.is(handled, "++:");
});
