/** Reject values before allocation or bit packing; all native encoders use this bound.
 * @param {number} value Candidate integer.
 * @param {string} label Diagnostic field name.
 * @param {number} minimum Inclusive lower bound.
 * @param {number} maximum Inclusive upper bound.
 * @returns {number} The validated integer.
 */
export function integer(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
  return value;
}

/** Validate a complete native byte stream, including its final partial unit.
 * @param {Uint8Array} bytes Input stream.
 * @param {number} size Number of bytes per native unit.
 * @param {string} label Diagnostic format name.
 * @returns {number} The number of complete units.
 */
export function unitCount(bytes: Uint8Array, size: number, label: string): number {
  if (bytes.length % size !== 0) {
    throw new RangeError(`${label} length ${bytes.length} is not divisible by ${size}.`);
  }
  return bytes.length / size;
}

/** Require a dotted, lowercase provider ID without regex backtracking.
 * @param {string} id Candidate provider ID.
 * @returns {boolean} Whether every namespace segment is valid.
 */
export function isNamespacedId(id: string): boolean {
  const parts = id.split(".");
  return (
    parts.length > 1 &&
    /^[a-z][\da-z-]*$/.test(parts[0]) &&
    parts.slice(1).every((part) => /^[\da-z][\da-z-]*$/.test(part))
  );
}
/** Portable runtime assertion; narrows validated input without requiring Node's assertion module. */
export function invariant(value: unknown, message = "Invalid asset value."): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

/** Exact scalar comparison, including NaN and signed-zero behavior, for portable native-format contracts. */
export function equal(
  actual: unknown,
  expected: unknown,
  message = `Expected ${String(expected)}, received ${String(actual)}.`,
): void {
  if (!Object.is(actual, expected)) {
    throw new Error(message);
  }
}

/** Reject an invalid branch while preserving control-flow narrowing at the call site. */
export function fail(message: string): never {
  throw new Error(message);
}
