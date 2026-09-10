/**
 * Sort keys and omit undefined fields recursively for bounded JSON identities and payloads.
 * @param {unknown} value Bounded JSON-compatible value; arrays retain their input order.
 * @returns {unknown} Canonical objects with undefined fields omitted.
 */
export const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  return value;
};

/**
 * Canonical JSON with a trailing newline; callers must keep the supplied value bounded.
 * @param {unknown} value Bounded identity, record, or configuration value.
 * @returns {string} Canonical text used for comparisons and hashes.
 */
export const canonicalJson = (value: unknown): string =>
  `${JSON.stringify(canonicalValue(value), undefined, 2)}\n`;
