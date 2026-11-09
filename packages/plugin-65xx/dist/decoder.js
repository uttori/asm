import { getCpuDecodeTable, getOpcodeForm, nmos6502Cpu } from "./instructions/opcodes.js";
/**
 * Formats an unsigned value as uppercase `$`-prefixed hex.
 * @param value Value to format.
 * @param width Minimum digit count.
 * @returns Zero-padded hex text.
 */
const hex = (value, width = 2) => `$${value.toString(16).toUpperCase().padStart(width, "0")}`;
/**
 * Computes total encoded size of a form.
 * @param form Instruction form.
 * @returns Prefix/opcode bytes plus operand field widths.
 */
const sizeOf = (form) => form.encoding.length + form.operands.reduce((sum, field) => sum + field.width, 0);
/** Fixed-width NMOS specifications share the encoder's exact opcode table, including aliases. */
export function cpu6502Specifications(cpu) {
    return getCpuDecodeTable(cpu).map((form) => ({
        id: `${cpu.id}:${form.opcode.toString(16).padStart(2, "0")}`,
        architecture: cpu.id,
        opcode: form.encoding,
        mnemonic: form.mnemonic,
        mode: form.mode,
        minimumSize: sizeOf(form),
        maximumSize: sizeOf(form),
        summary: form.note,
    }));
}
/** NMOS/Ricoh decoder. BRK owns its opcode; its skipped signature byte remains independently preserved data. */
export class Cpu6502Decoder {
    cpu;
    #forms;
    constructor(cpu = nmos6502Cpu) {
        this.cpu = cpu;
        if (!cpu.features.has("nmos") || cpu.features.has("dtv")) {
            throw new Error("The NMOS decoder requires an NMOS 6502 or Ricoh CPU profile.");
        }
        this.#forms = new Map(getCpuDecodeTable(cpu).map((form) => [form.opcode, form]));
    }
    /**
     * Decodes one instruction at `context.offset`.
     * @param context Byte source, offset, and 16-bit logical PC.
     * @returns Decoded instruction, or an error for an invalid PC, missing/truncated bytes, or an opcode absent from this CPU's table.
     */
    decode(context) {
        const { source, offset, logicalAddress } = context;
        if (!Number.isInteger(logicalAddress) || logicalAddress < 0 || logicalAddress > 0xffff) {
            return {
                kind: "error",
                code: "invalidState",
                offset,
                message: "6502 PC must be an unsigned 16-bit address.",
            };
        }
        const opcode = source.readByte(offset);
        if (opcode === undefined) {
            return {
                kind: "error",
                code: "outOfBounds",
                offset,
                message: "Opcode is outside the byte source.",
            };
        }
        const form = this.#forms.get(opcode);
        if (!form) {
            return {
                kind: "error",
                code: "invalidOpcode",
                offset,
                message: `Unsupported ${this.cpu.id} opcode ${hex(opcode)}.`,
            };
        }
        const size = sizeOf(form);
        const bytes = source.readBytes(offset, size);
        if (!bytes) {
            return {
                kind: "error",
                code: "truncated",
                offset,
                requiredBytes: size,
                availableBytes: Math.max(0, source.length - offset),
                message: "Truncated 6502 instruction.",
            };
        }
        let value = bytes.at(1) ?? 0;
        if (size === 3) {
            value |= bytes[2] << 8;
        }
        const operands = [];
        const references = [];
        let flow = { kind: "fallthrough", fallthrough: true };
        if (form.mode === "relative") {
            const displacement = value >= 128 ? value - 256 : value;
            const targetAddress = (logicalAddress + size + displacement) & 0xffff;
            operands.push({
                kind: "displacement",
                value: displacement,
                width: 1,
                signed: true,
                targetAddress,
            });
            references.push({ kind: "branch", address: targetAddress, operandIndex: 0 });
            flow = { kind: "conditionalBranch", fallthrough: true };
        }
        else if (size > 1) {
            const immediate = form.mode === "immediate";
            operands.push({ kind: immediate ? "immediate" : "address", value, width: size - 1 });
            if (!immediate) {
                const indirect = form.mode === "indirect" ||
                    form.mode === "indexedIndirectX" ||
                    form.mode === "indirectIndexedY";
                let kind = "data";
                if (form.mnemonic === "JSR") {
                    kind = "call";
                }
                if (form.mnemonic === "JMP") {
                    kind = "jump";
                }
                references.push({ kind, address: value, indirect, operandIndex: 0 });
            }
        }
        else if (form.mode === "accumulator") {
            operands.push({ kind: "accumulator", register: "a" });
        }
        if (form.mnemonic === "JSR") {
            flow = { kind: "call", fallthrough: true };
        }
        if (form.mnemonic === "JMP") {
            flow = { kind: "jump", fallthrough: false, indirect: form.mode === "indirect" };
        }
        if (form.mnemonic === "RTS" || form.mnemonic === "RTI") {
            flow = { kind: "return", fallthrough: false };
        }
        if (form.mnemonic === "BRK") {
            flow = { kind: "interrupt", fallthrough: false };
        }
        if (form.mnemonic === "JAM") {
            flow = { kind: "stop", fallthrough: false };
        }
        return {
            kind: "instruction",
            instruction: {
                architecture: this.cpu.id,
                specificationId: `${this.cpu.id}:${opcode.toString(16).padStart(2, "0")}`,
                opcode,
                mnemonic: form.mnemonic,
                mode: form.mode,
                offset,
                logicalAddress,
                bytes,
                size,
                operands,
                references,
                flow,
                effects: [{ kind: "custom", name: "nmos6502", details: { opcode } }],
            },
        };
    }
}
/** Uppercase, reassemblable ca65 text. Duplicate unofficial encodings remain explicit bytes rather than canonicalizing. */
export function formatCpu6502Instruction(instruction, 
/** Trusted address expression with the same numeric value; encoded operand width remains forced. */
addressExpression) {
    const form = getOpcodeForm(instruction.opcode);
    if (!form.canonical) {
        return `.byte ${[...instruction.bytes].map((byte) => hex(byte)).join(", ")} ; ${form.mnemonic}`;
    }
    const operand = instruction.operands.at(0);
    const value = operand?.value ?? 0;
    let text = "";
    let suffix = "";
    switch (form.mode) {
        case "implied":
            break;
        case "accumulator":
            text = "A";
            break;
        case "immediate":
            text = `#${hex(value)}`;
            break;
        case "relative":
            text = hex(operand.targetAddress, 4);
            break;
        case "zeroPage":
            text = addressExpression ?? hex(value);
            if (addressExpression) {
                // Exported symbols can be unresolved during layout; force the captured zero-page encoding.
                suffix = ".b";
            }
            break;
        case "zeroPageIndexedX":
            text = `${addressExpression ?? hex(value)},X`;
            if (addressExpression) {
                suffix = ".b";
            }
            break;
        case "zeroPageIndexedY":
            text = `${addressExpression ?? hex(value)},Y`;
            if (addressExpression) {
                suffix = ".b";
            }
            break;
        case "absolute":
            text = addressExpression ?? hex(value, 4);
            suffix = ".w";
            break;
        case "absoluteIndexedX":
            text = `${addressExpression ?? hex(value, 4)},X`;
            suffix = ".w";
            break;
        case "absoluteIndexedY":
            text = `${addressExpression ?? hex(value, 4)},Y`;
            suffix = ".w";
            break;
        case "indirect":
            text = `(${addressExpression ?? hex(value, 4)})`;
            suffix = ".w";
            break;
        case "indexedIndirectX":
            text = `(${addressExpression ?? hex(value)},X)`;
            if (addressExpression) {
                // An unresolved pointer must retain the 2A03 zero-page form during layout.
                suffix = ".b";
            }
            break;
        case "indirectIndexedY":
            text = `(${addressExpression ?? hex(value)}),Y`;
            break;
        // Other 65xx dialect modes cannot occur in an NMOS opcode table.
        case "absoluteIndexedIndirect":
        case "absoluteLongIndexedX":
        case "accumulatorRelative":
        case "basePageIndirectIndexedZ":
        case "blockTransfer":
        case "immediateAbsolute":
        case "immediateAbsoluteIndexedX":
        case "immediateZeroPage":
        case "immediateZeroPageIndexedX":
        case "quadAccumulator":
        case "relative16":
        case "specialPage":
        case "stackRelative":
        case "stackRelativeIndirectIndexedY":
        case "zeroPageImmediate":
        case "zeroPageIndirect":
        case "zeroPageIndirectIndexedZ":
        case "zeroPageIndirectLong":
        case "zeroPageRelative":
            throw new Error(`Unsupported NMOS mode ${form.mode}.`);
    }
    return `${form.mnemonic}${suffix}${text ? ` ${text}` : ""}`;
}
//# sourceMappingURL=decoder.js.map