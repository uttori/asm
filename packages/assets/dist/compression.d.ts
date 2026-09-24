/** One strictly reversible byte transform, such as a game compressor. */
export interface ByteTransform {
    readonly id: string;
    readonly version: string;
    encode(bytes: Uint8Array, options: Readonly<Record<string, unknown>>): Uint8Array;
    decode(bytes: Uint8Array, options: Readonly<Record<string, unknown>>, maxOutputBytes: number): Uint8Array;
}
/** Ordered transform invocation; decoding runs in reverse order. */
export interface TransformStep {
    readonly id: string;
    readonly options?: Readonly<Record<string, unknown>>;
}
/** Registers unique transforms independently of any assembler target. */
export declare class TransformRegistry {
    #private;
    register(transform: ByteTransform): this;
    get(id: string): ByteTransform;
}
/** Encode a chain and verify that each stage decodes to its exact input.
 * @param {TransformRegistry} registry Registered reversible transforms.
 * @param {Uint8Array} input Borrowed original bytes.
 * @param {TransformStep[]} steps Ordered encode stages.
 * @param {number} maxOutputBytes Maximum bytes allowed after any stage.
 * @returns {Uint8Array} Owned final encoded bytes.
 */
export declare function transformBytes(registry: TransformRegistry, input: Uint8Array, steps: readonly TransformStep[], maxOutputBytes?: number): Uint8Array;
/** Reverse a transform chain with a caller-defined decoded expansion bound.
 * @param {TransformRegistry} registry Registered reversible transforms.
 * @param {Uint8Array} encoded Borrowed final encoded bytes.
 * @param {TransformStep[]} steps Original encode order.
 * @param {number} maxOutputBytes Maximum bytes allowed after any decode stage.
 * @returns {Uint8Array} Owned reconstructed bytes.
 */
export declare function reverseTransforms(registry: TransformRegistry, encoded: Uint8Array, steps: readonly TransformStep[], maxOutputBytes: number): Uint8Array;
//# sourceMappingURL=compression.d.ts.map