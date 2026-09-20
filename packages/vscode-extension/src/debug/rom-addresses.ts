import type { DebugMap } from "@uttori/asm-core/debug-map";
import type { DebugAdapterSessionOptions, DebugAddress } from "@uttori/asm-debug-adapter";
import { RomImage } from "@uttori/asm-disassembler";
import {
  createSnesAddressContext,
  detectSnesRom,
  identifySnesCpuAddress,
} from "@uttori/asm-plugin-snes";

/** Mapper-dependent hooks kept outside the emulator-neutral DAP package. */
type AddressResolvers = Pick<
  DebugAdapterSessionOptions,
  "sourceBreakpointAddresses" | "sourceOutputOffset"
>;

/**
 * Resolves static cartridge mappings confirmed by the loaded ROM header.
 * RAM, coprocessors, ambiguous headers and dynamic bank registers retain exact addressing.
 * Output offsets include a copier header because maps fingerprint the complete file.
 * @param {DebugMap} map Validated map paired with this exact binary.
 * @param {Uint8Array} output Loaded binary bytes. Never modified.
 * @returns {AddressResolvers} Optional source alias and runtime-PC mapping hooks.
 */
export const createSnesDebugAddressResolvers = (
  map: DebugMap,
  output: Uint8Array,
): AddressResolvers => {
  if (map.target !== "snes.sfc") {
    return {};
  }
  let rom: RomImage;
  try {
    rom = new RomImage(output);
  } catch {
    // Small assembly/replay fixtures need not be complete cartridge images.
    return {};
  }
  const { mapper } = detectSnesRom(rom);
  if (!mapper || !["lorom", "hirom", "exlorom", "exhirom"].includes(mapper)) {
    return {};
  }
  const context = createSnesAddressContext(mapper);
  const identity = (address: DebugAddress) => {
    if (address.architecture !== "snes.65816" || address.addressSpace !== "snes.cpu") {
      return undefined;
    }
    return identifySnesCpuAddress(address.address, context, rom.length);
  };
  return {
    sourceBreakpointAddresses: (address) => {
      const mapped = identity(address);
      // Never expand a RAM relocation or a source whose physical map disagrees with
      // this cartridge mapper, even if its numeric address happens to resemble ROM.
      if (!mapped || address.outputOffset !== mapped.fileOffset + rom.identity.headerSize) {
        return [address];
      }
      return mapped.mirrors.map((alias) => ({ ...address, address: alias }));
    },
    sourceOutputOffset: (address) => {
      const mapped = identity(address);
      return mapped ? mapped.fileOffset + rom.identity.headerSize : undefined;
    },
  };
};
