/** Validate a native effect independently of transport framing or stored JSON.
 * @param {RuntimePPUEffect} effect Claimed physical writes and decision flags.
 * @param {Pick<RuntimeBusFact, "address" | "direction" | "value">} access Completing bus operation.
 * @returns {RuntimePPUEffect} Fresh semantic value with canonical property order, excluding raster.
 */
export const normalizeRuntimePPUEffect = (effect, access) => {
    const port = access.address & 0xffff;
    let target = "vram";
    if (port === 0x2104) {
        target = "oam";
    }
    if (port === 0x2122) {
        target = "cgram";
    }
    if (!effect ||
        access.direction !== "write" ||
        access.address & 0x400000 ||
        ![0x2104, 0x2118, 0x2119, 0x2122].includes(port) ||
        effect.target !== target ||
        !["written", "blocked", "latched"].includes(effect.outcome) ||
        typeof effect.forcedBlank !== "boolean" ||
        typeof effect.renderingRestricted !== "boolean" ||
        (effect.forcedBlank && effect.renderingRestricted) ||
        !["accurate", "performance"].includes(effect.implementation) ||
        (target === "vram"
            ? ![65536, 131072].includes(effect.vramBytes ?? 0)
            : effect.vramBytes !== null) ||
        !Array.isArray(effect.bytes) ||
        effect.bytes.length > 2) {
        throw new Error("Invalid native PPU effect identity or flags.");
    }
    const count = effect.bytes.length;
    if ((effect.outcome === "written" &&
        (count === 0 || (target === "vram" && count !== 1) || (target === "cgram" && count !== 2))) ||
        (effect.outcome !== "written" && count !== 0) ||
        (effect.outcome === "blocked" && (target !== "vram" || !effect.renderingRestricted)) ||
        (effect.outcome === "latched" && (target === "vram" || effect.renderingRestricted))) {
        throw new Error("Invalid native PPU outcome or write count.");
    }
    let bound = effect.vramBytes ?? 0;
    if (target === "cgram") {
        bound = 512;
    }
    if (target === "oam") {
        bound = 544;
    }
    const bytes = effect.bytes.map((byte, i) => {
        if (!byte ||
            !Number.isInteger(byte.address) ||
            byte.address < 0 ||
            byte.address >= bound ||
            !Number.isInteger(byte.value) ||
            byte.value < 0 ||
            byte.value > 255 ||
            (target === "vram" && ((byte.address & 1) !== (port & 1) || byte.value !== access.value)) ||
            (target === "cgram" &&
                (i === 0
                    ? (byte.address & 1) !== 0
                    : byte.address !== effect.bytes[0].address + 1 || byte.value !== (access.value & 127))) ||
            (target === "oam" && i === count - 1 && byte.value !== access.value)) {
            throw new Error("Invalid native PPU byte destination or value.");
        }
        return { address: byte.address, value: byte.value };
    });
    return {
        target: effect.target,
        outcome: effect.outcome,
        forcedBlank: effect.forcedBlank,
        renderingRestricted: effect.renderingRestricted,
        implementation: effect.implementation,
        vramBytes: effect.vramBytes,
        bytes,
    };
};
//# sourceMappingURL=runtime-ppu-effect.js.map