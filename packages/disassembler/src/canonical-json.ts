/**
 * Sort keys and omit undefined fields recursively for bounded JSON identities and payloads.
 * @param {unknown} value Bounded JSON-compatible value; arrays retain their input order.
 * @returns {unknown} Canonical objects with undefined fields omitted.
 */
export const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    // Rich traces canonicalize millions of small register/access objects. Sorting keys directly
    // avoids three temporary arrays and per-field entry tuples while preserving locale ordering.
    const input = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort((a, b) => a.localeCompare(b))) {
      const entry = input[key];
      if (entry === undefined) continue;
      const normalized = canonicalValue(entry);
      // Match Object.fromEntries: an input named __proto__ is data, not a prototype setter.
      if (key === "__proto__")
        Object.defineProperty(result, key, {
          value: normalized,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      else result[key] = normalized;
    }
    return result;
  }
  return value;
};

/**
 * Canonical JSON with a trailing newline; callers must keep the supplied value bounded.
 * @param {unknown} value Bounded identity, record, or configuration value.
 * @returns {string} Canonical text used for comparisons and hashes.
 */
export const canonicalJson = (value: unknown): string =>
  `${JSON.stringify(canonicalValue(value), undefined, 2)}\n`;
