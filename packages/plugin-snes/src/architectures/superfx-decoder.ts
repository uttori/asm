import type {
  ArchitectureDecodeContext,
  ArchitectureDecodeResult,
  ArchitectureDecoder,
  DecodedInstruction,
  DecodedOperand,
  DecodedReference,
  InstructionFlow,
} from "@uttori/asm-core";

import {
  superFxFusedSpecifications,
  superFxOpcodeMatrix,
  isSuperFxAltState,
  type SuperFxAltState,
  type SuperFxFusedInstructionSpecification,
  type SuperFxInstructionSpecification,
} from "./superfx-spec.js";

/** Decode-time GSU selector state. Unknown fields produce explicit ambiguity. */
export interface SuperFxDecodeState {
  /** Current GSU ALT selector, or unknown when disassembly cannot prove it. */
  readonly alt?: SuperFxAltState | "unknown";
  /** TO/WITH-selected destination register, if tracked. */
  readonly destinationRegister?: number | "unknown";
  /** FROM/WITH-selected source register, if tracked. */
  readonly sourceRegister?: number | "unknown";
  /** Program bank assumed when resolving R15 jump targets. */
  readonly programBank?: number | "unknown";
}

/** Reads a little-endian 16-bit word from an instruction byte slice. */
const word = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
/** Formats a hardware register index as an Rn decoded operand. */
const register = (value: number): DecodedOperand => ({ kind: "register", register: `R${value}` });
/** Formats a numeric immediate decoded operand with optional signed semantics. */
const immediate = (value: number, width: number, signed = false): DecodedOperand => ({
  kind: "immediate",
  value,
  width,
  ...(signed ? { signed: true } : {}),
});
/** Formats a RAM or absolute address decoded operand at the given width. */
const address = (value: number, width: number): DecodedOperand => ({
  kind: "address",
  value,
  width,
});

/** Decodes operands for one effective GSU specification and fetched byte span. */
const operandsFor = (
  specification: SuperFxInstructionSpecification,
  bytes: Uint8Array,
  prefixLength: number,
  logicalAddress: number,
): readonly DecodedOperand[] => {
  const operandOffset = prefixLength + 1;
  const registerNumber = specification.register ?? 0;
  switch (specification.operandEncoding) {
    case "implied":
      return [];
    case "relative": {
      const raw = bytes[operandOffset] ?? 0;
      // Branch displacement is a signed byte.
      const displacement = raw & 0x80 ? raw - 0x100 : raw;
      return [
        {
          kind: "displacement",
          value: displacement,
          width: 1,
          signed: true,
          targetAddress:
            (logicalAddress & 0xff0000) | ((logicalAddress + bytes.length + displacement) & 0xffff),
        },
      ];
    }
    case "register":
    case "registerIndirect":
      return [register(registerNumber)];
    case "immediateNibble":
      return [immediate(registerNumber, 1)];
    case "registerImmediate8":
      return [register(registerNumber), immediate(bytes[operandOffset] ?? 0, 1, true)];
    case "registerImmediate16":
      return [register(registerNumber), immediate(word(bytes, operandOffset), 2)];
    case "registerRamShort":
      return [register(registerNumber), address((bytes[operandOffset] ?? 0) << 1, 2)];
    case "ramShortRegister":
      return [address((bytes[operandOffset] ?? 0) << 1, 2), register(registerNumber)];
    case "registerRamAbsolute":
      return [register(registerNumber), address(word(bytes, operandOffset), 2)];
    case "ramAbsoluteRegister":
      return [address(word(bytes, operandOffset), 2), register(registerNumber)];
  }
  throw new Error("Unsupported SuperFX operand encoding.");
};

/** Resolves an R15 program-counter target as an absolute address or indirect jump. */
const r15Target = (
  specification: SuperFxInstructionSpecification,
  operands: readonly DecodedOperand[],
  state: SuperFxDecodeState,
  logicalAddress: number,
): number | "indirect" | undefined => {
  if (specification.register === 15) {
    if (specification.mnemonic === "IWT") {
      return (
        ((((state.programBank === "unknown" ? logicalAddress >>> 16 : state.programBank) ??
          logicalAddress >>> 16) &
          0xff) <<
          16) |
        (operands[1]?.value ?? 0)
      );
    }
    if (specification.mnemonic === "IBT") {
      const raw = operands[1]?.value ?? 0;
      const target = raw & 0x80 ? 0xff00 | raw : raw;
      const bank =
        state.programBank === "unknown" || state.programBank === undefined
          ? logicalAddress >>> 16
          : state.programBank;
      return ((bank & 0xff) << 16) | target;
    }
    if (specification.mnemonic === "LM" || specification.mnemonic === "LMS") {
      return "indirect";
    }
  }
  if (specification.writesDestination && state.destinationRegister === 15) {
    return "indirect";
  }
  return undefined;
};

/** Derives flow kind and cross-reference list for one decoded GSU instruction. */
const controlsFor = (
  specification: SuperFxInstructionSpecification,
  operands: readonly DecodedOperand[],
  state: SuperFxDecodeState,
  logicalAddress: number,
): { readonly flow: InstructionFlow; readonly references: readonly DecodedReference[] } => {
  const r15 = r15Target(specification, operands, state, logicalAddress);
  if (typeof r15 === "number") {
    return {
      flow: { kind: "jump", fallthrough: false },
      references: [{ kind: "jump", operandIndex: 1, address: r15 }],
    };
  }
  if (r15 === "indirect") {
    return {
      flow: { kind: "jump", fallthrough: false, indirect: true },
      references: [{ kind: "jump", indirect: true }],
    };
  }
  if (
    specification.mnemonic === "BRA" ||
    (specification.mnemonic.startsWith("B") && specification.operandEncoding === "relative")
  ) {
    return {
      flow: specification.flow,
      references: [{ kind: "branch", operandIndex: 0, address: operands[0]?.targetAddress }],
    };
  }
  if (specification.mnemonic === "LOOP") {
    return {
      flow: specification.flow,
      references: [{ kind: "branch", indirect: true }],
    };
  }
  if (specification.mnemonic === "JMP" || specification.mnemonic === "LJMP") {
    return {
      flow: specification.flow,
      references: [{ kind: "jump", operandIndex: 0, indirect: true }],
    };
  }
  let memoryIndex: number | undefined;
  if (
    specification.operandEncoding === "registerRamShort" ||
    specification.operandEncoding === "registerRamAbsolute"
  ) {
    memoryIndex = 1;
  } else if (
    specification.operandEncoding === "ramShortRegister" ||
    specification.operandEncoding === "ramAbsoluteRegister"
  ) {
    memoryIndex = 0;
  }
  if (memoryIndex !== undefined) {
    return {
      flow: specification.flow,
      references: [
        { kind: "data", operandIndex: memoryIndex, address: operands[memoryIndex]?.value },
      ],
    };
  }
  if (specification.operandEncoding === "registerIndirect") {
    return {
      flow: specification.flow,
      references: [{ kind: "pointer", operandIndex: 0, indirect: true }],
    };
  }
  return { flow: specification.flow, references: [] };
};

/** Assembles a decoded instruction record for one matrix specification row. */
const buildInstruction = (
  specification: SuperFxInstructionSpecification,
  bytes: Uint8Array,
  context: ArchitectureDecodeContext<SuperFxDecodeState>,
  state: SuperFxDecodeState,
  prefixLength: number,
): DecodedInstruction => {
  const operands = operandsFor(specification, bytes, prefixLength, context.logicalAddress);
  const controls = controlsFor(specification, operands, state, context.logicalAddress);
  return {
    architecture: "snes.superfx",
    specificationId: specification.id,
    opcode: specification.opcode[0],
    mnemonic: specification.mnemonic,
    mode: specification.mode,
    offset: context.offset,
    logicalAddress: context.logicalAddress & 0xffffff,
    bytes,
    size: bytes.length,
    operands,
    references: controls.references,
    flow: controls.flow,
    effects: specification.effects,
  };
};

/** Assembles a decoded instruction record for a canonical fused MOVE selector sequence. */
const buildFusedInstruction = (
  specification: SuperFxFusedInstructionSpecification,
  bytes: Uint8Array,
  context: ArchitectureDecodeContext<SuperFxDecodeState>,
): DecodedInstruction => {
  let operands: readonly DecodedOperand[];
  if (specification.mode === "registerRegister") {
    operands = [
      register(specification.destinationRegister),
      register(specification.sourceRegister ?? 0),
    ];
  } else if (specification.mode === "registerRegisterIndirect") {
    operands = [
      register(specification.destinationRegister),
      register(specification.pointerRegister ?? 0),
    ];
  } else {
    operands = [
      register(specification.sourceRegister ?? 0),
      register(specification.pointerRegister ?? 0),
    ];
  }
  return {
    architecture: "snes.superfx",
    specificationId: specification.id,
    opcode: specification.opcode.at(-1) ?? specification.opcode[0],
    mnemonic: specification.mnemonic,
    mode: specification.mode,
    offset: context.offset,
    logicalAddress: context.logicalAddress & 0xffffff,
    bytes,
    size: bytes.length,
    operands,
    references: specification.flow.kind === "jump" ? [{ kind: "jump", indirect: true }] : [],
    flow: specification.flow,
    effects: specification.effects,
  };
};

/** Finds a fused specification whose opcode bytes match the stream at the current offset. */
const matchFused = (
  context: ArchitectureDecodeContext<SuperFxDecodeState>,
): SuperFxFusedInstructionSpecification | undefined =>
  superFxFusedSpecifications.find((entry) =>
    entry.opcode.every((value, index) => context.source.readByte(context.offset + index) === value),
  );

/** Returns how many bytes remain readable from the current decode offset. */
const availableAt = (context: ArchitectureDecodeContext<SuperFxDecodeState>): number =>
  Number.isInteger(context.offset) && context.offset >= 0
    ? Math.max(0, context.source.length - context.offset)
    : 0;

/** Standard truncated-instruction error result when the fetch window is too short. */
const truncated = (
  context: ArchitectureDecodeContext<SuperFxDecodeState>,
  requiredBytes: number,
): ArchitectureDecodeResult => ({
  kind: "error",
  code: "truncated",
  message: `SuperFX instruction at offset ${context.offset} needs ${requiredBytes} byte(s).`,
  offset: context.offset,
  requiredBytes,
  availableBytes: availableAt(context),
});

/** Maps ALT1–ALT3 prefix opcode bytes to their ALT state, if any. */
const prefixAlt = (opcode: number): SuperFxAltState | undefined => {
  const alt = opcode - 0x3c;
  return opcode >= 0x3d && opcode <= 0x3f && isSuperFxAltState(alt) ? alt : undefined;
};

/** Bounds-safe SuperFX decoder with canonical ALT-prefix fusion. */
export class SuperFxDecoder implements ArchitectureDecoder<SuperFxDecodeState> {
  /**
   * Decodes one GSU instruction, fusing ALT prefixes and macro selector sequences when present.
   * @param context Byte source, offset, and optional GSU decode state.
   * @returns A decoded instruction or a bounds/state error.
   */
  decode(context: ArchitectureDecodeContext<SuperFxDecodeState>): ArchitectureDecodeResult {
    const opcode = context.source.readByte(context.offset);
    if (opcode === undefined) {
      return {
        kind: "error",
        code: "outOfBounds",
        message: `No SuperFX opcode exists at offset ${context.offset}.`,
        offset: context.offset,
        availableBytes: availableAt(context),
      };
    }
    const state = context.state ?? {};
    const requestedAlt = state.alt ?? 0;
    if (requestedAlt !== "unknown" && ![0, 1, 2, 3].includes(requestedAlt)) {
      return {
        kind: "error",
        code: "invalidState",
        message: `Invalid SuperFX ALT state '${requestedAlt}'.`,
        offset: context.offset,
        availableBytes: availableAt(context),
      };
    }

    if (
      requestedAlt === 0 &&
      (state.destinationRegister === undefined || state.destinationRegister === 0) &&
      (state.sourceRegister === undefined || state.sourceRegister === 0)
    ) {
      const fused = matchFused(context);
      if (fused) {
        const bytes = context.source.readBytes(context.offset, fused.minimumSize);
        if (!bytes) {
          return truncated(context, fused.minimumSize);
        }
        return { kind: "instruction", instruction: buildFusedInstruction(fused, bytes, context) };
      }
    }

    const prefix = prefixAlt(opcode);
    if (prefix !== undefined) {
      const next = context.source.readByte(context.offset + 1);
      const canFuse = requestedAlt === 0 || requestedAlt === "unknown";
      if (next !== undefined && canFuse && prefixAlt(next) === undefined) {
        const effective = superFxOpcodeMatrix[prefix][next];
        if (effective.alteredByAlt) {
          const required = effective.minimumSize + 1;
          const bytes = context.source.readBytes(context.offset, required);
          if (!bytes) {
            return truncated(context, required);
          }
          return {
            kind: "instruction",
            instruction: buildInstruction(effective, bytes, context, { ...state, alt: prefix }, 1),
          };
        }
      }
      const specification = superFxOpcodeMatrix[0][opcode];
      const bytes = context.source.readBytes(context.offset, 1)!;
      return {
        kind: "instruction",
        instruction: buildInstruction(specification, bytes, context, state, 0),
      };
    }

    if (requestedAlt === "unknown") {
      const candidates = ([0, 1, 2, 3] as const).map((alt) => superFxOpcodeMatrix[alt][opcode]);
      const unique = [
        ...new Map(candidates.map((entry) => [`${entry.mnemonic}:${entry.mode}`, entry])).values(),
      ];
      if (unique.length > 1) {
        const alternatives = unique.flatMap((entry) => {
          const bytes = context.source.readBytes(context.offset, entry.minimumSize);
          return bytes
            ? [buildInstruction(entry, bytes, context, { ...state, alt: entry.alt }, 0)]
            : [];
        });
        return {
          kind: "ambiguous",
          reason: `SuperFX opcode $${opcode.toString(16).toUpperCase().padStart(2, "0")} depends on ALT state.`,
          requiredState: ["alt"],
          alternatives,
          minimumSize: Math.min(...unique.map((entry) => entry.minimumSize)),
          maximumSize: Math.max(...unique.map((entry) => entry.maximumSize)),
          ...(alternatives.length === unique.length
            ? {}
            : {
                unavailableAlternatives: unique
                  .filter(
                    (entry) =>
                      context.source.readBytes(context.offset, entry.minimumSize) === undefined,
                  )
                  .map((entry) => ({
                    code: "truncated" as const,
                    size: entry.minimumSize,
                    availableBytes: availableAt(context),
                  })),
              }),
        };
      }
    }

    const alt = requestedAlt === "unknown" ? 0 : requestedAlt;
    const specification = superFxOpcodeMatrix[alt][opcode];
    const bytes = context.source.readBytes(context.offset, specification.minimumSize);
    if (!bytes) {
      return truncated(context, specification.minimumSize);
    }
    return {
      kind: "instruction",
      instruction: buildInstruction(specification, bytes, context, state, 0),
    };
  }
}

/** Formats an unsigned value as a `$`-prefixed hex literal with fixed width. */
const hex = (value: number, width: number): string =>
  `$${value
    .toString(16)
    .toUpperCase()
    .padStart(width * 2, "0")}`;

/**
 * Formats one decoded instruction in the project's native SuperFX syntax.
 * @param instruction Instruction to format.
 * @returns Native SuperFX source text.
 */
export function formatSuperFxInstruction(instruction: DecodedInstruction): string {
  if (instruction.architecture !== "snes.superfx") {
    throw new Error(`Cannot format architecture '${instruction.architecture}' as SuperFX.`);
  }
  const values = instruction.operands.map((operand) => operand.value ?? 0);
  const registers = instruction.operands.map((operand) => operand.register ?? "R0");
  let operands = "";
  switch (instruction.mode) {
    case "relative":
      operands = hex(instruction.operands[0]?.targetAddress ?? 0, 3);
      break;
    case "register":
      operands = registers[0];
      break;
    case "registerIndirect":
      operands = `(${registers[0]})`;
      break;
    case "immediateNibble":
      operands = `#${values[0]}`;
      break;
    case "registerImmediate8":
      operands = `${registers[0]},#${hex(values[1], 1)}`;
      break;
    case "registerImmediate16":
      operands = `${registers[0]},#${hex(values[1], 2)}`;
      break;
    case "registerRegister":
      operands = `${registers[0]},${registers[1]}`;
      break;
    case "registerRegisterIndirect":
      operands = `${registers[0]},(${registers[1]})`;
      break;
    case "registerIndirectRegister":
      operands = `(${registers[0]}),${registers[1]}`;
      break;
    case "registerRamShort":
    case "registerRamAbsolute":
      operands = `${registers[0]},(${hex(values[1], 2)})`;
      break;
    case "ramShortRegister":
    case "ramAbsoluteRegister":
      operands = `(${hex(values[0], 2)}),${registers[1]}`;
      break;
  }
  return operands ? `${instruction.mnemonic} ${operands}` : instruction.mnemonic;
}
