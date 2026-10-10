const record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const unsigned = (value) => Number.isSafeInteger(value) && Number(value) >= 0;
const name = (value) => typeof value === "string" && /^[A-Za-z][\w.-]{0,63}$/.test(value);
/** Validate target-neutral storage facts at every import and decode boundary. */
export function isRuntimeGraphicsFact(value) {
    if (!record(value) ||
        !name(value.addressSpace) ||
        !unsigned(value.address) ||
        !unsigned(value.pc) ||
        !name(value.actor) ||
        (value.context !== "instruction" &&
            value.context !== "interrupt" &&
            value.context !== "unattributed") ||
        (value.direction !== "read" && value.direction !== "write") ||
        !unsigned(value.value) ||
        value.value > 255) {
        return false;
    }
    if (value.cpuMapping !== null &&
        (!record(value.cpuMapping) ||
            !name(value.cpuMapping.offsetStateField) ||
            !unsigned(value.cpuMapping.physicalOffset))) {
        return false;
    }
    if (value.effect === null) {
        return true;
    }
    const effect = value.effect;
    if (!record(effect) ||
        !name(effect.target) ||
        value.direction !== "write" ||
        !Array.isArray(effect.bytes) ||
        effect.bytes.length > 16) {
        return false;
    }
    if (effect.outcome === "blocked") {
        return effect.bytes.length === 0;
    }
    return (effect.outcome === "written" &&
        effect.bytes.length > 0 &&
        effect.bytes.every((byte) => record(byte) && unsigned(byte.offset) && unsigned(byte.value) && byte.value <= 255));
}
//# sourceMappingURL=runtime-graphics-fact.js.map