/** Reject values before allocation or bit packing; all native encoders use this bound.
 * @param {number} value Candidate integer.
 * @param {string} label Diagnostic field name.
 * @param {number} minimum Inclusive lower bound.
 * @param {number} maximum Inclusive upper bound.
 * @returns {number} The validated integer.
 */
export declare function integer(value: number, label: string, minimum: number, maximum: number): number;
/** Validate a complete native byte stream, including its final partial unit.
 * @param {Uint8Array} bytes Input stream.
 * @param {number} size Number of bytes per native unit.
 * @param {string} label Diagnostic format name.
 * @returns {number} The number of complete units.
 */
export declare function unitCount(bytes: Uint8Array, size: number, label: string): number;
/** Require a dotted, lowercase provider ID without regex backtracking.
 * @param {string} id Candidate provider ID.
 * @returns {boolean} Whether every namespace segment is valid.
 */
export declare function isNamespacedId(id: string): boolean;
//# sourceMappingURL=validation.d.ts.map