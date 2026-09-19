import { createHash } from "node:crypto";
import * as fs from "node:fs";

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

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/**
 * Infers a 0- or 512-byte copier header from file size (`size % 0x8000`).
 * @param {number} fileSize Complete file length in bytes.
 * @returns {CopierHeaderSize} `0` or `512`.
 * @throws {Error} When `fileSize` is negative or not 32 KiB aligned with either header size.
 */
export const detectCopierHeaderSize = (fileSize: number): CopierHeaderSize => {
  if (fileSize < 0) {
    throw new Error("ROM size cannot be negative.");
  }
  const remainder = fileSize % 0x8000;
  if (remainder === 0) {
    return 0;
  }
  if (remainder === 512) {
    return 512;
  }
  throw new Error(
    `ROM size ${fileSize} is not aligned to a 32 KiB image with either a 0-byte or 512-byte copier header; pass an explicit header override.`,
  );
};

/**
 * Immutable, bounds-safe view of a user-supplied ROM.
 * The constructor copies input bytes so later mutation of the caller's buffer is ignored.
 */
export class RomImage {
  /** File and content hashes, sizes, and detected or overridden header size. */
  readonly identity: RomIdentity;
  /** Path passed to `RomImage.load`, if the image came from disk. */
  readonly sourcePath?: string;
  readonly #fileBytes: Uint8Array;
  readonly #contentBytes: Uint8Array;

  /**
   * @param {Uint8Array} bytes Complete file bytes; copied immediately.
   * @param {RomLoadOptions & { readonly sourcePath?: string }} [options] Header override and optional origin path.
   */
  constructor(bytes: Uint8Array, options: RomLoadOptions & { readonly sourcePath?: string } = {}) {
    this.#fileBytes = Uint8Array.from(bytes);
    const headerSize = options.headerSize ?? detectCopierHeaderSize(this.#fileBytes.length);
    if (headerSize > this.#fileBytes.length) {
      throw new Error(`Header size ${headerSize} exceeds ROM size ${this.#fileBytes.length}.`);
    }
    this.#contentBytes = this.#fileBytes.slice(headerSize);
    this.sourcePath = options.sourcePath;
    this.identity = Object.freeze({
      sha256: sha256(this.#fileBytes),
      contentSha256: sha256(this.#contentBytes),
      fileSize: this.#fileBytes.length,
      contentSize: this.#contentBytes.length,
      headerSize,
    });
  }

  /**
   * Reads a ROM from disk and records `sourcePath`.
   * @param {string} file Path to the ROM file.
   * @param {RomLoadOptions} [options] Optional explicit copier-header size.
   * @returns {RomImage} Loaded image.
   */
  static load(file: string, options: RomLoadOptions = {}): RomImage {
    return new RomImage(fs.readFileSync(file), { ...options, sourcePath: file });
  }

  /**
   * Headerless cartridge length in bytes.
   * @returns {number} The headerless cartridge length in bytes.
   */
  get length(): number {
    return this.#contentBytes.length;
  }

  /**
   * @param {number} offset Headerless file offset.
   * @returns {number | undefined} Byte value, or `undefined` when out of range.
   */
  readByte(offset: number): number | undefined {
    return Number.isInteger(offset) && offset >= 0 && offset < this.length
      ? this.#contentBytes[offset]
      : undefined;
  }

  /**
   * @param {number} offset Headerless file offset.
   * @param {number} length Number of bytes to copy.
   * @returns {Uint8Array | undefined} A copy of the slice, or `undefined` when out of range.
   */
  read(offset: number, length: number): Uint8Array | undefined {
    if (
      !Number.isInteger(offset) ||
      !Number.isInteger(length) ||
      offset < 0 ||
      length < 0 ||
      offset + length > this.length
    ) {
      return undefined;
    }
    return this.#contentBytes.slice(offset, offset + length);
  }

  /**
   * Returns a defensive copy; callers cannot mutate the loaded image.
   * @returns {Uint8Array} The headerless ROM content.
   */
  bytes(): Uint8Array {
    return this.#contentBytes.slice();
  }

  /**
   * Returns a defensive copy of the optional 512-byte copier header.
   * @returns {Uint8Array} The copier header bytes.
   */
  copierHeaderBytes(): Uint8Array {
    return this.#fileBytes.slice(0, this.identity.headerSize);
  }

  /**
   * Returns a defensive copy of the complete file, including any copier header.
   * @returns {Uint8Array} The complete file bytes.
   */
  fileBytes(): Uint8Array {
    return this.#fileBytes.slice();
  }
}
