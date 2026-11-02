import {
  isReferenceExpressionNode,
  type InstructionResolutionFrame,
  type OperandScalar,
} from "@uttori/asm-core";

import { operandScalar, type ExpansionPlan, type Syntax65xx } from "./syntax.js";

/** Per-occurrence values are never retained in a parsed operand or reused across passes. */
export interface Classification65xx {
  mode: string;
  length: number;
  generated: boolean;
  value: number;
  native: boolean;
  specialPage: boolean;
}
interface Expansion {
  length: number;
  generated: boolean;
  value: number;
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
function expand(plan: ExpansionPlan, frame: InstructionResolutionFrame): Expansion {
  // Native modules use authored widths. The explicit Asar adapter may reuse known source addresses
  // for encoding selection while keeping the actual field expression relocatable.
  if (
    frame.isRelocatable &&
    (frame.sourceAdapter !== "asar" || frame.previewSource(plan.scalar) === undefined)
  ) {
    return {
      length: plan.force ?? plan.hexWidth ?? 2,
      generated: false,
      value: 0,
      flattened: false,
    };
  }
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
/** Classify one whole operand using its parsed punctuation and current-stage width observations. */
function classify(syntax: Syntax65xx, frame: InstructionResolutionFrame): Classification65xx {
  const policy = syntax.policy65xx;
  const whole = expand(policy.whole, frame);
  const operands = syntax.operands;
  const first = operands.at(0);
  let mode = "unknown";
  let length = whole.length;
  if (!policy.hasOperand) {
    mode = "implied";
  } else if (policy.originalRegister === "a") {
    mode = "accumulator";
  } else if (policy.originalRegister === "q") {
    mode = "quadAccumulator";
  } else if (policy.whole.immediate && whole.generated) {
    mode = "immediate";
  } else if (first?.kind === "immediate" && operands.length >= 2) {
    const address = expand(policy.parts[1], frame);
    const second = operands[1];
    const indexed = second.kind === "memory" && second.index?.register === "x";
    mode = address.length <= 1 ? "immediateZeroPage" : "immediateAbsolute";
    if (indexed) {
      mode += "IndexedX";
    }
  } else if (first?.kind === "immediate") {
    mode = "immediate";
  } else if (
    operands.length >= 2 &&
    policy.whole.index &&
    policy.whole.scalar.expression.type === "error"
  ) {
    // Malformed indexed expressions still select their physical width during sizing;
    // the numeric reader owns the final expression diagnostic.
    mode = length <= 1 ? "zeroPage" : "absolute";
    mode += "Indexed" + policy.whole.index.toUpperCase();
  } else if (first?.kind === "invalid") {
    mode = length <= 1 ? "zeroPage" : "absolute";
  } else if (operands.length >= 2) {
    if (policy.parts.length === 3) {
      mode = "blockTransfer";
    } else if (first?.kind === "register" && first.name === "a") {
      mode = "accumulatorRelative";
    } else if (operands[1].kind === "immediate") {
      mode = "zeroPageImmediate";
    } else {
      mode = "zeroPageRelative";
    }
  } else if (first?.kind === "memory") {
    const index = first.index?.register;
    const delimiter = whole.flattened ? "none" : first.delimiter;
    if (delimiter === "parentheses" && first.innerIndex === "s" && index === "y") {
      mode = "stackRelativeIndirectIndexedY";
    } else if (delimiter === "parentheses" && first.index?.position === "inside" && index === "x") {
      length = expand(policy.inner!, frame).length;
      mode = length <= 1 ? "indexedIndirectX" : "absoluteIndexedIndirect";
    } else if (
      delimiter === "parentheses" &&
      first.index?.position === "outside" &&
      index === "y"
    ) {
      mode = "indirectIndexedY";
    } else if (
      delimiter === "parentheses" &&
      first.index?.position === "outside" &&
      index === "z"
    ) {
      mode = "zeroPageIndirectIndexedZ";
    } else if (delimiter === "brackets" && index === "z") {
      mode = "basePageIndirectIndexedZ";
    } else if (delimiter === "brackets" && !index) {
      mode = "zeroPageIndirectLong";
    } else if (delimiter === "parentheses" && !index) {
      length = expand(policy.inner!, frame).length;
      mode = length <= 1 ? "zeroPageIndirect" : "indirect";
    } else if (delimiter === "none") {
      if (index === "s") {
        mode = "stackRelative";
      } else if (index === "z") {
        mode = "unknown";
      } else if (index === "x" && length > 2) {
        mode = "absoluteLongIndexedX";
      } else {
        mode = length <= 1 ? "zeroPage" : "absolute";
        if (index === "x" || index === "y") {
          mode += "Indexed" + index.toUpperCase();
        }
      }
    }
  }
  // M740's special page is selected only by hex atoms or generated numeric addresses.
  return {
    mode,
    length,
    generated: whole.generated,
    value: whole.value,
    native: policy.whole.native,
    specialPage:
      mode === "absolute" &&
      ((whole.generated && whole.value >= 0xff00 && whole.value <= 0xffff) ||
        policy.hexSpecialPage),
  };
}
/** Keep the original per-component then whole-operand observation order, without retaining source strings. */
export function prepare65xx(
  syntax: Syntax65xx,
  frame: InstructionResolutionFrame,
): Classification65xx {
  if (syntax.policy65xx.parts.length === 1) {
    const first = classify(syntax, frame);
    if (first.native && !(first.generated && (first.value < 0 || !Number.isInteger(first.value)))) {
      return first;
    }
  } else {
    for (const part of syntax.policy65xx.parts) {
      expand(part, frame);
    }
  }
  return classify(syntax, frame);
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
/** Select the numeric component after addressing punctuation has already been parsed. */
export function selectedScalar(syntax: Syntax65xx): OperandScalar {
  if (
    syntax.policy65xx.whole.native ||
    (syntax.operands.length >= 2 &&
      syntax.policy65xx.whole.index &&
      syntax.policy65xx.whole.scalar.expression.type === "error")
  ) {
    return syntax.policy65xx.whole.scalar;
  }
  const selected = operandScalar(syntax.operands[0]);
  // A failed whole-fragment binding still has an expression tree for each numeric slot.
  // Use it instead of retrying the generated-source template during numeric execution.
  if (selected?.expression.type === "template") {
    return syntax.policy65xx.inner?.scalar ?? syntax.policy65xx.whole.scalar;
  }
  return selected ?? syntax.policy65xx.whole.scalar;
}
