import type { IntervalAnnotation } from "@uttori/asm-disassembler";
import type { NesCartridge } from "./cartridge.js";
/** A qualified declaration projected into the headerless original-image coordinate system. */
export interface NesSourceDataRange {
    readonly start: number;
    readonly end: number;
    readonly annotation: IntervalAnnotation;
}
/** CPU ranges need an explicit physical anchor; file ranges already identify their original owner. */
export declare function nesSourceDataRanges(rom: NesCartridge, annotations: readonly IntervalAnnotation[]): NesSourceDataRange[];
/** Fixed-width, uppercase source literals; filenames and stable IDs keep their original spelling. */
export declare function nesSourceHex(value: number, digits?: number): string;
/** Put long behavior contracts above the equate while short descriptions remain useful inline hovers. */
export declare function nesSourceDefinition(name: string, address: number, description: string): string[];
//# sourceMappingURL=source-data.d.ts.map