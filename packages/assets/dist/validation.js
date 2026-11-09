/**
 * Reject values before allocation or bit packing; all native encoders use this bound.
 * @param value Candidate integer.
 * @param label Diagnostic field name.
 * @param minimum Inclusive lower bound.
 * @param maximum Inclusive upper bound.
 * @returns The validated integer.
 */
export function integer(value, label, minimum, maximum) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new RangeError(`${label} must be an integer in ${minimum}..${maximum}.`);
    }
    return value;
}
/**
 * Validate a complete native byte stream, including its final partial unit.
 * @param bytes Input stream.
 * @param size Number of bytes per native unit.
 * @param label Diagnostic format name.
 * @returns The number of complete units.
 */
export function unitCount(bytes, size, label) {
    if (bytes.length % size !== 0) {
        throw new RangeError(`${label} length ${bytes.length} is not divisible by ${size}.`);
    }
    return bytes.length / size;
}
/**
 * Require a dotted, lowercase provider ID without regex backtracking.
 * @param id Candidate provider ID.
 * @returns Whether every namespace segment is valid.
 */
export function isNamespacedId(id) {
    const parts = id.split(".");
    return (parts.length > 1 &&
        /^[a-z][\da-z-]*$/.test(parts[0]) &&
        parts.slice(1).every((part) => /^[\da-z][\da-z-]*$/.test(part)));
}
/** Portable runtime assertion; narrows validated input without requiring Node's assertion module. */
export function invariant(value, message = "Invalid asset value.") {
    if (!value) {
        throw new Error(message);
    }
}
/** Exact scalar comparison, including NaN and signed-zero behavior, for portable native-format contracts. */
export function equal(actual, expected, message = `Expected ${String(expected)}, received ${String(actual)}.`) {
    if (!Object.is(actual, expected)) {
        throw new Error(message);
    }
}
/** Reject an invalid branch while preserving control-flow narrowing at the call site. */
export function fail(message) {
    throw new Error(message);
}
//# sourceMappingURL=validation.js.map