import type { EvidenceRecord, ProjectRegion, RomImage } from "@uttori/asm-disassembler";
import { Spc700AramImage } from "./spc700-address-space.js";
import { SNES_FILE_ADDRESS_SPACE } from "./address-identities.js";
/** One non-empty `{size, destination, payload}` record in an NSPC upload stream. */
export interface Spc700UploadBlock {
    readonly index: number;
    readonly headerOffset: number;
    readonly payloadOffset: number;
    readonly endOffset: number;
    readonly size: number;
    readonly destination: number;
    /** True when the upload crosses `$FFFF` and resumes at `$0000`. */
    readonly wraps: boolean;
}
/** Parsed, byte-preserving description of one explicitly located NSPC stream. */
export interface Spc700UploadStream {
    readonly format: "nspc";
    readonly startOffset: number;
    /** First byte after the zero-size execute trailer. */
    readonly endOffset: number;
    readonly terminatorOffset: number;
    readonly executeAddress: number;
    readonly blocks: readonly Spc700UploadBlock[];
}
/** Deterministic safety limits for parsing a configured upload-stream location. */
export interface Spc700UploadParseOptions {
    /** Maximum non-empty records. Defaults to a 16,384-record safety cap. */
    readonly maxBlocks?: number;
    /** Maximum bytes consumed from `startOffset`, including the trailer. Defaults to ROM remainder. */
    readonly maxBytes?: number;
}
/** One non-wrapping ARAM projection backed by a slice of an upload block. */
export interface Spc700UploadAramSegment {
    readonly id: string;
    readonly blockIndex: number;
    readonly segmentIndex: number;
    readonly sourceAddressSpace: typeof SNES_FILE_ADDRESS_SPACE;
    readonly sourceStart: number;
    readonly sourceEnd: number;
    readonly image: Spc700AramImage;
}
/** Merge-friendly regions plus provenance for a parsed upload stream. */
export interface Spc700UploadProjectRecords {
    readonly regions: readonly ProjectRegion[];
    readonly evidence: readonly EvidenceRecord[];
}
/**
 * Parses an NSPC upload stream at an explicit headerless ROM offset.
 * No signature scan or format guess is performed. Every record is bounded by
 * both the immutable ROM image and caller-selectable deterministic limits.
 * @param {RomImage} rom Headerless ROM view containing the stream.
 * @param {number} startOffset Explicit headerless file offset of its first size word.
 * @param {Spc700UploadParseOptions} [options] Deterministic record and byte limits.
 * @returns {Spc700UploadStream} Parsed block locations and execute trailer.
 */
export declare const parseSpc700UploadStream: (rom: RomImage, startOffset: number, options?: Spc700UploadParseOptions) => Spc700UploadStream;
/**
 * Copies one upload block into one or two directly analyzable ARAM images.
 * A wrapping upload is split at `$10000`; source ROM provenance remains on each segment.
 * @param {RomImage} rom ROM that was used to parse `block`.
 * @param {Spc700UploadBlock} block Parsed upload record.
 * @returns {readonly Spc700UploadAramSegment[]} Non-wrapping ARAM projections in load order.
 */
export declare const materializeSpc700UploadBlock: (rom: RomImage, block: Spc700UploadBlock) => readonly Spc700UploadAramSegment[];
/**
 * Creates nested ROM stream/block/payload regions and cross-address-space ARAM projections.
 * Region attributes contain offsets, sizes, and load order only; ROM bytes are never serialized.
 * @param {RomImage} rom ROM that owns the stream, used only for stable evidence identity.
 * @param {Spc700UploadStream} stream Parsed upload stream.
 * @returns {Spc700UploadProjectRecords} Native project regions and detector evidence.
 */
export declare const spc700UploadProjectRecords: (rom: RomImage, stream: Spc700UploadStream) => Spc700UploadProjectRecords;
//# sourceMappingURL=spc700-upload.d.ts.map