/**
 * Sort keys and omit undefined fields recursively for bounded JSON identities and payloads.
 * @param {unknown} value Bounded JSON-compatible value. Arrays retain their input order.
 * @returns {unknown} Canonical objects with undefined fields omitted.
 */
export declare const canonicalValue: (value: unknown) => unknown;
/**
 * Canonical JSON with a trailing newline. Callers must keep the supplied value bounded.
 * @param {unknown} value Bounded identity, record, or configuration value.
 * @returns {string} Canonical text used for comparisons and hashes.
 */
export declare const canonicalJson: (value: unknown) => string;
//# sourceMappingURL=canonical-json.d.ts.map