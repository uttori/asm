import type { Assembler } from "@uttori/asm-core";

import { withAstMigrationGuard } from "../../../core/src/internal-instrumentation.js";

/**
 * Fail after the invocation so speculative classification cannot swallow a forbidden call.
 * Source/template parsing is allowed; numeric execution must receive expression nodes.
 */
export function assertTypedSnes<T>(assembler: Assembler, run: () => T): T {
  const violations = new Set<string>();
  let executing = 0;
  const getnum = assembler.operandResolver.getnum;
  const math = assembler.mathCore.math;
  assembler.operandResolver.getnum = (...args) => {
    if (executing && typeof args[0] === "string") {
      violations.add("string numeric evaluation");
    }
    return getnum.apply(assembler.operandResolver, args);
  };
  assembler.mathCore.math = (...args) => {
    if (executing && typeof args[0] === "string") {
      violations.add("string math evaluation");
    }
    return math.apply(assembler.mathCore, args);
  };
  const restores: (() => void)[] = [];
  for (const definition of assembler.architectureRegistry.definitions.values()) {
    if (!definition.name.startsWith("snes.")) {
      continue;
    }
    const typed = definition.encoder.typed;
    if (!typed) {
      throw new Error("SNES registration did not install a typed encoder.");
    }
    const prepare = typed.prepare;
    const estimate = typed.estimate;
    const encode = typed.encode;
    const invoke = <V>(call: () => V): V => {
      executing++;
      try {
        return withAstMigrationGuard(
          [
            "legacy-scanner",
            "legacy-evaluation",
            "reference-to-text",
            "define-to-text",
            "function-to-text",
          ],
          call,
        );
      } finally {
        executing--;
      }
    };
    if (prepare) {
      typed.prepare = (frame) => invoke(() => prepare.call(typed, frame));
    }
    typed.estimate = (frame) => invoke(() => estimate.call(typed, frame));
    typed.encode = (frame, context) => invoke(() => encode.call(typed, frame, context));
    restores.push(() => {
      typed.prepare = prepare;
      typed.estimate = estimate;
      typed.encode = encode;
    });
  }
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: run() };
  } catch (error) {
    outcome = { ok: false, error };
  } finally {
    assembler.operandResolver.getnum = getnum;
    assembler.mathCore.math = math;
    restores.forEach((restore) => restore());
  }
  if (violations.size) {
    throw new Error("SNES AST execution crossed: " + [...violations].join(", "), {
      cause: outcome.ok ? undefined : outcome.error,
    });
  }
  if (!outcome.ok) {
    throw outcome.error;
  }
  return outcome.value;
}
