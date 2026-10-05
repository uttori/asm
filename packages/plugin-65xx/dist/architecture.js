/**
 * Table-driven 65xx encoder. Forms come from the NMOS grid or ca65-derived
 * variant tables. `.b`/`.w` force zp vs abs. Branches use `+`/`-` unnamed labels.
 */
import { buildInstructionCatalog } from "./instructions/catalog.js";
import { getCpuAssemblyForms, nmos6502DecodeTable } from "./instructions/opcodes.js";
import { matchesFeatures, } from "./instructions/schema.js";
import { variantFormsByCpuId } from "./instructions/variants.js";
/** `.w` / inferred-abs: promote zp forms to their 16-bit twins. */
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
/**
 * Parses a mnemonic with optional width suffix.
 * `LDA.B` / `STA.W` - ca65-style width force. `.L` is not a 65xx suffix here.
 * @param {string} value The mnemonic to parse.
 * @returns {ParsedMnemonic} The parsed mnemonic.
 */
function parseMnemonic(value) {
    const match = value
        .trim()
        .toUpperCase()
        .match(/^([A-Z][\dA-Z]{2,4})(?:\.([BW]))?$/);
    if (!match) {
        return { mnemonic: value.trim().toUpperCase() };
    }
    let forcedWidth;
    if (match[2] === "B") {
        forcedWidth = 1;
    }
    else if (match[2] === "W") {
        forcedWidth = 2;
    }
    return {
        mnemonic: match[1],
        forcedWidth,
    };
}
/**
 * Calculates the size of an instruction in bytes.
 * @param {InstructionForm} form The instruction form.
 * @returns {number} The size of the instruction in bytes.
 */
function modeSize(form) {
    return form.encoding.length + form.operands.reduce((size, operand) => size + operand.width, 0);
}
/**
 * Concatenates opcode/prefix bytes with already-encoded operand bytes.
 * Used by tests and tooling. The live encoder writes through `emission` instead.
 * @param {InstructionForm} form The instruction form.
 * @param {readonly number[]} operandBytes The operand bytes.
 * @returns {Uint8Array} The materialized opcode form.
 */
export function materializeOpcodeForm(form, operandBytes = []) {
    const expected = form.operands.reduce((size, operand) => size + operand.width, 0);
    if (operandBytes.length !== expected) {
        throw new Error(`${form.mnemonic} ${form.mode} expects ${expected} encoded operand byte(s), got ${operandBytes.length}.`);
    }
    for (const byte of operandBytes) {
        if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
            throw new RangeError(`Encoded operand byte ${byte} is outside the byte range.`);
        }
    }
    return Uint8Array.from([...form.encoding, ...operandBytes]);
}
/**
 * Splits top-level operands in a string.
 * BBR/BBS `zp,target` - do not split on commas inside `(...)` or `[...]`.
 * @param {string} value The string to split.
 * @returns {string[]} The split operands.
 */
function splitTopLevelOperands(value) {
    const operands = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < value.length; index++) {
        const character = value[index];
        if (character === "(" || character === "[") {
            depth++;
        }
        else if (character === ")" || character === "]") {
            depth--;
        }
        else if (character === "," && depth === 0) {
            operands.push(value.slice(start, index).trim());
            start = index + 1;
        }
    }
    operands.push(value.slice(start).trim());
    return operands.filter(Boolean);
}
/**
 * Table-driven encoder for one {@link CpuDefinition}. Unknown mnemonics that
 * exist only on another CPU get a targeted diagnostic. Truly unknown ops
 * return false so the assembler can try the next architecture.
 */
export class Arch65xx {
    context;
    cpu;
    forms;
    catalog;
    formsByMnemonic = new Map();
    /**
     * @param {ArchitectureEncoderContext} context Encoder host (operands, emission, diagnostics).
     * @param {CpuDefinition} cpu CPU whose feature set filters {@link getCpuAssemblyForms}.
     */
    constructor(context, cpu) {
        this.context = context;
        this.cpu = cpu;
        this.forms = getCpuAssemblyForms(cpu).filter((form) => matchesFeatures(form.availableWhen, cpu.features));
        this.catalog = buildInstructionCatalog(this.forms);
        const grouped = new Map();
        for (const form of this.forms) {
            const entries = grouped.get(form.mnemonic) ?? [];
            entries.push(form);
            grouped.set(form.mnemonic, entries);
        }
        for (const [mnemonic, entries] of grouped) {
            this.formsByMnemonic.set(mnemonic, entries);
        }
    }
    getInstructionCatalog() {
        return this.catalog;
    }
    /**
     * Estimates size from tokenized words.
     * @param {readonly string[]} words Mnemonic plus rest-of-line operand.
     * @returns {number} Encoded size in bytes, or 0 if unknown.
     */
    estimateSize(words) {
        if (words.length === 0) {
            return 0;
        }
        const operand = words.slice(1).join(" ");
        return this.estimateResolved(words[0] ?? "", this.context.operands.lowerOperand(operand));
    }
    /**
     * Encodes tokenized words. Returns false when the mnemonic is unknown on this CPU.
     * @param {readonly string[]} words Mnemonic plus rest-of-line operand.
     * @returns {boolean} True if encoded.
     */
    encode(words) {
        if (words.length === 0) {
            return true;
        }
        const operand = words.slice(1).join(" ");
        return this.encodeResolved(words[0] ?? "", this.context.operands.lowerOperand(operand));
    }
    /**
     * Estimates the size of a resolved instruction.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {number} The estimated size in bytes.
     */
    estimateInstruction(instruction) {
        return this.estimateResolved(instruction.mnemonic, instruction.loweredOperand);
    }
    /**
     * Encodes a resolved instruction.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {boolean} True if encoded.
     */
    encodeInstruction(instruction) {
        return this.encodeResolved(instruction.mnemonic, instruction.loweredOperand);
    }
    /**
     * Estimates the size of a resolved instruction.
     * @param {string} rawMnemonic The raw mnemonic.
     * @param {LoweredOperand} operand The operand.
     * @returns {number} The estimated size in bytes.
     */
    estimateResolved(rawMnemonic, operand) {
        const resolved = this.resolveForm(rawMnemonic, operand);
        return resolved ? modeSize(resolved) : 0;
    }
    /**
     * Encodes a resolved instruction.
     * @param {string} rawMnemonic The raw mnemonic.
     * @param {LoweredOperand} operand The operand.
     * @returns {boolean} True if encoded.
     */
    encodeResolved(rawMnemonic, operand) {
        const resolved = this.resolveForm(rawMnemonic, operand);
        if (!resolved) {
            return false;
        }
        const form = resolved;
        const relativeBaseOffset = form.relativeBaseOffset ?? modeSize(form);
        let branchDelta = 0;
        if (form.codec === "relative8" || form.codec === "relative16") {
            const branchWidth = form.codec === "relative8" ? 1 : 2;
            branchDelta = this.readBranchDelta(operand, relativeBaseOffset, branchWidth);
        }
        const compoundOperands = form.codec === "zero-page-relative8" ||
            form.codec === "accumulator-relative8" ||
            form.codec === "zero-page-immediate8" ||
            form.codec === "three-unsigned16-le" ||
            form.codec === "immediate-unsigned8" ||
            form.codec === "immediate-unsigned16"
            ? splitTopLevelOperands(operand.expanded)
            : [];
        const compoundValues = this.readCompoundValues(form, compoundOperands);
        // Only unsigned codecs use the generic operand reader below.
        let operandWidth = 0;
        if (form.codec === "unsigned8") {
            operandWidth = 1;
        }
        else if (form.codec === "unsigned16-le") {
            operandWidth = 2;
        }
        else if (form.codec === "unsigned24-le") {
            operandWidth = 3;
        }
        const operandKind = operandWidth === 1 ? "operand" : "address";
        let operandValue = 0;
        if (operandWidth !== 0) {
            operandValue = this.readExpressionValue(operand.baseExpression ?? operand.expanded, operandWidth, `${form.mnemonic} ${operandKind}`, operand.mode === "immediate");
            if (form.operandConstraint === "power-of-two" &&
                (operandValue === 0 || (operandValue & (operandValue - 1)) !== 0)) {
                throw this.context.diagnostics.error(`${form.mnemonic} operand must be a power of two.`);
            }
        }
        const specialPageValue = form.codec === "special-page"
            ? this.readExpressionValue(operand.baseExpression ?? operand.expanded, 2, `${form.mnemonic} special-page address`, false)
            : 0;
        if (form.codec === "special-page" && (specialPageValue & 0xff00) !== 0xff00) {
            throw this.context.diagnostics.error(`${form.mnemonic} special-page address must be in $FF00-$FFFF.`);
        }
        this.context.emission.writeBytes(form.encoding);
        switch (form.codec) {
            case "none":
                return true;
            case "unsigned8":
                this.context.emission.writeByte(operandValue);
                return true;
            case "unsigned16-le":
                this.context.emission.writeValue(operandValue, 2, "little");
                return true;
            case "unsigned24-le":
                this.context.emission.writeValue(operandValue, 3, "little");
                return true;
            case "relative8":
                this.context.emission.writeByte(branchDelta & 0xff);
                return true;
            case "relative16":
                this.context.emission.writeValue(branchDelta & 0xffff, 2, "little");
                return true;
            case "zero-page-relative8": {
                this.context.emission.writeByte(compoundValues[0] ?? 0);
                this.context.emission.writeByte((compoundValues[1] ?? 0) & 0xff);
                return true;
            }
            case "accumulator-relative8":
                this.context.emission.writeByte((compoundValues[0] ?? 0) & 0xff);
                return true;
            case "zero-page-immediate8":
                this.context.emission.writeByte(compoundValues[0] ?? 0);
                this.context.emission.writeByte(compoundValues[1] ?? 0);
                return true;
            case "special-page":
                this.context.emission.writeByte(specialPageValue & 0xff);
                return true;
            case "three-unsigned16-le":
                for (const value of compoundValues) {
                    this.context.emission.writeValue(value, 2, "little");
                }
                return true;
            case "immediate-unsigned8":
                this.context.emission.writeByte(compoundValues[0] ?? 0);
                this.context.emission.writeByte(compoundValues[1] ?? 0);
                return true;
            case "immediate-unsigned16":
                this.context.emission.writeByte(compoundValues[0] ?? 0);
                this.context.emission.writeValue(compoundValues[1] ?? 0, 2, "little");
                return true;
        }
        return false;
    }
    /**
     * Reads compound values from operands.
     * @param {InstructionForm} form The instruction form.
     * @param {readonly string[]} operands The operands.
     * @returns {readonly number[]} The compound values.
     */
    readCompoundValues(form, operands) {
        const expect = (count, description) => {
            if (operands.length !== count) {
                throw this.context.diagnostics.error(`${form.mnemonic} expects ${description}.`);
            }
        };
        switch (form.codec) {
            case "zero-page-relative8":
                expect(2, "a zero-page address and branch target");
                return [
                    this.readExpressionValue(operands[0] ?? "", 1, `${form.mnemonic} address`, false),
                    this.readBranchExpression(operands[1] ?? "", form.relativeBaseOffset ?? modeSize(form), 1),
                ];
            case "accumulator-relative8":
                expect(2, "A and a branch target");
                if (operands[0]?.trim().toUpperCase() !== "A") {
                    throw this.context.diagnostics.error(`${form.mnemonic} accumulator branch must use A.`);
                }
                return [
                    this.readBranchExpression(operands[1] ?? "", form.relativeBaseOffset ?? modeSize(form), 1),
                ];
            case "zero-page-immediate8":
                expect(2, "a zero-page address and immediate value");
                if (!operands[1]?.trim().startsWith("#")) {
                    throw this.context.diagnostics.error(`${form.mnemonic} second operand must be immediate.`);
                }
                return [
                    this.readExpressionValue(operands[0] ?? "", 1, `${form.mnemonic} address`, false),
                    this.readExpressionValue(operands[1]?.trim().slice(1) ?? "", 1, `${form.mnemonic} immediate`, true),
                ];
            case "three-unsigned16-le":
                expect(3, "source, destination, and length operands");
                return operands.map((expression, index) => this.readExpressionValue(expression, 2, `${form.mnemonic} ${["source", "destination", "length"][index]}`, false));
            case "immediate-unsigned8":
            case "immediate-unsigned16": {
                const indexed = form.mode.endsWith("IndexedX");
                expect(indexed ? 3 : 2, "an immediate value and address");
                if (!operands[0]?.trim().startsWith("#")) {
                    throw this.context.diagnostics.error(`${form.mnemonic} first operand must be immediate.`);
                }
                if (indexed && operands[2]?.trim().toUpperCase() !== "X") {
                    throw this.context.diagnostics.error(`${form.mnemonic} indexed test operand must use X.`);
                }
                return [
                    this.readExpressionValue(operands[0]?.trim().slice(1) ?? "", 1, `${form.mnemonic} immediate`, true),
                    this.readExpressionValue(operands[1] ?? "", form.codec === "immediate-unsigned8" ? 1 : 2, `${form.mnemonic} address`, false),
                ];
            }
            case "none":
            case "relative16":
            case "relative8":
            case "special-page":
            case "unsigned16-le":
            case "unsigned24-le":
            case "unsigned8":
            default:
                return [];
        }
    }
    /**
     * Resolves a form for a mnemonic and operand.
     * @param {string} rawMnemonic The raw mnemonic.
     * @param {LoweredOperand} operand The operand.
     * @returns {InstructionForm | undefined} The resolved form.
     */
    resolveForm(rawMnemonic, operand) {
        const parsed = parseMnemonic(rawMnemonic);
        let mnemonic = parsed.mnemonic;
        let forms = this.formsByMnemonic.get(mnemonic);
        const variantArchitectures = Object.entries(variantFormsByCpuId)
            .filter(([, entries]) => entries.some((entry) => entry.mnemonic === parsed.mnemonic))
            .map(([cpuId]) => cpuId);
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
            // Wrong-CPU diagnostics: "this mnemonic exists on 65c02, not 6502"
            // vs unofficial-only "needs 65xx.6502x".
            if (variantArchitectures.length > 0) {
                throw this.context.diagnostics.error(`Instruction '${parsed.mnemonic}' is available on ${variantArchitectures.join(", ")}, not ${this.cpu.id}.`);
            }
            const knownOnlyOn6502x = nmos6502DecodeTable.some((form) => form.mnemonic === mnemonic || form.aliases?.includes(mnemonic));
            if (knownOnlyOn6502x) {
                throw this.context.diagnostics.error(`Instruction '${mnemonic}' or this operand form requires architecture '65xx.6502x'.`);
            }
            return undefined;
        }
        const hasOperand = operand.raw.trim() !== "";
        if (mnemonic === "BRK" && forcedWidth === 2) {
            throw this.context.diagnostics.error("BRK accepts at most an 8-bit signature byte.");
        }
        let mode = operand.mode;
        if (operand.raw.trim().toUpperCase() === "A") {
            mode = "accumulator";
        }
        if (operand.raw.trim().toUpperCase() === "Q") {
            mode = "quadAccumulator";
        }
        if (this.cpu.id === "65xx.m740" &&
            mnemonic === "JSR" &&
            mode === "absolute" &&
            /^(?:\$ff[\da-f]{2}|0xff[\da-f]{2})$/i.test(operand.expanded.trim())) {
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
            const alreadyRequestedWidth = (forcedWidth === 1 && mode !== undefined && mode.startsWith("zeroPage")) ||
                (forcedWidth === 2 &&
                    (mode === "absolute" ||
                        mode === "indirect" ||
                        (mode !== undefined && mode.startsWith("absoluteIndexed"))));
            if (!byteMode && !wordMode && !alreadyRequestedWidth) {
                throw this.context.diagnostics.error(`Width suffix '.${forcedWidth === 1 ? "b" : "w"}' is not valid for ${mnemonic} ${mode}.`);
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
            throw this.context.diagnostics.error(`${mnemonic} does not support addressing mode '${mode ?? "unknown"}' on ${this.cpu.id}. Expected ${accepted}.`);
        }
        return form;
    }
    /**
     * Reads an expression value.
     * @param {string} expression The expression.
     * @param {1 | 2 | 3} width The width.
     * @param {string} description The description.
     * @param {boolean} immediate Whether the expression is immediate.
     * @returns {number} The value.
     */
    readExpressionValue(expression, width, description, immediate) {
        const value = this.context.operands.getnum(expression);
        const minimum = width === 1 && immediate ? -128 : 0;
        let maximum = 0xff;
        if (width === 2) {
            maximum = 0xffff;
        }
        else if (width === 3) {
            maximum = 0xffffff;
        }
        // Immediate `#-1` is allowed for 8-bit (signed). Addresses stay unsigned.
        if (!Number.isInteger(value) || value < minimum || value > maximum) {
            throw this.context.diagnostics.error(`${description} ${value} is outside the ${width * 8}-bit range.`);
        }
        return value & maximum;
    }
    /**
     * Reads a branch delta.
     * @param {LoweredOperand} operand The operand.
     * @param {number} relativeBaseOffset The relative base offset.
     * @param {1 | 2} width The width.
     * @returns {number} The branch delta.
     */
    readBranchDelta(operand, relativeBaseOffset, width) {
        return this.readBranchExpression(operand.baseExpression ?? operand.expanded, relativeBaseOffset, width);
    }
    /**
     * Reads a branch expression.
     * @param {string} expression The expression.
     * @param {number} relativeBaseOffset The relative base offset.
     * @param {1 | 2} width The width.
     * @returns {number} The branch expression.
     */
    readBranchExpression(expression, relativeBaseOffset, width) {
        if (!this.context.branches.enforceResolvedLabels()) {
            return 0;
        }
        const reference = (this.context.sizing.getCurrentAddress() + relativeBaseOffset) & 0xffff;
        let target;
        // Unnamed labels: Asar `+`/`++` forward, `-`/`--` backward. Ca65 `:+` / `:-`.
        if (/^\++$/.test(expression)) {
            target = this.context.branches.findNextLabel(expression, reference);
        }
        else if (/^-+$/.test(expression)) {
            target = this.context.branches.findPreviousLabel(expression, reference);
        }
        else {
            target = this.context.operands.getnum(expression);
        }
        if (!Number.isInteger(target) || target < 0 || target > 0xffff) {
            throw this.context.diagnostics.error(`Branch target ${target} is outside the 16-bit address space.`);
        }
        // Sign-extend the wrapping 16-bit subtraction before checking the branch width.
        const delta = ((target - reference + 0x8000) & 0xffff) - 0x8000;
        const minimum = width === 1 ? -128 : -32768;
        const maximum = width === 1 ? 127 : 32767;
        if (delta < minimum || delta > maximum) {
            throw this.context.diagnostics.error(`Branch target $${target.toString(16).toUpperCase()} is out of range from $${reference.toString(16).toUpperCase()} (${delta}).`);
        }
        return delta;
    }
}
//# sourceMappingURL=architecture.js.map