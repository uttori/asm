import type { SnesStructBinding, SnesStructLayout } from "./struct-map.js";
/** A closed expression over this map. Binding identities are retained for span ownership checks. */
export interface SnesStructExpression {
    readonly expression: string;
    readonly value: number;
    readonly bindings: readonly SnesStructBinding[];
}
/** A contiguous part of an observed access. Missing field names deliberately represent opaque bytes. */
export interface SnesStructAccessPart {
    readonly expression: string;
    readonly address: number;
    readonly width: number;
    readonly field?: string;
}
/**
 * Resolve a bounded subset of native assembly expressions, caching repeated expressions per map.
 * No defines, arbitrary calls, file reads or record contents participate in instruction identity.
 */
export declare class SnesStructExpressionResolver {
    private readonly layouts;
    private readonly bindings;
    private readonly fields;
    private readonly cache;
    constructor(layouts: readonly SnesStructLayout[], bindings: readonly SnesStructBinding[]);
    /**
     * Check every intermediate value and preserve explicit grouping in the generated assembly.
     * @param {unknown} input Single-line expression, at most 1,024 characters and 128 AST nodes.
     * @returns {SnesStructExpression} Native source and exact integer value with referenced owners.
     */
    resolve(input: unknown): SnesStructExpression;
}
/**
 * Split a CPU access across fields, opaque gaps and adjacent records of one physical binding.
 * @param {SnesStructBinding} binding Sole owner referenced by the target expression.
 * @param {number} address Resolved CPU start address. Biased index-zero bases are not physical data.
 * @param {number} width CPU access width in bytes (one or two).
 * @returns {readonly SnesStructAccessPart[]} Ordered parts covering every byte exactly once.
 */
export declare function describeSnesStructAccess(binding: SnesStructBinding, address: number, width: number): readonly SnesStructAccessPart[];
//# sourceMappingURL=struct-expressions.d.ts.map