/**
 * Returns the inclusive maximum unsigned address for a target width.
 * @param addressWidth Address width in bits.
 * @returns Inclusive maximum address.
 */
export declare function maximumAddressForWidth(addressWidth: number): number;
/**
 * Normalizes an integer logical address to the active target's unsigned width.
 * @param address Logical address.
 * @param addressWidth Address width in bits.
 * @returns Normalized unsigned address.
 */
export declare function normalizeAddressForWidth(address: number, addressWidth: number): number;
/**
 * Formats a logical address using the hexadecimal digits implied by its width.
 * @param address Logical address.
 * @param addressWidth Address width in bits.
 * @returns Uppercase zero-padded hexadecimal address.
 */
export declare function formatAddressForWidth(address: number, addressWidth: number): string;
//# sourceMappingURL=address-width.d.ts.map