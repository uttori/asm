import { canonicalValue } from "@uttori/asm-core/canonical-json";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUnknownArray(value) {
    return Array.isArray(value);
}
function isInteger(value) {
    return typeof value === "number" && Number.isInteger(value);
}
function isSafeInteger(value) {
    return typeof value === "number" && Number.isSafeInteger(value);
}
function isStateValue(value) {
    return (typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)));
}
function isMemoryAccess(entry) {
    if (!isRecord(entry)) {
        return false;
    }
    const addressSpace = entry.addressSpace;
    const address = entry.address;
    const access = entry.access;
    const width = entry.width;
    const value = entry.value;
    const actor = entry.actor;
    const channel = entry.channel;
    return (typeof addressSpace === "string" &&
        addressSpace !== "" &&
        isSafeInteger(address) &&
        address >= 0 &&
        (access === "read" || access === "write" || access === "fetch") &&
        isSafeInteger(width) &&
        width >= 1 &&
        width <= 8 &&
        (value === undefined || (isSafeInteger(value) && value >= 0)) &&
        (actor === undefined || actor === "cpu" || actor === "dma" || actor === "hdma") &&
        (channel === undefined ||
            (isInteger(channel) && channel >= 0 && channel <= 7 && (actor === "dma" || actor === "hdma"))));
}
/**
 * Validate execution details for persistence.
 * @param {unknown} value Untrusted detail array.
 * @param {number} count Expected instruction count.
 * @returns {readonly RuntimeInstructionDetail[]} Owned details with recursively canonical key order.
 */
export const validateRuntimeInstructionDetails = (value, count) => {
    if (!isUnknownArray(value) || value.length !== count) {
        throw new Error("Trace details must align one-to-one with instruction addresses.");
    }
    let previousKeys = [];
    let sortedKeys = [];
    return value.map((entry) => {
        if (!isRecord(entry)) {
            throw new Error("Trace instruction bytes must contain 1–16 byte values.");
        }
        const rawBytes = entry.bytes;
        if (!isUnknownArray(rawBytes) || rawBytes.length < 1 || rawBytes.length > 16) {
            throw new Error("Trace instruction bytes must contain 1–16 byte values.");
        }
        const bytes = [];
        for (const byte of rawBytes) {
            if (!(isInteger(byte) && byte >= 0 && byte <= 255)) {
                throw new Error("Trace instruction bytes must contain 1–16 byte values.");
            }
            bytes.push(byte);
        }
        const rawState = entry.state;
        if (!isRecord(rawState)) {
            throw new Error("Trace instruction state contains an invalid register value.");
        }
        const state = {};
        const keys = Object.keys(rawState);
        // Captures repeat one register layout millions of times. Sort only when the shape changes;
        // values are always revalidated and copied, so mutable producers cannot reuse stale state.
        if (keys.length !== previousKeys.length ||
            keys.some((key, index) => key !== previousKeys[index])) {
            previousKeys = keys;
            sortedKeys = keys.toSorted((left, right) => left.localeCompare(right));
        }
        for (const key of sortedKeys) {
            const stateValue = rawState[key];
            if (!key || !isStateValue(stateValue)) {
                throw new Error("Trace instruction state contains an invalid register value.");
            }
            if (key === "__proto__") {
                Object.defineProperty(state, key, {
                    value: stateValue,
                    enumerable: true,
                    writable: true,
                    configurable: true,
                });
            }
            else {
                state[key] = stateValue;
            }
        }
        const droppedMemoryAccesses = entry.droppedMemoryAccesses;
        let droppedCount;
        if (droppedMemoryAccesses !== undefined) {
            if (!(isSafeInteger(droppedMemoryAccesses) && droppedMemoryAccesses >= 0)) {
                throw new Error("Trace memory loss must be a non-negative safe integer.");
            }
            droppedCount = droppedMemoryAccesses;
        }
        const rawAccesses = entry.memoryAccesses;
        if (rawAccesses !== undefined && (!isUnknownArray(rawAccesses) || rawAccesses.length > 256)) {
            throw new Error("Trace instruction memory accesses exceed the 256-operation bound.");
        }
        const memoryAccesses = rawAccesses === undefined
            ? undefined
            : rawAccesses.map((access) => {
                if (!isMemoryAccess(access)) {
                    throw new Error("Trace contains an invalid bus operation.");
                }
                // Optional producer fields also participate in historical hashes. Canonicalize those
                // records completely rather than dropping fields outside the required bus schema.
                const normalized = canonicalValue(access);
                if (!isMemoryAccess(normalized)) {
                    throw new Error("Trace contains an invalid normalized bus operation.");
                }
                return normalized;
            });
        return {
            bytes,
            ...(droppedCount === undefined ? {} : { droppedMemoryAccesses: droppedCount }),
            ...(memoryAccesses === undefined ? {} : { memoryAccesses }),
            state,
        };
    });
};
//# sourceMappingURL=trace-detail.js.map