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
export declare const snesRomAddressSpace: TargetAddressSpace;
//# sourceMappingURL=address-space.d.ts.map