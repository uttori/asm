import type { DecodedInstruction } from "@uttori/asm-core";
import type { RomImage } from "@uttori/asm-disassembler";

import {
  describeSnesStructAccess,
  SnesStructExpressionResolver,
  type SnesStructAccessPart,
} from "./struct-expressions.js";
import type { SnesStructBinding, SnesStructLayout } from "./struct-map.js";

/** A curated capture reference, separate from static operand identity and CPU control flow. */
export interface SnesStructAccessObservation {
  readonly expression: string;
  /** Resolved CPU address. The complete access must remain inside one physical binding. */
  readonly address: number;
  /** Physical owner and exact field/gap coverage of the complete access. */
  readonly binding: string;
  readonly parts: readonly SnesStructAccessPart[];
  /** Number of bytes in this CPU access, one or two. Independent of the field's declared size. */
  readonly width: number;
  readonly access: "read" | "write" | "read-write";
  /** A bus observation and an inference from instruction/register traces are different evidence. */
  readonly provenance: "observed" | "trace-derived";
  /** Capture path or stable identifier. Export renders it as provenance and never opens it. */
  readonly source: string;
  /** Capture location and reasoning, such as instruction sequence and pointer reconstruction. */
  readonly detail: string;
  /** SHA-256 of the capture's headerless ROM, checked against the export ROM. */
  readonly romSha256: string;
}

/** Validated instruction-specific metadata. Expressions resolve only against this map's declarations. */
export interface SnesStructInstructionUse {
  readonly address: number;
  /** Complete instruction encoding, including opcode. Stale metadata aborts export before writes. */
  readonly expectedBytes: readonly number[];
  readonly reason: string;
  /** Immediate value expression. Mutually exclusive with memoryOperand and access observations. */
  readonly operand?: { readonly expression: string; readonly value: number };
  /** Encoded direct memory address, before indexing/DB/D. Never a resolved runtime effective address. */
  readonly memoryOperand?: { readonly expression: string; readonly value: number };
  readonly observations: readonly SnesStructAccessObservation[];
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Struct instruction-use entries must be objects.");
  }
  return value as Record<string, unknown>;
};
const integer = (value: unknown, min: number, max: number): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`Invalid struct instruction-use integer '${String(value)}'.`);
  }
  return value;
};
/**
 * Collapse whitespace so provenance remains a comment and cannot inject assembly lines.
 * @param {unknown} value Required user-supplied explanation.
 * @returns {string} Non-empty text restricted to one source line.
 */
const text = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Struct instruction uses require non-empty reason/source/detail strings.");
  }
  return value.replaceAll(/\s+/g, " ").trim();
};
const hex = (value: number): string => `$${value.toString(16).toUpperCase()}`;

/**
 * Resolve optional instructionUses against already validated layouts and bindings.
 * Native expressions name exact operands. Observations describe complete spans within a binding.
 * @param {unknown} value Optional instructionUses array from JSON.
 * @param {readonly SnesStructLayout[]} structures Validated zero-based layouts.
 * @param {readonly SnesStructBinding[]} bindings Validated physical record bindings.
 * @returns {readonly SnesStructInstructionUse[]} Resolved uses in CPU-address order.
 */
export const validateSnesStructInstructionUses = (
  value: unknown,
  structures: readonly SnesStructLayout[],
  bindings: readonly SnesStructBinding[],
): readonly SnesStructInstructionUse[] => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Struct instructionUses must be an array.");
  }
  if (value.length === 0) {
    return [];
  }
  const resolver = new SnesStructExpressionResolver(structures, bindings);
  const addresses = new Set<number>();
  return value
    .map((input): SnesStructInstructionUse => {
      const entry = record(input);
      const address = integer(entry.address, 0, 0xffffff);
      if (addresses.has(address)) {
        throw new Error(`Duplicate struct instruction use at ${hex(address)}.`);
      }
      addresses.add(address);
      if (
        !Array.isArray(entry.expectedBytes) ||
        entry.expectedBytes.length < 1 ||
        entry.expectedBytes.length > 4
      ) {
        throw new Error("Struct instruction uses require 1–4 complete expectedBytes.");
      }
      const expectedBytes = entry.expectedBytes.map((byte) => integer(byte, 0, 0xff));
      let operand: SnesStructInstructionUse["operand"];
      if (entry.operand !== undefined) {
        const resolved = resolver.resolve(entry.operand);
        operand = { expression: resolved.expression, value: integer(resolved.value, 0, 0xffff) };
      }
      let memoryOperand: SnesStructInstructionUse["memoryOperand"];
      if (entry.memoryOperand !== undefined) {
        const resolved = resolver.resolve(entry.memoryOperand);
        memoryOperand = {
          expression: resolved.expression,
          value: integer(resolved.value, 0, 0xffffff),
        };
      }
      if (entry.observations !== undefined && !Array.isArray(entry.observations)) {
        throw new Error("Struct observations must be an array.");
      }
      const observations = ((entry.observations ?? []) as unknown[]).map(
        (inputObservation): SnesStructAccessObservation => {
          const observation = record(inputObservation);
          const width = integer(observation.width, 1, 2);
          const target = resolver.resolve(observation.target);
          // Ownership must come from the expression, not a coincidental address match in another binding.
          if (target.bindings.length !== 1) {
            throw new Error("Struct observation target must reference exactly one binding.");
          }
          const binding = target.bindings[0];
          const parts = describeSnesStructAccess(binding, target.value, width);
          const { access, provenance } = observation;
          if (access !== "read" && access !== "write" && access !== "read-write") {
            throw new Error("Struct observation access must be read, write or read-write.");
          }
          if (provenance !== "observed" && provenance !== "trace-derived") {
            throw new Error("Struct observation provenance must be observed or trace-derived.");
          }
          if (
            typeof observation.romSha256 !== "string" ||
            !/^[\da-f]{64}$/.test(observation.romSha256)
          ) {
            throw new Error("Struct observations require the capture ROM SHA-256.");
          }
          return {
            expression: target.expression,
            address: target.value,
            binding: binding.name,
            parts,
            width,
            access,
            provenance,
            source: text(observation.source),
            detail: text(observation.detail),
            romSha256: observation.romSha256,
          };
        },
      );
      if (!operand && !memoryOperand && observations.length === 0) {
        throw new Error("A struct instruction use requires an operand or observations.");
      }
      // An immediate denotes a value, while a captured access denotes a memory operand.
      // Combining them at one instruction would assign incompatible meanings to that operand.
      if (operand && (memoryOperand || observations.length)) {
        throw new Error(
          "A struct instruction use cannot combine an immediate and memory observations.",
        );
      }
      return {
        address,
        expectedBytes,
        reason: text(entry.reason),
        ...(operand ? { operand } : {}),
        ...(memoryOperand ? { memoryOperand } : {}),
        observations,
      };
    })
    .sort((a, b) => a.address - b.address);
};

/**
 * Index only annotated instructions, O(uses), rather than scanning uses for every CFG variant.
 * Mapper aliases, complete byte encodings and capture ROM identities are checked before export.
 * The callback returns undefined for unmapped addresses. Instruction bytes must map contiguously.
 * @param {readonly SnesStructInstructionUse[] | undefined} uses Validated instruction uses.
 * @param {RomImage} rom Immutable ROM supplying instruction bytes and capture identity.
 * @param {Function} toFileOffset Mapper-specific CPU-to-ROM translation.
 * @returns {ReadonlyMap<number, SnesStructInstructionUse> | undefined} Sparse lookup, absent when unused.
 */
export const indexSnesStructInstructionUses = (
  uses: readonly SnesStructInstructionUse[] | undefined,
  rom: RomImage,
  toFileOffset: (address: number) => number | undefined,
): ReadonlyMap<number, SnesStructInstructionUse> | undefined => {
  if (!uses?.length) {
    return undefined;
  }
  const result = new Map<number, SnesStructInstructionUse>();
  for (const use of uses) {
    const offset = toFileOffset(use.address);
    const last = toFileOffset(use.address + use.expectedBytes.length - 1);
    if (offset === undefined || offset < 0 || last !== offset + use.expectedBytes.length - 1) {
      throw new Error(`Struct instruction use at ${hex(use.address)} is not contiguous ROM.`);
    }
    if (result.has(offset)) {
      throw new Error(`Aliased struct instruction uses at ROM ${hex(offset)}.`);
    }
    const bytes = rom.read(offset, use.expectedBytes.length);
    if (!bytes || use.expectedBytes.some((byte, index) => byte !== bytes[index])) {
      throw new Error(`Stale struct instruction bytes at ${hex(use.address)}.`);
    }
    for (const observation of use.observations) {
      if (observation.romSha256 !== rom.identity.contentSha256) {
        throw new Error(`Struct observation '${observation.source}' belongs to a different ROM.`);
      }
    }
    result.set(offset, use);
  }
  return result;
};

/**
 * Replace a proven immediate or direct memory operand, preserving its encoded width and indexing.
 * This runs for every accepted state variant. A size/value mismatch is an error, never truncation.
 * @param {DecodedInstruction} instruction One accepted decode context.
 * @param {string} source Existing formatted source, including any conservative numeric fallback.
 * @param {SnesStructInstructionUse} use Validated metadata at this ROM instruction.
 * @returns {string} Width-preserving symbolic operand, or the original instruction for observations.
 */
export const applySnesStructInstructionOperand = (
  instruction: DecodedInstruction,
  source: string,
  use: SnesStructInstructionUse,
): string => {
  if (
    instruction.size !== use.expectedBytes.length ||
    use.expectedBytes.some((byte, index) => instruction.bytes[index] !== byte)
  ) {
    throw new Error(
      `Struct instruction use at ${hex(use.address)} does not match the decoded instruction.`,
    );
  }
  // These references describe explicit memory operands. Stack traffic, DMA and control-flow
  // fetches need their own evidence model and must not masquerade as a struct operand access.
  if (
    use.observations.length &&
    !instruction.references.some(({ kind }) => kind === "data" || kind === "pointer")
  ) {
    throw new Error(`Struct observations at ${hex(use.address)} require a memory operand.`);
  }
  if (use.memoryOperand) {
    // A curated overlay names the encoded address, not a captured post-index address. Restrict
    // replacement to direct memory modes so calls, indirect pointers and stack syntax cannot
    // accidentally be reformatted as ordinary loads/stores.
    const modes: Record<string, readonly [number, string]> = {
      direct: [1, ""],
      directIndexedX: [1, ",x"],
      directIndexedY: [1, ",y"],
      absolute: [2, ""],
      absoluteIndexedX: [2, ",x"],
      absoluteIndexedY: [2, ",y"],
      absoluteLong: [3, ""],
      absoluteLongIndexedX: [3, ",x"],
    };
    const mode = modes[instruction.mode];
    const operand = instruction.operands[0];
    if (
      !mode ||
      instruction.operands.length !== 1 ||
      operand?.kind !== "address" ||
      operand.width !== mode[0] ||
      operand.value !== use.memoryOperand.value ||
      !instruction.references.some(({ kind }) => kind === "data")
    ) {
      throw new Error(
        `Struct memoryOperand '${use.memoryOperand.expression}' does not match the encoded memory address at ${hex(use.address)}.`,
      );
    }
    const width = ["", "b", "w", "l"][mode[0]];
    return `${instruction.mnemonic}.${width} ${use.memoryOperand.expression}${mode[1]}`;
  }
  if (!use.operand) {
    return source;
  }
  const operand = instruction.operands[0];
  if (
    instruction.mode !== "immediate" ||
    instruction.operands.length !== 1 ||
    (operand?.width !== 1 && operand?.width !== 2) ||
    operand.value !== use.operand.value ||
    use.operand.value >= 2 ** (operand.width * 8)
  ) {
    throw new Error(
      `Struct operand '${use.operand.expression}' does not match the encoded immediate at ${hex(use.address)}.`,
    );
  }
  return `${instruction.mnemonic}.${operand.width === 1 ? "b" : "w"} #${use.operand.expression}`;
};

/**
 * Render all capture alternatives as comments. They never become fixed-address CPU operands.
 * @param {SnesStructInstructionUse} use Validated instruction metadata in curator-supplied order.
 * @returns {readonly string[]} Individual comment bodies without the leading semicolon.
 */
export const renderSnesStructUseComments = (use: SnesStructInstructionUse): readonly string[] => [
  `[struct use] ${use.reason}`,
  ...use.observations.map((observation) => {
    let coverage = "";
    if (observation.parts.length > 1 || !observation.parts[0].field) {
      coverage = `. Covers: ${observation.parts.map((part) => `${part.expression} (${part.width} byte(s)${part.field ? "" : ", opaque"})`).join(", ")}`;
    }
    return `[${observation.provenance} ${observation.access}] ${observation.expression} (${hex(observation.address)}, ${observation.width} byte(s))${coverage}. ${observation.source}: ${observation.detail}`;
  }),
];
