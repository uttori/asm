import { test } from "../ava-helper.js";
import { handleRelativeLabel } from "../../packages/core/src/directives/flow-control.js";
import type { FlowControlDirectiveContext } from "../../packages/core/src/directives/types.js";
import { createOperandResolver, runtimeStub } from "./test-stubs.js";

test("relative labels only require the symbol scope capability", (t) => {
  let handled = "";
  const ctx = {
    session: {
      symbolScope: {
        handleRelativeLabel: (raw: string) => {
          handled = raw;
        },
      },
    },
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  } as FlowControlDirectiveContext;

  handleRelativeLabel(ctx, ["+"], "++:");
  t.is(handled, "++:");
});
