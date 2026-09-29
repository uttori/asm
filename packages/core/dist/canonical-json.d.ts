/**
 * Sort keys and omit undefined fields recursively for bounded JSON identities and payloads.
 * @param {unknown} value Bounded JSON-compatible value. Arrays retain their input order.
 * @returns {unknown} Canonical objects with undefined fields omitted.
 */
export declare const canonicalValue: (value: unknown) => unknown;
/**
 * Compact canonical JSON for in-memory equality.
 * Same key order, undefined omission, and escaping as {@link canonicalJson}, without
 * indentation or a trailing newline.
 * @param {unknown} value Bounded identity, record, or configuration value.
 * @returns {string} Compact canonical text. Top-level undefined, functions, and symbols become empty.
 */
export declare const canonicalJsonCompact: (value: unknown) => string;
/**
 * True when both values have the same canonical JSON identity.
 * Identical references match without serialization.
 * @param {unknown} left First bounded value.
 * @param {unknown} right Second bounded value.
 * @returns {boolean} Canonical equality.
 */
export declare const canonicalEquals: (left: unknown, right: unknown) => boolean;
/**
 * Pretty canonical JSON with a trailing newline.
 * Debug-map fingerprints, analysis manifests, runtime-fact payloads, trace content
 * hashes, and review files are defined as this text. Changing the layout changes
 * those durable identities. In-memory equality should use {@link canonicalEquals}.
 * @param {unknown} value Bounded identity, record, or configuration value.
 * @returns {string} Canonical text used for durable hashes and review output.
 */
export declare const canonicalJson: (value: unknown) => string;
//# sourceMappingURL=canonical-json.d.ts.map