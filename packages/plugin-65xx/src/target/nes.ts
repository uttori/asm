import type {
  SessionLifecycle,
  TargetAddressSpace,
  TargetFactoryContext,
  TargetOutputFormat,
} from "@uttori/asm-core/plugin";

import { applyLinkerSymbols, closeActiveSegment } from "../directives/ca65.js";
import {
  defaultLd65ConfigText,
  linkerDefinedSymbolNames,
  parseLd65Config,
  type Ld65Config,
} from "../linker-config.js";
import {
  cloneNes65xxSessionState,
  nes65xxSessionStateKey,
  resetNes65xxStageState,
  type Nes65xxSessionState,
} from "../session-state.js";

/** iNES / NES 2.0 cartridge target (`nes`, `ines`, `6502-nes` aliases). */
export const NES_65XX_TARGET_ID = "65xx.nes";
/** Address-space contribution id for iNES CPU/PPU mapping. */
export const NES_65XX_ADDRESS_SPACE_ID = "65xx.ines-address-space";
/** Output-format contribution id for headered iNES images. */
export const NES_65XX_OUTPUT_FORMAT_ID = "65xx.ines-output";
/** Lifecycle contribution id that prefills NES header and PRG. */
export const NES_65XX_LIFECYCLE_ID = "65xx.nes-lifecycle";

const INES_MAGIC = [0x4e, 0x45, 0x53, 0x1a];

/**
 * Accepts a JSON object. Arrays and null are not option maps.
 * @param value Candidate target options.
 * @returns True when `value` is a non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * NES target options. Plugin activation stays origin-only for the raw target.
 * These fields are per-session `targetOptions`.
 */
export interface Nes65xxTargetOptions extends Readonly<Record<string, unknown>> {
  /** Asar uses headerless physical org offsets and logical CPU/PPU base addresses; ca65 retains MEMORY segments. */
  readonly sourceStyle: "asar" | "ca65";
  /** Parsed or declared header bytes. */
  readonly header: readonly number[];
  /** ld65 MEMORY/SEGMENTS text used for this cartridge layout. */
  readonly linkerConfig: string;
  /** Byte used to prefill unused PRG and header gaps. */
  readonly fillByte: number;
  /** Parsed ld65 configuration driving NES section placement. */
  readonly linker: Ld65Config;
}

/**
 * Coerces NES target options. Omitted `linkerConfig` uses a 32 KiB `$8000` ROM.
 * Omitted `header` synthesizes a 16-byte iNES header from PRG size.
 * @param configured Assembler `targetOptions`.
 * @returns Normalized options including a parsed linker.
 */
export function createNes65xxTargetOptions(configured: unknown): Nes65xxTargetOptions {
  const value = isRecord(configured) ? configured : {};
  const sourceStyle = value.sourceStyle ?? "ca65";
  if (sourceStyle !== "asar" && sourceStyle !== "ca65") {
    throw new Error("NES sourceStyle must be 'asar' or 'ca65'.");
  }
  const linkerConfig =
    typeof value.linkerConfig === "string" && value.linkerConfig.trim()
      ? value.linkerConfig
      : defaultLd65ConfigText();
  const linker = parseLd65Config(linkerConfig);
  const fillByte =
    typeof value.fillByte === "number" && Number.isInteger(value.fillByte)
      ? value.fillByte & 0xff
      : 0xff;
  const header = normalizeHeader(value.header, linker.imageSize);
  return { header, linkerConfig, fillByte, linker, sourceStyle };
}

/**
 * Builds the initial NES session state from target options.
 * @param context Session creation context.
 * @param context.targetOptions Normalized NES options.
 * @returns Fresh session state.
 */
export function createInitialNesState(context: {
  targetOptions: Readonly<Record<string, unknown>>;
}): Nes65xxSessionState {
  const options = createNes65xxTargetOptions(context.targetOptions);
  const state: Nes65xxSessionState = {
    header: options.header,
    fillByte: options.fillByte,
    linker: options.linker,
    memoryCursors: {},
    currentSegment: null,
    currentLoadMemory: null,
    segmentLoadStart: 0,
    segmentRunStart: 0,
  };
  resetNes65xxStageState(state);
  return state;
}

/**
 * Rejects addresses outside the unsigned 16-bit NES CPU space.
 * @param address Candidate CPU address.
 * @returns The same address when it is in range.
 */
function validate(address: number): number {
  if (!Number.isInteger(address) || address < 0 || address > 0xffff) {
    throw new Error(`Address $${address.toString(16).toUpperCase()} is outside 16-bit NES space.`);
  }
  return address;
}

/**
 * Maps load addresses into the iNES image using physical Asar offsets or ca65 MEMORY regions.
 * Logical CPU/PPU addresses stay independent of the load cursor through core `base` support.
 * @param context Target factory context.
 * @returns The NES address space.
 */
export function createNesAddressSpace({
  state,
  options,
}: TargetFactoryContext): TargetAddressSpace {
  if (options.sourceStyle === "asar") {
    const nes = state.get(nes65xxSessionStateKey);
    // Banked CPU addresses are not unique ROM locations. org selects physical payload bytes;
    // core base supplies the independent logical address used by labels and instruction encoding.
    const physical = (address: number): number => {
      if (!Number.isSafeInteger(address) || address < 0 || address >= nes.linker.imageSize) {
        throw new Error(
          `NES physical write offset ${address} is outside the fixed cartridge layout.`,
        );
      }
      return address;
    };
    return {
      addressWidth: 32,
      defaultOrigin: 0,
      normalizeForWrite: physical,
      advance: (address, amount) => address + amount,
      toOutputOffset(address) {
        // End-of-bank source ranges may point one byte past the payload; actual writes remain strict.
        if (!Number.isSafeInteger(address) || address < 0 || address > nes.linker.imageSize) {
          return -1;
        }
        return nes.header.length + address;
      },
      fromOutputOffset(offset) {
        const address = offset - nes.header.length;
        return address >= 0 && address < nes.linker.imageSize ? address : -1;
      },
      validateWrite: physical,
    };
  }
  return {
    addressWidth: 16,
    defaultOrigin: 0,
    normalizeForWrite: validate,
    advance(address, amount) {
      return validate((address + amount) & 0xffff);
    },
    toOutputOffset(address) {
      const nes = state.get(nes65xxSessionStateKey);
      if (!nes.currentLoadMemory) {
        return -1;
      }
      const memory = nes.linker.memories.get(nes.currentLoadMemory);
      if (!memory || memory.fileOffset < 0) {
        return -1;
      }
      if (address < memory.start || address >= memory.start + memory.size) {
        return -1;
      }
      return nes.header.length + memory.fileOffset + (address - memory.start);
    },
    fromOutputOffset(offset) {
      const nes = state.get(nes65xxSessionStateKey);
      const prgOffset = offset - nes.header.length;
      if (prgOffset < 0) {
        return -1;
      }
      for (const memory of nes.linker.memories.values()) {
        if (memory.fileOffset < 0) {
          continue;
        }
        if (prgOffset >= memory.fileOffset && prgOffset < memory.fileOffset + memory.size) {
          return memory.start + (prgOffset - memory.fileOffset);
        }
      }
      return -1;
    },
    validateWrite(address) {
      validate(address);
    },
  };
}

/**
 * Header plus filled PRG image. Checksum is not an iNES concept.
 * @returns The NES output format.
 */
export function createNesOutputFormat(): TargetOutputFormat {
  return {
    finalize: () => undefined,
    getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
  };
}

/**
 * Prefills header + `$FF` PRG, reseeds linker symbols, and closes the last segment.
 * @param context Target factory context.
 * @returns NES session lifecycle hooks.
 */
export function createNesLifecycle({ state }: TargetFactoryContext): SessionLifecycle {
  const prefill = (
    session: Parameters<NonNullable<SessionLifecycle["onStageStart"]>>[0]["session"],
  ) => {
    const nes = state.get(nes65xxSessionStateKey);
    resetNes65xxStageState(nes);
    session.outputFillByte = nes.fillByte;
    if (session.module) {
      for (const name of linkerDefinedSymbolNames(nes.linker)) {
        session.module.declare(name, "import");
      }
      session.bytes = 0;
      return;
    }
    const total = nes.header.length + nes.linker.imageSize;
    const image = Array.from({ length: total }, () => nes.fillByte);
    for (let index = 0; index < nes.header.length; index++) {
      image[index] = nes.header[index] ?? 0;
    }
    session.outputBytes = image;
    session.bytes = 0;
    for (const name of linkerDefinedSymbolNames(nes.linker)) {
      session.globalSymbols.add(name);
    }
  };
  return {
    onSessionCreated: ({ session }) => {
      prefill(session);
    },
    onStageStart: ({ session }) => {
      prefill(session);
    },
    onStageEnd: ({ session }) => {
      const nes = state.get(nes65xxSessionStateKey);
      closeActiveSegment(session, nes);
      applyLinkerSymbols(session, nes);
    },
  };
}

export { cloneNes65xxSessionState };

/**
 * Normalizes a caller-supplied header or synthesizes a 16-byte iNES header.
 * @param configured Header bytes, if any.
 * @param imageSize Linked PRG size in bytes.
 * @returns Header bytes.
 */
function normalizeHeader(configured: unknown, imageSize: number): number[] {
  if (configured instanceof Uint8Array || Array.isArray(configured)) {
    const bytes = [...configured].map((value) => Number(value) & 0xff);
    if (bytes.length === 0) {
      throw new Error("65xx NES target header must not be empty.");
    }
    return bytes;
  }
  if (configured !== undefined) {
    throw new Error("65xx NES target header must be a byte array.");
  }
  const prgBanks = Math.max(1, Math.ceil(imageSize / 0x4000));
  const header = Array.from({ length: 16 }, () => 0);
  header[0] = INES_MAGIC[0];
  header[1] = INES_MAGIC[1];
  header[2] = INES_MAGIC[2];
  header[3] = INES_MAGIC[3];
  header[4] = prgBanks & 0xff;
  return header;
}
