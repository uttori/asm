/** Mutable mapper state supplied to an address-space implementation. */
export interface AddressSpaceContext {
  mapper: string;
  sa1banks: readonly number[];
  bankCrossCheckMode?: "off" | "full" | "half";
}

/**
 * Translates logical assembly addresses to output offsets and advances the
 * logical program counter. CPU encoders do not need to know which address
 * space is active.
 */
export interface TargetAddressSpace {
  readonly name: string;
  readonly addressWidth: number;
  readonly defaultOrigin: number;
  readonly unmappedWriteBehavior: "allow" | "throw";
  normalizeForWrite(address: number, context: AddressSpaceContext): number;
  advance(address: number, amount: number, context: AddressSpaceContext): number;
  toOutputOffset(address: number, context: AddressSpaceContext): number;
  fromOutputOffset(offset: number, context: AddressSpaceContext): number;
}

/** Existing SNES mapper behavior expressed through the target contract. */
export const snesRomAddressSpace: TargetAddressSpace = {
  name: "snes-rom",
  addressWidth: 24,
  defaultOrigin: 0x008000,
  unmappedWriteBehavior: "allow",
  normalizeForWrite(address, context) {
    return this.advance(address, 0, context);
  },
  advance(address, amount, context) {
    const prefix = address & 0xff000000;
    const logicalAddress = address & 0xffffff;
    const newAddress = logicalAddress + amount;
    const finish = (value: number): number => prefix | value;
    // Asar: with `check bankcross on` (the default), pc() is linear, including
    // one-past-end $xxFFFF → $xy0000. Wrapping to $xy8000 only happens when
    // bankcross is off (see asar's bankcross test / `print pc` after $80FFFF).
    if ((logicalAddress & 0xff0000) !== (newAddress & 0xff0000)) {
      const wrapOnBankCross =
        context.bankCrossCheckMode !== "full" && context.bankCrossCheckMode !== "half";
      switch (context.mapper) {
        case "lorom":
          if (wrapOnBankCross) {
            return finish((newAddress & 0xff0000) | ((newAddress & 0xffff) + 0x8000));
          }
          return finish(newAddress);
        case "hirom":
        case "exhirom":
        case "sfxrom":
        case "sa1rom":
          if (wrapOnBankCross && (logicalAddress & 0x400000) === 0) {
            return finish((newAddress & 0xff0000) | ((newAddress & 0xffff) + 0x8000));
          }
          return finish(newAddress);
        case "exlorom":
        case "bigsa1rom": {
          if (!wrapOnBankCross) {
            return finish(newAddress);
          }
          const offset = this.toOutputOffset(logicalAddress, context);
          const mapped = offset < 0 ? -1 : this.fromOutputOffset(offset + amount, context);
          return mapped < 0 ? -1 : finish(mapped);
        }
        case "norom":
          return finish(newAddress);
        default:
          throw new Error(`Unknown mapper type: ${context.mapper}`);
      }
    }
    return finish(newAddress);
  },
  toOutputOffset(address, context) {
    if (address < 0 || address > 0xffffff) return -1;

    if (context.mapper === "lorom") {
      if (
        (address & 0xfe0000) === 0x7e0000 ||
        (address & 0x408000) === 0x000000 ||
        (address & 0x708000) === 0x700000
      ) {
        return -1;
      }
      return ((address & 0x7f0000) >> 1) | (address & 0x7fff);
    }
    if (context.mapper === "hirom") {
      if ((address & 0xfe0000) === 0x7e0000 || (address & 0x408000) === 0x000000) {
        return -1;
      }
      return address & 0x3fffff;
    }
    if (context.mapper === "exlorom") {
      if ((address & 0xf00000) === 0x700000 || (address & 0x408000) === 0x000000) {
        return -1;
      }
      const mapped = ((address & 0x7f0000) >> 1) | (address & 0x7fff);
      return address & 0x800000 ? mapped : mapped + 0x400000;
    }
    if (context.mapper === "exhirom") {
      if ((address & 0xfe0000) === 0x7e0000 || (address & 0x408000) === 0x000000) {
        return -1;
      }
      return (address & 0x800000) === 0 ? (address & 0x3fffff) | 0x400000 : address & 0x3fffff;
    }
    if (context.mapper === "sfxrom") {
      if (
        (address & 0x600000) === 0x600000 ||
        (address & 0x408000) === 0x000000 ||
        (address & 0x800000) === 0x800000
      ) {
        return -1;
      }
      return address & 0x400000
        ? address & 0x3fffff
        : ((address & 0x7f0000) >> 1) | (address & 0x7fff);
    }
    if (context.mapper === "sa1rom") {
      if ((address & 0x408000) === 0x008000) {
        return (
          context.sa1banks[(address & 0xe00000) >> 21] |
          ((address & 0x1f0000) >> 1) |
          (address & 0x007fff)
        );
      }
      if ((address & 0xc00000) === 0xc00000) {
        return (
          context.sa1banks[((address & 0x100000) >> 20) | ((address & 0x200000) >> 19)] |
          (address & 0x0fffff)
        );
      }
      return -1;
    }
    if (context.mapper === "bigsa1rom") {
      if ((address & 0xc00000) === 0xc00000) {
        return (address & 0x3fffff) | 0x400000;
      }
      if ((address & 0xc00000) === 0x000000 || (address & 0xc00000) === 0x800000) {
        if ((address & 0x008000) === 0) return -1;
        return ((address & 0x800000) >> 2) | ((address & 0x3f0000) >> 1) | (address & 0x7fff);
      }
      return -1;
    }
    return context.mapper === "norom" ? address : -1;
  },
  fromOutputOffset(offset, context) {
    if (offset < 0) return -1;
    let address = offset;
    if (context.mapper === "lorom") {
      if (address >= 0x400000) return -1;
      address = ((address << 1) & 0x7f0000) | (address & 0x7fff) | 0x8000;
      return address | 0x800000;
    }
    if (context.mapper === "hirom") {
      return address >= 0x400000 ? -1 : address | 0xc00000;
    }
    if (context.mapper === "exlorom") {
      if (address >= 0x800000) return -1;
      if (address & 0x400000) {
        address -= 0x400000;
        return ((address << 1) & 0x7f0000) | (address & 0x7fff) | 0x8000;
      }
      address = ((address << 1) & 0x7f0000) | (address & 0x7fff) | 0x8000;
      return address | 0x800000;
    }
    if (context.mapper === "exhirom") {
      if (address >= 0x800000) return -1;
      return address & 0x400000 ? address : address | 0xc00000;
    }
    if (context.mapper === "sa1rom") {
      if (address >= 0x800000) return -1;
      for (let index = 0; index < 8; index++) {
        if (context.sa1banks[index] === (address & 0x700000)) {
          return 0x008000 | (index << 21) | ((address & 0x0f8000) << 1) | (address & 0x7fff);
        }
      }
      return -1;
    }
    if (context.mapper === "bigsa1rom") {
      if (address >= 0x800000) return -1;
      if ((address & 0x400000) === 0x400000) return address | 0xc00000;
      if ((address & 0x600000) === 0x000000) {
        return ((address << 1) & 0x3f0000) | 0x8000 | (address & 0x7fff);
      }
      if ((address & 0x600000) === 0x200000) {
        return 0x800000 | ((address << 1) & 0x3f0000) | 0x8000 | (address & 0x7fff);
      }
      return -1;
    }
    if (context.mapper === "sfxrom") {
      return address >= 0x200000 ? -1 : ((address << 1) & 0x7f0000) | (address & 0x7fff) | 0x8000;
    }
    return context.mapper === "norom" ? address : -1;
  },
};
