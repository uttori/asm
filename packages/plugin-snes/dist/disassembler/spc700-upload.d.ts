import type { EvidenceRecord, ProjectRegion, RomImage } from "@uttori/asm-disassembler";
import { SNES_FILE_ADDRESS_SPACE } from "./address-identities.js";
import { Spc700AramImage } from "./spc700-address-space.js";
/** One non-empty `{size, destination, payload}` record in an NSPC upload stream. */
export interface Spc700UploadBlock {
    /** Zero-based position among the stream's non-empty records. */
    readonly index: number;
    /** Headerless ROM offset of the record's size word. */
    readonly headerOffset: number;
    /** Headerless ROM offset of the first payload byte (`headerOffset + 4`). */
    readonly payloadOffset: number;
    /** Exclusive headerless ROM offset of the payload; the next record starts here. */
    readonly endOffset: number;
    /** Payload length in bytes, `1`–`$FFFF`. */
    readonly size: number;
    /** 16-bit ARAM address receiving the first payload byte. */
    readonly destination: number;
    /** True when the upload crosses `$FFFF` and resumes at `$0000`. */
    readonly wraps: boolean;
}
/** Parsed, byte-preserving description of one explicitly located NSPC stream. */
export interface Spc700UploadStream {
    /** Upload protocol; only the Nintendo size/destination/payload stream is parsed. */
    readonly format: "nspc";
    /** Headerless ROM offset of the first record's size word. */
    readonly startOffset: number;
    /** First byte after the zero-size execute trailer. */
    readonly endOffset: number;
    /** Headerless ROM offset of the zero-size trailer record. */
    readonly terminatorOffset: number;
    /** ARAM address jumped to after the upload, taken from the trailer's destination word. */
    readonly executeAddress: number;
    /** Non-empty records in stream order; empty when the stream is only a trailer. */
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
    /** Stable id derived from the block header offset and segment index. */
    readonly id: string;
    /** Index of the owning upload block. */
    readonly blockIndex: number;
    /** `0` for the leading slice, `1` for the slice that wrapped to `$0000`. */
    readonly segmentIndex: number;
    /** Address space of `sourceStart`/`sourceEnd`. */
    readonly sourceAddressSpace: typeof SNES_FILE_ADDRESS_SPACE;
    /** Inclusive headerless ROM offset of the segment bytes. */
    readonly sourceStart: number;
    /** Exclusive headerless ROM offset of the segment bytes. */
    readonly sourceEnd: number;
    /** Copied segment bytes loaded at their ARAM destination. */
    readonly image: Spc700AramImage;
}
/** Merge-friendly regions plus provenance for a parsed upload stream. */
export interface Spc700UploadProjectRecords {
    /** Nested ROM stream/block/payload regions and ARAM projections. */
    readonly regions: readonly ProjectRegion[];
    /** Provenance records referenced by the regions. */
    readonly evidence: readonly EvidenceRecord[];
}
/**
 * Parses an NSPC upload stream at an explicit headerless ROM offset.
 * No signature scan or format guess is performed. Every record is bounded by
 * both the immutable ROM image and caller-selectable deterministic limits.
 * @param rom Headerless ROM view containing the stream.
 * @param startOffset Explicit headerless file offset of its first size word.
 * @param [options] Deterministic record and byte limits.
 * @returns Parsed block locations and execute trailer.
 */
export declare const parseSpc700UploadStream: (rom: RomImage, startOffset: number, options?: Spc700UploadParseOptions) => Spc700UploadStream;
/**
 * Copies one upload block into one or two directly analyzable ARAM images.
 * A wrapping upload is split at `$10000`. Source ROM provenance remains on each segment.
 * @param rom ROM that was used to parse `block`.
 * @param block Parsed upload record.
 * @returns Non-wrapping ARAM projections in load order.
 */
export declare const materializeSpc700UploadBlock: (rom: RomImage, block: Spc700UploadBlock) => readonly Spc700UploadAramSegment[];
/**
 * Creates nested ROM stream/block/payload regions and cross-address-space ARAM projections.
 * Region attributes contain offsets, sizes, and load order only. ROM bytes are never serialized.
 * @param rom ROM that owns the stream, used only for stable evidence identity.
 * @param stream Parsed upload stream.
 * @returns Native project regions and detector evidence.
 */
export declare const spc700UploadProjectRecords: (rom: RomImage, stream: Spc700UploadStream) => Spc700UploadProjectRecords;
//# sourceMappingURL=spc700-upload.d.ts.map