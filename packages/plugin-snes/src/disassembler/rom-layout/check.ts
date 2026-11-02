import type {
  AddressToLineMapping,
  AddressToLineRange,
  InstructionSourceInfo,
} from "@uttori/asm-core";

import { cpu65816Specifications } from "../../architectures/65816-spec.js";
import {
  assertSnesSplitReferences,
  encodeSnesRelocationReference,
  type SnesMovableObject,
  type SnesRelocationReference,
} from "./relocate.js";

/** A source-linked build failure. Offsets refer to headerless ROM bytes. */
export interface SnesLayoutDiagnostic {
  /** Stable category for grouping related layout failures. */
  readonly code:
    | "overlap"
    | "output-size"
    | "bank-crossing"
    | "instruction-width"
    | "unknown-cpu-state"
    | "control-flow"
    | "expansion"
    | "missing-size"
    | "fixed-extent"
    | "raw-consumption"
    | "placement"
    | "reference";
  /** Human-readable explanation tied to the failing contract. */
  readonly message: string;
  /** Source file path when the failure maps to authored text. */
  readonly file?: string;
  /** One-based source line when available. */
  readonly line?: number;
  /** Headerless ROM byte index when the failure is image-local. */
  readonly offset?: number;
}

/** Explicit CPU entry assumptions are research inputs, not inferred from operand suffixes. */
export interface SnesInstructionStateContract {
  /** Headerless ROM offset of the instruction requiring known widths. */
  readonly offset: number;
  /** Emulation mode flag when explicitly declared. */
  readonly e?: boolean;
  /** Memory-width flag when explicitly declared. */
  readonly m?: boolean;
  /** Index-width flag when explicitly declared. */
  readonly x?: boolean;
}

/** A declared object is anchored by symbols so ordinary line edits do not change its identity. */
export interface SnesFixedExtent {
  /** Stable extent id referenced by layout checks. */
  readonly id: string;
  /** Label marking the inclusive start of the fixed span. */
  readonly startSymbol: string;
  /** Label marking the exclusive end of the fixed span. */
  readonly endSymbol: string;
  /** Declared byte length between the symbols. */
  readonly size: number;
}

/** Saved placements remain build contracts after the relocation preview has been applied. */
export interface SnesPlacementContract {
  /** Saved objects anchored by source symbols for post-relocation builds. */
  readonly objects: readonly (SnesMovableObject & {
    readonly startSymbol: string;
    readonly endSymbol: string;
  })[];
  /** Encoded pointer and length fields that must still target declared objects. */
  readonly references: readonly SnesRelocationReference[];
  /** Mapper identity is included in the caller's configuration hash. */
  readonly logicalAddress: (offset: number) => number;
}

/** Validate current source ownership and encoded references without invoking the allocation planner. */
export function checkSnesPlacements(
  output: Uint8Array,
  symbols: ReadonlyMap<string, number>,
  contract: SnesPlacementContract,
): SnesLayoutDiagnostic[] {
  const diagnostics: SnesLayoutDiagnostic[] = [];
  try {
    assertSnesSplitReferences(contract.references);
  } catch (error) {
    diagnostics.push({ code: "reference", message: String(error) });
  }
  const objects = new Map(contract.objects.map((object) => [object.id, object]));
  if (objects.size !== contract.objects.length) {
    throw new Error("Repeated source placement identity.");
  }
  const occupied = [...contract.objects].toSorted((a, b) => a.start - b.start);
  for (const [index, object] of occupied.entries()) {
    const start = symbols.get(object.startSymbol),
      end = symbols.get(object.endSymbol);
    if (
      !Number.isSafeInteger(object.start) ||
      object.start < 0 ||
      !Number.isSafeInteger(object.length) ||
      object.length <= 0 ||
      object.start + object.length > output.length ||
      ![0x8000, 0x10000].includes(object.bankSize) ||
      !Number.isSafeInteger(object.alignment) ||
      object.alignment <= 0 ||
      object.start % object.alignment !== 0 ||
      Math.floor(object.start / object.bankSize) !==
        Math.floor((object.start + object.length - 1) / object.bankSize) ||
      start !== contract.logicalAddress(object.start) ||
      end === undefined ||
      end - start !== object.length ||
      (index > 0 && occupied[index - 1].start + occupied[index - 1].length > object.start)
    ) {
      diagnostics.push({
        code: "placement",
        offset: object.start,
        message: `Source object ${object.id} no longer matches its declared placement and extent. Prepare relocation or reconcile its layout.`,
      });
    }
  }
  const ids = new Set<string>();
  const fields = new Set<number>();
  for (const reference of contract.references) {
    const object = objects.get(reference.target);
    if (!object || ids.has(reference.id)) {
      throw new Error(`Unknown or repeated reference target: ${reference.id}`);
    }
    ids.add(reference.id);
    try {
      const expected = encodeSnesRelocationReference(
        reference,
        contract.logicalAddress(object.start),
        object.length,
      );
      if (
        !Number.isSafeInteger(reference.offset) ||
        reference.offset < 0 ||
        reference.offset + expected.length > output.length
      ) {
        throw new Error("Reference field is outside the current ROM.");
      }
      for (let offset = reference.offset; offset < reference.offset + expected.length; offset++) {
        if (fields.has(offset)) {
          throw new Error("Reference fields overlap.");
        }
        fields.add(offset);
      }
      if (!expected.every((byte, index) => output[reference.offset + index] === byte)) {
        throw new Error(
          `Encoded field no longer targets ${reference.target} with its declared encoding.`,
        );
      }
    } catch (error) {
      diagnostics.push({
        code: "reference",
        offset: reference.offset,
        message: `${reference.id}: ${String(error)}`,
      });
    }
  }
  return diagnostics;
}

/** Minimal target checks shared by pure and modified builds. Larger output requires explicit allocation policy. */
export interface SnesLayoutCheckOptions {
  /** Built headerless ROM image under test. */
  readonly output: Uint8Array;
  /** Address-to-source map for attributing diagnostics. */
  readonly mapping: AddressToLineMapping;
  /** Declared cartridge capacity from project configuration. */
  readonly expectedSize: number;
  /** Optional explicit CPU width assumptions keyed by ROM offset. */
  readonly states?: readonly SnesInstructionStateContract[];
  /** Symbol-anchored fixed spans that must not drift. */
  readonly extents?: readonly SnesFixedExtent[];
  /** Resolved label values for extent and placement checks. */
  readonly symbols?: ReadonlyMap<string, number>;
  /** Movable code requires explicit width proof for every dynamic-width instruction in these ranges. */
  readonly requiredCpuStateRanges?: readonly { readonly start: number; readonly end: number }[];
}

/**
 * Attribute a diagnostic to the exact emission, including repeated macro/loop instances.
 * @param mapping Build debug map listing files and lines.
 * @param entry Instruction or range entry carrying file and line indices.
 */
function location(
  mapping: AddressToLineMapping,
  entry: AddressToLineRange | InstructionSourceInfo,
) {
  return { file: mapping.fileList[entry.fileIdx]?.name, line: entry.line };
}

/**
 * Inspect emission ranges before accepting output. Final binary length alone hides writes later
 * overwritten by org/include emission; explicit ranges retain those overlaps and bank crossings.
 */
export function checkSnesSourceLayout(options: SnesLayoutCheckOptions): SnesLayoutDiagnostic[] {
  const { output, mapping } = options;
  const diagnostics: SnesLayoutDiagnostic[] = [];
  if (!Number.isSafeInteger(options.expectedSize) || options.expectedSize <= 0) {
    throw new Error("Layout needs a positive ROM size.");
  }
  if (output.length !== options.expectedSize) {
    diagnostics.push({
      code: "output-size",
      message: `ROM has ${output.length} bytes; declared layout requires ${options.expectedSize}.`,
    });
  }
  const ranges = mapping.ranges
    .filter((range) => range.outputStart !== undefined && range.outputEnd !== undefined)
    .toSorted((a, b) => a.outputStart! - b.outputStart! || a.outputEnd! - b.outputEnd!);
  let previous: AddressToLineRange | undefined;
  for (const range of ranges) {
    if (previous && range.outputStart! < previous.outputEnd!) {
      diagnostics.push({
        code: "overlap",
        ...location(mapping, range),
        offset: range.outputStart,
        message: `Output at $${range.outputStart!.toString(16)} overlaps ${mapping.fileList[previous.fileIdx]?.name}:${previous.line}. Growth requires a declared relocation.`,
      });
    }
    if (!previous || range.outputEnd! > previous.outputEnd!) {
      previous = range;
    }
  }
  const states = new Map<number, SnesInstructionStateContract>();
  for (const state of options.states ?? []) {
    if (
      !Number.isSafeInteger(state.offset) ||
      state.offset < 0 ||
      state.offset >= options.expectedSize ||
      states.has(state.offset) ||
      [state.e, state.m, state.x].some((flag) => flag !== undefined && typeof flag !== "boolean")
    ) {
      throw new Error(
        "CPU-state contracts require unique ROM offsets and boolean E/M/X assumptions.",
      );
    }
    if (state.e === true && (state.m === false || state.x === false)) {
      throw new Error(
        "Emulation-mode CPU state cannot declare 16-bit accumulator or index registers.",
      );
    }
    states.set(state.offset, state);
  }
  for (const instruction of mapping.instructions) {
    if (instruction.architecture !== "snes.65816" || instruction.outputOffset === undefined) {
      continue;
    }
    const offset = instruction.outputOffset;
    const size = instruction.size;
    if (!Number.isSafeInteger(size) || size! <= 0) {
      diagnostics.push({
        code: "missing-size",
        ...location(mapping, instruction),
        offset,
        message: "Rebuild with current instruction emission metadata before validating layout.",
      });
      continue;
    }
    if ((instruction.address & 0xffff) + size! > 0x10000) {
      diagnostics.push({
        code: "bank-crossing",
        ...location(mapping, instruction),
        offset,
        message: "Instruction crosses its 65816 program bank boundary.",
      });
    }
    const opcodeByte = offset >= 0 && offset < output.length ? output[offset] : undefined;
    const specification =
      opcodeByte !== undefined && opcodeByte < cpu65816Specifications.length
        ? cpu65816Specifications[opcodeByte]
        : undefined;
    const state = states.get(offset);
    if (!specification) {
      continue;
    }
    let expectedSize: number | undefined = specification.minimumSize;
    if (specification.widthFlag) {
      const flag = state?.e === true ? true : state?.[specification.widthFlag];
      expectedSize = undefined;
      if (flag === true) {
        expectedSize = 2;
      } else if (flag === false && state?.e === false) {
        expectedSize = 3;
      }
      // A suffix controls encoding, not runtime CPU state. A newly inserted instruction in movable
      // code must not inherit an unproven width merely because the surrounding source assembles.
      if (
        expectedSize === undefined &&
        options.requiredCpuStateRanges?.some((range) => offset >= range.start && offset < range.end)
      ) {
        diagnostics.push({
          code: "unknown-cpu-state",
          ...location(mapping, instruction),
          offset,
          message: `${specification.mnemonic} needs an explicit E/${specification.widthFlag.toUpperCase()} assumption before this code can be placed.`,
        });
      }
    }
    if (expectedSize !== undefined && size !== expectedSize) {
      diagnostics.push({
        code: "instruction-width",
        ...location(mapping, instruction),
        offset,
        message: `${specification.mnemonic} emits ${size} bytes but its declared CPU state requires ${expectedSize}.`,
      });
    }
  }
  const extentIds = new Set<string>();
  for (const extent of options.extents ?? []) {
    if (
      typeof extent.id !== "string" ||
      !extent.id ||
      extentIds.has(extent.id) ||
      typeof extent.startSymbol !== "string" ||
      !extent.startSymbol ||
      typeof extent.endSymbol !== "string" ||
      !extent.endSymbol ||
      !Number.isSafeInteger(extent.size) ||
      extent.size <= 0 ||
      extent.size > options.expectedSize
    ) {
      throw new Error(
        "Fixed extents require unique IDs, start/end symbols and positive bounded sizes.",
      );
    }
    extentIds.add(extent.id);
    const start = options.symbols?.get(extent.startSymbol),
      end = options.symbols?.get(extent.endSymbol);
    if (start === undefined || end === undefined || end - start !== extent.size) {
      diagnostics.push({
        code: "fixed-extent",
        message: `Object ${extent.id} must retain its ${extent.size}-byte extent; resolve ${extent.startSymbol}/${extent.endSymbol} or declare relocation.`,
      });
    }
  }
  return diagnostics;
}
