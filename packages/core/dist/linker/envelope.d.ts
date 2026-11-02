export declare const MAX_ARTIFACT_BYTES: number;
/** A versioned binary envelope keeps payloads raw and hashes the header and every stored byte. */
export declare function encodeEnvelope(magic: string, metadata: unknown, payload: Uint8Array): Uint8Array;
/** Validate sizes before parsing JSON or exposing owned slices; trailing or corrupted data is rejected. */
export declare function decodeEnvelope(source: Uint8Array, magic: string): {
    metadata: unknown;
    payload: Uint8Array;
};
//# sourceMappingURL=envelope.d.ts.map