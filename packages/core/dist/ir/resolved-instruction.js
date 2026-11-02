import { requireLinkConstant } from "./link-expression.js";
import { copySyntaxValue } from "./source-syntax.js";
import { syntaxExpression } from "./syntax-codec.js";
/**
 * One sizing/encoding invocation owns one frame. Evaluation is always explicit and repeatable;
 * reusing a prior result requires retaining that result, so opcode writes cannot silently move reads.
 */
export class InstructionResolutionFrame {
    instruction;
    context;
    preparation;
    identity;
    stage;
    address;
    active = true;
    selection;
    values = [];
    constructor(instruction, context, 
    /** Fresh classification observations from this same lowering occurrence and stage. */
    preparation) {
        this.instruction = instruction;
        this.context = context;
        this.preparation = preparation;
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
    choose(form, size, state = null) {
        this.assertSelection(form, size);
        // Stateless forms need no recursive copier or ancestor set on this hot instruction boundary.
        this.selection = { form, size, state: state === null ? null : copySyntaxValue(state) };
    }
    /**
     * Record a compact tuple of JSON scalars. Numbers must be finite; objects and undefined are rejected.
     * The fresh rest array is owned by this frame, so no recursive copy or descriptor traversal is needed.
     * This preserves choose's form, size and lifetime checks; arbitrary plugin trees still use choose.
     */
    chooseScalars(form, size, ...state) {
        this.assertSelection(form, size);
        for (const value of state) {
            if (value !== null &&
                typeof value !== "string" &&
                typeof value !== "boolean" &&
                (typeof value !== "number" || !Number.isFinite(value))) {
                throw new Error("Instruction scalar state requires finite JSON scalars.");
            }
        }
        this.selection = { form, size, state };
    }
    /** Both state representations enforce the same selected-form and borrowed-frame contract. */
    assertSelection(form, size) {
        this.assertActive();
        if (!form || !Number.isSafeInteger(size) || size < 0) {
            throw new Error("Invalid resolved instruction form or byte size.");
        }
    }
    /** Evaluate exactly once per call, at the current cursor; the caller may explicitly reuse the returned value. */
    evaluate(scalar, point, generated = false, semantics = "numeric", displayText) {
        this.assertActive();
        if (!syntaxExpression(scalar.expression)) {
            throw new Error("Typed operand requires a portable expression node.");
        }
        const address = this.context.currentAddress();
        const value = semantics === "math" && this.context.evaluateMath
            ? this.context.evaluateMath(scalar.expression)
            : this.context.evaluate(scalar.expression);
        let issue;
        if (generated) {
            if (!Number.isFinite(value)) {
                issue = "nonfinite";
            }
            else if (value < 0) {
                issue = "negative";
            }
            else if (!Number.isInteger(value)) {
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
    observe(scalar, value, point, displayText) {
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
    reference(expression, address) {
        this.assertActive();
        return this.context.reference(expression, address);
    }
    /** A target may defer failed fragment binding until the numeric read that historically owned it. */
    get bindingFailure() {
        this.assertActive();
        return this.context.bindingFailure;
    }
    /** Stage policy is observed through the frame rather than retained session capabilities. */
    get stageName() {
        this.assertActive();
        return this.stage;
    }
    error(message) {
        this.assertActive();
        return this.context.error?.(message) ?? new Error(message);
    }
    currentAddress() {
        this.assertActive();
        return this.context.currentAddress();
    }
    /** The invocation-start byte cursor is stable even after opcode writes advance the live cursor. */
    get instructionAddress() {
        this.assertActive();
        return this.address;
    }
    /** Distinguishes object production from the existing absolute numeric encoding contract. */
    get isRelocatable() {
        this.assertActive();
        return this.context.compileLink !== undefined;
    }
    /** Source policy belongs to this frame and cannot be inferred from operand spelling. */
    get sourceAdapter() {
        this.assertActive();
        return this.context.sourceAdapter;
    }
    /** Undefined means layout cannot determine this operand yet; the normal unresolved form remains authoritative. */
    previewSource(scalar) {
        this.assertActive();
        return this.context.previewSource?.(scalar.expression);
    }
    /** Borrow an isolated numeric cursor so compatibility selection observes opcode-before-operand timing without emitting bytes. */
    withSourcePreview(operation) {
        this.assertActive();
        if (!this.context.withSourcePreview) {
            throw new Error("Source preview cursor is unavailable.");
        }
        return this.context.withSourcePreview(operation);
    }
    /** Preserve the operand's bound symbolic meaning at its actual evaluation cursor. */
    compileLink(scalar) {
        this.assertActive();
        if (!this.context.compileLink) {
            throw new Error("Instruction frame is not producing a relocatable module.");
        }
        return this.context.compileLink(scalar.expression);
    }
    /** Opcode/register/count decisions must be invariant under final placement. */
    constant(scalar, purpose) {
        return requireLinkConstant(this.compileLink(scalar), purpose);
    }
    /** Relative fields capture a section position rather than a guessed final program counter. */
    sectionPosition() {
        this.assertActive();
        if (!this.context.sectionPosition) {
            throw new Error("Instruction has no section-relative cursor.");
        }
        return this.context.sectionPosition();
    }
    /** Release access even after failures; a retained frame can never act on the next instruction. */
    close() {
        this.active = false;
    }
    /** Copy observations while retaining the immutable lexical width objects. */
    snapshot() {
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
    assertActive() {
        if (!this.active ||
            this.context.stageIdentity() !== this.identity ||
            this.context.stage() !== this.stage) {
            throw new Error("Instruction resolution frame is no longer active.");
        }
    }
}
//# sourceMappingURL=resolved-instruction.js.map