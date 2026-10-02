import { isNamespacedId } from "./validation.js";
const sameBytes = (left, right) => left.length === right.length && left.every((byte, index) => byte === right[index]);
/** Registers unique transforms independently of any assembler target. */
export class TransformRegistry {
    #transforms = new Map();
    register(transform) {
        if (!isNamespacedId(transform.id) || !transform.version || this.#transforms.has(transform.id)) {
            throw new Error(`Invalid or duplicate byte transform '${transform.id}'.`);
        }
        this.#transforms.set(transform.id, transform);
        return this;
    }
    get(id) {
        const transform = this.#transforms.get(id);
        if (!transform) {
            throw new Error(`No byte transform '${id}'.`);
        }
        return transform;
    }
}
/** Encode a chain and verify that each stage decodes to its exact input.
 * @param {TransformRegistry} registry Registered reversible transforms.
 * @param {Uint8Array} input Borrowed original bytes.
 * @param {TransformStep[]} steps Ordered encode stages.
 * @param {number} maxOutputBytes Maximum bytes allowed after any stage.
 * @returns {Uint8Array} Owned final encoded bytes.
 */
export function transformBytes(registry, input, steps, maxOutputBytes = 16 * 1024 * 1024) {
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 0) {
        throw new RangeError("Invalid output byte limit.");
    }
    let bytes = input.slice();
    for (const step of steps) {
        const transform = registry.get(step.id);
        const options = step.options ?? {};
        const encoded = transform.encode(bytes.slice(), options);
        if (!(encoded instanceof Uint8Array) || encoded.length > maxOutputBytes) {
            throw new Error(`Transform '${step.id}' produced invalid or oversized output.`);
        }
        const decoded = transform.decode(encoded.slice(), options, bytes.length);
        if (!(decoded instanceof Uint8Array) || !sameBytes(decoded, bytes)) {
            throw new Error(`Transform '${step.id}' is not lossless for this input.`);
        }
        bytes = encoded.slice();
    }
    return bytes;
}
/** Reverse a transform chain with a caller-defined decoded expansion bound.
 * @param {TransformRegistry} registry Registered reversible transforms.
 * @param {Uint8Array} encoded Borrowed final encoded bytes.
 * @param {TransformStep[]} steps Original encode order.
 * @param {number} maxOutputBytes Maximum bytes allowed after any decode stage.
 * @returns {Uint8Array} Owned reconstructed bytes.
 */
export function reverseTransforms(registry, encoded, steps, maxOutputBytes) {
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 0) {
        throw new RangeError("Invalid output byte limit.");
    }
    if (encoded.length > maxOutputBytes) {
        throw new RangeError("Encoded bytes exceed output byte limit.");
    }
    let bytes = encoded.slice();
    for (const step of [...steps].toReversed()) {
        bytes = registry.get(step.id).decode(bytes, step.options ?? {}, maxOutputBytes);
        if (!(bytes instanceof Uint8Array) || bytes.length > maxOutputBytes) {
            throw new Error(`Transform '${step.id}' exceeded decoded byte limit ${maxOutputBytes}.`);
        }
    }
    return bytes.slice();
}
//# sourceMappingURL=compression.js.map