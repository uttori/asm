/** Narrow parsed JSON to a plain object record. */
function record(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Accept only boolean flags and bounded register widths for 65816 assumptions. */
function is65816(value) {
    return Object.entries(value).every(([field, item]) => {
        if (["e", "m", "x", "carry"].includes(field)) {
            return typeof item === "boolean";
        }
        const maximum = field === "programBank" || field === "dataBank" ? 255 : 65535;
        return (["programBank", "dataBank", "directPage", "stackPointer"].includes(field) &&
            typeof item === "number" &&
            Number.isInteger(item) &&
            item >= 0 &&
            item <= maximum);
    });
}
/**
 * Interpret an owned, versioned target payload from the architecture-tagged storage representation.
 * Storage remains compact and existing evidence keeps its identity; unknown/nonmatching fields fail
 * before target analysis. The returned state is copied and frozen, never a borrowed mutable map.
 */
export function readAnalysisTargetState(architecture, value) {
    if (value === undefined) {
        return undefined;
    }
    if (!record(value)) {
        throw new Error("Invalid target state: expected a register map.");
    }
    if (architecture === "snes.65816" && is65816(value)) {
        return { codec: architecture, version: 1, state: Object.freeze({ ...value }) };
    }
    if (architecture === "snes.spc700" &&
        Object.keys(value).every((key) => key === "directPage") &&
        (value.directPage === undefined || value.directPage === 0 || value.directPage === 256)) {
        return {
            codec: architecture,
            version: 1,
            state: Object.freeze(value.directPage === undefined ? {} : { directPage: value.directPage }),
        };
    }
    if (architecture === "65xx.2a03" &&
        Object.keys(value).every((key) => key === "carry") &&
        (value.carry === undefined || typeof value.carry === "boolean")) {
        return {
            codec: architecture,
            version: 1,
            state: Object.freeze(value.carry === undefined ? {} : { carry: value.carry }),
        };
    }
    // Empty annotations carry no assumptions and remain usable for other registered architectures.
    if (Object.keys(value).length === 0) {
        return undefined;
    }
    throw new Error(`Invalid state fields for architecture '${architecture}'.`);
}
//# sourceMappingURL=target-state.js.map