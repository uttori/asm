import { HalfOpenIntervalIndex, type EvidenceRecord, type IntervalAnnotation } from "@uttori/asm-disassembler";
/** A typed declaration retains its original alignment even when labels split its emitted source. */
export interface SnesTypedData {
    readonly start: number;
    readonly end: number;
    readonly width: number;
    /** Explicit human decisions supersede imported byte classifications. */
    readonly priority: number;
}
/** Index only ROM-file data claims; CPU addresses and codec-bound assets have separate renderers. */
export declare function indexSnesTypedData(annotations: readonly IntervalAnnotation[], evidence: readonly EvidenceRecord[]): HalfOpenIntervalIndex<SnesTypedData>;
/** Resolve width without guessing pointer bank semantics. Conflicting word widths/alignment stop export. */
export declare function snesTypedDataAt(index: HalfOpenIntervalIndex<SnesTypedData>, start: number, end: number): SnesTypedData | undefined;
/** Emit little-endian literals in stable eight-value rows. Interior labels retain partial elements as bytes. */
export declare function renderSnesTypedData(bytes: Uint8Array, start: number, declaration: SnesTypedData): string[];
//# sourceMappingURL=typed-data.d.ts.map