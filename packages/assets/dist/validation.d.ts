/**
 * Reject values before allocation or bit packing; all native encoders use this bound.
 * @param value Candidate integer.
 * @param label Diagnostic field name.
 * @param minimum Inclusive lower bound.
 * @param maximum Inclusive upper bound.
 * @returns The validated integer.
 */
export declare function integer(value: number, label: string, minimum: number, maximum: number): number;
/**
 * Validate a complete native byte stream, including its final partial unit.
 * @param bytes Input stream.
 * @param size Number of bytes per native unit.
 * @param label Diagnostic format name.
 * @returns The number of complete units.
 */
export declare function unitCount(bytes: Uint8Array, size: number, label: string): number;
/**
 * Require a dotted, lowercase provider ID without regex backtracking.
 * @param id Candidate provider ID.
 * @returns Whether every namespace segment is valid.
 */
export declare function isNamespacedId(id: string): boolean;
/** Portable runtime assertion; narrows validated input without requiring Node's assertion module. */
export declare function invariant(value: unknown, message?: string): asserts value;
/** Exact scalar comparison, including NaN and signed-zero behavior, for portable native-format contracts. */
export declare function equal(actual: unknown, expected: unknown, message?: string): void;
/** Reject an invalid branch while preserving control-flow narrowing at the call site. */
export declare function fail(message: string): never;
//# sourceMappingURL=validation.d.ts.map