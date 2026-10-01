import type { SnesLayoutDiagnostic } from "./check.js";
import type { SnesMovableObject } from "./relocate.js";
/** Explicit same-mapper capacity increase. All offsets and sizes are headerless ROM bytes. */
export interface SnesRomExpansionPolicy {
    readonly mapper: "hirom" | "lorom";
    /** Power-of-two ceiling, at most 4 MiB. Mapper transitions require a different contract. */
    readonly maximumSize: number;
    /** Pristine value of every newly available byte, before declared object placement. */
    readonly fillByte: number;
    readonly checksum: "recalculate";
}
/** Return the cartridge header's file offset; expansion never relocates the header. */
export declare const expansionHeaderOffset: (policy: SnesRomExpansionPolicy) => number;
/** Reject unsupported capacities before allocation, including accidental shrinkage and mapper changes. */
export declare function assertSnesRomExpansion(original: Uint8Array, size: number, policy?: SnesRomExpansionPolicy): void;
/**
 * Virtual pristine allocation image: preserve the original ROM and append only declared fill.
 * This is an allocation oracle, never a replacement original-ROM identity or an asset file.
 */
export declare function expandedPristineRom(original: Uint8Array, size: number, policy?: SnesRomExpansionPolicy): Uint8Array;
/** Verify header/checksum and ownership of new storage independently of assembler finalization. */
export declare function checkSnesRomExpansion(output: Uint8Array, original: Uint8Array, size: number, policy: SnesRomExpansionPolicy | undefined, objects?: readonly SnesMovableObject[]): SnesLayoutDiagnostic[];
//# sourceMappingURL=expansion.d.ts.map