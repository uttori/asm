import { type InspectSnesSourceOptions } from "../source-build.js";
import { type SnesRomExpansionPolicy } from "./expansion.js";
import type { SnesSourceFreeSpace, SnesSourceRelocation } from "./source-relocation.js";
/** Source-only capacity proposal. The caller pairs these edits with layout and checksum configuration. */
export interface SnesSourceExpansion {
    readonly size: number;
    readonly expansion: SnesRomExpansionPolicy;
    readonly freeSpace: readonly SnesSourceFreeSpace[];
    readonly edits: SnesSourceRelocation["edits"];
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