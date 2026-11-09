import type { AddressSpaceDescriptor } from "@uttori/asm-disassembler";
/** Project identity for addresses fetched by the SuperFX GSU. */
export declare const SUPERFX_ROM_ADDRESS_SPACE = "snes.superfx.rom";
/** Native-project descriptor for the banked 24-bit GSU ROM view. */
export declare const SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR: AddressSpaceDescriptor;
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
export declare class SuperFxRomImage {
    #private;
    /** First 24-bit GSU address represented by the image. */
    readonly loadAddress: number;
    /** Lowercase hex SHA-256 of the image bytes, fixed at construction. */
    readonly contentSha256: string;
    /**
     * Copies the bytes and validates that they fit contiguously below `$1000000`.
     * @param bytes Contiguous bytes copied into the image.
     * @param [loadAddress] First 24-bit GSU address represented by `bytes`.
     */
    constructor(bytes: ArrayLike<number>, loadAddress?: number);
    /**
     * Number of represented GSU bytes.
     * @returns Backing-image length.
     */
    get length(): number;
    /**
     * Returns a defensive copy of the represented bytes.
     * @returns Copied image bytes.
     */
    bytes(): Uint8Array;
    /**
     * Reads one byte by 24-bit GSU address.
     * @param address GSU memory address.
     * @returns Byte value, or `undefined` outside the image.
     */
    readByte(address: number): number | undefined;
    /**
     * Maps a represented GSU address to its backing-image offset.
     * @param address GSU memory address.
     * @returns Address identity when represented.
     */
    identifyAddress(address: number): SuperFxRomAddressIdentity | undefined;
    /**
     * Maps a backing-image offset to its 24-bit GSU address.
     * @param imageOffset Offset in the contiguous backing image.
     * @returns Address identity when represented.
     */
    identifyOffset(imageOffset: number): SuperFxRomAddressIdentity | undefined;
}
//# sourceMappingURL=superfx-address-space.d.ts.map