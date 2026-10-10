import type { IntervalAnnotation } from "@uttori/asm-disassembler";

import type { NesCartridge } from "./cartridge.js";

/** A qualified declaration projected into the headerless original-image coordinate system. */
export interface NesSourceDataRange {
  readonly start: number;
  readonly end: number;
  readonly annotation: IntervalAnnotation;
}

/** CPU ranges need an explicit physical anchor; file ranges already identify their original owner. */
export function nesSourceDataRanges(
  rom: NesCartridge,
  annotations: readonly IntervalAnnotation[],
): NesSourceDataRange[] {
  const ranges: NesSourceDataRange[] = [];
  for (const annotation of annotations) {
    let start: number | undefined;
    if (annotation.addressSpace === "nes.file") {
      start = annotation.start;
    } else if (annotation.addressSpace === "nes.cpu") {
      start = annotation.mapping?.fileOffset;
    }
    if (
      start === undefined ||
      ["unreached", "opcode", "operand"].includes(annotation.classification)
    ) {
      continue;
    }
    const end = start + annotation.end - annotation.start;
    if (start < 0 || end > rom.size - 16 || end <= start) {
      throw new Error(`Invalid NES source data range '${annotation.id}'.`);
    }
    ranges.push({ start, end, annotation });
  }
  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < ranges.length; index++) {
    if (ranges[index].start < ranges[index - 1].end) {
      // Choosing one of two classifications would silently discard an authored ownership decision.
      throw new Error(
        `Overlapping NES source data declarations '${ranges[index - 1].annotation.id}' and '${ranges[index].annotation.id}'.`,
      );
    }
  }
  return ranges;
}

/** Fixed-width, uppercase source literals; filenames and stable IDs keep their original spelling. */
export function nesSourceHex(value: number, digits = 4): string {
  return "$" + value.toString(16).toUpperCase().padStart(digits, "0");
}

/** Put long behavior contracts above the equate while short descriptions remain useful inline hovers. */
export function nesSourceDefinition(name: string, address: number, description: string): string[] {
  const lines = description.split(/\r?\n/);
  if (lines.length === 1 && lines[0].length <= 100) {
    return [`${name} = ${nesSourceHex(address)} ; ${lines[0]}`];
  }
  return [...lines.map((line) => `; ${line}`), `${name} = ${nesSourceHex(address)}`];
}
