/** Shared section-relative sizing/emission path. Targets own form selection and field semantics. */
export class RelocatableInstruction {
    frame;
    context;
    parts = [];
    size = 0;
    constructor(frame, context) {
        this.frame = frame;
        this.context = context;
    }
    /** Opcode bytes are completely known before placement; symbolic opcode/register choices are rejected. */
    opcode(...values) {
        for (const value of values) {
            if (!Number.isInteger(value) || value < 0 || value > 255) {
                throw this.frame.error(`Invalid opcode byte: ${value}`);
            }
            this.parts.push(value);
            this.size++;
        }
        return this;
    }
    /** Retain an operand's pure expression and its target-owned encoding contract. */
    field(value, encoding) {
        this.parts.push({ value, encoding });
        this.size += encoding.width;
        return this;
    }
    /** Relative PC anchors are assigned after the entire instruction size is known. */
    finish(form, state = null) {
        this.frame.choose(form, this.size, state);
        if (this.context) {
            if (!this.context.emission.writeRelocation) {
                throw this.frame.error("Encoder host does not support relocatable fields.");
            }
            for (const part of this.parts) {
                if (typeof part === "number") {
                    this.context.emission.write1(part);
                }
                else {
                    let encoding = part.encoding;
                    if (encoding.kind === "relative" && !encoding.pc) {
                        const start = this.frame.sectionPosition();
                        // The live writer has advanced; the captured start still identifies the entire instruction.
                        encoding = {
                            ...encoding,
                            pc: { section: start.section, offset: this.frame.instructionAddress + this.size },
                        };
                    }
                    const expression = "expression" in part.value ? this.frame.compileLink(part.value) : part.value;
                    this.context.emission.writeRelocation(expression, encoding);
                }
            }
        }
        return this.size;
    }
}
//# sourceMappingURL=relocatable-instruction.js.map