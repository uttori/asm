import type { SnesStructBinding, SnesStructConstant, SnesStructLayout } from "./struct-map.js";
/** A closed expression over this map. Binding identities are retained for span ownership checks. */
export interface SnesStructExpression {
    /** Native assembly text preserving grouping for re-emission. */
    readonly expression: string;
    /** Exact safe integer after bounded evaluation. */
    readonly value: number;
    /** Bindings touched by the expression; used for span ownership checks. */
    readonly bindings: readonly SnesStructBinding[];
}
/** A contiguous part of an observed access. Missing field names deliberately represent opaque bytes. */
export interface SnesStructAccessPart {
    /** Operand fragment covering this byte range. */
    readonly expression: string;
    /** CPU bus address of the first byte in this part. */
    readonly address: number;
    /** Byte length of this contiguous slice. */
    readonly width: number;
    /** Named field when the slice lies entirely inside one layout member. */
    readonly field?: string;
}
/**
 * Resolve a bounded subset of native assembly expressions, caching repeated expressions per map.
 * Only this map's constants/layouts/bindings participate; external defines, arbitrary calls,
 * file reads and record contents cannot affect instruction identity.
 */
export declare class SnesStructExpressionResolver {
    private readonly layouts;
    private readonly bindings;
    private readonly fields;
    private readonly cache;
    private readonly constants;
    /** Keep resolution local to one validated map; omitted constants preserve older map behavior. */
    constructor(layouts: readonly SnesStructLayout[], bindings: readonly SnesStructBinding[], constants?: readonly SnesStructConstant[]);
    /**
     * Check every intermediate value and preserve explicit grouping in the generated assembly.
     * @param input Single-line expression, at most 1,024 characters and 128 AST nodes.
     * @returns Native source and exact integer value with referenced owners.
     */
    resolve(input: unknown): SnesStructExpression;
}
/**
 * Split a CPU access across fields, opaque gaps and adjacent records of one physical binding.
 * @param binding Sole owner referenced by the target expression.
 * @param address Resolved CPU start address. Biased index-zero bases are not physical data.
 * @param width CPU access width in bytes (one or two).
 * @returns Ordered parts covering every byte exactly once.
 */
export declare function describeSnesStructAccess(binding: SnesStructBinding, address: number, width: number): readonly SnesStructAccessPart[];
//# sourceMappingURL=struct-expressions.d.ts.map