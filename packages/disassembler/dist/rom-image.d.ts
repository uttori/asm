/** Copier (SMC) header size: none, or the classic 512-byte prefix. */
export type CopierHeaderSize = 0 | 512;
/** Cryptographic identity of a loaded ROM file, with and without any copier header. */
export interface RomIdentity {
    /** SHA-256 of the complete file, including any copier header. */
    readonly sha256: string;
    /** SHA-256 of the headerless cartridge image used for analysis and rebuild. */
    readonly contentSha256: string;
    /** Byte length of the complete file. */
    readonly fileSize: number;
    /** Byte length after stripping the copier header. */
    readonly contentSize: number;
    /** `0` or `512`; matches `fileSize - contentSize`. */
    readonly headerSize: CopierHeaderSize;
}
/** Options for constructing a `RomImage`. Omitted `headerSize` is auto-detected. */
export interface RomLoadOptions {
    /** Explicit copier-header size; required when the file size is not 32 KiB aligned. */
    readonly headerSize?: CopierHeaderSize;
}
/**
 * Infers a 0- or 512-byte copier header from file size (`size % 0x8000`).
 * @param {number} fileSize Complete file length in bytes.
 * @returns {CopierHeaderSize} `0` or `512`.
 * @throws {Error} When `fileSize` is negative or not 32 KiB aligned with either header size.
 */
export declare const detectCopierHeaderSize: (fileSize: number) => CopierHeaderSize;
/**
 * Immutable, bounds-safe view of a user-supplied ROM.
 * The constructor copies input bytes so later mutation of the caller's buffer is ignored.
 */
export declare class RomImage {
    #private;
    /** File and content hashes, sizes, and detected or overridden header size. */
    readonly identity: RomIdentity;
    /** Path passed to `RomImage.load`, if the image came from disk. */
    readonly sourcePath?: string;
    /**
     * @param {Uint8Array} bytes Complete file bytes; copied immediately.
     * @param {RomLoadOptions & { readonly sourcePath?: string }} [options] Header override and optional origin path.
     */
    constructor(bytes: Uint8Array, options?: RomLoadOptions & {
        readonly sourcePath?: string;
    });
    /**
     * Reads a ROM from disk and records `sourcePath`.
     * @param {string} file Path to the ROM file.
     * @param {RomLoadOptions} [options] Optional explicit copier-header size.
     * @returns {RomImage} Loaded image.
     */
    static load(file: string, options?: RomLoadOptions): RomImage;
    /**
     * Headerless cartridge length in bytes.
     * @returns {number} The headerless cartridge length in bytes.
     */
    get length(): number;
    /**
     * @param {number} offset Headerless file offset.
     * @returns {number | undefined} Byte value, or `undefined` when out of range.
     */
    readByte(offset: number): number | undefined;
    /**
     * @param {number} offset Headerless file offset.
     * @param {number} length Number of bytes to copy.
     * @returns {Uint8Array | undefined} A copy of the slice, or `undefined` when out of range.
     */
    read(offset: number, length: number): Uint8Array | undefined;
    /**
     * Returns a defensive copy; callers cannot mutate the loaded image.
     * @returns {Uint8Array} The headerless ROM content.
     */
    bytes(): Uint8Array;
    /**
     * Returns a defensive copy of the optional 512-byte copier header.
     * @returns {Uint8Array} The copier header bytes.
     */
    copierHeaderBytes(): Uint8Array;
    /**
     * Returns a defensive copy of the complete file, including any copier header.
     * @returns {Uint8Array} The complete file bytes.
     */
    fileBytes(): Uint8Array;
}
//# sourceMappingURL=rom-image.d.ts.map