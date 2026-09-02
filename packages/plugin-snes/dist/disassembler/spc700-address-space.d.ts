import type { AddressSpaceDescriptor } from "@uttori/asm-disassembler";
/** Project address-space id for the SPC700's private 64 KiB memory bus. */
export declare const SPC700_ARAM_ADDRESS_SPACE = "snes.spc700.aram";
/** Native-project descriptor for SPC700 ARAM addresses. */
export declare const SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR: AddressSpaceDescriptor;
/** Identity between a 16-bit SPC700 address and its offset in an analysis image. */
export interface Spc700AramAddressIdentity {
    readonly addressSpace: typeof SPC700_ARAM_ADDRESS_SPACE;
    readonly address: number;
    readonly imageOffset: number;
}
/** Immutable contiguous ARAM image used by standalone SPC700 analysis. */
export declare class Spc700AramImage {
    #private;
    readonly loadAddress: number;
    readonly contentSha256: string;
    /**
     * @param {ArrayLike<number>} bytes Contiguous bytes copied into the image.
     * @param {number} [loadAddress] First 16-bit ARAM address represented by `bytes`.
     */
    constructor(bytes: ArrayLike<number>, loadAddress?: number);
    /**
     * Number of represented ARAM bytes.
     * @returns {number} Backing-image length.
     */
    get length(): number;
    /**
     * Returns a defensive copy of the represented bytes.
     * @returns {Uint8Array} Copied image bytes.
     */
    bytes(): Uint8Array;
    /**
     * Reads one byte by 16-bit ARAM address.
     * @param {number} address SPC700 memory address.
     * @returns {number | undefined} Byte value, or `undefined` outside the image.
     */
    readByte(address: number): number | undefined;
    /**
     * Maps a represented ARAM address to its backing-image offset.
     * @param {number} address SPC700 memory address.
     * @returns {Spc700AramAddressIdentity | undefined} Address identity when represented.
     */
    identifyAddress(address: number): Spc700AramAddressIdentity | undefined;
    /**
     * Maps a backing-image offset to its 16-bit ARAM address.
     * @param {number} imageOffset Offset in the contiguous backing image.
     * @returns {Spc700AramAddressIdentity | undefined} Address identity when represented.
     */
    identifyOffset(imageOffset: number): Spc700AramAddressIdentity | undefined;
}
//# sourceMappingURL=spc700-address-space.d.ts.map