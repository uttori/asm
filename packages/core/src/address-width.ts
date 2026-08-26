/**
 * Returns the inclusive maximum unsigned address for a target width.
 * @param {number} addressWidth Address width in bits.
 * @returns {number} Inclusive maximum address.
 */
export function maximumAddressForWidth(addressWidth: number): number {
  if (!Number.isInteger(addressWidth) || addressWidth < 1 || addressWidth > 53) {
    throw new Error(`Address width must be an integer from 1 through 53, got ${addressWidth}.`);
  }
  return 2 ** addressWidth - 1;
}

/**
 * Normalizes an integer logical address to the active target's unsigned width.
 * @param {number} address Logical address.
 * @param {number} addressWidth Address width in bits.
 * @returns {number} Normalized unsigned address.
 */
export function normalizeAddressForWidth(address: number, addressWidth: number): number {
  const modulus = maximumAddressForWidth(addressWidth) + 1;
  if (!Number.isFinite(address) || !Number.isInteger(address)) {
    throw new Error(`Logical address must be a finite integer, got ${address}.`);
  }
  return ((address % modulus) + modulus) % modulus;
}

/**
 * Formats a logical address using the hexadecimal digits implied by its width.
 * @param {number} address Logical address.
 * @param {number} addressWidth Address width in bits.
 * @returns {string} Uppercase zero-padded hexadecimal address.
 */
export function formatAddressForWidth(address: number, addressWidth: number): string {
  return normalizeAddressForWidth(address, addressWidth)
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(addressWidth / 4), "0");
}
