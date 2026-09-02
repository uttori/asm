import type { EvidenceRecord, ProjectRegion, RomImage } from "@uttori/asm-disassembler";

import { SPC700_ARAM_ADDRESS_SPACE, Spc700AramImage } from "./spc700-address-space.js";
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

const wordAt = (rom: RomImage, offset: number): number | undefined => {
  const low = rom.readByte(offset);
  const high = rom.readByte(offset + 1);
  return low === undefined || high === undefined ? undefined : low | (high << 8);
};

const validatePositiveLimit = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
};

/**
 * Parses an NSPC upload stream at an explicit headerless ROM offset.
 * No signature scan or format guess is performed. Every record is bounded by
 * both the immutable ROM image and caller-selectable deterministic limits.
 * @param {RomImage} rom Headerless ROM view containing the stream.
 * @param {number} startOffset Explicit headerless file offset of its first size word.
 * @param {Spc700UploadParseOptions} [options] Deterministic record and byte limits.
 * @returns {Spc700UploadStream} Parsed block locations and execute trailer.
 */
export const parseSpc700UploadStream = (
  rom: RomImage,
  startOffset: number,
  options: Spc700UploadParseOptions = {},
): Spc700UploadStream => {
  if (!Number.isSafeInteger(startOffset) || startOffset < 0 || startOffset >= rom.length) {
    throw new Error("SPC700 upload startOffset must identify a byte in the headerless ROM.");
  }
  const maxBlocks = options.maxBlocks ?? 0x4000;
  const maxBytes = options.maxBytes ?? rom.length - startOffset;
  validatePositiveLimit("maxBlocks", maxBlocks);
  validatePositiveLimit("maxBytes", maxBytes);

  const blocks: Spc700UploadBlock[] = [];
  let offset = startOffset;
  while (true) {
    if (offset + 4 > rom.length) {
      throw new Error(`Truncated SPC700 upload record header at ROM offset $${hex(offset, 6)}.`);
    }
    if (offset - startOffset + 4 > maxBytes) {
      throw new Error(`SPC700 upload stream exceeds the ${maxBytes}-byte parsing limit.`);
    }
    const size = wordAt(rom, offset);
    const destination = wordAt(rom, offset + 2);
    if (size === undefined || destination === undefined)
      throw new Error("ROM bounds check failed.");
    if (size === 0) {
      return {
        format: "nspc",
        startOffset,
        endOffset: offset + 4,
        terminatorOffset: offset,
        executeAddress: destination,
        blocks,
      };
    }
    if (blocks.length >= maxBlocks) {
      throw new Error(`SPC700 upload stream exceeds the ${maxBlocks}-block parsing limit.`);
    }
    const payloadOffset = offset + 4;
    const endOffset = payloadOffset + size;
    if (endOffset > rom.length) {
      throw new Error(
        `Truncated SPC700 upload payload at ROM offset $${hex(payloadOffset, 6)}: expected ${size} byte(s).`,
      );
    }
    if (endOffset - startOffset > maxBytes) {
      throw new Error(`SPC700 upload stream exceeds the ${maxBytes}-byte parsing limit.`);
    }
    blocks.push({
      index: blocks.length,
      headerOffset: offset,
      payloadOffset,
      endOffset,
      size,
      destination,
      wraps: destination + size > 0x10000,
    });
    offset = endOffset;
  }
};

const hex = (value: number, width: number): string =>
  value.toString(16).toUpperCase().padStart(width, "0");

/**
 * Copies one upload block into one or two directly analyzable ARAM images.
 * A wrapping upload is split at `$10000`; source ROM provenance remains on each segment.
 * @param {RomImage} rom ROM that was used to parse `block`.
 * @param {Spc700UploadBlock} block Parsed upload record.
 * @returns {readonly Spc700UploadAramSegment[]} Non-wrapping ARAM projections in load order.
 */
export const materializeSpc700UploadBlock = (
  rom: RomImage,
  block: Spc700UploadBlock,
): readonly Spc700UploadAramSegment[] => {
  const payload = rom.read(block.payloadOffset, block.size);
  if (!payload) {
    throw new Error(`SPC700 upload block ${block.index} is outside the supplied ROM image.`);
  }
  const firstSize = Math.min(block.size, 0x10000 - block.destination);
  const parts = [
    {
      sourceStart: block.payloadOffset,
      destination: block.destination,
      bytes: payload.slice(0, firstSize),
    },
    ...(firstSize === block.size
      ? []
      : [
          {
            sourceStart: block.payloadOffset + firstSize,
            destination: 0,
            bytes: payload.slice(firstSize),
          },
        ]),
  ];
  return parts.map((part, index) => ({
    id: `spc-upload:${hex(block.headerOffset, 6)}:segment:${index}`,
    blockIndex: block.index,
    segmentIndex: index,
    sourceAddressSpace: SNES_FILE_ADDRESS_SPACE,
    sourceStart: part.sourceStart,
    sourceEnd: part.sourceStart + part.bytes.length,
    image: new Spc700AramImage(part.bytes, part.destination),
  }));
};

/**
 * Creates nested ROM stream/block/payload regions and cross-address-space ARAM projections.
 * Region attributes contain offsets, sizes, and load order only; ROM bytes are never serialized.
 * @param {RomImage} rom ROM that owns the stream, used only for stable evidence identity.
 * @param {Spc700UploadStream} stream Parsed upload stream.
 * @returns {Spc700UploadProjectRecords} Native project regions and detector evidence.
 */
export const spc700UploadProjectRecords = (
  rom: RomImage,
  stream: Spc700UploadStream,
): Spc700UploadProjectRecords => {
  const streamId = `spc-upload:${hex(stream.startOffset, 6)}`;
  const evidenceId = `detector:${streamId}:${rom.identity.contentSha256}`;
  const regions: ProjectRegion[] = [
    {
      id: streamId,
      addressSpace: SNES_FILE_ADDRESS_SPACE,
      start: stream.startOffset,
      end: stream.endOffset,
      name: `SPC upload stream $${hex(stream.startOffset, 6)}`,
      context: "snes.spc700.upload-stream",
      attributes: {
        format: stream.format,
        blockCount: stream.blocks.length,
        terminatorOffset: stream.terminatorOffset,
        executeAddress: stream.executeAddress,
      },
      evidence: [evidenceId],
    },
  ];

  for (const block of stream.blocks) {
    const blockId = `${streamId}:block:${block.index.toString().padStart(4, "0")}`;
    const payloadId = `${blockId}:payload`;
    regions.push(
      {
        id: blockId,
        parentRegion: streamId,
        addressSpace: SNES_FILE_ADDRESS_SPACE,
        start: block.headerOffset,
        end: block.endOffset,
        name: `SPC upload block ${block.index}`,
        context: "snes.spc700.upload-block",
        attributes: {
          index: block.index,
          size: block.size,
          destination: block.destination,
          payloadOffset: block.payloadOffset,
          wraps: block.wraps,
        },
        evidence: [evidenceId],
      },
      {
        id: payloadId,
        parentRegion: blockId,
        addressSpace: SNES_FILE_ADDRESS_SPACE,
        start: block.payloadOffset,
        end: block.endOffset,
        name: `SPC upload payload ${block.index}`,
        context: "snes.spc700.upload-payload",
        attributes: { destination: block.destination, size: block.size },
        evidence: [evidenceId],
      },
    );

    for (const segment of materializeSpc700UploadBlock(rom, block)) {
      regions.push({
        id: `${blockId}:aram:${segment.segmentIndex}`,
        parentRegion: payloadId,
        addressSpace: SPC700_ARAM_ADDRESS_SPACE,
        start: segment.image.loadAddress,
        end: segment.image.loadAddress + segment.image.length,
        name: `SPC ARAM projection ${block.index}.${segment.segmentIndex}`,
        context: "snes.spc700.upload-projection",
        attributes: {
          blockIndex: block.index,
          loadOrder: block.index,
          segmentIndex: segment.segmentIndex,
          sourceAddressSpace: segment.sourceAddressSpace,
          sourceStart: segment.sourceStart,
          sourceEnd: segment.sourceEnd,
        },
        evidence: [evidenceId],
      });
    }
  }

  return {
    regions,
    evidence: [
      {
        id: evidenceId,
        source: "detector",
        sourceId: "snes.spc700.nspc-v1",
        confidence: "certain",
        detail: `Explicit NSPC stream at ROM offset $${hex(stream.startOffset, 6)} contains ${stream.blocks.length} block(s) and executes at $${hex(stream.executeAddress, 4)}.`,
      },
    ],
  };
};
