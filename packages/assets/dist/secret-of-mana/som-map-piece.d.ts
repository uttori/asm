/** One compressed token, retaining both the requested and native row-clipped run lengths. */
interface MapCommand {
    offset: number;
    opcode: number;
    destination: number;
    count: number;
    emitted: number;
}
/** Pointer-bounded deferred rectangle; tiles describe its first observed insertion, when used. */
interface MapMotif {
    offset: number;
    dimensions: number;
    width: number;
    height: number;
    bytes: Uint8Array;
    consumed?: number;
    tiles?: number[];
    commands?: MapCommand[];
}
/** Context from independently known tile bytes; the decoder never mutates this input. */
interface MapHistory {
    /** Byte offsets 0..65535 in bank 7F mapped to known byte values; absent cells remain unknown. */
    history?: ReadonlyMap<number, number>;
    /** Physical bank-7F byte offset of the parent origin, default 0; rows have a 128-byte stride. */
    origin?: number;
}
/** A fully consumed stream; base placeholders are resolved by its ordered motif insertions. */
interface DecodedMapStream {
    width: number;
    height: number;
    consumed: number;
    tiles: number[];
    commands: MapCommand[];
    baseTiles: (number | null)[];
    insertions: {
        index: number;
        destination: number;
    }[];
    /** Context-dependent insertion results, kept out of serialized geometry snapshots. */
    motifInstances: DecodedMapStream[];
}
/** Public geometry; motif workspace is available only when the header declares deferred rectangles. */
interface DecodedMapPiece {
    width: number;
    height: number;
    consumed: number;
    tiles: number[];
    commands: MapCommand[];
    dataOffset?: number;
    motifs?: MapMotif[];
    baseTiles?: (number | null)[];
    insertions?: {
        index: number;
        destination: number;
    }[];
    motifInstances?: DecodedMapStream[];
}
/**
 * Decode a complete pointer-bounded map piece. C0CD93..C0D032
 * emits into 128-byte WRAM rows and advances pattern history with an eight-bit column. This returns
 * compact row-major tile IDs, not SNES graphics or a reconstructed capture RAM image.
 * Motif commands reserve one unwritten base cell; C0CD4D applies their rectangles afterward.
 * Motifs decode in queue order against the completed parent and earlier insertions. Narrow motifs
 * can read outside their own rectangle through the native eight-bit history cursor. Optional
 * physical history supplies such cells when they also lie outside the parent; missing cells fail.
 * The input history is copied and never mutated. Recursive motifs and truncated input fail closed.
 * @param {Uint8Array} bytes Pointer-bounded map piece.
 * @returns {object} Compact row-major tile IDs and the consumed extent.
 */
export declare function decodeMapPiece(bytes: Uint8Array, { history, origin }?: MapHistory): DecodedMapPiece;
export {};
//# sourceMappingURL=som-map-piece.d.ts.map