import { MathCore } from "../../src/mathcore.js";
import { OperandResolver } from "../../src/operand-resolver.js";
import type { DirectiveRuntimeService } from "../../src/services/directive-runtime-service.js";

/** Directive tests use the production expression evaluator with an empty symbol scope. */
export const createOperandResolver = (getCurrentAddress = (): number => 0): OperandResolver => {
  const math = new MathCore();
  return new OperandResolver({
    resolveReference: (_node) => ({ kind: "missing", name: "unresolved", deferred: false }),
    evaluateMath: (input) => math.math(input),
    shouldDeferExpressionEvaluation: () => false,
    getCurrentAddress,
  });
};

/** Partial doubles stand in for the methods a single test calls. */
// The caller chooses the interface exercised by this intentionally incomplete test double.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export function testDouble<T>(value: object): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as T;
}

export const runtimeStub = testDouble<DirectiveRuntimeService>({});
