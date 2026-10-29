import { parseAssetCall } from "@uttori/asm-core";

import type { LoadedSnesStructMap } from "./struct-map.js";

/** Exact source codec required for every ROM binding of one project-defined layout. */
export interface SnesAssetRequirement {
  readonly structure: string;
  readonly format: string;
  /** Required literal string options, such as the room section. Other options remain unrestricted. */
  readonly options?: Readonly<Record<string, string>>;
}

/** Headerless ROM interval replaced by a single asset directive. */
export interface SnesAssetIncludeEntry {
  readonly start: number;
  readonly end: number;
  readonly directive: string;
}

/** Project rules remain optional; malformed rules must never silently disable admission checks. */
export function parseSnesAssetRequirements(value: unknown): readonly SnesAssetRequirement[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Asset requirements must be an array.");
  const structures = new Set<string>();
  return value.map((row: unknown) => {
    if (
      typeof row !== "object" ||
      row === null ||
      !("structure" in row) ||
      typeof row.structure !== "string" ||
      !/^[A-Za-z_]\w*$/.test(row.structure) ||
      !("format" in row) ||
      typeof row.format !== "string" ||
      !row.format.trim()
    ) {
      throw new Error("Asset requirements need a structure name and format.");
    }
    if (structures.has(row.structure))
      throw new Error(`Duplicate asset requirement: ${row.structure}.`);
    structures.add(row.structure);
    let options: Record<string, string> | undefined;
    if ("options" in row) {
      if (typeof row.options !== "object" || row.options === null || Array.isArray(row.options))
        throw new Error("Asset requirement options must be literal strings.");
      options = {};
      for (const [key, option] of Object.entries(row.options)) {
        if (!/^[A-Za-z_]\w*$/.test(key) || typeof option !== "string")
          throw new Error("Asset requirement options must be literal strings.");
        options[key] = option;
      }
    }
    return { structure: row.structure, format: row.format, ...(options ? { options } : {}) };
  });
}

/**
 * Require complete coverage by the declared codec before export emits any files.
 * Adjacent includes and larger shared owners are valid; gaps, wrong codecs and wrong
 * section options fail even when the resulting raw assembly would rebuild correctly.
 */
export function verifySnesAssetRequirements(
  requirements: readonly SnesAssetRequirement[],
  entries: readonly SnesAssetIncludeEntry[],
  catalog: LoadedSnesStructMap | undefined,
): void {
  if (!requirements.length) return;
  if (!catalog) throw new Error("Asset requirements need a struct-map.json input.");
  const calls = entries.map((entry) => ({ ...entry, call: parseAssetCall(entry.directive) }));
  const rules = new Map(requirements.map((rule) => [rule.structure, rule]));
  for (const binding of catalog.bindings) {
    const rule = rules.get(binding.structure.id);
    if (!rule || binding.fileOffset === undefined) continue;
    const end = binding.fileOffset + binding.structure.size * binding.count;
    let covered = binding.fileOffset;
    const matching = calls
      .filter(
        (entry) =>
          entry.start < end &&
          entry.end > covered &&
          entry.call?.format.value === rule.format &&
          Object.entries(rule.options ?? {}).every(([key, value]) => {
            const option = entry.call?.options[key];
            return option?.kind === "string" && option.value === value;
          }),
      )
      .sort((a, b) => a.start - b.start);
    // Coverage is a union, not a requirement for one particular palette slice or
    // room filename. Aliases retain their existing physical owner and source identity.
    for (const entry of matching) {
      if (entry.start > covered) break;
      covered = Math.max(covered, entry.end);
      if (covered >= end) break;
    }
    if (covered < end) {
      const options = JSON.stringify(rule.options ?? {});
      throw new Error(
        `Missing required ${rule.format} includeAsset for ${binding.name} ` +
          `(${binding.structure.id}) at ROM $${covered.toString(16).toUpperCase()}; options ${options}.`,
      );
    }
  }
}
