/** Native artifacts use a fixed, locale-independent key order for reproducible cross-process identities. */
export declare function stableJson(value: unknown): string;
/** Clone supported target metadata without silently dropping callbacks, nonfinite values, or rich objects. */
export declare function portableValue(value: unknown, depth?: number, budget?: {
    nodes: number;
}): unknown;
/** Reverse the one explicit rich-value tag after bounded JSON parsing. */
export declare function restoreValue(value: unknown, depth?: number, budget?: {
    nodes: number;
}): unknown;
/** SHA-256 covers exact serialized bytes, including metadata, payloads, and ordering. */
export declare function artifactHash(value: string | Uint8Array): string;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function record(value: unknown, purpose: string): Record<string, unknown>;
export declare function list(value: unknown, purpose: string): unknown[];
export declare function textValue(value: unknown, purpose: string): string;
export declare function integer(value: unknown, purpose: string, minimum?: number, maximum?: number): number;
//# sourceMappingURL=value.d.ts.map