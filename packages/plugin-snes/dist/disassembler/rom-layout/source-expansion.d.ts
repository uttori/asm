import { type InspectSnesSourceOptions } from "../source-build.js";
import { type SnesRomExpansionPolicy } from "./expansion.js";
import type { SnesSourceFreeSpace, SnesSourceRelocation } from "./source-relocation.js";
/** Source-only capacity proposal. The caller pairs these edits with layout and checksum configuration. */
export interface SnesSourceExpansion {
    /** Target headerless ROM capacity after growth. */
    readonly size: number;
    /** Mapper, fill byte and checksum policy paired with the size change. */
    readonly expansion: SnesRomExpansionPolicy;
    /** Declared slack regions the assembler may allocate inside new storage. */
    readonly freeSpace: readonly SnesSourceFreeSpace[];
    /** Source edits that introduce capacity and placement metadata. */
    readonly edits: SnesSourceRelocation["edits"];
    /** SHA-256 of the pristine expanded image before user object placement. */
    readonly outputSha256: string;
}
/**
 * Add reviewed storage as ordinary assembly and update an explicit one-byte size header.
 * No source file is written. Existing source must build before capacity changes are proposed.
 */
export declare function prepareSnesSourceExpansion(options: {
    readonly build: InspectSnesSourceOptions;
    readonly size: number;
    readonly expansion: SnesRomExpansionPolicy;
    readonly freeSpace: readonly SnesSourceFreeSpace[];
    readonly logicalAddress: (offset: number) => number;
}): SnesSourceExpansion;
//# sourceMappingURL=source-expansion.d.ts.map