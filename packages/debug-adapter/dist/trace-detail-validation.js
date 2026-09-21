const isArray = (value) => Array.isArray(value);
/**
 * Validate details before they reach a debugger client.
 * @param {unknown} value Untrusted detail array.
 * @param {number} count Expected instruction count.
 * @returns {readonly DebugTraceInstructionDetail[]} Validated details.
 */
export const validateDebugTraceDetails = (value, count) => {
    if (!Array.isArray(value) || value.length !== count) {
        throw new Error("Trace details must align with instruction addresses.");
    }
    for (const detail of value) {
        if (!detail ||
            !isArray(detail.bytes) ||
            detail.bytes.length < 1 ||
            detail.bytes.length > 16 ||
            detail.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
            throw new Error("Invalid trace instruction bytes.");
        }
        if (!detail.state ||
            typeof detail.state !== "object" ||
            isArray(detail.state) ||
            Object.entries(detail.state).some(([key, entry]) => !key ||
                !["number", "boolean", "string"].includes(typeof entry) ||
                (typeof entry === "number" && !Number.isFinite(entry)))) {
            throw new Error("Invalid trace instruction state.");
        }
        if (detail.droppedMemoryAccesses !== undefined &&
            (!Number.isSafeInteger(detail.droppedMemoryAccesses) || detail.droppedMemoryAccesses < 0)) {
            throw new Error("Invalid trace memory loss.");
        }
        if (detail.memoryAccesses !== undefined &&
            (!isArray(detail.memoryAccesses) || detail.memoryAccesses.length > 256)) {
            throw new Error("Invalid trace memory access bound.");
        }
        for (const access of detail.memoryAccesses ?? []) {
            if (!access ||
                typeof access.addressSpace !== "string" ||
                !access.addressSpace ||
                !Number.isSafeInteger(access.address) ||
                access.address < 0 ||
                !["read", "write", "fetch"].includes(access.access) ||
                !Number.isInteger(access.width) ||
                access.width < 1 ||
                access.width > 8 ||
                (access.value !== undefined && (!Number.isSafeInteger(access.value) || access.value < 0)) ||
                (access.actor !== undefined && !["cpu", "dma", "hdma"].includes(access.actor)) ||
                (access.channel !== undefined &&
                    (!Number.isInteger(access.channel) ||
                        access.channel < 0 ||
                        access.channel > 7 ||
                        !["dma", "hdma"].includes(access.actor ?? "cpu")))) {
                throw new Error("Invalid trace bus operation.");
            }
        }
    }
    return value;
};
//# sourceMappingURL=trace-detail-validation.js.map