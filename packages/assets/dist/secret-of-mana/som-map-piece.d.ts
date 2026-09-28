interface MapCommand {
    offset: number;
    opcode: number;
    destination: number;
    count: number;
    emitted: number;
}
/**
 * Decode a complete pointer-bounded map piece. C0CD93..C0D032
 * emits into 128-byte WRAM rows, but its history wraps at the logical piece width. This returns
 * compact row-major tile IDs, not SNES graphics or a reconstructed capture RAM image.
 * Motif commands reserve one unwritten base cell; C0CD4D applies their rectangles afterward.
 * History references to those still-unwritten cells, recursive motifs and truncated input fail closed.
 * @param {Uint8Array} bytes Pointer-bounded map piece.
 * @returns {object} Compact row-major tile IDs and the consumed extent.
 */
export declare function decodeMapPiece(bytes: Uint8Array): {
    width: number;
    height: number;
    consumed: number;
    tiles: number[];
    commands: {
        opcode: number;
        destination: number;
        count: number;
        emitted: number;
        offset: number;
    }[];
} | {
    consumed: number;
    commands: {
        opcode: number;
        destination: number;
        count: number;
        emitted: number;
        offset: number;
    }[];
    dataOffset: number;
    motifs: {
        offset: number;
        dimensions: number;
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
    }[];
    width: number;
    height: number;
    tiles: number[];
    baseTiles: (number | null)[];
    insertions: {
        index: number;
        destination: number;
    }[];
};
export {};
//# sourceMappingURL=som-map-piece.d.ts.map