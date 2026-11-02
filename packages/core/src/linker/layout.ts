import type {
  AssemblyLinkRecipe,
  AssemblyModule,
  AssemblySection,
  LinkMemoryRegion,
  LinkSectionPlacement,
} from "../relocatable.js";
import { LinkError, type LinkAllocation, type LinkRegionReport } from "./types.js";
import { integer, textValue } from "./value.js";

/** Mutable cursor tracking while placing sections into one memory region. */
interface RegionState {
  readonly region: LinkMemoryRegion;
  cursor: number;
}
/** Final section placements, region usage reports, and contiguous output image. */
export interface LinkLayout {
  /** Per-module section run addresses and sizes after layout. */
  readonly allocations: readonly LinkAllocation[];
  /** Human-readable region fill summaries for diagnostics. */
  readonly regions: readonly LinkRegionReport[];
  /** Contiguous ROM/RAM image sized to the highest used address. */
  readonly output: Uint8Array;
}

/** Align logical addresses with checked integer arithmetic, rather than aligning container offsets by accident. */
function aligned(value: number, alignment: number): number {
  return integer(Math.ceil(value / alignment) * alignment, "Aligned address");
}
/** Greatest common divisor for combining section alignment requirements. */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
/** Least common multiple of alignments with overflow-checked integer math. */
function combine(a: number, b: number): number {
  return integer((a / gcd(a, b)) * b, "Combined alignment", 1, 0x1000000);
}

/** Deterministic recipe order, then object order, then section order. No instruction is resized during placement. */
export function allocateSections(
  modules: readonly AssemblyModule[],
  recipe: AssemblyLinkRecipe,
): LinkLayout {
  const allocations: LinkAllocation[] = [];
  const fail = (message: string): never => {
    throw new LinkError("layout", message, undefined, [...allocations]);
  };
  const regions = new Map<string, RegionState>();
  const physical: { start: number; end: number; name: string }[] = [];
  let outputSize = 0;
  for (const region of recipe.regions) {
    textValue(region.name, "Region name");
    integer(region.start, "Region start");
    integer(region.size, "Region size", 0, 0x10000000);
    integer(region.start + region.size, "Region end");
    if (regions.has(region.name)) {
      fail(`Duplicate memory region '${region.name}'.`);
    }
    if (region.fillByte !== undefined) {
      integer(region.fillByte, "Region fill", 0, 255);
    }
    if (region.outputOffset !== undefined) {
      integer(region.outputOffset, "Region output offset", 0, 0x10000000);
      const end = integer(region.outputOffset + region.size, "Image extent", 0, 0x10000000);
      physical.push({ start: region.outputOffset, end, name: region.name });
      outputSize = Math.max(outputSize, end);
    }
    if (region.initialBytes !== undefined) {
      if (region.outputOffset === undefined || region.initialBytes.length !== region.size) {
        fail(`Initial bytes must fill physical region '${region.name}'.`);
      }
      region.initialBytes.forEach((byte) => integer(byte, "Container byte", 0, 255));
    }
    regions.set(region.name, { region, cursor: region.start });
  }
  physical.sort((a, b) => a.start - b.start);
  for (let i = 1; i < physical.length; i++) {
    if (physical[i].start < physical[i - 1].end) {
      fail(`Output regions '${physical[i - 1].name}' and '${physical[i].name}' overlap.`);
    }
  }
  const placed = new Set<string>();
  const placementNames = new Set<string>();
  const find = (name: string): RegionState => {
    const region = regions.get(name);
    if (!region) {
      return fail(`Unknown memory region '${name}'.`);
    }
    return region;
  };
  for (const placement of recipe.placements) {
    if (placementNames.has(placement.section)) {
      fail(`Section '${placement.section}' has multiple placement rules.`);
    }
    placementNames.add(placement.section);
    const load = find(placement.load),
      run = find(placement.run);
    integer(placement.alignment ?? 1, "Placement alignment", 1, 0x1000000);
    if (placement.bankSize !== undefined) {
      integer(placement.bankSize, "Bank size", 1, 0x1000000);
    }
    if (placement.start !== undefined) {
      integer(placement.start, "Section start");
      if (placement.start < run.cursor) {
        fail(
          `Section '${placement.section}' starts before the current run cursor in '${placement.run}'.`,
        );
      }
      run.cursor = placement.start;
    }
    for (const module of modules) {
      for (const section of module.sections) {
        if (section.name !== placement.section) {
          continue;
        }
        if (run.region.initialBytes || load.region.initialBytes) {
          fail(`Section '${section.name}' cannot overwrite container bytes.`);
        }
        const alignment = combine(section.alignment, placement.alignment ?? 1);
        const runAddress = fit(run, section, placement, alignment, fail);
        let loadAddress = runAddress;
        if (section.kind !== "bss" && load !== run) {
          loadAddress = fit(load, section, placement, alignment, fail);
        }
        const addressSpace = run.region.addressSpace ?? section.addressSpace;
        if (addressSpace !== section.addressSpace) {
          fail(
            `Section '${module.id}:${section.name}' uses '${section.addressSpace}', region '${placement.run}' uses '${addressSpace}'.`,
          );
        }
        let outputOffset: number | undefined;
        if (section.kind !== "bss") {
          if (load.region.outputOffset === undefined) {
            fail(`Initialized section '${section.name}' has no ROM load storage.`);
          }
          outputOffset = load.region.outputOffset! + loadAddress - load.region.start;
        } else if (run.region.outputOffset !== undefined) {
          fail(`BSS '${section.name}' requires a RAM run region without ROM storage.`);
        }
        allocations.push({
          module: module.id,
          section: section.name,
          kind: section.kind,
          addressSpace,
          loadRegion: placement.load,
          runRegion: placement.run,
          loadAddress,
          runAddress,
          ...(outputOffset !== undefined ? { outputOffset } : {}),
          size: section.size,
          alignment,
        });
        run.cursor = runAddress + section.size;
        if (section.kind !== "bss" && load !== run) {
          load.cursor = loadAddress + section.size;
        }
        placed.add(`${module.id}\0${section.name}`);
      }
    }
  }
  for (const module of modules) {
    for (const section of module.sections) {
      if (!placed.has(`${module.id}\0${section.name}`)) {
        fail(`No placement rule for '${module.id}:${section.name}'.`);
      }
    }
  }
  const output = new Uint8Array(outputSize);
  for (const { region } of regions.values()) {
    if (region.outputOffset !== undefined) {
      output.fill(region.fillByte ?? 0, region.outputOffset, region.outputOffset + region.size);
      if (region.initialBytes) {
        output.set(region.initialBytes, region.outputOffset);
      }
    }
  }
  const byModule = new Map(
    modules.map((module) => [
      module.id,
      new Map(module.sections.map((section) => [section.name, section])),
    ]),
  );
  for (const allocation of allocations) {
    if (allocation.outputOffset !== undefined) {
      output.set(
        byModule.get(allocation.module)!.get(allocation.section)!.bytes,
        allocation.outputOffset,
      );
    }
  }
  return {
    output,
    allocations,
    regions: [...regions.values()].map(({ region, cursor }) => ({
      name: region.name,
      start: region.start,
      size: region.size,
      used: cursor - region.start,
    })),
  };
}

/** Bank constraints skip unusable tails deterministically; an oversized contribution cannot be split. */
function fit(
  state: RegionState,
  section: AssemblySection,
  placement: LinkSectionPlacement,
  alignment: number,
  fail: (message: string) => never,
): number {
  let start = aligned(state.cursor, alignment);
  const bankSize = placement.bankSize;
  if (bankSize !== undefined && section.size > 0) {
    if (section.size > bankSize) {
      return fail(`Section '${section.name}' exceeds its ${bankSize}-byte bank constraint.`);
    }
    if (Math.floor(start / bankSize) !== Math.floor((start + section.size - 1) / bankSize)) {
      start = aligned((Math.floor(start / bankSize) + 1) * bankSize, alignment);
      if (Math.floor(start / bankSize) !== Math.floor((start + section.size - 1) / bankSize)) {
        return fail(`Alignment prevents '${section.name}' from fitting one bank.`);
      }
    }
  }
  if (start < state.region.start || start + section.size > state.region.start + state.region.size) {
    return fail(
      `Section '${section.name}' needs ${section.size} bytes at $${start.toString(16)}; region '${state.region.name}' ends at $${(state.region.start + state.region.size).toString(16)}.`,
    );
  }
  return start;
}
