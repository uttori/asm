/** Decoded 16-bit pointer relative to the beginning of its table. */
export interface FrameworkRelativePointer {
  /** Zero-based word position in the table. */
  readonly index: number;
  /** Raw little-endian word, measured from the table beginning. */
  readonly storedOffset: number;
  /** Table address plus the stored offset; not wrapped to a bank. */
  readonly targetAddress: number;
}

/** One extraction range derived from two adjacent 24-bit Framework pointers. */
export interface FrameworkAssetExtractionRange {
  /** Position of the starting pointer in the list. */
  readonly index: number;
  /** Inclusive start after skipping the per-asset header. */
  readonly sourceStart: number;
  /** Exclusive end, taken from the next pointer. */
  readonly sourceEnd: number;
}

/** One four-byte SNES sample directory entry. */
export interface FrameworkSamplePointer {
  /** Zero-based entry position in the directory. */
  readonly index: number;
  /** ARAM address of the sample start word. */
  readonly startAddress: number;
  /** ARAM loop address; equals `startAddress` for null entries. */
  readonly loopAddress: number;
  /** `zero` and `unused` mark null entries whose start is `$0000` or `$FFFF`. */
  readonly kind: "sample" | "zero" | "unused";
  /** Loop distance from the sample start in bytes; present only for `sample` entries. */
  readonly loopOffset?: number;
}

/** Unique sample payload range projected from ARAM addresses into the ROM. */
export interface FrameworkSampleExtractionRange {
  /** Ordinal of the unique sample start, in ascending ARAM order. */
  readonly id: number;
  /** Shared ARAM start address of every grouped pointer. */
  readonly startAddress: number;
  /** Inclusive projected ROM address. */
  readonly sourceStart: number;
  /** Exclusive projected ROM address: the next unique start or the configured data end. */
  readonly sourceEnd: number;
  /** Directory indexes that point at this payload. */
  readonly pointerIndexes: readonly number[];
}

/**
 * Rejects values that are not non-negative safe integers.
 * @param value Candidate value.
 * @param name Label used in the thrown message.
 */
const assertInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
};

/**
 * Reads an unsigned little-endian value, throwing when any byte is out of bounds.
 * @param bytes Table bytes.
 * @param offset First byte offset.
 * @param width Value width in bytes.
 * @returns Unsigned value.
 */
const readLittleEndian = (bytes: Uint8Array, offset: number, width: number): number => {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("Framework table bytes must be Uint8Array.");
  }
  if (offset < 0 || offset + width > bytes.length) {
    throw new Error(`Framework table read ${offset}..${offset + width} is out of bounds.`);
  }
  let value = 0;
  for (let index = 0; index < width; index++) {
    value += bytes[offset + index] * 2 ** (index * 8);
  }
  return value;
};

/**
 * Decodes the Framework helper's table-base-relative 16-bit pointers.
 * @param bytes Complete relative-pointer table bytes.
 * @param tableAddress Logical address of the table beginning.
 * @returns Decoded qualified targets.
 */
export const decodeFrameworkRelativePointerTable = (
  bytes: Uint8Array,
  tableAddress: number,
): readonly FrameworkRelativePointer[] => {
  assertInteger(tableAddress, "Framework relative-pointer tableAddress");
  if (bytes.length === 0 || bytes.length % 2 !== 0) {
    throw new Error(
      "Framework relative-pointer table must contain a non-empty whole number of words.",
    );
  }
  return Object.freeze(
    Array.from({ length: bytes.length / 2 }, (_, index) => {
      const storedOffset = readLittleEndian(bytes, index * 2, 2);
      return Object.freeze({ index, storedOffset, targetAddress: tableAddress + storedOffset });
    }),
  );
};

/**
 * Derives extraction ranges from an ordered 24-bit pointer list. The last
 * pointer is a terminal boundary and does not create an asset by itself.
 * @param pointerBytes Complete adjacent 24-bit pointer list.
 * @param [headerSize] Bytes skipped at the start of each asset.
 * @returns Half-open source ranges.
 */
export const deriveFrameworkAssetExtractionRanges = (
  pointerBytes: Uint8Array,
  headerSize = 4,
): readonly FrameworkAssetExtractionRange[] => {
  assertInteger(headerSize, "Framework asset headerSize");
  if (pointerBytes.length < 6 || pointerBytes.length % 3 !== 0) {
    throw new Error("Framework asset table requires at least two complete 24-bit pointers.");
  }
  const pointers = Array.from({ length: pointerBytes.length / 3 }, (_, index) =>
    readLittleEndian(pointerBytes, index * 3, 3),
  );
  return Object.freeze(
    pointers.slice(0, -1).map((pointer, index) => {
      const sourceStart = pointer + headerSize;
      const sourceEnd = pointers[index + 1];
      if (sourceEnd < sourceStart) {
        throw new Error(
          `Framework asset pointer ${index} ends before its ${headerSize}-byte header is skipped.`,
        );
      }
      return Object.freeze({ index, sourceStart, sourceEnd });
    }),
  );
};

/**
 * Decodes four-byte `(start, loop)` sample-directory records.
 * @param bytes Complete sample pointer table bytes.
 * @returns Decoded directory records.
 */
export const decodeFrameworkSamplePointers = (
  bytes: Uint8Array,
): readonly FrameworkSamplePointer[] => {
  if (bytes.length === 0 || bytes.length % 4 !== 0) {
    throw new Error("Framework sample pointer table must contain complete four-byte entries.");
  }
  return Object.freeze(
    Array.from({ length: bytes.length / 4 }, (_, index) => {
      const startAddress = readLittleEndian(bytes, index * 4, 2);
      const loopAddress = readLittleEndian(bytes, index * 4 + 2, 2);
      let kind: FrameworkSamplePointer["kind"] = "sample";
      if (startAddress === 0) {
        kind = "zero";
      } else if (startAddress === 0xffff) {
        kind = "unused";
      }
      if (kind !== "sample") {
        if (loopAddress !== startAddress) {
          throw new Error(
            `Framework null sample pointer ${index} has mismatched start and loop values.`,
          );
        }
        return Object.freeze({ index, startAddress, loopAddress, kind });
      }
      if (loopAddress < startAddress) {
        throw new Error(`Framework sample pointer ${index} loops before its sample start.`);
      }
      return Object.freeze({
        index,
        startAddress,
        loopAddress,
        kind,
        loopOffset: loopAddress - startAddress,
      });
    }),
  );
};

/**
 * Groups duplicate sample pointers and projects ordered ARAM sample starts onto
 * half-open ROM ranges. The configured data end closes the final unique sample.
 * @param pointers Decoded sample directory.
 * @param sourceDataStart ROM address corresponding to `aramDataBase`.
 * @param sourceDataEnd Exclusive ROM end for the final sample.
 * @param aramDataBase First ARAM address stored in the ROM payload.
 * @returns Unique projected payload ranges.
 */
export const deriveFrameworkSampleExtractionRanges = (
  pointers: readonly FrameworkSamplePointer[],
  sourceDataStart: number,
  sourceDataEnd: number,
  aramDataBase: number,
): readonly FrameworkSampleExtractionRange[] => {
  assertInteger(sourceDataStart, "Framework sample sourceDataStart");
  assertInteger(sourceDataEnd, "Framework sample sourceDataEnd");
  assertInteger(aramDataBase, "Framework sample aramDataBase");
  if (sourceDataEnd <= sourceDataStart) {
    throw new Error("Framework sample source data range must be non-empty.");
  }
  const groups = new Map<number, number[]>();
  const starts: number[] = [];
  let lastSampleStart: number | undefined;
  for (const pointer of pointers) {
    if (pointer.kind !== "sample") {
      continue;
    }
    if (lastSampleStart !== undefined && pointer.startAddress < lastSampleStart) {
      throw new Error("Framework sample pointers are not ordered by start address.");
    }
    lastSampleStart = pointer.startAddress;
    const indexes = groups.get(pointer.startAddress);
    if (indexes) {
      indexes.push(pointer.index);
    } else {
      if (pointer.startAddress < aramDataBase) {
        throw new Error(`Framework sample pointer ${pointer.index} precedes the ARAM data base.`);
      }
      starts.push(pointer.startAddress);
      groups.set(pointer.startAddress, [pointer.index]);
    }
  }
  return Object.freeze(
    starts.map((startAddress, id) => {
      const sourceStart = sourceDataStart + startAddress - aramDataBase;
      const sourceEnd =
        id + 1 < starts.length ? sourceDataStart + starts[id + 1] - aramDataBase : sourceDataEnd;
      if (sourceStart < sourceDataStart || sourceEnd <= sourceStart || sourceEnd > sourceDataEnd) {
        throw new Error(`Framework sample ${id} projects outside the configured ROM data range.`);
      }
      return Object.freeze({
        id,
        startAddress,
        sourceStart,
        sourceEnd,
        pointerIndexes: Object.freeze([...(groups.get(startAddress) ?? [])]),
      });
    }),
  );
};
