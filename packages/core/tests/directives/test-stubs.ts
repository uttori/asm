import { OperandResolver } from "../../src/operand-resolver.js";
import type { DirectiveRuntimeService } from "../../src/services/directive-runtime-service.js";

export const createOperandResolver = (getCurrentAddress = (): number => 0): OperandResolver =>
  new OperandResolver({
    resolveDefines: (input) => input,
    isStructReference: () => false,
    resolveStructLabel: () => 0,
    tryResolveLabel: () => 0,
    resolveLabel: () => 0,
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

/** Partial doubles stand in for the methods a single test calls. */
// The caller chooses the interface exercised by this intentionally incomplete test double.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export function testDouble<T>(value: object): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as T;
}

export const runtimeStub = testDouble<DirectiveRuntimeService>({});
