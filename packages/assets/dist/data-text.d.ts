/** Single-byte translation table; unmapped bytes use literal `\\xHH` escapes. */
export interface SingleByteTextOptions {
    /** Include common ASCII controls and printable bytes when true. */
    readonly ascii?: boolean;
    /** Additional byte-to-token mappings keyed by hex or decimal literals. */
    readonly table?: Readonly<Record<string, string>>;
    /** Optional trailing byte marking end-of-string in ROM. */
    readonly terminator?: number;
}
/** Termination is distinct from the visible text to preserve its native byte. */
export interface SingleByteText {
    /** Decoded visible text without the terminator byte. */
    readonly text: string;
    /** Whether the source ended with the configured terminator. */
    readonly terminated: boolean;
}
/**
 * Decode native single-byte text without replacing unknown values.
 * @param bytes Borrowed source bytes.
 * @param options Translation table and optional terminator.
 * @returns Visible text plus whether the final byte was a terminator.
 */
export declare function decodeSingleByteText(bytes: Uint8Array, options?: SingleByteTextOptions): SingleByteText;
/**
 * Encode translated text, including explicit escapes and optional terminator.
 * @param value Visible text and termination state.
 * @param options Translation table and optional terminator.
 * @returns Owned native bytes.
 */
export declare function encodeSingleByteText(value: SingleByteText, options?: SingleByteTextOptions): Uint8Array;
//# sourceMappingURL=data-text.d.ts.map