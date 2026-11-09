/**
 * Decode pointer-bounded SoM body records; no ROM reads or capture-tool dependencies.
 * @param input Pointer-bounded body bytes.
 * @returns Parsed body record.
 */
export declare function decodeBodyFrame(input: Uint8Array | readonly number[]): {
    header: number;
    groups: number;
    tileOffsets: number[];
    blocks: {
        x: number;
        y: number;
        flipX: boolean;
        priority: boolean;
    }[];
    coordinateOffsets: {
        y: number;
        x: number;
    }[];
    collisionBytes: Uint8Array<ArrayBuffer>;
};
/**
 * Patch only signed-seven-bit block coordinates; preserve every flag, run token and tail byte.
 * Edits name a native block index, never a visual occurrence or an atlas coordinate.
 * @param input Original body bytes.
 * @param edits Coordinate replacements.
 * @returns Body bytes with only the named coordinates changed.
 */
export declare function patchBodyFrameCoordinates(input: Uint8Array | readonly number[], edits: readonly {
    block: number;
    x?: number;
    y?: number;
}[]): Uint8Array<ArrayBuffer>;
//# sourceMappingURL=som-body-frame.d.ts.map