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
  /** Always the GSU ROM address space. */
  readonly addressSpace: typeof SUPERFX_ROM_ADDRESS_SPACE;
  /** 24-bit banked GSU address. */
  readonly address: number;
  /** Zero-based offset in the backing image. */
  readonly imageOffset: number;
}

/** Immutable contiguous program image used by SuperFX decoding and analysis. */
export class SuperFxRomImage {
  /** First 24-bit GSU address represented by the image. */
  readonly loadAddress: number;
  /** Lowercase hex SHA-256 of the image bytes, fixed at construction. */
  readonly contentSha256: string;
  readonly #bytes: Uint8Array;

  /**
   * Copies the bytes and validates that they fit contiguously below `$1000000`.
   * @param bytes Contiguous bytes copied into the image.
   * @param [loadAddress] First 24-bit GSU address represented by `bytes`.
   */
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

  /**
   * Number of represented GSU bytes.
   * @returns Backing-image length.
   */
  get length(): number {
    return this.#bytes.length;
  }

  /**
   * Returns a defensive copy of the represented bytes.
   * @returns Copied image bytes.
   */
  bytes(): Uint8Array {
    return this.#bytes.slice();
  }

  /**
   * Reads one byte by 24-bit GSU address.
   * @param address GSU memory address.
   * @returns Byte value, or `undefined` outside the image.
   */
  readByte(address: number): number | undefined {
    const identity = this.identifyAddress(address);
    return identity ? this.#bytes[identity.imageOffset] : undefined;
  }

  /**
   * Maps a represented GSU address to its backing-image offset.
   * @param address GSU memory address.
   * @returns Address identity when represented.
   */
  identifyAddress(address: number): SuperFxRomAddressIdentity | undefined {
    if (!Number.isInteger(address) || address < this.loadAddress || address > 0xffffff) {
      return undefined;
    }
    const imageOffset = address - this.loadAddress;
    if (imageOffset >= this.length) {
      return undefined;
    }
    return { addressSpace: SUPERFX_ROM_ADDRESS_SPACE, address, imageOffset };
  }

  /**
   * Maps a backing-image offset to its 24-bit GSU address.
   * @param imageOffset Offset in the contiguous backing image.
   * @returns Address identity when represented.
   */
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
