import type { DecodedInstruction } from "@uttori/asm-core";
/** CPU register definition. Read/write aliases can have different meanings at the same address. */
export interface NesHardwareSymbol {
    /** Canonical NES hardware-register name. */
    readonly name: string;
    /** Logical bus or device address for the observation. */
    readonly address: number;
    /** Allowed CPU access direction for the hardware location. */
    readonly access: "read" | "write" | "read-write";
    /** Short hardware-register summary for editors and catalogs. */
    readonly description: string;
    /** Mapper number or register snapshot. */
    readonly mapper?: number;
}
/** Conventional 2A03/2C02 names and the supported MMC3 register interface. */
export declare const NES_HARDWARE_SYMBOLS: readonly NesHardwareSymbol[];
/**
 * Resolve direct data operands only. Mirror expressions retain the exact encoded address.
 * Indexed/pointer operands and RMW accesses remain numeric when their direction/port is ambiguous.
 * Reading PRG ROM must never acquire a write-only mapper-register name.
 */
export declare function nesHardwareOperand(instruction: DecodedInstruction, mapper: number): string | undefined;
/** Shared Asar equates remain visible through incsrc; descriptions support hover/navigation. */
export declare function nesHardwareSource(mapper: number): string;
//# sourceMappingURL=hardware.d.ts.map