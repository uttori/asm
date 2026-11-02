import type {
  ArchitectureDecodeContext,
  ArchitectureDecodeResult,
  ArchitectureDecoder,
  DecodedInstruction,
  DecodedOperand,
  DecodedReference,
  InstructionStateEffect,
} from "@uttori/asm-core";

import {
  conditionalBranches,
  cpu65816Specifications,
  type Cpu65816InstructionSpecification,
  type Cpu65816WidthFlag,
} from "./65816-spec.js";

/** Width or emulation flag value observed during linear disassembly. */
export type Cpu65816FlagState = 0 | 1 | boolean | "unknown";

/**
 * The state of the 65816 decoder.
 */
export interface Cpu65816DecodeState {
  /** Emulation flag. E=1 forces M=X=1. */
  readonly e?: Cpu65816FlagState;
  /** Accumulator width flag: 1 = 8-bit, 0 = 16-bit. */
  readonly m?: Cpu65816FlagState;
  /** Index width flag: 1 = 8-bit, 0 = 16-bit. */
  readonly x?: Cpu65816FlagState;
  /** Program bank (bits 16–23) of the instruction address being decoded. */
  readonly programBank?: number;
  /** Data bank register assumed for absolute long reads and writes. */
  readonly dataBank?: number;
  /** Direct page base used when formatting DP-relative operands. */
  readonly directPage?: number;
}

/**
 * Returns the value of a 65816 flag.
 * @param value The flag value.
 * @returns The value of the flag.
 */
const flagValue = (value: Cpu65816FlagState | undefined): 0 | 1 | "unknown" => {
  if (value === true || value === 1) {
    return 1;
  }
  if (value === false || value === 0) {
    return 0;
  }
  return "unknown";
};

/**
 * Resolves the width flag for a 65816 instruction.
 * @param state The decoder state.
 * @param flag The width flag to resolve.
 * @returns The resolved width flag.
 */
const resolvedWidthFlag = (
  state: Cpu65816DecodeState,
  flag: Cpu65816WidthFlag,
): 0 | 1 | "unknown" => {
  const emulation = flagValue(state.e);
  if (emulation === 1) {
    return 1;
  }
  const width = flagValue(state[flag]);
  if (width === 1) {
    return 1;
  }
  if (width === 0 && emulation === 0) {
    return 0;
  }
  return "unknown";
};

/**
 * Reads a little-endian value from a byte array.
 * @param bytes The byte array.
 * @param offset The offset to read from.
 * @param width The width of the value to read.
 * @returns The little-endian value.
 */
const readLittleEndian = (bytes: Uint8Array, offset: number, width: number): number => {
  let value = 0;
  for (let index = 0; index < width; index++) {
    value |= (bytes[offset + index] ?? 0) << (index * 8);
  }
  return value >>> 0;
};

/** Operand byte at `index`, or undefined when the fetched instruction is shorter. */
function byteAt(bytes: Uint8Array, index: number): number | undefined {
  return index >= 0 && index < bytes.length ? bytes[index] : undefined;
}

/**
 * Converts a little-endian value to a signed value.
 * @param value The little-endian value.
 * @param width The width of the value.
 * @returns The signed value.
 */
const signed = (value: number, width: number): number => {
  const signBit = 1 << (width * 8 - 1);
  const modulus = 2 ** (width * 8);
  return value & signBit ? value - modulus : value;
};

/**
 * Calculates the bank-local target address for a 65816 instruction.
 * @param logicalAddress The logical address.
 * @param size The size of the instruction.
 * @param displacement The displacement.
 * @returns The bank-local target address.
 */
const bankLocalTarget = (logicalAddress: number, size: number, displacement: number): number =>
  (logicalAddress & 0xff0000) | ((logicalAddress + size + displacement) & 0xffff);

/**
 * Creates an address operand for a 65816 instruction.
 * @param value The value of the operand.
 * @param width The width of the operand.
 * @returns The address operand.
 */
const addressOperand = (value: number, width: number): DecodedOperand => ({
  kind: "address",
  value,
  width,
});

/**
 * Creates the operands for a 65816 instruction.
 * @param specification The instruction specification.
 * @param bytes The bytes of the instruction.
 * @param logicalAddress The logical address of the instruction.
 * @returns The operands for the instruction.
 */
const operandsFor = (
  specification: Cpu65816InstructionSpecification,
  bytes: Uint8Array,
  logicalAddress: number,
): readonly DecodedOperand[] => {
  const firstOperandByte = byteAt(bytes, 1);
  const value8 = firstOperandByte ?? 0;
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
        { kind: "bank", value: byteAt(bytes, 2) ?? 0, width: 1 },
      ];
    default:
      return [];
  }
};

/**
 * Calculates the target address for a 65816 instruction.
 * @param specification The instruction specification.
 * @param operands The operands of the instruction.
 * @param state The decoder state.
 * @param logicalAddress The logical address of the instruction.
 * @returns The target address, or undefined if the target is not a valid address.
 */
const targetFor = (
  specification: Cpu65816InstructionSpecification,
  operands: readonly DecodedOperand[],
  state: Cpu65816DecodeState,
  logicalAddress: number,
): number | undefined => {
  const operand = operands.length > 0 ? operands[0] : undefined;
  if (!operand) {
    return undefined;
  }
  if (operand.targetAddress !== undefined) {
    return operand.targetAddress;
  }
  if (operand.value === undefined) {
    return undefined;
  }
  if (specification.mode === "absoluteLong") {
    return operand.value;
  }
  if (specification.mode === "absolute") {
    const bank = (state.programBank ?? logicalAddress >>> 16) & 0xff;
    return (bank << 16) | operand.value;
  }
  return undefined;
};

/**
 * Calculates the references for a 65816 instruction.
 * @param specification The instruction specification.
 * @param operands The operands of the instruction.
 * @param state The decoder state.
 * @param logicalAddress The logical address of the instruction.
 * @returns The references for the instruction.
 */
const referencesFor = (
  specification: Cpu65816InstructionSpecification,
  operands: readonly DecodedOperand[],
  state: Cpu65816DecodeState,
  logicalAddress: number,
): readonly DecodedReference[] => {
  const { mnemonic, mode } = specification;
  const isBranch = conditionalBranches.has(mnemonic) || mnemonic === "BRA" || mnemonic === "BRL";
  const isCall = mnemonic === "JSR" || mnemonic === "JSL";
  const isJump = mnemonic === "JMP" || mnemonic === "JML";
  if (isBranch || isCall || isJump) {
    const target = targetFor(specification, operands, state, logicalAddress);
    let kind: "branch" | "call" | "jump" = "jump";
    if (isBranch) {
      kind = "branch";
    } else if (isCall) {
      kind = "call";
    }
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
  const memoryMode =
    mode.startsWith("direct") || mode.startsWith("absolute") || mode.startsWith("stackRelative");
  if (!memoryMode || operands[0]?.value === undefined) {
    return [];
  }
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
 * @param specification The instruction specification.
 * @param operands The operands of the instruction.
 * @returns The effects for the instruction.
 */
const effectsFor = (
  specification: Cpu65816InstructionSpecification,
  operands: readonly DecodedOperand[],
): readonly InstructionStateEffect[] => {
  const mask = operands[0]?.value;
  if (specification.operandStatusEffect && mask !== undefined) {
    return [{ kind: specification.operandStatusEffect, target: "p", mask }];
  }
  return specification.effects;
};

/**
 * Builds a decoded instruction for a 65816 instruction.
 * @param specification The instruction specification.
 * @param bytes The bytes of the instruction.
 * @param context The decode context.
 * @param state The decoder state.
 * @returns The decoded instruction.
 */
const buildInstruction = (
  specification: Cpu65816InstructionSpecification,
  bytes: Uint8Array,
  context: ArchitectureDecodeContext<Cpu65816DecodeState>,
  state: Cpu65816DecodeState,
): DecodedInstruction => {
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
export class Cpu65816Decoder implements ArchitectureDecoder<Cpu65816DecodeState> {
  /**
   * Decodes a 65816 instruction.
   * @param context The decode context.
   * @returns The decode result.
   */
  decode(context: ArchitectureDecodeContext<Cpu65816DecodeState>): ArchitectureDecodeResult {
    const availableBytes =
      Number.isInteger(context.offset) && context.offset >= 0
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
    const specification =
      opcode >= 0 && opcode < cpu65816Specifications.length
        ? cpu65816Specifications[opcode]
        : undefined;
    if (!specification) {
      return {
        kind: "error",
        code: "invalidOpcode",
        message: `Unknown 65816 opcode $${opcode.toString(16).padStart(2, "0")}.`,
        offset: context.offset,
      };
    }
    const state = context.state ?? {};
    let sizes: readonly number[] = [specification.minimumSize];
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
      if (!bytes) {
        throw new Error("Decoder byte source violated its bounds contract.");
      }
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
                .map((size) => ({ code: "truncated" as const, size, availableBytes })),
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
 * @param value The value to format.
 * @param width The width of the value.
 * @returns The hexadecimal string.
 */
const hex = (value: number, width: number): string =>
  `$${(value >>> 0)
    .toString(16)
    .toUpperCase()
    .padStart(width * 2, "0")
    .slice(-width * 2)}`;

/**
 * Formats one decoded instruction in this project's native source syntax.
 * @param instruction The decoded 65816 instruction.
 * @returns Canonical native source text.
 */
export function formatCpu65816Instruction(instruction: DecodedInstruction): string {
  if (instruction.architecture !== "snes.65816") {
    throw new Error(`Cannot format architecture '${instruction.architecture}' as 65816.`);
  }
  const operand = instruction.operands.length > 0 ? instruction.operands[0] : undefined;
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
