import type {
  AddressedAssemblySection,
  AssemblyLinkRecipe,
  LinkMemoryRegion,
  LinkSectionPlacement,
} from "../relocatable.js";

/** Convert authored load/run hints into replaceable regions/placements, retaining gaps and container prefixes explicitly. */
export function addressedSourceLinkRecipe(options: {
  readonly target: string;
  readonly sections: readonly AddressedAssemblySection[];
  readonly outputOffset: (address: number) => number;
  readonly targetOptions?: Readonly<Record<string, unknown>>;
  readonly fillByte: number;
  readonly prefix?: readonly number[];
  /** Complete fixed container extent, including prefix bytes; omitted for growable ROM output. */
  readonly outputSize?: number;
  readonly checksumPolicy?: "preserve" | "recompute";
}): AssemblyLinkRecipe {
  const regions: LinkMemoryRegion[] = [];
  const placements: LinkSectionPlacement[] = [];
  const prefix = options.prefix ?? [];
  let cursor = prefix.length;
  if (prefix.length) {
    regions.push({
      name: "__source_header",
      start: 0,
      size: prefix.length,
      outputOffset: 0,
      initialBytes: [...prefix],
    });
  }
  const entries = options.sections
    .map((section) => ({ ...section, outputOffset: options.outputOffset(section.loadAddress) }))
    .toSorted((a, b) => a.outputOffset - b.outputOffset || a.size - b.size);
  const gap = (end: number): void => {
    if (end > cursor) {
      regions.push({
        name: `__source_gap_${cursor}`,
        start: 0,
        size: end - cursor,
        outputOffset: cursor,
        fillByte: options.fillByte,
      });
    }
    cursor = Math.max(cursor, end);
  };
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.outputOffset) || entry.outputOffset < prefix.length) {
      throw new Error(`Source ORG for '${entry.section}' does not map to payload storage.`);
    }
    if (entry.size && entry.outputOffset < cursor) {
      throw new Error(
        `Source contributions overlap at '${entry.section}'; use the absolute patch workflow for overlapping writes.`,
      );
    }
    gap(entry.outputOffset);
    const load = `${entry.section}:load`;
    const run = entry.runAddress === entry.loadAddress ? load : `${entry.section}:run`;
    regions.push({
      name: load,
      start: entry.loadAddress,
      size: entry.size,
      outputOffset: entry.outputOffset,
      fillByte: options.fillByte,
    });
    if (run !== load) {
      regions.push({ name: run, start: entry.runAddress, size: entry.size });
    }
    placements.push({ section: entry.section, load, run });
    cursor = Math.max(cursor, entry.outputOffset + entry.size);
  }
  if (options.outputSize !== undefined) {
    if (cursor > options.outputSize) {
      throw new Error("Source layout exceeds its configured container size.");
    }
    gap(options.outputSize);
  }
  return {
    target: options.target,
    targetOptions: options.targetOptions,
    checksumPolicy: options.checksumPolicy ?? "preserve",
    regions,
    placements,
  };
}
