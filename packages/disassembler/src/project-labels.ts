import type { ProjectLabel } from "./project-types.js";

/**
 * Validate a portable global assembly identifier without changing the user's spelling.
 * @param {string} name Preferred assembly symbol.
 */
export const validateSourceLabelName = (name: string): void => {
  if (typeof name !== "string" || name.length > 256 || !/^[A-Z_a-z]\w*$/.test(name)) {
    throw new Error(
      "Use a global label name containing letters, digits, and underscores, starting with a letter or underscore.",
    );
  }
};

/**
 * Legacy imported names retain their historical, deterministic export spelling.
 * @param {string} name Native imported label name.
 * @returns {string} Historical assembly spelling.
 */
export const legacySourceLabelName = (name: string): string =>
  `L_${name.replaceAll(/\W/g, "_").replaceAll(/_+/g, "_") || "unnamed"}`;

/**
 * Allocate names once for definitions, references, and editor navigation. Explicit names never
 * silently acquire a suffix. Reserve target-provided hardware/RAM names before emitting source.
 * @param {readonly ProjectLabel[]} labels Persisted native labels.
 * @param {Iterable<string>} reserved Names already owned by the target/export.
 * @returns {ReadonlyMap<string, string>} Stable label ids mapped to unique assembly names.
 */
export const projectSourceLabelNames = (
  labels: readonly ProjectLabel[],
  reserved: Iterable<string> = [],
): ReadonlyMap<string, string> => {
  const names = new Map<string, string>();
  const used = new Set([...reserved].map((name) => name.toLowerCase()));
  const sorted = [...labels].sort((a, b) => a.id.localeCompare(b.id));
  for (const label of sorted.filter((label) => label.sourceName === undefined)) {
    const base = legacySourceLabelName(label.name);
    let name = base;
    let suffix = 2;
    while (used.has(name.toLowerCase())) {
      name = `${base}_${suffix++}`;
    }
    used.add(name.toLowerCase());
    names.set(label.id, name);
  }
  for (const label of sorted.filter((label) => label.sourceName !== undefined)) {
    const name = label.sourceName!;
    validateSourceLabelName(name);
    if (used.has(name.toLowerCase())) {
      throw new Error(`Source label '${name}' conflicts with another symbol.`);
    }
    used.add(name.toLowerCase());
    names.set(label.id, name);
  }
  return names;
};
