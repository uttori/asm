/**
 * Compare keys preserving the existing locale-based ordering.
 * @param {string} a First key.
 * @param {string} b Second key.
 * @returns {number} Comparison result.
 */
const compareKeys = (a: string, b: string): number => a.localeCompare(b);

/**
 * Sort keys and omit undefined fields recursively for bounded JSON identities and payloads.
 * @param {unknown} value Bounded JSON-compatible value. Arrays retain their input order.
 * @returns {unknown} Canonical objects with undefined fields omitted.
 */
export const canonicalValue = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  // Rich traces canonicalize millions of small register/access objects.
  // Sorting keys directly avoids three temporary arrays & per-field entry
  // tuples while preserving locale ordering.
  const input = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const keys = Object.keys(input);
  // Only sort non-empty objects to avoid unnecessary work.
  if (keys.length > 1) {
    keys.sort(compareKeys);
  }
  for (const key of keys) {
    const entry = input[key];
    if (entry === undefined) {
      continue;
    }

    // Primitive fields need no recursive normalization.
    const normalized = typeof entry === "object" && entry !== null
      ? canonicalValue(entry)
      : entry;

    // Match Object.fromEntries: an input named __proto__ is data, not a prototype setter.
    if (key === "__proto__") {
      Object.defineProperty(result, key, {
        value: normalized,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else {
      result[key] = normalized;
    }
  }
  return result;
};

/**
 * Canonical JSON with a trailing newline. Callers must keep the supplied value bounded.
 * @param {unknown} value Bounded identity, record, or configuration value.
 * @returns {string} Canonical text used for comparisons and hashes.
 */
export const canonicalJson = (value: unknown): string =>
  `${JSON.stringify(canonicalValue(value), undefined, 2)}\n`;
