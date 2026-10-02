function isEffectRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isVramBytes(value) {
    return value === 65536 || value === 131072;
}
function isInteger(value) {
    return typeof value === "number" && Number.isInteger(value);
}
/** Validate a native effect independently of transport framing or stored JSON.
 * @param {unknown} effect Claimed physical writes and decision flags.
 * @param {object} access Completing bus operation.
 * @returns {RuntimePPUEffect} Fresh semantic value with canonical property order, excluding raster.
 */
export const normalizeRuntimePPUEffect = (effect, access) => {
    const accessAddress = access.address;
    const accessValue = access.value;
    const accessDirection = access.direction;
    if (typeof accessAddress !== "number" ||
        typeof accessValue !== "number" ||
        typeof accessDirection !== "string") {
        throw new Error("Invalid native PPU effect identity or flags.");
    }
    const port = accessAddress & 0xffff;
    let target = "vram";
    if (port === 0x2104) {
        target = "oam";
    }
    if (port === 0x2122) {
        target = "cgram";
    }
    const effectRecord = isEffectRecord(effect) ? effect : undefined;
    const outcome = effectRecord?.outcome;
    const forcedBlank = effectRecord?.forcedBlank;
    const renderingRestricted = effectRecord?.renderingRestricted;
    const implementation = effectRecord?.implementation;
    const vramBytes = effectRecord?.vramBytes;
    const rawBytes = effectRecord?.bytes;
    if (!effectRecord ||
        accessDirection !== "write" ||
        accessAddress & 0x400000 ||
        ![0x2104, 0x2118, 0x2119, 0x2122].includes(port) ||
        effectRecord.target !== target ||
        (outcome !== "written" && outcome !== "blocked" && outcome !== "latched") ||
        typeof forcedBlank !== "boolean" ||
        typeof renderingRestricted !== "boolean" ||
        (forcedBlank && renderingRestricted) ||
        (implementation !== "accurate" && implementation !== "performance") ||
        (target === "vram" ? !isVramBytes(vramBytes) : vramBytes !== null) ||
        !Array.isArray(rawBytes) ||
        rawBytes.length > 2) {
        throw new Error("Invalid native PPU effect identity or flags.");
    }
    const count = rawBytes.length;
    const capacity = target === "vram" && isVramBytes(vramBytes) ? vramBytes : null;
    if ((outcome === "written" &&
        (count === 0 || (target === "vram" && count !== 1) || (target === "cgram" && count !== 2))) ||
        (outcome !== "written" && count !== 0) ||
        (outcome === "blocked" && (target !== "vram" || !renderingRestricted)) ||
        (outcome === "latched" && (target === "vram" || renderingRestricted))) {
        throw new Error("Invalid native PPU outcome or write count.");
    }
    let bound = capacity ?? 0;
    if (target === "cgram") {
        bound = 512;
    }
    if (target === "oam") {
        bound = 544;
    }
    const byteEntries = rawBytes;
    let firstAddress = 0;
    const bytes = byteEntries.map((entry, i) => {
        const byte = isEffectRecord(entry) ? entry : undefined;
        if (!byte) {
            throw new Error("Invalid native PPU byte destination or value.");
        }
        const address = byte.address;
        const byteValue = byte.value;
        if (!isInteger(address) || !isInteger(byteValue)) {
            throw new Error("Invalid native PPU byte destination or value.");
        }
        if (address < 0 ||
            address >= bound ||
            byteValue < 0 ||
            byteValue > 255 ||
            (target === "vram" && ((address & 1) !== (port & 1) || byteValue !== accessValue)) ||
            (target === "cgram" &&
                (i === 0
                    ? (address & 1) !== 0
                    : address !== firstAddress + 1 || byteValue !== (accessValue & 127))) ||
            (target === "oam" && i === count - 1 && byteValue !== accessValue)) {
            throw new Error("Invalid native PPU byte destination or value.");
        }
        if (i === 0) {
            firstAddress = address;
        }
        return { address, value: byteValue };
    });
    return {
        target,
        outcome,
        forcedBlank,
        renderingRestricted,
        implementation,
        vramBytes: capacity,
        bytes,
    };
};
//# sourceMappingURL=runtime-ppu-effect.js.map