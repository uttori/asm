import { createHash } from "node:crypto";

import type { AddressSpaceDescriptor } from "@uttori/asm-disassembler";

/** Project identity for addresses fetched by the SuperFX GSU. */
export const SUPERFX_ROM_ADDRESS_SPACE = "snes.superfx.rom";

/** Native-project descriptor for the banked 24-bit GSU ROM view. */
export const SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR: AddressSpaceDescriptor = Object.freeze({
  id: SUPERFX_ROM_ADDRESS_SPACE,
  name: "SuperFX ROM",
  addressBits: 24,
  kind: "memory",
});

/** Address-to-backing identity within one contiguous GSU analysis image. */
export interface SuperFxRomAddressIdentity {
  readonly addressSpace: typeof SUPERFX_ROM_ADDRESS_SPACE;
  readonly address: number;
  readonly imageOffset: number;
}

/** Immutable contiguous program image used by SuperFX decoding and analysis. */
export class SuperFxRomImage {
  readonly loadAddress: number;
  readonly contentSha256: string;
  readonly #bytes: Uint8Array;

  constructor(bytes: ArrayLike<number>, loadAddress = 0) {
    if (!Number.isInteger(loadAddress) || loadAddress < 0 || loadAddress > 0xffffff) {
      throw new Error("SuperFX loadAddress must be a 24-bit unsigned integer.");
    }
    if (bytes.length > 0x1000000 || loadAddress + bytes.length > 0x1000000) {
      throw new Error("SuperFX images must fit contiguously within the 24-bit address space.");
    }
    this.#bytes = Uint8Array.from(bytes);
    this.loadAddress = loadAddress;
    this.contentSha256 = createHash("sha256").update(this.#bytes).digest("hex");
  }

  get length(): number {
    return this.#bytes.length;
  }

  bytes(): Uint8Array {
    return this.#bytes.slice();
  }

  readByte(address: number): number | undefined {
    const identity = this.identifyAddress(address);
    return identity ? this.#bytes[identity.imageOffset] : undefined;
  }

  identifyAddress(address: number): SuperFxRomAddressIdentity | undefined {
    if (!Number.isInteger(address) || address < this.loadAddress || address > 0xffffff) {
      return undefined;
    }
    const imageOffset = address - this.loadAddress;
    if (imageOffset >= this.length) return undefined;
    return { addressSpace: SUPERFX_ROM_ADDRESS_SPACE, address, imageOffset };
  }

  identifyOffset(imageOffset: number): SuperFxRomAddressIdentity | undefined {
    if (!Number.isInteger(imageOffset) || imageOffset < 0 || imageOffset >= this.length) {
      return undefined;
    }
    return {
      addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
      address: this.loadAddress + imageOffset,
      imageOffset,
    };
  }
}
