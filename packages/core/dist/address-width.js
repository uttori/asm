/**
 * Returns the inclusive maximum unsigned address for a target width.
 * @param addressWidth Address width in bits.
 * @returns Inclusive maximum address.
 */
export function maximumAddressForWidth(addressWidth) {
    if (!Number.isInteger(addressWidth) || addressWidth < 1 || addressWidth > 53) {
        throw new Error(`Address width must be an integer from 1 through 53, got ${addressWidth}.`);
    }
    return 2 ** addressWidth - 1;
}
/**
 * Normalizes an integer logical address to the active target's unsigned width.
 * @param address Logical address.
 * @param addressWidth Address width in bits.
 * @returns Normalized unsigned address.
 */
export function normalizeAddressForWidth(address, addressWidth) {
    const modulus = maximumAddressForWidth(addressWidth) + 1;
    if (!Number.isFinite(address) || !Number.isInteger(address)) {
        throw new Error(`Logical address must be a finite integer, got ${address}.`);
    }
    return ((address % modulus) + modulus) % modulus;
}
/**
 * Formats a logical address using the hexadecimal digits implied by its width.
 * @param address Logical address.
 * @param addressWidth Address width in bits.
 * @returns Uppercase zero-padded hexadecimal address.
 */
export function formatAddressForWidth(address, addressWidth) {
    return normalizeAddressForWidth(address, addressWidth)
        .toString(16)
        .toUpperCase()
        .padStart(Math.ceil(addressWidth / 4), "0");
}
//# sourceMappingURL=address-width.js.map