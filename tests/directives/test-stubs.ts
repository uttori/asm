import { OperandResolver } from "../../src/operand-resolver.js";
import type { DirectiveRuntimeService } from "../../src/services/directive-runtime-service.js";

export const createOperandResolver = (getCurrentAddress = (): number => 0): OperandResolver => new OperandResolver({
  resolveDefines: (input) => input,
  resolveStructLabel: () => 0,
  resolveLabel: () => 0,
  hasLabel: () => false,
  evaluateMath: (input) => {
    const text = typeof input === "string" ? input : "0";
    if (/^\$[\da-f]+$/i.test(text)) {
      return parseInt(text.slice(1), 16);
    }
    return Number(text);
  },
  shouldDeferExpressionEvaluation: () => false,
  getCurrentAddress,
  requireStaticLabelLookup: () => false,
});

export const runtimeStub = {} as DirectiveRuntimeService;
