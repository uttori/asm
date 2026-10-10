import type { DecodedInstruction } from "@uttori/asm-core";
import type { RomImage } from "@uttori/asm-disassembler";

import { omitResearchReferences } from "./source-layout.js";
import {
  describeSnesStructAccess,
  SnesStructExpressionResolver,
  type SnesStructAccessPart,
} from "./struct-expressions.js";
import type { SnesStructBinding, SnesStructConstant, SnesStructLayout } from "./struct-map.js";

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
  /** Capture path or stable identifier, retained for verification and never opened by export. */
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
  /** Research justification retained in metadata; never emitted as an assembly comment. */
  readonly reason: string;
  /** Explicit instruction-specific behavior or constraint; omitted/empty emits no comment. Field descriptions belong on their declarations. */
  readonly comment?: string;
  /** Immediate value expression. Mutually exclusive with other operand forms and access observations. */
  readonly operand?: { readonly expression: string; readonly value: number };
  /** Encoded direct memory address, before indexing/DB/D. Never a resolved runtime effective address. */
  readonly memoryOperand?: { readonly expression: string; readonly value: number };
  /** Encoded unsigned stack displacement (0–255), before adding S. Never a WRAM address or access observation. */
  readonly stackOperand?: { readonly expression: string; readonly value: number };
  readonly observations: readonly SnesStructAccessObservation[];
}

/**
 * Accepts a JSON object. Arrays and null are not instruction-use records.
 * @param {unknown} value Candidate record.
 * @returns {boolean} True when `value` is a non-array object.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const record = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error("Struct instruction-use entries must be objects.");
  }
  return value;
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
 * @param {readonly SnesStructConstant[]} constants Optional declared scalar values, without storage ownership.
 * @returns {readonly SnesStructInstructionUse[]} Resolved uses in CPU-address order.
 */
export const validateSnesStructInstructionUses = (
  value: unknown,
  structures: readonly SnesStructLayout[],
  bindings: readonly SnesStructBinding[],
  constants: readonly SnesStructConstant[] = [],
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
  const resolver = new SnesStructExpressionResolver(structures, bindings, constants);
  const addresses = new Set<number>();
  return value
    .map((input, index): SnesStructInstructionUse => {
      try {
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
        if (entry.comment !== undefined && typeof entry.comment !== "string") {
          throw new Error("Struct instruction-use comment must be a string, or omitted.");
        }
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
        let stackOperand: SnesStructInstructionUse["stackOperand"];
        if (entry.stackOperand !== undefined) {
          const resolved = resolver.resolve(entry.stackOperand);
          stackOperand = {
            expression: resolved.expression,
            value: integer(resolved.value, 0, 0xff),
          };
        }
        if (entry.observations !== undefined && !Array.isArray(entry.observations)) {
          throw new Error("Struct observations must be an array.");
        }
        const observations = ((entry.observations ?? []) as unknown[]).map(
          (inputObservation, observationIndex): SnesStructAccessObservation => {
            try {
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
            } catch (error) {
              const detail = error instanceof Error ? error.message : String(error);
              throw new Error(`observations[${observationIndex}]: ${detail}`, { cause: error });
            }
          },
        );
        if (!operand && !memoryOperand && !stackOperand && observations.length === 0) {
          throw new Error(
            "A struct instruction use requires an operand or observations. Set operand, memoryOperand, stackOperand, or a non-empty observations array.",
          );
        }
        // An immediate denotes a value, while a captured access denotes a memory operand.
        // Combining them at one instruction would assign incompatible meanings to that operand.
        if (operand && (memoryOperand || observations.length)) {
          throw new Error(
            "A struct instruction use cannot combine an immediate and memory observations.",
          );
        }
        // Stack offsets belong to a call's stack layout. Mixing them with another
        // operand form or a bound-memory observation would claim incompatible ownership.
        if (stackOperand && (operand || memoryOperand || observations.length)) {
          throw new Error(
            "A struct instruction use cannot combine a stack operand with other operand forms or observations.",
          );
        }
        return {
          address,
          expectedBytes,
          reason: text(entry.reason),
          ...(entry.comment === undefined
            ? {}
            : { comment: entry.comment.replaceAll(/\s+/g, " ").trim() }),
          ...(operand ? { operand } : {}),
          ...(memoryOperand ? { memoryOperand } : {}),
          ...(stackOperand ? { stackOperand } : {}),
          observations,
        };
      } catch (error) {
        // Keep the original array index even though successful uses are sorted by CPU address afterward.
        const address = isRecord(input) ? input.address : undefined;
        const location =
          typeof address === "number" && Number.isSafeInteger(address)
            ? ` at CPU ${hex(address)}`
            : "";
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`instructionUses[${index}]${location}: ${detail}`, { cause: error });
      }
    })
    .toSorted((a, b) => a.address - b.address);
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
 * Replace a proven immediate, memory address, data pointer or stack displacement without changing its mode.
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
  if (use.stackOperand) {
    const operand = instruction.operands[0];
    const indirect = instruction.mode === "stackRelativeIndirectIndexedY";
    if (
      (instruction.mode !== "stackRelative" && !indirect) ||
      instruction.operands.length !== 1 ||
      operand.kind !== "address" ||
      operand.width !== 1 ||
      operand.value !== use.stackOperand.value
    ) {
      throw new Error(
        `Struct stackOperand '${use.stackOperand.expression}' does not match the encoded stack displacement at ${hex(use.address)}.`,
      );
    }
    // Keep the stack selector and optional pointer/index syntax explicit. The
    // expression replaces only the encoded byte, never S or the resulting pointer.
    if (indirect) {
      return `${instruction.mnemonic}.b (${use.stackOperand.expression},s),y`;
    }
    return `${instruction.mnemonic}.b ${use.stackOperand.expression},s`;
  }
  if (use.memoryOperand) {
    // The expression names encoded operand bytes, never the dereferenced or indexed address.
    // Preserve pointer delimiters for scoped direct-page locals. The whitelist excludes
    // indirect control flow and stack modes, which have different operand contracts.
    const modes: Partial<Record<string, readonly [number, string, string]>> = {
      direct: [1, "", ""],
      directIndexedX: [1, "", ",x"],
      directIndexedY: [1, "", ",y"],
      directIndirect: [1, "(", ")"],
      directIndexedXIndirect: [1, "(", ",x)"],
      directIndirectIndexedY: [1, "(", "),y"],
      directIndirectLong: [1, "[", "]"],
      directIndirectLongIndexedY: [1, "[", "],y"],
      absolute: [2, "", ""],
      absoluteIndexedX: [2, "", ",x"],
      absoluteIndexedY: [2, "", ",y"],
      absoluteLong: [3, "", ""],
      absoluteLongIndexedX: [3, "", ",x"],
    };
    const mode = modes[instruction.mode];
    const operand = instruction.operands.length > 0 ? instruction.operands[0] : undefined;
    if (
      !mode ||
      instruction.operands.length !== 1 ||
      operand?.kind !== "address" ||
      operand.width !== mode[0] ||
      operand.value !== use.memoryOperand.value ||
      !instruction.references.some(({ kind }) => kind === "data" || kind === "pointer")
    ) {
      throw new Error(
        `Struct memoryOperand '${use.memoryOperand.expression}' does not match the encoded memory address at ${hex(use.address)}.`,
      );
    }
    const width = ["", "b", "w", "l"][mode[0]];
    return `${instruction.mnemonic}.${width} ${mode[1]}${use.memoryOperand.expression}${mode[2]}`;
  }
  if (!use.operand) {
    return source;
  }
  const operand = instruction.operands.length > 0 ? instruction.operands[0] : undefined;
  // REP/SEP have fixed byte status masks, represented as signature operands by the decoder.
  // Do not broaden this to BRK/COP/WDM signatures, which are not ordinary immediate values.
  const statusMask =
    instruction.mode === "signature" && ["REP", "SEP"].includes(instruction.mnemonic);
  if (
    (instruction.mode !== "immediate" && !statusMask) ||
    instruction.operands.length !== 1 ||
    (operand?.width !== 1 && operand?.width !== 2) ||
    operand.value !== use.operand.value ||
    use.operand.value >= 2 ** (operand.width * 8)
  ) {
    throw new Error(
      `Struct operand '${use.operand.expression}' does not match the encoded immediate at ${hex(use.address)}.`,
    );
  }
  if (statusMask) {
    return `${instruction.mnemonic} #${use.operand.expression}`;
  }
  return `${instruction.mnemonic}.${operand.width === 1 ? "b" : "w"} #${use.operand.expression}`;
};

/**
 * Emit only explicitly curated instruction context. Justifications, field descriptions
 * and capture observations remain in metadata instead of becoming repetitive source notes.
 * Preserve the entire explanation; the assembly layout pass wraps it without clipping.
 * @param {SnesStructInstructionUse} use Validated instruction metadata.
 * @returns {readonly string[]} Zero or one complete comment body, without a semicolon.
 */
export const renderSnesStructUseComments = (use: SnesStructInstructionUse): readonly string[] => {
  const comment = omitResearchReferences(use.comment ?? "");
  return comment ? [comment] : [];
};
