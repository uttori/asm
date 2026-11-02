import { RelocatableInstruction, linkConstant } from "@uttori/asm-core";
import { buildInstructionCatalog } from "./instructions/catalog.js";
import { getCpuAssemblyForms, nmos6502DecodeTable } from "./instructions/opcodes.js";
import { matchesFeatures, } from "./instructions/schema.js";
import { variantFormsByCpuId } from "./instructions/variants.js";
import { prepare65xx, selectedScalar, generatedValue, } from "./operands/resolution.js";
import { syntax65xx } from "./operands/syntax.js";
const directToAbsolute = {
    zeroPage: "absolute",
    zeroPageIndexedX: "absoluteIndexedX",
    zeroPageIndexedY: "absoluteIndexedY",
    zeroPageIndirect: "indirect",
    indexedIndirectX: "absoluteIndexedIndirect",
};
/** `.b`: demote abs forms. Missing twins (e.g. no `STX abs,y`) error at resolve. */
const absoluteToDirect = {
    absolute: "zeroPage",
    absoluteIndexedX: "zeroPageIndexedX",
    absoluteIndexedY: "zeroPageIndexedY",
    indirect: "zeroPageIndirect",
    absoluteIndexedIndirect: "indexedIndirectX",
};
/** Every addressing mode. A missing key fails typechecking when the mode union grows. */
const addressingModes = {
    implied: true,
    accumulator: true,
    immediate: true,
    zeroPage: true,
    zeroPageIndexedX: true,
    zeroPageIndexedY: true,
    absolute: true,
    absoluteIndexedX: true,
    absoluteIndexedY: true,
    absoluteLongIndexedX: true,
    indirect: true,
    zeroPageIndirect: true,
    zeroPageIndirectLong: true,
    indexedIndirectX: true,
    indirectIndexedY: true,
    absoluteIndexedIndirect: true,
    zeroPageIndirectIndexedZ: true,
    stackRelative: true,
    stackRelativeIndirectIndexedY: true,
    relative: true,
    relative16: true,
    zeroPageRelative: true,
    accumulatorRelative: true,
    zeroPageImmediate: true,
    specialPage: true,
    blockTransfer: true,
    immediateZeroPage: true,
    immediateZeroPageIndexedX: true,
    immediateAbsolute: true,
    immediateAbsoluteIndexedX: true,
    basePageIndirectIndexedZ: true,
    quadAccumulator: true,
};
/**
 * Accepts a classified 65xx addressing mode.
 * @param {string} value Operand mode string.
 * @returns {boolean} True when `value` is a known mode.
 */
function isAddressingMode(value) {
    for (const mode of Object.keys(addressingModes)) {
        if (value === mode) {
            return true;
        }
    }
    return false;
}
/**
 * Looks up a zp/absolute twin. Unknown mode strings have no twin.
 * @param {Readonly<Partial<Record<AddressingMode, AddressingMode>>>} table Width-promotion map.
 * @param {string | undefined} mode Classified mode, which may be outside the mode union.
 * @returns {AddressingMode | undefined} The paired mode, when one exists.
 */
function mappedAddressingMode(table, mode) {
    if (mode === undefined || !isAddressingMode(mode)) {
        return undefined;
    }
    return table[mode];
}
const aliasToMnemonic = new Map();
for (const form of nmos6502DecodeTable) {
    for (const alias of form.aliases ?? []) {
        aliasToMnemonic.set(alias, form.mnemonic);
    }
}
const modeSize = (form) => form.encoding.length + form.operands.reduce((size, operand) => size + operand.width, 0);
/** All shipped 65xx forms use this selector for both layout and emission. */
export class TypedArch65xx {
    cpu;
    supportsRelocatable = true;
    deferOperandBindingErrors = true;
    forms;
    catalog;
    formsByMnemonic = new Map();
    constructor(cpu) {
        this.cpu = cpu;
        this.forms = getCpuAssemblyForms(cpu).filter((form) => matchesFeatures(form.availableWhen, cpu.features));
        this.catalog = buildInstructionCatalog(this.forms);
        for (const form of this.forms) {
            this.formsByMnemonic.set(form.mnemonic, [
                ...(this.formsByMnemonic.get(form.mnemonic) ?? []),
                form,
            ]);
        }
    }
    /** Failed binding retains parsed punctuation so addressing errors keep precedence over value reads. */
    syntax(frame) {
        const syntax = syntax65xx(frame.instruction.operands);
        return frame.bindingFailure
            ? { ...syntax, operands: syntax.policy65xx.unboundOperands }
            : syntax;
    }
    /** Record classification effects before form selection; this receipt does not yet carry a size. */
    prepare(frame) {
        const state = prepare65xx(this.syntax(frame), frame);
        frame.chooseScalars(state.mode, 0, state.mode, state.length, state.generated, state.value, state.native, state.specialPage);
    }
    /** Reuse this occurrence's preparation without repeating its width probes during encoding. */
    classification(frame) {
        const value = frame.preparation?.state;
        if (Array.isArray(value)) {
            const tuple = value;
            const [mode, length, generated, scalar, native, specialPage] = tuple;
            if (value.length !== 6 ||
                typeof mode !== "string" ||
                typeof length !== "number" ||
                typeof generated !== "boolean" ||
                typeof scalar !== "number" ||
                typeof native !== "boolean" ||
                typeof specialPage !== "boolean") {
                throw new Error("Invalid prepared 65xx snapshot.");
            }
            return { mode, length, generated, value: scalar, native, specialPage };
        }
        if (value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            "mode" in value &&
            "length" in value &&
            "generated" in value &&
            "value" in value &&
            "native" in value &&
            "specialPage" in value &&
            typeof value.mode === "string" &&
            typeof value.length === "number" &&
            typeof value.generated === "boolean" &&
            typeof value.value === "number" &&
            typeof value.native === "boolean" &&
            typeof value.specialPage === "boolean") {
            return {
                mode: value.mode,
                length: value.length,
                generated: value.generated,
                value: value.value,
                native: value.native,
                specialPage: value.specialPage,
            };
        }
        return prepare65xx(this.syntax(frame), frame);
    }
    estimate(frame) {
        const state = this.classification(frame);
        const form = this.resolveForm(frame, this.syntax(frame), state);
        const size = form ? modeSize(form) : 0;
        frame.choose(form ? form.mnemonic + ":" + form.mode : "unknown", size, {
            cpu: this.cpu.id,
            mode: form?.mode ?? "unknown",
        });
        return size;
    }
    resolveForm(frame, syntax, operand) {
        const parsed = syntax.policy65xx;
        let mnemonic = parsed.mnemonic;
        let forms = this.formsByMnemonic.get(mnemonic);
        if (!forms) {
            const canonical = aliasToMnemonic.get(mnemonic);
            const aliasedForms = canonical ? this.formsByMnemonic.get(canonical) : undefined;
            if (canonical && aliasedForms) {
                mnemonic = canonical;
                forms = aliasedForms;
            }
        }
        const { forcedWidth } = parsed;
        if (!forms) {
            // Cross-CPU scans are diagnostic work; ordinary form selection does not need them.
            const variantArchitectures = Object.entries(variantFormsByCpuId)
                .filter(([, entries]) => entries.some((entry) => entry.mnemonic === parsed.mnemonic))
                .map(([cpuId]) => cpuId);
            // Wrong-CPU diagnostics: "this mnemonic exists on 65c02, not 6502"
            // vs unofficial-only "needs 65xx.6502x".
            if (variantArchitectures.length > 0) {
                throw frame.error(`Instruction '${parsed.mnemonic}' is available on ${variantArchitectures.join(", ")}, not ${this.cpu.id}.`);
            }
            const knownOnlyOn6502x = nmos6502DecodeTable.some((form) => form.mnemonic === mnemonic || form.aliases?.includes(mnemonic));
            if (knownOnlyOn6502x) {
                throw frame.error(`Instruction '${mnemonic}' or this operand form requires architecture '65xx.6502x'.`);
            }
            return undefined;
        }
        const hasOperand = parsed.hasOperand;
        if (mnemonic === "BRK" && forcedWidth === 2) {
            throw frame.error("BRK accepts at most an 8-bit signature byte.");
        }
        let mode = operand.mode;
        if (parsed.originalRegister === "a") {
            mode = "accumulator";
        }
        if (parsed.originalRegister === "q") {
            mode = "quadAccumulator";
        }
        if (this.cpu.id === "65xx.m740" &&
            mnemonic === "JSR" &&
            mode === "absolute" &&
            operand.specialPage) {
            mode = "specialPage";
        }
        // Branches: any operand is a target. Don't treat `$12` as zp.
        if (hasOperand && forms.some((entry) => entry.mode === "relative16")) {
            mode = "relative16";
        }
        else if (hasOperand && forms.some((entry) => entry.mode === "relative")) {
            mode = "relative";
        }
        if (!hasOperand && !forms.some((entry) => entry.mode === "implied")) {
            if (forms.some((entry) => entry.mode === "accumulator")) {
                mode = "accumulator";
            }
            else if (forms.some((entry) => entry.mode === "quadAccumulator")) {
                mode = "quadAccumulator";
            }
        }
        if (forcedWidth) {
            const byteMode = mappedAddressingMode(absoluteToDirect, mode);
            const wordMode = mappedAddressingMode(directToAbsolute, mode);
            const alreadyRequestedWidth = (forcedWidth === 1 && mode.startsWith("zeroPage")) ||
                (forcedWidth === 2 &&
                    (mode === "absolute" || mode === "indirect" || mode.startsWith("absoluteIndexed")));
            if (!byteMode && !wordMode && !alreadyRequestedWidth) {
                throw frame.error(`Width suffix '.${forcedWidth === 1 ? "b" : "w"}' is not valid for ${mnemonic} ${mode}.`);
            }
            const promoted = forcedWidth === 1 ? byteMode : wordMode;
            mode = promoted ?? mode;
        }
        let form = forms.find((entry) => entry.mode === mode);
        const widened = mappedAddressingMode(directToAbsolute, mode);
        if (!form && widened) {
            form = forms.find((entry) => entry.mode === widened);
        }
        if (!form) {
            const accepted = forms.map((entry) => entry.mode).join(", ");
            throw frame.error(`${mnemonic} does not support addressing mode '${mode}' on ${this.cpu.id}. Expected ${accepted}.`);
        }
        return form;
    }
    /** Validate the complete operand tuple before the first opcode/prefix write. */
    encode(frame, context) {
        const syntax = this.syntax(frame);
        const state = this.classification(frame);
        const form = this.resolveForm(frame, syntax, state);
        if (!form) {
            return false;
        }
        if (frame.isRelocatable) {
            return this.encodeModule(frame, context, syntax, form);
        }
        frame.choose(form.mnemonic + ":" + form.mode, modeSize(form), {
            cpu: this.cpu.id,
            mode: form.mode,
        });
        const scalar = selectedScalar(syntax);
        const generated = state.generated && (!state.native || state.value < 0 || !Number.isInteger(state.value));
        const value = (width, description, immediate = false) => this.readValue(frame, scalar, width, description, immediate, generated ? state.value : undefined, state.generated
            ? "$" + state.value.toString(16).toUpperCase()
            : syntax.policy65xx.scalarDisplay, syntax.policy65xx.whole.unbound);
        const p = syntax.policy65xx.parts;
        const expect = (count, description) => {
            if (p.length !== count) {
                throw frame.error(form.mnemonic + " expects " + description + ".");
            }
        };
        const branch = (operand, prepared, display, unbound = false) => this.readBranch(frame, operand, form.relativeBaseOffset ?? modeSize(form), form.codec === "relative16" ? 2 : 1, prepared, display, unbound);
        const values = [];
        switch (form.codec) {
            case "none":
                break;
            case "unsigned8":
            case "unsigned16-le":
            case "unsigned24-le": {
                let width = 1;
                if (form.codec === "unsigned16-le") {
                    width = 2;
                }
                else if (form.codec === "unsigned24-le") {
                    width = 3;
                }
                const v = value(width, form.mnemonic + (width === 1 ? " operand" : " address"), state.mode === "immediate");
                if (form.operandConstraint === "power-of-two" && (v === 0 || (v & (v - 1)) !== 0)) {
                    throw frame.error(form.mnemonic + " operand must be a power of two.");
                }
                values.push(v);
                break;
            }
            case "relative8":
            case "relative16":
                values.push(branch(scalar, state.generated ? state.value : undefined, state.generated
                    ? "$" + state.value.toString(16).toUpperCase()
                    : syntax.policy65xx.scalarDisplay, syntax.policy65xx.whole.unbound));
                break;
            case "zero-page-relative8":
                expect(2, "a zero-page address and branch target");
                values.push(this.readValue(frame, p[0].scalar, 1, form.mnemonic + " address", false, undefined, p[0].display, p[0].unbound), branch(p[1].scalar, undefined, p[1].display, p[1].unbound));
                break;
            case "accumulator-relative8":
                expect(2, "A and a branch target");
                if (syntax.operands[0]?.kind !== "register" || syntax.operands[0].name !== "a") {
                    throw frame.error(form.mnemonic + " accumulator branch must use A.");
                }
                values.push(branch(p[1].scalar, undefined, p[1].display, p[1].unbound));
                break;
            case "zero-page-immediate8":
                expect(2, "a zero-page address and immediate value");
                if (!p[1].immediate) {
                    throw frame.error(form.mnemonic + " second operand must be immediate.");
                }
                values.push(this.readValue(frame, p[0].scalar, 1, form.mnemonic + " address", false, undefined, p[0].display, p[0].unbound), this.readValue(frame, p[1].scalar, 1, form.mnemonic + " immediate", true, undefined, p[1].display, p[1].unbound));
                break;
            case "three-unsigned16-le":
                expect(3, "source, destination, and length operands");
                for (let i = 0; i < p.length; i++) {
                    values.push(this.readValue(frame, p[i].scalar, 2, form.mnemonic + " " + ["source", "destination", "length"][i], false, undefined, p[i].display, p[i].unbound));
                }
                break;
            case "immediate-unsigned8":
            case "immediate-unsigned16": {
                const indexed = form.mode.endsWith("IndexedX");
                expect(indexed ? 3 : 2, "an immediate value and address");
                if (!p[0].immediate) {
                    throw frame.error(form.mnemonic + " first operand must be immediate.");
                }
                values.push(this.readValue(frame, p[0].scalar, 1, form.mnemonic + " immediate", true, undefined, p[0].display, p[0].unbound), this.readValue(frame, p[1].scalar, form.codec === "immediate-unsigned8" ? 1 : 2, form.mnemonic + " address", false, undefined, p[1].display, p[1].unbound));
                break;
            }
            case "special-page": {
                const v = value(2, form.mnemonic + " special-page address");
                if ((v & 0xff00) !== 0xff00) {
                    throw frame.error(form.mnemonic + " special-page address must be in $FF00-$FFFF.");
                }
                values.push(v & 0xff);
                break;
            }
        }
        context.emission.writeBytes(form.encoding);
        // The form table supplies widths/order for every codec, including vendor compound operations.
        for (let i = 0; i < values.length; i++) {
            const width = form.operands[i].width;
            const mask = 2 ** (width * 8) - 1;
            context.emission.writeValue(values[i] & mask, width, "little");
        }
        return true;
    }
    /** Form tables supply every field's width/order, including vendor and prefixed instructions. */
    encodeModule(frame, context, syntax, form) {
        const instruction = new RelocatableInstruction(frame, context).opcode(...form.encoding);
        const parts = syntax.policy65xx.parts;
        const scalar = selectedScalar(syntax);
        let fields = [scalar];
        switch (form.codec) {
            case "none":
                fields = [];
                break;
            case "accumulator-relative8":
                fields = [parts[1].scalar];
                break;
            case "zero-page-relative8":
            case "zero-page-immediate8":
            case "three-unsigned16-le":
            case "immediate-unsigned8":
            case "immediate-unsigned16":
                fields = parts.slice(0, form.operands.length).map((part) => part.scalar);
                break;
            case "relative16":
            case "relative8":
            case "special-page":
            case "unsigned16-le":
            case "unsigned24-le":
            case "unsigned8":
                if (!syntax.policy65xx.hasOperand && form.mnemonic === "BRK") {
                    fields = [linkConstant(0)];
                }
                break;
        }
        if (fields.length !== form.operands.length || fields.some((field) => !field)) {
            throw frame.error(`${form.mnemonic} requires ${form.operands.length} encoded operands.`);
        }
        for (let index = 0; index < fields.length; index++) {
            const field = form.operands[index];
            const relative = field.relative === true ||
                form.codec === "relative8" ||
                form.codec === "relative16" ||
                (form.codec === "zero-page-relative8" && index === 1) ||
                form.codec === "accumulator-relative8";
            const encoding = {
                width: field.width,
                kind: relative ? "relative" : "absolute",
                addressWidth: 16,
                wrapWidth: 16,
            };
            if (relative) {
                const start = frame.sectionPosition();
                instruction.field(fields[index], {
                    ...encoding,
                    signed: true,
                    pc: {
                        section: start.section,
                        offset: frame.instructionAddress + (form.relativeBaseOffset ?? modeSize(form)),
                    },
                });
            }
            else if (form.codec === "special-page") {
                instruction.field(fields[index], { ...encoding, minimum: 0xff00, maximum: 0xffff });
            }
            else {
                const immediate = form.mode === "immediate" ||
                    (form.codec.startsWith("immediate-") && index === 0) ||
                    (form.codec === "zero-page-immediate8" && index === 1);
                instruction.field(fields[index], {
                    ...encoding,
                    minimum: immediate ? -(2 ** (8 * field.width - 1)) : 0,
                    constraint: form.operandConstraint === "power-of-two" ? "powerOfTwo" : undefined,
                });
            }
        }
        instruction.finish(`${form.mnemonic}:${form.mode}`, { cpu: this.cpu.id, mode: form.mode });
        return true;
    }
    /** Validate before writing, retaining a classification value only when its evaluation schedule requires it. */
    readValue(frame, scalar, width, description, immediate = false, prepared, displayText, unbound = false) {
        let value;
        if (unbound && frame.bindingFailure?.reason === "other") {
            throw new Error(frame.bindingFailure.message);
        }
        else if (prepared === undefined) {
            value = frame.evaluate(scalar, "beforeOpcode", false, "numeric", displayText).value;
        }
        else {
            // Invalid generated numbers use the same sizing placeholder as deferred math errors.
            value =
                frame.stageName !== "emitProgram" && (!Number.isInteger(prepared) || prepared < 0)
                    ? 0
                    : generatedValue(prepared);
            frame.observe(scalar, value, "beforeOpcode", displayText);
        }
        const minimum = width === 1 && immediate ? -128 : 0;
        const maximum = 2 ** (width * 8) - 1;
        if (!Number.isInteger(value) || value < minimum || value > maximum) {
            throw frame.error(description + " " + value + " is outside the " + width * 8 + "-bit range.");
        }
        return value & maximum;
    }
    /** Relative streams select against the same reference cursor used by the wrapping subtraction. */
    readBranch(frame, scalar, offset, width, prepared, displayText, unbound = false) {
        if (frame.stageName !== "emitProgram") {
            return 0;
        }
        const reference = (frame.currentAddress() + offset) & 0xffff;
        let target;
        if (unbound && frame.bindingFailure?.reason === "other") {
            throw new Error(frame.bindingFailure.message);
        }
        else if (prepared !== undefined) {
            target = generatedValue(prepared);
            frame.observe(scalar, target, "beforeOpcode", displayText);
        }
        else if (scalar.expression.type === "relativeReference" &&
            scalar.expression.stream === "relative") {
            const result = frame.reference(scalar.expression, reference);
            if (result.kind === "error") {
                throw result.error;
            }
            if (result.kind === "missing") {
                throw new Error("Error: Label '" + result.name + "' not found.");
            }
            target = result.value;
        }
        else {
            target = frame.evaluate(scalar, "beforeOpcode", false, "numeric", displayText).value;
        }
        if (!Number.isInteger(target) || target < 0 || target > 0xffff) {
            throw frame.error("Branch target " + target + " is outside the 16-bit address space.");
        }
        const delta = ((target - reference + 0x8000) & 0xffff) - 0x8000;
        const minimum = width === 1 ? -128 : -32768;
        const maximum = width === 1 ? 127 : 32767;
        if (delta < minimum || delta > maximum) {
            throw frame.error("Branch target $" +
                target.toString(16).toUpperCase() +
                " is out of range from $" +
                reference.toString(16).toUpperCase() +
                " (" +
                delta +
                ").");
        }
        return delta;
    }
}
//# sourceMappingURL=typed-architecture.js.map