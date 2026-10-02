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

function isTestDouble<T>(value: object): value is T {
  return typeof value === "object";
}

/** Partial doubles stand in for the methods a single test calls. */
export function testDouble<T>(value: object): T {
  if (!isTestDouble<T>(value)) {
    throw new Error("Expected an object test double.");
  }
  return value;
}

export const runtimeStub = testDouble<DirectiveRuntimeService>({});
