/**
 * Compare keys preserving the existing locale-based ordering.
 * JSON.stringify still emits canonical integer keys in numeric order.
 * @param a First key.
 * @param b Second key.
 * @returns Comparison result.
 */
const compareKeys = (a, b) => a.localeCompare(b);
/** Narrows plain objects while excluding arrays and null. */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/**
 * Sort keys and omit undefined fields recursively for bounded JSON identities and payloads.
 * @param value Bounded JSON-compatible value. Arrays retain their input order.
 * @returns Canonical objects with undefined fields omitted.
 */
export const canonicalValue = (value) => {
    if (typeof value !== "object" || value === null) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(canonicalValue);
    }
    if (!isRecord(value)) {
        return value;
    }
    // Rich traces canonicalize millions of small register/access objects.
    // Sorting keys directly avoids three temporary arrays & per-field entry
    // tuples while preserving locale ordering.
    const input = value;
    const result = {};
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
        const normalized = typeof entry === "object" && entry !== null ? canonicalValue(entry) : entry;
        // Match Object.fromEntries: an input named __proto__ is data, not a prototype setter.
        if (key === "__proto__") {
            Object.defineProperty(result, key, {
                value: normalized,
                enumerable: true,
                writable: true,
                configurable: true,
            });
        }
        else {
            result[key] = normalized;
        }
    }
    return result;
};
/** Shared JSON.stringify entry point so compact and pretty paths stay aligned. */
function stringifyCanonical(value) {
    return JSON.stringify(value);
}
/**
 * Compact canonical JSON for in-memory equality.
 * Same key order, undefined omission, and escaping as {@link canonicalJson}, without
 * indentation or a trailing newline.
 * @param value Bounded identity, record, or configuration value.
 * @returns Compact canonical text. Top-level undefined, functions, and symbols become empty.
 */
export const canonicalJsonCompact = (value) => stringifyCanonical(canonicalValue(value)) ?? "";
/**
 * True when both values have the same canonical JSON identity.
 * Identical references match without serialization.
 * @param left First bounded value.
 * @param right Second bounded value.
 * @returns Canonical equality.
 */
export const canonicalEquals = (left, right) => left === right || canonicalJsonCompact(left) === canonicalJsonCompact(right);
/**
 * Pretty canonical JSON with a trailing newline.
 * Debug-map fingerprints, analysis manifests, runtime-fact payloads, trace content
 * hashes, and review files are defined as this text. Changing the layout changes
 * those durable identities. In-memory equality should use {@link canonicalEquals}.
 * @param value Bounded identity, record, or configuration value.
 * @returns Canonical text used for durable hashes and review output.
 */
export const canonicalJson = (value) => `${JSON.stringify(canonicalValue(value), undefined, 2)}\n`;
//# sourceMappingURL=canonical-json.js.map