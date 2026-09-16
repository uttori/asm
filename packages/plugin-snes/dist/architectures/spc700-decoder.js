import { spc700Specifications } from "./spc700-spec.js";
const readLittleEndian = (bytes, offset, width) => {
    let value = 0;
    for (let index = 0; index < width; index++)
        value |= (bytes[offset + index] ?? 0) << (index * 8);
    return value >>> 0;
};
const signedByte = (value) => (value & 0x80 ? value - 0x100 : value);
const register = (name) => ({ kind: "register", register: name });
const address = (value, width) => ({
    kind: "address",
    value,
    width,
});
const immediate = (value) => ({ kind: "immediate", value, width: 1 });
const bit = (value) => ({ kind: "bit", value, width: 1 });
const relative = (value, logicalAddress, size) => ({
    kind: "displacement",
    value: signedByte(value),
    width: 1,
    signed: true,
    targetAddress: (logicalAddress + size + signedByte(value)) & 0xffff,
});
const bitAddress = (bytes) => {
    const encoded = readLittleEndian(bytes, 1, 2);
    return [address(encoded & 0x1fff, 2), bit(encoded >>> 13)];
};
const fixedRegisters = {
    registerA: ["A"],
    registerX: ["X"],
    registerY: ["Y"],
    registerP: ["P"],
    registerYA: ["YA"],
    registerYAX: ["YA", "X"],
    registerXA: ["X", "A"],
    registerAX: ["A", "X"],
    registerXSP: ["X", "SP"],
    registerSPX: ["SP", "X"],
    registerAY: ["A", "Y"],
    registerYA2: ["Y", "A"],
    registerPostIncrementXA: ["X", "A"],
    registerAPostIncrementX: ["A", "X"],
    registerIndirectXA: ["X", "A"],
    registerAIndirectX: ["A", "X"],
    indirectXY: ["X", "Y"],
};
const operandsFor = (specification, bytes, logicalAddress) => {
    const byte = bytes[1] ?? 0;
    const word = readLittleEndian(bytes, 1, 2);
    const fixed = fixedRegisters[specification.mode];
    if (fixed)
        return fixed.map(register);
    switch (specification.mode) {
        case "implied":
            return [];
        case "tableCall":
            return [immediate(specification.opcode[0] >>> 4)];
        case "directBit":
            return [address(byte, 1), bit(Number(specification.mnemonic.at(-1)))];
        case "directBitRelative":
            return [
                address(byte, 1),
                bit(Number(specification.mnemonic.at(-1))),
                relative(bytes[2] ?? 0, logicalAddress, bytes.length),
            ];
        case "accumulatorDirect":
        case "accumulatorDirectIndexedX":
        case "accumulatorDirectIndexedXIndirect":
        case "accumulatorDirectIndirectIndexedY":
            return [register("A"), address(byte, 1)];
        case "accumulatorAbsolute":
        case "accumulatorAbsoluteIndexedX":
        case "accumulatorAbsoluteIndexedY":
            return [register("A"), address(word, 2)];
        case "accumulatorIndirectX":
            return [register("A"), register("X")];
        case "accumulatorImmediate":
            return [register("A"), immediate(byte)];
        case "directDirect":
            return [address(bytes[2] ?? 0, 1), address(byte, 1)];
        case "carryMemoryBit":
        case "carryInvertedMemoryBit": {
            const [memory, bit] = bitAddress(bytes);
            return [register("C"), memory, bit];
        }
        case "memoryBitCarry": {
            const [memory, bit] = bitAddress(bytes);
            return [memory, bit, register("C")];
        }
        case "memoryBit":
            return bitAddress(bytes);
        case "direct":
        case "directIndexedX":
        case "directWord":
            return [address(byte, 1)];
        case "absolute":
        case "absoluteIndexedXIndirect":
            return [address(word, 2)];
        case "relative":
            return [relative(byte, logicalAddress, bytes.length)];
        case "absoluteAccumulator":
            return [address(word, 2), register("A")];
        case "directImmediate":
            return [address(bytes[2] ?? 0, 1), immediate(byte)];
        case "registerXAbsolute":
            return [register("X"), address(word, 2)];
        case "registerXDirect":
        case "registerXDirectIndexedY":
            return [register("X"), address(byte, 1)];
        case "registerYAbsolute":
            return [register("Y"), address(word, 2)];
        case "registerYDirect":
        case "registerYDirectIndexedX":
            return [register("Y"), address(byte, 1)];
        case "registerXImmediate":
            return [register("X"), immediate(byte)];
        case "registerYImmediate":
            return [register("Y"), immediate(byte)];
        case "directRelative":
        case "directIndexedXRelative":
            return [address(byte, 1), relative(bytes[2] ?? 0, logicalAddress, bytes.length)];
        case "registerYRelative":
            return [register("Y"), relative(byte, logicalAddress, bytes.length)];
        case "registerYADirect":
            return [register("YA"), address(byte, 1)];
        case "directRegisterYA":
            return [address(byte, 1), register("YA")];
        case "upperPageCall":
            return [address(0xff00 | byte, 2)];
        case "directRegisterA":
        case "directIndexedXRegisterA":
        case "directIndirectIndexedYRegisterA":
        case "directIndexedXIndirectRegisterA":
            return [address(byte, 1), register("A")];
        case "absoluteRegisterA":
        case "absoluteIndexedXRegisterA":
        case "absoluteIndexedYRegisterA":
            return [address(word, 2), register("A")];
        case "indirectXRegisterA":
            return [register("X"), register("A")];
        case "directRegisterX":
        case "directIndexedYRegisterX":
            return [address(byte, 1), register("X")];
        case "absoluteRegisterX":
            return [address(word, 2), register("X")];
        case "directRegisterY":
        case "directIndexedXRegisterY":
            return [address(byte, 1), register("Y")];
        case "absoluteRegisterY":
            return [address(word, 2), register("Y")];
        default:
            throw new Error(`Unhandled SPC700 decode mode '${specification.mode}'.`);
    }
};
const referencesFor = (specification, operands, state) => {
    const references = [];
    const branchIndex = operands.findIndex((operand) => operand.targetAddress !== undefined);
    if (branchIndex >= 0) {
        references.push({
            kind: "branch",
            operandIndex: branchIndex,
            address: operands[branchIndex].targetAddress,
        });
    }
    else if (specification.mnemonic === "TCALL") {
        const vector = 0xffde - (specification.opcode[0] >>> 4) * 2;
        references.push({ kind: "call", operandIndex: 0, indirect: true });
        references.push({ kind: "pointer", operandIndex: 0, address: vector, indirect: true });
    }
    else if (specification.mnemonic === "PCALL") {
        references.push({ kind: "call", operandIndex: 0, address: operands[0]?.value });
    }
    else if (specification.mnemonic === "CALL" || specification.mnemonic === "JMP") {
        if (specification.flow.indirect) {
            references.push({ kind: "jump", operandIndex: 0, indirect: true });
            references.push({
                kind: "pointer",
                operandIndex: 0,
                address: operands[0]?.value,
                indirect: true,
            });
        }
        else {
            references.push({
                kind: specification.mnemonic === "CALL" ? "call" : "jump",
                operandIndex: 0,
                address: operands[0]?.value,
            });
        }
    }
    for (let index = 0; index < operands.length; index++) {
        const operand = operands[index];
        if (operand.kind !== "address" || operand.value === undefined)
            continue;
        if (references.some((reference) => reference.operandIndex === index))
            continue;
        const isDirect = operand.width === 1;
        let resolved = operand.value;
        if (isDirect) {
            resolved =
                state.directPage === undefined || state.directPage === "unknown"
                    ? undefined
                    : (state.directPage + operand.value) & 0xffff;
        }
        references.push({
            kind: specification.mode.includes("Indirect") ? "pointer" : "data",
            operandIndex: index,
            ...(resolved === undefined ? {} : { address: resolved }),
            ...(specification.mode.includes("Indirect") ? { indirect: true } : {}),
        });
    }
    return references;
};
const buildInstruction = (specification, bytes, context) => {
    const operands = operandsFor(specification, bytes, context.logicalAddress);
    return {
        architecture: "snes.spc700",
        specificationId: specification.id,
        opcode: specification.opcode[0],
        mnemonic: specification.mnemonic,
        mode: specification.mode,
        offset: context.offset,
        logicalAddress: context.logicalAddress & 0xffff,
        bytes,
        size: bytes.length,
        operands,
        references: referencesFor(specification, operands, context.state ?? {}),
        flow: specification.flow,
        effects: specification.effects,
    };
};
/** Fixed-width, bounds-safe decoder for every SPC700 opcode. */
export class Spc700Decoder {
    decode(context) {
        const availableBytes = Number.isInteger(context.offset) && context.offset >= 0
            ? Math.max(0, context.source.length - context.offset)
            : 0;
        const opcode = context.source.readByte(context.offset);
        if (opcode === undefined) {
            return {
                kind: "error",
                code: "outOfBounds",
                message: `Cannot read an SPC700 opcode at offset ${context.offset}.`,
                offset: context.offset,
                requiredBytes: 1,
                availableBytes,
            };
        }
        const specification = spc700Specifications[opcode];
        if (!specification) {
            return {
                kind: "error",
                code: "invalidOpcode",
                message: `Unknown SPC700 opcode $${opcode.toString(16).padStart(2, "0")}.`,
                offset: context.offset,
            };
        }
        const size = specification.minimumSize;
        if (availableBytes < size) {
            return {
                kind: "error",
                code: "truncated",
                message: `Truncated ${specification.mnemonic}: requires ${size} byte(s), ${availableBytes} available.`,
                offset: context.offset,
                requiredBytes: size,
                availableBytes,
            };
        }
        const bytes = context.source.readBytes(context.offset, size);
        if (!bytes)
            throw new Error("Decoder byte source violated its bounds contract.");
        return { kind: "instruction", instruction: buildInstruction(specification, bytes, context) };
    }
}
const hex = (value, width) => `$${(value >>> 0)
    .toString(16)
    .toUpperCase()
    .padStart(width * 2, "0")
    .slice(-width * 2)}`;
const formatOperands = (instruction) => {
    const values = instruction.operands.map((operand) => operand.value ?? 0);
    const target = instruction.operands.find((operand) => operand.targetAddress !== undefined)?.targetAddress;
    const dp = () => hex(values.find((_, index) => instruction.operands[index].kind === "address") ?? 0, 1);
    const abs = () => hex(values.find((_, index) => instruction.operands[index].kind === "address") ?? 0, 2);
    const bit = () => values.find((_, index) => instruction.operands[index].kind === "bit") ?? 0;
    const relativeTarget = () => hex(target ?? 0, 2);
    switch (instruction.mode) {
        case "implied":
            return "";
        case "tableCall":
            return String(values[0]);
        case "directBit":
            return dp();
        case "directBitRelative":
            return `${dp()},${relativeTarget()}`;
        case "accumulatorDirect":
            return `A,${dp()}`;
        case "accumulatorAbsolute":
            return `A,${abs()}`;
        case "accumulatorIndirectX":
        case "registerAIndirectX":
            return "A,(X)";
        case "accumulatorDirectIndexedXIndirect":
            return `A,(${dp()}+X)`;
        case "accumulatorImmediate":
            return `A,#${hex(values[1], 1)}`;
        case "directDirect":
            return `${hex(values[0], 1)},${hex(values[1], 1)}`;
        case "carryMemoryBit":
            return `C,${abs()}.${bit()}`;
        case "carryInvertedMemoryBit":
            return `C,/${abs()}.${bit()}`;
        case "memoryBitCarry":
            return `${abs()}.${bit()},C`;
        case "memoryBit":
            return `${abs()}.${bit()}`;
        case "direct":
        case "directWord":
            return dp();
        case "directIndexedX":
            return `${dp()}+X`;
        case "absolute":
            return abs();
        case "relative":
            return relativeTarget();
        case "absoluteAccumulator":
            return `${abs()},A`;
        case "accumulatorDirectIndexedX":
            return `A,${dp()}+X`;
        case "accumulatorAbsoluteIndexedX":
            return `A,${abs()}+X`;
        case "accumulatorAbsoluteIndexedY":
            return `A,${abs()}+Y`;
        case "accumulatorDirectIndirectIndexedY":
            return `A,(${dp()})+Y`;
        case "directImmediate":
            return `${hex(values[0], 1)},#${hex(values[1], 1)}`;
        case "indirectXY":
            return "(X),(Y)";
        case "registerXAbsolute":
            return `X,${abs()}`;
        case "registerXDirect":
            return `X,${dp()}`;
        case "registerXDirectIndexedY":
            return `X,${dp()}+Y`;
        case "registerYAbsolute":
            return `Y,${abs()}`;
        case "registerYDirect":
            return `Y,${dp()}`;
        case "registerYDirectIndexedX":
            return `Y,${dp()}+X`;
        case "registerXImmediate":
            return `X,#${hex(values[1], 1)}`;
        case "registerYImmediate":
            return `Y,#${hex(values[1], 1)}`;
        case "absoluteIndexedXIndirect":
            return `(${abs()}+X)`;
        case "directRelative":
            return `${hex(values[0], 1)},${relativeTarget()}`;
        case "directIndexedXRelative":
            return `${hex(values[0], 1)}+X,${relativeTarget()}`;
        case "registerYRelative":
            return `Y,${relativeTarget()}`;
        case "registerYADirect":
            return `YA,${dp()}`;
        case "directRegisterYA":
            return `${dp()},YA`;
        case "upperPageCall":
            return hex(values[0] & 0xff, 1);
        case "directRegisterA":
            return `${dp()},A`;
        case "absoluteRegisterA":
            return `${abs()},A`;
        case "indirectXRegisterA":
            return "(X),A";
        case "directIndexedXIndirectRegisterA":
            return `(${dp()}+X),A`;
        case "directIndexedXRegisterA":
            return `${dp()}+X,A`;
        case "absoluteIndexedXRegisterA":
            return `${abs()}+X,A`;
        case "absoluteIndexedYRegisterA":
            return `${abs()}+Y,A`;
        case "directIndirectIndexedYRegisterA":
            return `(${dp()})+Y,A`;
        case "directRegisterX":
            return `${dp()},X`;
        case "directIndexedYRegisterX":
            return `${dp()}+Y,X`;
        case "absoluteRegisterX":
            return `${abs()},X`;
        case "directRegisterY":
            return `${dp()},Y`;
        case "directIndexedXRegisterY":
            return `${dp()}+X,Y`;
        case "absoluteRegisterY":
            return `${abs()},Y`;
        default:
            return spc700Specifications[instruction.opcode]?.syntax ?? "";
    }
};
/**
 * Formats one decoded instruction in this project's native SPC700 syntax.
 * @param {DecodedInstruction} instruction Decoded SPC700 instruction.
 * @returns {string} Canonical native source text.
 */
export function formatSpc700Instruction(instruction) {
    if (instruction.architecture !== "snes.spc700") {
        throw new Error(`Cannot format architecture '${instruction.architecture}' as SPC700.`);
    }
    const operands = formatOperands(instruction);
    return operands === "" ? instruction.mnemonic : `${instruction.mnemonic} ${operands}`;
}
//# sourceMappingURL=spc700-decoder.js.map