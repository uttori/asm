import { conditionalBranches, cpu65816Specifications, } from "./65816-spec.js";
/**
 * Returns the value of a 65816 flag.
 * @param {Cpu65816FlagState | undefined} value The flag value.
 * @returns {0 | 1 | "unknown"} The value of the flag.
 */
const flagValue = (value) => {
    if (value === true || value === 1)
        return 1;
    if (value === false || value === 0)
        return 0;
    return "unknown";
};
/**
 * Resolves the width flag for a 65816 instruction.
 * @param {Cpu65816DecodeState} state The decoder state.
 * @param {Cpu65816WidthFlag} flag The width flag to resolve.
 * @returns {0 | 1 | "unknown"} The resolved width flag.
 */
const resolvedWidthFlag = (state, flag) => {
    const emulation = flagValue(state.e);
    if (emulation === 1)
        return 1;
    const width = flagValue(state[flag]);
    if (width === 1)
        return 1;
    if (width === 0 && emulation === 0)
        return 0;
    return "unknown";
};
/**
 * Reads a little-endian value from a byte array.
 * @param {Uint8Array} bytes The byte array.
 * @param {number} offset The offset to read from.
 * @param {number} width The width of the value to read.
 * @returns {number} The little-endian value.
 */
const readLittleEndian = (bytes, offset, width) => {
    let value = 0;
    for (let index = 0; index < width; index++)
        value |= (bytes[offset + index] ?? 0) << (index * 8);
    return value >>> 0;
};
/**
 * Converts a little-endian value to a signed value.
 * @param {number} value The little-endian value.
 * @param {number} width The width of the value.
 * @returns {number} The signed value.
 */
const signed = (value, width) => {
    const signBit = 1 << (width * 8 - 1);
    const modulus = 2 ** (width * 8);
    return value & signBit ? value - modulus : value;
};
/**
 * Calculates the bank-local target address for a 65816 instruction.
 * @param {number} logicalAddress The logical address.
 * @param {number} size The size of the instruction.
 * @param {number} displacement The displacement.
 * @returns {number} The bank-local target address.
 */
const bankLocalTarget = (logicalAddress, size, displacement) => (logicalAddress & 0xff0000) | ((logicalAddress + size + displacement) & 0xffff);
/**
 * Creates an address operand for a 65816 instruction.
 * @param {number} value The value of the operand.
 * @param {number} width The width of the operand.
 * @returns {DecodedOperand} The address operand.
 */
const addressOperand = (value, width) => ({
    kind: "address",
    value,
    width,
});
/**
 * Creates the operands for a 65816 instruction.
 * @param {Cpu65816InstructionSpecification} specification The instruction specification.
 * @param {Uint8Array} bytes The bytes of the instruction.
 * @param {number} logicalAddress The logical address of the instruction.
 * @returns {readonly DecodedOperand[]} The operands for the instruction.
 */
const operandsFor = (specification, bytes, logicalAddress) => {
    const value8 = bytes[1] ?? 0;
    const value16 = readLittleEndian(bytes, 1, 2);
    const value24 = readLittleEndian(bytes, 1, 3);
    switch (specification.mode) {
        case "implied":
            return [];
        case "accumulator":
            return [{ kind: "accumulator", register: "a" }];
        case "signature":
            return [{ kind: "signature", value: value8, width: 1 }];
        case "immediate":
            return [
                {
                    kind: "immediate",
                    value: bytes.length === 2 ? value8 : value16,
                    width: bytes.length - 1,
                },
            ];
        case "immediate16":
            return [{ kind: "immediate", value: value16, width: 2 }];
        case "direct":
        case "directIndexedX":
        case "directIndexedY":
        case "directIndirect":
        case "directIndirectLong":
        case "directIndexedXIndirect":
        case "directIndirectIndexedY":
        case "directIndirectLongIndexedY":
        case "stackRelative":
        case "stackRelativeIndirectIndexedY":
            return [addressOperand(value8, 1)];
        case "absolute":
        case "absoluteIndexedX":
        case "absoluteIndexedY":
        case "absoluteIndirect":
        case "absoluteIndexedXIndirect":
        case "absoluteIndirectLong":
            return [addressOperand(value16, 2)];
        case "absoluteLong":
        case "absoluteLongIndexedX":
            return [addressOperand(value24, 3)];
        case "relative": {
            const displacement = signed(value8, 1);
            return [
                {
                    kind: "displacement",
                    value: displacement,
                    width: 1,
                    signed: true,
                    targetAddress: bankLocalTarget(logicalAddress, bytes.length, displacement),
                },
            ];
        }
        case "relativeLong": {
            const displacement = signed(value16, 2);
            return [
                {
                    kind: "displacement",
                    value: displacement,
                    width: 2,
                    signed: true,
                    targetAddress: bankLocalTarget(logicalAddress, bytes.length, displacement),
                },
            ];
        }
        case "blockMove":
            // The project's native/Asar-compatible source syntax follows encoded byte order.
            return [
                { kind: "bank", value: value8, width: 1 },
                { kind: "bank", value: bytes[2] ?? 0, width: 1 },
            ];
        default:
            return [];
    }
};
/**
 * Calculates the target address for a 65816 instruction.
 * @param {Cpu65816InstructionSpecification} specification The instruction specification.
 * @param {readonly DecodedOperand[]} operands The operands of the instruction.
 * @param {Cpu65816DecodeState} state The decoder state.
 * @param {number} logicalAddress The logical address of the instruction.
 * @returns {number | undefined} The target address, or undefined if the target is not a valid address.
 */
const targetFor = (specification, operands, state, logicalAddress) => {
    const operand = operands[0];
    if (!operand)
        return undefined;
    if (operand.targetAddress !== undefined)
        return operand.targetAddress;
    if (operand.value === undefined)
        return undefined;
    if (specification.mode === "absoluteLong")
        return operand.value;
    if (specification.mode === "absolute") {
        const bank = (state.programBank ?? logicalAddress >>> 16) & 0xff;
        return (bank << 16) | operand.value;
    }
    return undefined;
};
/**
 * Calculates the references for a 65816 instruction.
 * @param {Cpu65816InstructionSpecification} specification The instruction specification.
 * @param {readonly DecodedOperand[]} operands The operands of the instruction.
 * @param {Cpu65816DecodeState} state The decoder state.
 * @param {number} logicalAddress The logical address of the instruction.
 * @returns {readonly DecodedReference[]} The references for the instruction.
 */
const referencesFor = (specification, operands, state, logicalAddress) => {
    const { mnemonic, mode } = specification;
    const isBranch = conditionalBranches.has(mnemonic) || mnemonic === "BRA" || mnemonic === "BRL";
    const isCall = mnemonic === "JSR" || mnemonic === "JSL";
    const isJump = mnemonic === "JMP" || mnemonic === "JML";
    if (isBranch || isCall || isJump) {
        const target = targetFor(specification, operands, state, logicalAddress);
        let kind = "jump";
        if (isBranch)
            kind = "branch";
        else if (isCall)
            kind = "call";
        return [
            {
                kind,
                operandIndex: 0,
                ...(target === undefined ? {} : { address: target }),
                ...(mode.includes("Indirect") ? { indirect: true } : {}),
            },
        ];
    }
    if (mode.includes("Indirect")) {
        const value = operands[0]?.value;
        return [
            {
                kind: "pointer",
                operandIndex: 0,
                ...(value === undefined ? {} : { address: value }),
                indirect: true,
            },
        ];
    }
    const memoryMode = mode.startsWith("direct") || mode.startsWith("absolute") || mode.startsWith("stackRelative");
    if (!memoryMode || operands[0]?.value === undefined)
        return [];
    if (mode.startsWith("direct")) {
        return [
            {
                kind: "data",
                operandIndex: 0,
                ...(state.directPage === undefined
                    ? {}
                    : { address: (state.directPage + operands[0].value) & 0xffff }),
            },
        ];
    }
    if (!mode.startsWith("absoluteLong") && mode.startsWith("absolute")) {
        return [
            {
                kind: "data",
                operandIndex: 0,
                ...(state.dataBank === undefined
                    ? {}
                    : { address: ((state.dataBank & 0xff) << 16) | operands[0].value }),
            },
        ];
    }
    return [{ kind: "data", operandIndex: 0, address: operands[0].value }];
};
/**
 * Calculates the effects for a 65816 instruction.
 * @param {Cpu65816InstructionSpecification} specification The instruction specification.
 * @param {readonly DecodedOperand[]} operands The operands of the instruction.
 * @returns {readonly InstructionStateEffect[]} The effects for the instruction.
 */
const effectsFor = (specification, operands) => {
    const mask = operands[0]?.value;
    if (specification.operandStatusEffect && mask !== undefined) {
        return [{ kind: specification.operandStatusEffect, target: "p", mask }];
    }
    return specification.effects;
};
/**
 * Builds a decoded instruction for a 65816 instruction.
 * @param {Cpu65816InstructionSpecification} specification The instruction specification.
 * @param {Uint8Array} bytes The bytes of the instruction.
 * @param {ArchitectureDecodeContext<Cpu65816DecodeState>} context The decode context.
 * @param {Cpu65816DecodeState} state The decoder state.
 * @returns {DecodedInstruction} The decoded instruction.
 */
const buildInstruction = (specification, bytes, context, state) => {
    const operands = operandsFor(specification, bytes, context.logicalAddress);
    return {
        architecture: "snes.65816",
        specificationId: specification.id,
        opcode: specification.opcode[0],
        mnemonic: specification.mnemonic,
        mode: specification.mode,
        offset: context.offset,
        logicalAddress: context.logicalAddress & 0xffffff,
        bytes,
        size: bytes.length,
        operands,
        references: referencesFor(specification, operands, state, context.logicalAddress),
        flow: specification.flow,
        effects: effectsFor(specification, operands),
    };
};
/**
 * The 65816 decoder.
 */
export class Cpu65816Decoder {
    /**
     * Decodes a 65816 instruction.
     * @param {ArchitectureDecodeContext<Cpu65816DecodeState>} context The decode context.
     * @returns {ArchitectureDecodeResult} The decode result.
     */
    decode(context) {
        const availableBytes = Number.isInteger(context.offset) && context.offset >= 0
            ? Math.max(0, context.source.length - context.offset)
            : 0;
        const opcode = context.source.readByte(context.offset);
        if (opcode === undefined) {
            return {
                kind: "error",
                code: "outOfBounds",
                message: `Cannot read a 65816 opcode at offset ${context.offset}.`,
                offset: context.offset,
                requiredBytes: 1,
                availableBytes,
            };
        }
        const specification = cpu65816Specifications[opcode];
        if (!specification) {
            return {
                kind: "error",
                code: "invalidOpcode",
                message: `Unknown 65816 opcode $${opcode.toString(16).padStart(2, "0")}.`,
                offset: context.offset,
            };
        }
        const state = context.state ?? {};
        let sizes = [specification.minimumSize];
        if (specification.widthFlag) {
            const width = resolvedWidthFlag(state, specification.widthFlag);
            sizes = width === "unknown" ? [2, 3] : [width === 1 ? 2 : 3];
        }
        const minimumSize = Math.min(...sizes);
        const maximumSize = Math.max(...sizes);
        if (availableBytes < minimumSize) {
            return {
                kind: "error",
                code: "truncated",
                message: `Truncated ${specification.mnemonic}: requires at least ${minimumSize} byte(s), ${availableBytes} available.`,
                offset: context.offset,
                requiredBytes: minimumSize,
                availableBytes,
            };
        }
        if (sizes.length === 1 && availableBytes < maximumSize) {
            return {
                kind: "error",
                code: "truncated",
                message: `Truncated ${specification.mnemonic}: requires ${maximumSize} byte(s), ${availableBytes} available.`,
                offset: context.offset,
                requiredBytes: maximumSize,
                availableBytes,
            };
        }
        const availableSizes = sizes.filter((size) => size <= availableBytes);
        const alternatives = availableSizes.map((size) => {
            const bytes = context.source.readBytes(context.offset, size);
            if (!bytes)
                throw new Error("Decoder byte source violated its bounds contract.");
            return buildInstruction(specification, bytes, context, state);
        });
        if (sizes.length === 2) {
            return {
                kind: "ambiguous",
                reason: `The 65816 ${specification.widthFlag?.toUpperCase()} flag is unknown.`,
                requiredState: [specification.widthFlag ?? "m"],
                alternatives,
                ...(availableSizes.length === sizes.length
                    ? {}
                    : {
                        unavailableAlternatives: sizes
                            .filter((size) => size > availableBytes)
                            .map((size) => ({ code: "truncated", size, availableBytes })),
                    }),
                minimumSize: 2,
                maximumSize: 3,
            };
        }
        return { kind: "instruction", instruction: alternatives[0] };
    }
}
/**
 * Formats a value as a hexadecimal string.
 * @param {number} value The value to format.
 * @param {number} width The width of the value.
 * @returns {string} The hexadecimal string.
 */
const hex = (value, width) => `$${(value >>> 0)
    .toString(16)
    .toUpperCase()
    .padStart(width * 2, "0")
    .slice(-width * 2)}`;
/**
 * Formats one decoded instruction in this project's native source syntax.
 * @param {DecodedInstruction} instruction The decoded 65816 instruction.
 * @returns {string} Canonical native source text.
 */
export function formatCpu65816Instruction(instruction) {
    if (instruction.architecture !== "snes.65816") {
        throw new Error(`Cannot format architecture '${instruction.architecture}' as 65816.`);
    }
    const operand = instruction.operands[0];
    const value = operand?.value ?? 0;
    let text = "";
    switch (instruction.mode) {
        case "implied":
            break;
        // The project encoder's native accumulator spelling omits the operand.
        case "accumulator":
            break;
        case "signature":
            text = `#${hex(value, 1)}`;
            break;
        case "immediate":
            text = `#${hex(value, operand?.width ?? 1)}`;
            break;
        case "immediate16":
            text = hex(value, 2);
            break;
        case "direct":
            text = hex(value, 1);
            break;
        case "directIndexedX":
            text = `${hex(value, 1)},x`;
            break;
        case "directIndexedY":
            text = `${hex(value, 1)},y`;
            break;
        case "directIndirect":
            text = instruction.mnemonic === "PEI" ? hex(value, 1) : `(${hex(value, 1)})`;
            break;
        case "directIndirectLong":
            text = `[${hex(value, 1)}]`;
            break;
        case "directIndexedXIndirect":
            text = `(${hex(value, 1)},x)`;
            break;
        case "directIndirectIndexedY":
            text = `(${hex(value, 1)}),y`;
            break;
        case "directIndirectLongIndexedY":
            text = `[${hex(value, 1)}],y`;
            break;
        case "stackRelative":
            text = `${hex(value, 1)},s`;
            break;
        case "stackRelativeIndirectIndexedY":
            text = `(${hex(value, 1)},s),y`;
            break;
        case "absolute":
            text = hex(value, 2);
            break;
        case "absoluteIndexedX":
            text = `${hex(value, 2)},x`;
            break;
        case "absoluteIndexedY":
            text = `${hex(value, 2)},y`;
            break;
        case "absoluteLong":
            text = hex(value, 3);
            break;
        case "absoluteLongIndexedX":
            text = `${hex(value, 3)},x`;
            break;
        case "absoluteIndirect":
            text = `(${hex(value, 2)})`;
            break;
        case "absoluteIndexedXIndirect":
            text = `(${hex(value, 2)},x)`;
            break;
        case "absoluteIndirectLong":
            text = `[${hex(value, 2)}]`;
            break;
        case "relative":
            text = hex(operand?.targetAddress ?? 0, 3);
            break;
        case "relativeLong":
            text = instruction.mnemonic === "PER" ? hex(value, 2) : hex(operand?.targetAddress ?? 0, 3);
            break;
        case "blockMove":
            text = `${hex(instruction.operands[0]?.value ?? 0, 1)},${hex(instruction.operands[1]?.value ?? 0, 1)}`;
            break;
        default:
            throw new Error(`Unsupported 65816 formatter mode '${instruction.mode}'.`);
    }
    return text ? `${instruction.mnemonic} ${text}` : instruction.mnemonic;
}
//# sourceMappingURL=65816-decoder.js.map