/** Versioned retention contract: paired opcode bytes, decoder state, exact counts and memory facts. */
export const SNES_ANALYSIS_TRACE_PROFILE = "65816-analysis-v3";
/** Aliases remain distinct so missing, invalid and conflicting values keep decoder fallback behavior. */
export const SNES_ANALYSIS_STATE_FIELDS = ["p", "P", "e", "E", "db", "DB", "d", "D"];
/** Non-width P flags do not change instruction decoding or captured-code identities. */
export const SNES_ANALYSIS_STATE_MASKS = {
    p: { max: 255, mask: 0x30 },
    P: { max: 255, mask: 0x30 },
};
/**
 * Project a SNES snapshot before indexing. Input hashing still covers the original full snapshot.
 * Only valid integer P values are masked; malformed or unknown values must reach decoder fallbacks.
 */
export function snesAnalysisTraceState(state) {
    const result = {};
    for (const field of SNES_ANALYSIS_STATE_FIELDS) {
        if (!Object.hasOwn(state, field)) {
            continue;
        }
        const value = state[field];
        if ((field === "p" || field === "P") &&
            typeof value === "number" &&
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 255) {
            result[field] = value & 0x30;
        }
        else {
            result[field] = value;
        }
    }
    return result;
}
//# sourceMappingURL=runtime-analysis-profile.js.map