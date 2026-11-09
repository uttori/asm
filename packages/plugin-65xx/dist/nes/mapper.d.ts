import type { NesCartridge } from "./cartridge.js";
/** Unknown register values are null. Mapper context is separate from CPU register state. */
export interface NesMapperState {
    /** MMC3 address-select latch; null when the register has not been observed. */
    readonly select: number | null;
    /** MMC3 PRG banking mode bit; null when unknown. */
    readonly prgMode: number | null;
    /** MMC3 CHR banking mode bit; null when unknown. */
    readonly chrMode: number | null;
    /** MMC3 bank data registers r0..r7; null entries are unknown. */
    readonly banks: readonly (number | null)[];
    /** MMC3 WRAM enable flag; null when unknown. */
    readonly ramEnabled: boolean | null;
    /** MMC3 WRAM write-protect flag; null when unknown. */
    readonly ramWritable: boolean | null;
    /** Nametable mirroring selector; null when unknown. */
    readonly mirroring: number | null;
    /** MMC3 IRQ reload latch; null when unknown. */
    readonly irqLatch: number | null;
    /** MMC3 IRQ enable flag; null when unknown. */
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