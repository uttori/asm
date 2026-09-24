/** Single-byte translation table; unmapped bytes use literal `\\xHH` escapes. */
export interface SingleByteTextOptions {
    readonly ascii?: boolean;
    readonly table?: Readonly<Record<string, string>>;
    readonly terminator?: number;
}
/** Termination is distinct from the visible text to preserve its native byte. */
export interface SingleByteText {
    readonly text: string;
    readonly terminated: boolean;
}
/** Decode native single-byte text without replacing unknown values.
 * @param {Uint8Array} bytes Borrowed source bytes.
 * @param {SingleByteTextOptions} options Translation table and optional terminator.
 * @returns {SingleByteText} Visible text plus whether the final byte was a terminator.
 */
export declare function decodeSingleByteText(bytes: Uint8Array, options?: SingleByteTextOptions): SingleByteText;
/** Encode translated text, including explicit escapes and optional terminator.
 * @param {SingleByteText} value Visible text and termination state.
 * @param {SingleByteTextOptions} options Translation table and optional terminator.
 * @returns {Uint8Array} Owned native bytes.
 */
export declare function encodeSingleByteText(value: SingleByteText, options?: SingleByteTextOptions): Uint8Array;
//# sourceMappingURL=data-text.d.ts.map