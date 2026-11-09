/** One strictly reversible byte transform, such as a game compressor. */
export interface ByteTransform {
    /** Namespaced transform id registered with the host. */
    readonly id: string;
    /** Transform schema revision for options validation. */
    readonly version: string;
    /** Apply the forward transform to owned input bytes. */
    encode(bytes: Uint8Array, options: Readonly<Record<string, unknown>>): Uint8Array;
    /** Invert the transform with an explicit decoded-size ceiling. */
    decode(bytes: Uint8Array, options: Readonly<Record<string, unknown>>, maxOutputBytes: number): Uint8Array;
}
/** Ordered transform invocation; decoding runs in reverse order. */
export interface TransformStep {
    /** Registered transform id to invoke at this pipeline stage. */
    readonly id: string;
    /** Optional transform-specific options validated by the transform. */
    readonly options?: Readonly<Record<string, unknown>>;
}
/** Registers unique transforms independently of any assembler target. */
export declare class TransformRegistry {
    #private;
    /** Add one transform; duplicate ids reject registration. */
    register(transform: ByteTransform): this;
    /** Resolve a registered transform by id. */
    get(id: string): ByteTransform;
}
/**
 * Encode a chain and verify that each stage decodes to its exact input.
 * @param registry Registered reversible transforms.
 * @param input Borrowed original bytes.
 * @param steps Ordered encode stages.
 * @param maxOutputBytes Maximum bytes allowed after any stage.
 * @returns Owned final encoded bytes.
 */
export declare function transformBytes(registry: TransformRegistry, input: Uint8Array, steps: readonly TransformStep[], maxOutputBytes?: number): Uint8Array;
/**
 * Reverse a transform chain with a caller-defined decoded expansion bound.
 * @param registry Registered reversible transforms.
 * @param encoded Borrowed final encoded bytes.
 * @param steps Original encode order.
 * @param maxOutputBytes Maximum bytes allowed after any decode stage.
 * @returns Owned reconstructed bytes.
 */
export declare function reverseTransforms(registry: TransformRegistry, encoded: Uint8Array, steps: readonly TransformStep[], maxOutputBytes: number): Uint8Array;
//# sourceMappingURL=compression.d.ts.map