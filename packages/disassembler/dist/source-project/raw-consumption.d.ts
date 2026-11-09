import type { AddressToLineMapping } from "@uttori/asm-core";
/** One retained raw block, paired with bytes from the immutable original ROM. */
export interface RawBlockInput {
    /** Source path used to match linker incbin dependencies. */
    readonly file: string;
    /** Bytes from the immutable original ROM at import time. */
    readonly original: Uint8Array;
    /** Current working copy bytes retained by the caller for the duration of the check. */
    readonly current: Uint8Array;
}
/**
 * A clean text merge can stop including an edited raw byte after analysis discovers code/table data.
 * Compare changed input bytes against exact final-pass incbin slices, not just dependency filenames.
 * The caller retains every block snapshot so the check cannot race a later filesystem read.
 */
export declare function checkRawBlockConsumption(mapping: AddressToLineMapping, blocks: readonly RawBlockInput[]): string[];
//# sourceMappingURL=raw-consumption.d.ts.map