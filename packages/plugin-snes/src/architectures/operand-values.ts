import { isReferenceExpressionNode, type InstructionResolutionFrame } from "@uttori/asm-core";

import type { ExpansionPlan } from "./operand-plans.js";

/** Numeric width facts copied into a frame snapshot, never retained by immutable syntax. */
export interface OperandExpansion {
  /** Byte width chosen for encoding after width inference and forced sizes. */
  length: number;
  /** True when classification produced a concrete numeric value without re-evaluating source text. */
  generated: boolean;
  /** Numeric value from probe, immediate, or math classification when generated. */
  value: number;
  /** True when a whole-list math expression collapsed delimiter structure. */
  flattened: boolean;
}

/** Match lexical hexadecimal width numerically, including signed/fractional diagnostic paths. */
function valueWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return 4;
  }
  let integer = Math.floor(Math.abs(value));
  let digits = 1;
  while (integer >= 16) {
    integer = Math.floor(integer / 16);
    digits++;
  }
  if (value < 0) {
    digits++;
  }
  let fraction = Math.abs(value) % 1;
  if (fraction) {
    digits++;
    for (let n = 0; fraction && n < 268; n++) {
      fraction = (fraction * 16) % 1;
      digits++;
    }
  }
  return Math.max(1, Math.ceil(digits / 2));
}
/** Speculative width reads swallow errors, as unresolved operands must survive definition collection. */
export function expandOperandPlan(
  plan: ExpansionPlan,
  frame: InstructionResolutionFrame,
): OperandExpansion {
  let length = plan.hexWidth ?? 2;
  let value = 0;
  let generated = false;
  let flattened = false;
  if (plan.unbound && frame.bindingFailure?.reason === "other") {
    // Missing defines fail before numeric evaluation, including calls elsewhere in the scalar.
    // Recursive references retain normal typed evaluation so effects before the bad leaf stay ordered.
    return { length: plan.force ?? length, value, flattened, generated };
  }
  if (plan.relative) {
    return { length: 2, value, generated, flattened };
  }
  if (plan.probe && isReferenceExpressionNode(plan.probe.expression)) {
    const result = frame.reference(plan.probe.expression);
    if (result.kind === "resolved") {
      value = result.value;
      generated = true;
      length = valueWidth(value);
    }
  }
  if (plan.immediate && !generated && (plan.math || !plan.directHex)) {
    try {
      value = frame.evaluate(plan.scalar, "classification", true).value;
      generated = true;
      length = valueWidth(value);
    } catch {
      /* The final value read owns diagnostics. */
    }
  }
  if (!generated && plan.math) {
    try {
      const result = frame.evaluate(plan.math, "classification", true, "math").value;
      if (!Number.isNaN(result)) {
        value = result;
        generated = true;
        flattened = true;
        length = valueWidth(value);
      }
    } catch {
      /* Invalid whole-list expressions retain their structural compound grammar. */
    }
  }
  if (plan.force === 1) {
    length = 1;
  } else if (plan.force) {
    length = Math.max(plan.force, length);
  }
  return { length, value, generated, flattened };
}
/** The final reader diagnoses noncanonical generated values without executing generated hexadecimal text. */
export function generatedValue(value: number): number {
  if (value < 0 || Number.isNaN(value)) {
    throw new Error("Invalid number: NaN");
  }
  if (!Number.isFinite(value)) {
    throw new Error("Invalid number: $" + String(value).toUpperCase());
  }
  if (!Number.isInteger(value)) {
    throw new Error("Invalid number: $" + value.toString(16).toUpperCase());
  }
  return value;
}

/** Validate portable frame data before reusing observations from the preparation phase. */
export function isOperandExpansion(value: unknown): value is OperandExpansion {
  return (
    typeof value === "object" &&
    value !== null &&
    "length" in value &&
    typeof value.length === "number" &&
    "value" in value &&
    typeof value.value === "number" &&
    "generated" in value &&
    typeof value.generated === "boolean" &&
    "flattened" in value &&
    typeof value.flattened === "boolean"
  );
}

/** Store width observations as four scalars per operand; scalar syntax remains on the immutable AST. */
export function chooseOperandPreparation(
  frame: InstructionResolutionFrame,
  form: string,
  parts: readonly OperandExpansion[],
): void {
  const state: (number | boolean)[] = [];
  for (const part of parts) {
    state.push(part.length, part.value, part.generated, part.flattened);
  }
  frame.chooseScalars(form, 0, ...state);
}
/** Absent preparation is valid for direct encoder invocations; malformed snapshots are rejected. */
export function preparedParts(
  frame: InstructionResolutionFrame,
): readonly OperandExpansion[] | undefined {
  const state = frame.preparation?.state;
  if (state === undefined) {
    return undefined;
  }
  if (Array.isArray(state)) {
    if (state.length % 4 !== 0) {
      throw new Error("Invalid prepared operand snapshot.");
    }
    const parts: OperandExpansion[] = [];
    for (let index = 0; index < state.length; index += 4) {
      const length: unknown = state[index];
      const value: unknown = state[index + 1];
      const generated: unknown = state[index + 2];
      const flattened: unknown = state[index + 3];
      if (
        typeof length !== "number" ||
        typeof value !== "number" ||
        typeof generated !== "boolean" ||
        typeof flattened !== "boolean"
      ) {
        throw new Error("Invalid prepared operand snapshot.");
      }
      parts.push({ length, value, generated, flattened });
    }
    return parts;
  }
  if (
    typeof state !== "object" ||
    state === null ||
    !("parts" in state) ||
    !Array.isArray(state.parts) ||
    !state.parts.every(isOperandExpansion)
  ) {
    throw new Error("Invalid prepared operand snapshot.");
  }
  return state.parts;
}
