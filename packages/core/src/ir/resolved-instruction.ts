import type { EncoderDiagnosticContext, EncoderEmissionContext } from "../architecture-types.js";
import type { AssemblyStageName } from "../plugin/contracts.js";
import type { SectionPosition } from "../relocatable.js";
import type { ExpressionNode, ReferenceExpressionNode } from "./expression-node.js";
import { requireLinkConstant, type LinkExpression } from "./link-expression.js";
import type { OperandScalar, ParsedInstructionOperands } from "./parsed-operand.js";
import type { ReferenceResolution } from "./reference-path.js";
import { copySyntaxValue, type SyntaxValue } from "./source-syntax.js";
import { syntaxExpression } from "./syntax-codec.js";

/** Target-selected instruction syntax. Original spelling belongs to its source occurrence, not decisions. */
export type ParsedInstruction = {
  readonly mnemonic: string;
  readonly operands: ParsedInstructionOperands;
};
export type OperandEvaluationPoint =
  | "classification"
  | "sizing"
  | "beforeOpcode"
  | "afterOpcode"
  | "operand";

/** Binding failures are stage-local diagnostics, never cached syntax or executable source. */
export type OperandBindingFailure = {
  readonly reason: "unbound" | "recursive" | "depth" | "other";
  readonly message: string;
};

/** Narrow capabilities deliberately omit all string evaluation, expansion and operand classifiers. */
export interface TypedOperandEvaluationContext {
  /** Explicit module compatibility mode; omitted contexts retain their native encoding policy. */
  readonly sourceAdapter?: "asar" | "ca65";
  /** Optional authored-address preview used exclusively to preserve source encoding choices. */
  previewSource?(expression: ExpressionNode): number | undefined;
  /** Advance only a borrowed preview cursor while selecting a compatibility encoding. */
  withSourcePreview?<T>(operation: (advance: (bytes: number) => void) => T): T;
  /** Present only during section-relative assembly; never substitutes numeric placeholder addresses. */
  compileLink?(expression: ExpressionNode): LinkExpression;
  sectionPosition?(): SectionPosition;
  readonly bindingFailure?: OperandBindingFailure;
  evaluate(expression: ExpressionNode): number;
  /** Mathematical grouping can round differently from a numeric atom read. */
  evaluateMath?(expression: ExpressionNode): number;
  reference(expression: ReferenceExpressionNode, address?: number): ReferenceResolution;
  error?(message: string): Error;
  currentAddress(): number;
  stage(): AssemblyStageName;
  /** Identity changes on a new stage/session snapshot; callers cannot reuse a frame across it. */
  stageIdentity(): object;
}

/** Width intent and evaluated value remain separate, including signed and fractional values. */
export type ResolvedOperandValue = {
  readonly value: number;
  readonly width: OperandScalar["width"];
  readonly span: OperandScalar["span"];
  readonly point: OperandEvaluationPoint;
  readonly address: number;
  /** Optional diagnostic/source-map spelling. It is never parsed or used to select a form. */
  readonly displayText?: string;
  /** Encoders decide when to report legacy generated-number rejection; no rendered text is executed. */
  readonly generatedNumberIssue?: "negative" | "fractional" | "nonfinite";
};

/** A stage-owned receipt, not a cache of values for later assembly passes. */
export type ResolvedInstruction = {
  readonly stage: AssemblyStageName;
  readonly address: number;
  readonly form: string;
  readonly size: number;
  readonly state: SyntaxValue;
  readonly values: readonly ResolvedOperandValue[];
};

/**
 * One sizing/encoding invocation owns one frame. Evaluation is always explicit and repeatable;
 * reusing a prior result requires retaining that result, so opcode writes cannot silently move reads.
 */
export class InstructionResolutionFrame {
  private readonly identity: object;
  private readonly stage: AssemblyStageName;
  private readonly address: number;
  private active = true;
  private selection?: { form: string; size: number; state: SyntaxValue };
  private readonly values: ResolvedOperandValue[] = [];

  constructor(
    readonly instruction: ParsedInstruction,
    private readonly context: TypedOperandEvaluationContext,
    /** Fresh classification observations from this same lowering occurrence and stage. */
    readonly preparation?: ResolvedInstruction,
  ) {
    this.identity = context.stageIdentity();
    this.stage = context.stage();
    // Branch fixups use section offsets even when source selection observes authored bus addresses.
    this.address =
      context.sourceAdapter === "asar" && context.sectionPosition
        ? context.sectionPosition().offset
        : context.currentAddress();
    if (preparation && (preparation.stage !== this.stage || preparation.address !== this.address)) {
      throw new Error("Instruction preparation belongs to a different stage or cursor.");
    }
  }

  /** Select from typed syntax/values and copy the relevant processor state at that decision point. */
  choose(form: string, size: number, state: SyntaxValue = null): void {
    this.assertSelection(form, size);
    // Stateless forms need no recursive copier or ancestor set on this hot instruction boundary.
    this.selection = { form, size, state: state === null ? null : copySyntaxValue(state) };
  }

  /**
   * Record a compact tuple of JSON scalars. Numbers must be finite; objects and undefined are rejected.
   * The fresh rest array is owned by this frame, so no recursive copy or descriptor traversal is needed.
   * This preserves choose's form, size and lifetime checks; arbitrary plugin trees still use choose.
   */
  chooseScalars(form: string, size: number, ...state: (string | number | boolean | null)[]): void {
    this.assertSelection(form, size);
    for (const value of state) {
      if (
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "boolean" &&
        (typeof value !== "number" || !Number.isFinite(value))
      ) {
        throw new Error("Instruction scalar state requires finite JSON scalars.");
      }
    }
    this.selection = { form, size, state };
  }

  /** Both state representations enforce the same selected-form and borrowed-frame contract. */
  private assertSelection(form: string, size: number): void {
    this.assertActive();
    if (!form || !Number.isSafeInteger(size) || size < 0) {
      throw new Error("Invalid resolved instruction form or byte size.");
    }
  }

  /** Evaluate exactly once per call, at the current cursor; the caller may explicitly reuse the returned value. */
  evaluate(
    scalar: OperandScalar,
    point: OperandEvaluationPoint,
    generated = false,
    semantics: "numeric" | "math" = "numeric",
    displayText?: string,
  ): ResolvedOperandValue {
    this.assertActive();
    if (!syntaxExpression(scalar.expression)) {
      throw new Error("Typed operand requires a portable expression node.");
    }
    const address = this.context.currentAddress();
    const value =
      semantics === "math" && this.context.evaluateMath
        ? this.context.evaluateMath(scalar.expression)
        : this.context.evaluate(scalar.expression);
    let issue: ResolvedOperandValue["generatedNumberIssue"];
    if (generated) {
      if (!Number.isFinite(value)) {
        issue = "nonfinite";
      } else if (value < 0) {
        issue = "negative";
      } else if (!Number.isInteger(value)) {
        issue = "fractional";
      }
    }
    const result = {
      value,
      width: scalar.width,
      span: scalar.span,
      point,
      address,
      ...(displayText === undefined ? {} : { displayText }),
      ...(issue ? { generatedNumberIssue: issue } : {}),
    };
    this.values.push(result);
    return result;
  }

  /** Record a previously observed value without reevaluating an effectful expression. */
  observe(
    scalar: OperandScalar,
    value: number,
    point: OperandEvaluationPoint,
    displayText?: string,
  ): void {
    this.assertActive();
    this.values.push({
      value,
      width: scalar.width,
      span: scalar.span,
      point,
      address: this.context.currentAddress(),
      ...(displayText === undefined ? {} : { displayText }),
    });
  }

  /** Resolve a symbol, optionally selecting relative labels at an instruction-end byte cursor. */
  reference(expression: ReferenceExpressionNode, address?: number): ReferenceResolution {
    this.assertActive();
    return this.context.reference(expression, address);
  }

  /** A target may defer failed fragment binding until the numeric read that historically owned it. */
  get bindingFailure(): OperandBindingFailure | undefined {
    this.assertActive();
    return this.context.bindingFailure;
  }

  /** Stage policy is observed through the frame rather than retained session capabilities. */
  get stageName(): AssemblyStageName {
    this.assertActive();
    return this.stage;
  }

  error(message: string): Error {
    this.assertActive();
    return this.context.error?.(message) ?? new Error(message);
  }

  currentAddress(): number {
    this.assertActive();
    return this.context.currentAddress();
  }

  /** The invocation-start byte cursor is stable even after opcode writes advance the live cursor. */
  get instructionAddress(): number {
    this.assertActive();
    return this.address;
  }

  /** Distinguishes object production from the existing absolute numeric encoding contract. */
  get isRelocatable(): boolean {
    this.assertActive();
    return this.context.compileLink !== undefined;
  }

  /** Source policy belongs to this frame and cannot be inferred from operand spelling. */
  get sourceAdapter(): "asar" | "ca65" | undefined {
    this.assertActive();
    return this.context.sourceAdapter;
  }

  /** Undefined means layout cannot determine this operand yet; the normal unresolved form remains authoritative. */
  previewSource(scalar: OperandScalar): number | undefined {
    this.assertActive();
    return this.context.previewSource?.(scalar.expression);
  }

  /** Borrow an isolated numeric cursor so compatibility selection observes opcode-before-operand timing without emitting bytes. */
  withSourcePreview<T>(operation: (advance: (bytes: number) => void) => T): T {
    this.assertActive();
    if (!this.context.withSourcePreview) {
      throw new Error("Source preview cursor is unavailable.");
    }
    return this.context.withSourcePreview(operation);
  }

  /** Preserve the operand's bound symbolic meaning at its actual evaluation cursor. */
  compileLink(scalar: OperandScalar): LinkExpression {
    this.assertActive();
    if (!this.context.compileLink) {
      throw new Error("Instruction frame is not producing a relocatable module.");
    }
    return this.context.compileLink(scalar.expression);
  }

  /** Opcode/register/count decisions must be invariant under final placement. */
  constant(scalar: OperandScalar, purpose: string): number {
    return requireLinkConstant(this.compileLink(scalar), purpose);
  }

  /** Relative fields capture a section position rather than a guessed final program counter. */
  sectionPosition(): SectionPosition {
    this.assertActive();
    if (!this.context.sectionPosition) {
      throw new Error("Instruction has no section-relative cursor.");
    }
    return this.context.sectionPosition();
  }

  /** Release access even after failures; a retained frame can never act on the next instruction. */
  close(): void {
    this.active = false;
  }

  /** Copy observations while retaining the immutable lexical width objects. */
  snapshot(): ResolvedInstruction {
    this.assertActive();
    if (!this.selection) {
      throw new Error("Typed encoder did not select an instruction form.");
    }
    return {
      stage: this.stage,
      address: this.address,
      ...this.selection,
      values: [...this.values],
    };
  }

  private assertActive(): void {
    if (
      !this.active ||
      this.context.stageIdentity() !== this.identity ||
      this.context.stage() !== this.stage
    ) {
      throw new Error("Instruction resolution frame is no longer active.");
    }
  }
}

/** Typed encoders receive no legacy operand facade. Sizing and encoding must share their form selector. */
export interface TypedArchitectureEncoder {
  /** Opt-in contract: every supported instruction form can retain typed symbolic operand fields. */
  readonly supportsRelocatable?: boolean;
  /** Opt in only with structural unresolved operands and explicit numeric-read diagnostic timing. */
  readonly deferOperandBindingErrors?: boolean;
  /** Observe stage-entry and refreshed-command classification at the original lowering points. */
  prepare?(frame: InstructionResolutionFrame): void;
  /** Reset processor-local state at the start of each pass. */
  beginPass?(): void;
  estimate(frame: InstructionResolutionFrame): number;
  encode(frame: InstructionResolutionFrame, context: TypedEncoderContext): boolean;
}
export interface TypedEncoderContext {
  readonly emission: EncoderEmissionContext;
  readonly diagnostics: EncoderDiagnosticContext;
}

/** Versioned architecture-owned grammar, selected again when an `arch` directive changes the CPU. */
export interface ArchitectureOperandGrammar {
  readonly version: string;
  parse(mnemonic: string, operands: string): ParsedInstructionOperands;
}
