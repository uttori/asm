/** Mutable mapper state supplied to an address-space implementation. */
export interface AddressSpaceContext {
    /** Canonical mapper name (`lorom`, `hirom`, `sa1rom`, `norom`, ...). */
    mapper: string;
    /** SA-1 LoROM bank bases in 1 MiB units; unused slots are `-1`. */
    sa1banks: readonly number[];
    /** PC wrap policy from `check bankcross`. */
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
    /**
     * Canonicalizes a logical address before a write.
     * @param {number} address Logical address.
     * @param {AddressSpaceContext} context Mapper/bankcross state.
     * @returns {number} Address to write.
     */
    normalizeForWrite(address: number, context: AddressSpaceContext): number;
    /**
     * Advances the logical PC after emitting `amount` bytes.
     * @param {number} address Current logical address.
     * @param {number} amount Bytes written.
     * @param {AddressSpaceContext} context Mapper/bankcross state.
     * @returns {number} Next logical address.
     */
    advance(address: number, amount: number, context: AddressSpaceContext): number;
    /**
     * Maps a CPU bus address to a ROM file offset, or `-1` if unmapped.
     * @param {number} address Logical address.
     * @param {AddressSpaceContext} context Mapper/bankcross state.
     * @returns {number} File offset, or `-1`.
     */
    toOutputOffset(address: number, context: AddressSpaceContext): number;
    /**
     * Maps a ROM file offset back to a CPU bus address, or `-1` if unmapped.
     * @param {number} offset File offset.
     * @param {AddressSpaceContext} context Mapper/bankcross state.
     * @returns {number} Logical address, or `-1`.
     */
    fromOutputOffset(offset: number, context: AddressSpaceContext): number;
}
/** Existing SNES mapper behavior expressed through the target contract. */
export declare const snesRomAddressSpace: TargetAddressSpace;
//# sourceMappingURL=address-space.d.ts.map