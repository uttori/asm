import type { IntervalAnnotation } from "@uttori/asm-disassembler";
import type { NesCartridge } from "./cartridge.js";
/** A qualified declaration projected into the headerless original-image coordinate system. */
export interface NesSourceDataRange {
    /** Inclusive interval start address. */
    readonly start: number;
    /** Exclusive interval end address. */
    readonly end: number;
    /** Interval annotation applied to the address range. */
    readonly annotation: IntervalAnnotation;
}
/** CPU ranges need an explicit physical anchor; file ranges already identify their original owner. */
export declare function nesSourceDataRanges(rom: NesCartridge, annotations: readonly IntervalAnnotation[]): NesSourceDataRange[];
/** Fixed-width, uppercase source literals; filenames and stable IDs keep their original spelling. */
export declare function nesSourceHex(value: number, digits?: number): string;
/** Keep each contract above its equate and separate declarations for readable shared includes. */
export declare function nesSourceDefinition(name: string, address: number, description: string): string[];
//# sourceMappingURL=source-data.d.ts.map