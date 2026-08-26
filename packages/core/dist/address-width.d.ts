/**
 * Returns the inclusive maximum unsigned address for a target width.
 * @param {number} addressWidth Address width in bits.
 * @returns {number} Inclusive maximum address.
 */
export declare function maximumAddressForWidth(addressWidth: number): number;
/**
 * Normalizes an integer logical address to the active target's unsigned width.
 * @param {number} address Logical address.
 * @param {number} addressWidth Address width in bits.
 * @returns {number} Normalized unsigned address.
 */
export declare function normalizeAddressForWidth(address: number, addressWidth: number): number;
/**
 * Formats a logical address using the hexadecimal digits implied by its width.
 * @param {number} address Logical address.
 * @param {number} addressWidth Address width in bits.
 * @returns {string} Uppercase zero-padded hexadecimal address.
 */
export declare function formatAddressForWidth(address: number, addressWidth: number): string;
//# sourceMappingURL=address-width.d.ts.map