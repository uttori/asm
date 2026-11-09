import type { EncoderDiagnosticContext, EncoderEmissionContext } from "../architecture-types.js";
import type { AssemblyStageName } from "../plugin/contracts.js";
import type { SectionPosition } from "../relocatable.js";
import type { ExpressionNode, ReferenceExpressionNode } from "./expression-node.js";
import { type LinkExpression } from "./link-expression.js";
import type { OperandScalar, ParsedInstructionOperands } from "./parsed-operand.js";
import type { ReferenceResolution } from "./reference-path.js";
import { type SyntaxValue } from "./source-syntax.js";
/** Target-selected instruction syntax. Original spelling belongs to its source occurrence, not decisions. */
export type ParsedInstruction = {
    /** Normalized mnemonic selecting the encoder entry point. */
    readonly mnemonic: string;
    /** Parsed operand list bound to the mnemonic's grammar. */
    readonly operands: ParsedInstructionOperands;
};
/** Stage in encoder lowering when an operand numeric read occurs. */
export type OperandEvaluationPoint = "classification" | "sizing" | "beforeOpcode" | "afterOpcode" | "operand";
/** Binding failures are stage-local diagnostics, never cached syntax or executable source. */
export type OperandBindingFailure = {
    /** Category explaining why symbolic binding could not complete. */
    readonly reason: "unbound" | "recursive" | "depth" | "other";
    /** Human-readable detail suitable for deferred encoder diagnostics. */
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
    /** Return the current section-relative cursor when object production is active. */
    sectionPosition?(): SectionPosition;
    /** Deferred fragment binding failure surfaced at numeric read time when encoders opt in. */
    readonly bindingFailure?: OperandBindingFailure;
    /** Evaluate a typed expression to a numeric value at the current cursor. */
    evaluate(expression: ExpressionNode): number;
    /** Mathematical grouping can round differently from a numeric atom read. */
    evaluateMath?(expression: ExpressionNode): number;
    /** Resolve a reference expression, optionally at an instruction-relative address. */
    reference(expression: ReferenceExpressionNode, address?: number): ReferenceResolution;
    /** Construct a stage-appropriate error for encoder failures. */
    error?(message: string): Error;
    /** Current logical byte cursor observed by operand reads. */
    currentAddress(): number;
    /** Active assembly stage for this evaluation frame. */
    stage(): AssemblyStageName;
    /** Identity changes on a new stage/session snapshot; callers cannot reuse a frame across it. */
    stageIdentity(): object;
}
/** Width intent and evaluated value remain separate, including signed and fractional values. */
export type ResolvedOperandValue = {
    /** Numeric value observed for the operand at the evaluation point. */
    readonly value: number;
    /** Declared storage width for the operand slot. */
    readonly width: OperandScalar["width"];
    /** Source span covering the operand token in the original line. */
    readonly span: OperandScalar["span"];
    /** Encoder phase when the value was recorded. */
    readonly point: OperandEvaluationPoint;
    /** Logical address active when the read occurred. */
    readonly address: number;
    /** Optional diagnostic/source-map spelling. It is never parsed or used to select a form. */
    readonly displayText?: string;
    /** Encoders decide when to report legacy generated-number rejection; no rendered text is executed. */
    readonly generatedNumberIssue?: "negative" | "fractional" | "nonfinite";
};
/** A stage-owned receipt, not a cache of values for later assembly passes. */
export type ResolvedInstruction = {
    /** Assembly stage that produced the resolution snapshot. */
    readonly stage: AssemblyStageName;
    /** Instruction-start logical address for the lowered form. */
    readonly address: number;
    /** Selected encoder form identifier. */
    readonly form: string;
    /** Total encoded byte size for the selected form. */
    readonly size: number;
    /** Copied processor or encoder state at form selection time. */
    readonly state: SyntaxValue;
    /** Operand values recorded during sizing and encoding for this form. */
    readonly values: readonly ResolvedOperandValue[];
};
/**
 * One sizing/encoding invocation owns one frame. Evaluation is always explicit and repeatable;
 * reusing a prior result requires retaining that result, so opcode writes cannot silently move reads.
 */
export declare class InstructionResolutionFrame {
    readonly instruction: ParsedInstruction;
    private readonly context;
    /** Fresh classification observations from this same lowering occurrence and stage. */
    readonly preparation?: ResolvedInstruction | undefined;
    private readonly identity;
    private readonly stage;
    private readonly address;
    private active;
    private selection?;
    private readonly values;
    constructor(instruction: ParsedInstruction, context: TypedOperandEvaluationContext, 
    /** Fresh classification observations from this same lowering occurrence and stage. */
    preparation?: ResolvedInstruction | undefined);
    /** Select from typed syntax/values and copy the relevant processor state at that decision point. */
    choose(form: string, size: number, state?: SyntaxValue): void;
    /**
     * Record a compact tuple of JSON scalars. Numbers must be finite; objects and undefined are rejected.
     * The fresh rest array is owned by this frame, so no recursive copy or descriptor traversal is needed.
     * This preserves choose's form, size and lifetime checks; arbitrary plugin trees still use choose.
     */
    chooseScalars(form: string, size: number, ...state: (string | number | boolean | null)[]): void;
    /** Both state representations enforce the same selected-form and borrowed-frame contract. */
    private assertSelection;
    /** Evaluate exactly once per call, at the current cursor; the caller may explicitly reuse the returned value. */
    evaluate(scalar: OperandScalar, point: OperandEvaluationPoint, generated?: boolean, semantics?: "numeric" | "math", displayText?: string): ResolvedOperandValue;
    /** Record a previously observed value without reevaluating an effectful expression. */
    observe(scalar: OperandScalar, value: number, point: OperandEvaluationPoint, displayText?: string): void;
    /** Resolve a symbol, optionally selecting relative labels at an instruction-end byte cursor. */
    reference(expression: ReferenceExpressionNode, address?: number): ReferenceResolution;
    /** A target may defer failed fragment binding until the numeric read that historically owned it. */
    get bindingFailure(): OperandBindingFailure | undefined;
    /** Stage policy is observed through the frame rather than retained session capabilities. */
    get stageName(): AssemblyStageName;
    /** Build an encoder error without releasing the resolution frame. */
    error(message: string): Error;
    /** Logical address after opcode and operand writes within this frame. */
    currentAddress(): number;
    /** The invocation-start byte cursor is stable even after opcode writes advance the live cursor. */
    get instructionAddress(): number;
    /** Distinguishes object production from the existing absolute numeric encoding contract. */
    get isRelocatable(): boolean;
    /** Source policy belongs to this frame and cannot be inferred from operand spelling. */
    get sourceAdapter(): "asar" | "ca65" | undefined;
    /** Undefined means layout cannot determine this operand yet; the normal unresolved form remains authoritative. */
    previewSource(scalar: OperandScalar): number | undefined;
    /** Borrow an isolated numeric cursor so compatibility selection observes opcode-before-operand timing without emitting bytes. */
    withSourcePreview<T>(operation: (advance: (bytes: number) => void) => T): T;
    /** Preserve the operand's bound symbolic meaning at its actual evaluation cursor. */
    compileLink(scalar: OperandScalar): LinkExpression;
    /** Opcode/register/count decisions must be invariant under final placement. */
    constant(scalar: OperandScalar, purpose: string): number;
    /** Relative fields capture a section position rather than a guessed final program counter. */
    sectionPosition(): SectionPosition;
    /** Release access even after failures; a retained frame can never act on the next instruction. */
    close(): void;
    /** Copy observations while retaining the immutable lexical width objects. */
    snapshot(): ResolvedInstruction;
    private assertActive;
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
    /** Return the encoded byte length for the current frame without writing bytes. */
    estimate(frame: InstructionResolutionFrame): number;
    /** Encode the selected form, returning false when the frame should try another form. */
    encode(frame: InstructionResolutionFrame, context: TypedEncoderContext): boolean;
}
/** Emission and diagnostic sinks passed into typed encoders during encode. */
export interface TypedEncoderContext {
    /** Byte emission callbacks bound to the active assembly session. */
    readonly emission: EncoderEmissionContext;
    /** Diagnostic reporting hooks for encoder-selected messages. */
    readonly diagnostics: EncoderDiagnosticContext;
}
/** Versioned architecture-owned grammar, selected again when an `arch` directive changes the CPU. */
export interface ArchitectureOperandGrammar {
    /** Grammar revision bumped when tokenization or operand shapes change. */
    readonly version: string;
    /** Parse raw operand text for a mnemonic into typed operand structures. */
    parse(mnemonic: string, operands: string): ParsedInstructionOperands;
}
//# sourceMappingURL=resolved-instruction.d.ts.map