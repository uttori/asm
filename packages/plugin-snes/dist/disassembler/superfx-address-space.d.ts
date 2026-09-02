import type { AddressSpaceDescriptor } from "@uttori/asm-disassembler";
/** Project identity for addresses fetched by the SuperFX GSU. */
export declare const SUPERFX_ROM_ADDRESS_SPACE = "snes.superfx.rom";
/** Native-project descriptor for the banked 24-bit GSU ROM view. */
export declare const SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR: AddressSpaceDescriptor;
/** Address-to-backing identity within one contiguous GSU analysis image. */
export interface SuperFxRomAddressIdentity {
    readonly addressSpace: typeof SUPERFX_ROM_ADDRESS_SPACE;
    readonly address: number;
    readonly imageOffset: number;
}
/** Immutable contiguous program image used by SuperFX decoding and analysis. */
export declare class SuperFxRomImage {
    #private;
    readonly loadAddress: number;
    readonly contentSha256: string;
    constructor(bytes: ArrayLike<number>, loadAddress?: number);
    get length(): number;
    bytes(): Uint8Array;
    readByte(address: number): number | undefined;
    identifyAddress(address: number): SuperFxRomAddressIdentity | undefined;
    identifyOffset(imageOffset: number): SuperFxRomAddressIdentity | undefined;
}
//# sourceMappingURL=superfx-address-space.d.ts.map