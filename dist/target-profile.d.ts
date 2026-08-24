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
/** Context passed to an output format after the final emission pass. */
export interface OutputFinalizationContext {
    readonly canFinalize: boolean;
    readonly checksumFixEnabled: boolean;
    readonly bytes: number[] | Uint8Array;
    updateChecksum(): void;
}
/** Controls target-container finalization and the bytes returned to callers. */
export interface TargetOutputFormat {
    readonly name: string;
    readonly defaultExtension: string;
    finalize(context: OutputFinalizationContext): void;
    getBinaryOutput(bytes: number[] | Uint8Array): Uint8Array;
}
/**
 * A complete build target. Architectures, address spaces, containers, and
 * dialect capabilities are intentionally independent so future targets can
 * reuse only the pieces they need.
 */
export interface TargetProfile {
    readonly name: string;
    readonly defaultArchitecture: string;
    readonly architectures: ReadonlySet<string>;
    readonly defaultMapper: string;
    readonly checksumFixEnabled: boolean;
    readonly addressSpace: TargetAddressSpace;
    readonly outputFormat: TargetOutputFormat;
    readonly directiveSetIds: ReadonlySet<string>;
    readonly expressionSetIds: ReadonlySet<string>;
}
/** Registry used by CLIs, editors, and embedders to resolve named targets. */
export declare class TargetProfileRegistry {
    readonly profiles: Map<string, TargetProfile>;
    readonly aliases: Map<string, string>;
    register(profile: TargetProfile, aliases?: readonly string[]): void;
    get(name: string): TargetProfile | undefined;
}
/** Linear 16-bit address space used by the future 6502 target. */
export declare const flat16AddressSpace: TargetAddressSpace;
/** Existing SNES mapper behavior expressed through the target contract. */
export declare const snesRomAddressSpace: TargetAddressSpace;
/** Existing SFC output behavior, including checksum finalization. */
export declare const snesRomOutputFormat: TargetOutputFormat;
/** Container-free output format for future linear targets. */
export declare const rawBinaryOutputFormat: TargetOutputFormat;
export declare const snesTargetProfile: TargetProfile;
/**
 * Placeholder target proving the composition boundary. Its architecture is
 * intentionally a stub and cannot encode programs yet.
 */
export declare const mos6502StubTargetProfile: TargetProfile;
export declare const builtInTargetProfiles: TargetProfileRegistry;
//# sourceMappingURL=target-profile.d.ts.map