import {
  HalfOpenIntervalIndex,
  type EvidenceRecord,
  type IntervalAnnotation,
} from "@uttori/asm-disassembler";

import { SNES_FILE_ADDRESS_SPACE } from "./address-identities.js";

/** A typed declaration retains its original alignment even when labels split its emitted source. */
export interface SnesTypedData {
  readonly start: number;
  readonly end: number;
  readonly width: number;
  /** Explicit human decisions supersede imported byte classifications. */
  readonly priority: number;
}

const WIDTHS: Partial<Record<IntervalAnnotation["classification"], number>> = {
  data8: 1,
  data16: 2,
  data24: 3,
  data32: 4,
  pointer16: 2,
  pointer24: 3,
  pointer32: 4,
};

/** Index only ROM-file data claims; CPU addresses and codec-bound assets have separate renderers. */
export function indexSnesTypedData(
  annotations: readonly IntervalAnnotation[],
  evidence: readonly EvidenceRecord[],
): HalfOpenIntervalIndex<SnesTypedData> {
  const manual = new Set(
    evidence.filter((record) => record.source === "manual").map((record) => record.id),
  );
  return new HalfOpenIntervalIndex(
    annotations.flatMap((annotation) => {
      const width = WIDTHS[annotation.classification];
      if (!width || annotation.addressSpace !== SNES_FILE_ADDRESS_SPACE || annotation.asset) {
        return [];
      }
      return [
        {
          start: annotation.start,
          end: annotation.end,
          width,
          priority: Number(annotation.evidence.some((id) => manual.has(id))),
        },
      ];
    }),
  );
}

/** Resolve width without guessing pointer bank semantics. Conflicting word widths/alignment stop export. */
export function snesTypedDataAt(
  index: HalfOpenIntervalIndex<SnesTypedData>,
  start: number,
  end: number,
): SnesTypedData | undefined {
  let candidates = index.at(start).filter((entry) => entry.end >= end);
  if (!candidates.length) {
    return undefined;
  }
  const priority = Math.max(...candidates.map((entry) => entry.priority));
  candidates = candidates.filter((entry) => entry.priority === priority);
  // Imported data8 intervals establish data coverage, but do not contradict a more specific word.
  if (candidates.some((entry) => entry.width > 1)) {
    candidates = candidates.filter((entry) => entry.width > 1);
  }
  const first = candidates[0];
  if (
    candidates.some(
      (entry) => entry.width !== first.width || (entry.start - first.start) % first.width !== 0,
    )
  ) {
    throw new Error(
      `Conflicting typed data widths or alignment at ROM offset $${start.toString(16)}. Reconcile the research declarations.`,
    );
  }
  return first;
}

/** Emit little-endian literals in stable eight-value rows. Interior labels retain partial elements as bytes. */
export function renderSnesTypedData(
  bytes: Uint8Array,
  start: number,
  declaration: SnesTypedData,
): string[] {
  const lines: string[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    let width = declaration.width;
    if ((start + offset - declaration.start) % width !== 0 || offset + width > bytes.length) {
      width = 1;
    }
    const values: string[] = [];
    const limit = 8 - (Math.floor((start + offset - declaration.start) / width) % 8);
    for (let count = 0; count < limit && offset + width <= bytes.length; count++) {
      // A byte fragment ends as soon as the original element boundary is reachable again.
      if (
        count &&
        width === 1 &&
        declaration.width > 1 &&
        (start + offset - declaration.start) % declaration.width === 0
      ) {
        break;
      }
      let value = 0;
      for (let byte = 0; byte < width; byte++) {
        value += bytes[offset + byte] * 2 ** (8 * byte);
      }
      values.push(
        `$${value
          .toString(16)
          .toUpperCase()
          .padStart(width * 2, "0")}`,
      );
      offset += width;
    }
    lines.push(`  ${["", "db", "dw", "dl", "dd"][width]} ${values.join(", ")}`);
  }
  return lines;
}
