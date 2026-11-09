/** Mutable mapper state supplied to an address-space implementation. */
export interface AddressSpaceContext {
    /** Canonical mapper name (`lorom`, `hirom`, `sa1rom`, `norom`, ...). */
    mapper: string;
    /** SA-1 LoROM bank bases in 1 MiB units. Unused slots are `-1`. */
    sa1banks: readonly number[];
    /** PC wrap policy from `check bankcross`. */
    bankCrossCheckMode?: "off" | "full" | "half";
}
/**
 * Translates logical assembly addresses to output offsets and advances the
 * logical program counter. CPU encoders do not need to know which address
 * space is active.
 */
export interface SnesRomAddressSpace {
    /** Stable address-space id registered with the SNES target. */
    readonly name: string;
    /** Logical address width in bits (24 for cartridge ROM). */
    readonly addressWidth: number;
    /** Origin used when the source does not set `org`. */
    readonly defaultOrigin: number;
    /** Whether writes to unmapped logical addresses throw or are ignored. */
    readonly unmappedWriteBehavior: "allow" | "throw";
    /**
     * Canonicalizes a logical address before a write.
     * @param address Logical address.
     * @param context Mapper/bankcross state.
     * @returns Address to write.
     */
    normalizeForWrite(address: number, context: AddressSpaceContext): number;
    /**
     * Advances the logical PC after emitting `amount` bytes.
     * @param address Current logical address.
     * @param amount Bytes written.
     * @param context Mapper/bankcross state.
     * @returns Next logical address.
     */
    advance(address: number, amount: number, context: AddressSpaceContext): number;
    /**
     * Maps a CPU bus address to a ROM file offset, or `-1` if unmapped.
     * @param address Logical address.
     * @param context Mapper/bankcross state.
     * @returns File offset, or `-1`.
     */
    toOutputOffset(address: number, context: AddressSpaceContext): number;
    /**
     * Maps a ROM file offset back to a CPU bus address, or `-1` if unmapped.
     * @param offset File offset.
     * @param context Mapper/bankcross state.
     * @returns Logical address, or `-1`.
     */
    fromOutputOffset(offset: number, context: AddressSpaceContext): number;
}
/** Existing SNES mapper behavior expressed through the target contract. */
export declare const snesRomAddressSpace: SnesRomAddressSpace;
//# sourceMappingURL=address-space.d.ts.map