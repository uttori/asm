import type { NesCartridge } from "./cartridge.js";
/** Unknown register values are null. Mapper context is separate from CPU register state. */
export interface NesMapperState {
    readonly select: number | null;
    readonly prgMode: number | null;
    readonly chrMode: number | null;
    readonly banks: readonly (number | null)[];
    readonly ramEnabled: boolean | null;
    readonly ramWritable: boolean | null;
    readonly mirroring: number | null;
    readonly irqLatch: number | null;
    readonly irqEnabled: boolean | null;
}
/** Deterministic ares power-on profile; physical cartridge power-up is not inferred from the header. */
export declare function initialNesMapperState(): NesMapperState;
/** Reject unsupported boards before publishing analysis rather than treating them as NROM. */
export declare function validateNesMapper(rom: NesCartridge): void;
/** CPU bus address to physical PRG offset. Unknown mappings return undefined, never a guessed bank. */
export declare function nesPrgOffset(rom: NesCartridge, address: number, state: NesMapperState): number | undefined;
/** MMC3 register writes use the decoded bus alias. Unknown bank data invalidates only the affected selection. */
export declare function writeNesMapper(state: NesMapperState, address: number, value: number | null): NesMapperState;
/** Only PRG mapping participates in execution identity; CHR/IRQ changes do not multiply CPU nodes. */
export declare function nesExecutionContext(state: NesMapperState): string;
//# sourceMappingURL=mapper.d.ts.map