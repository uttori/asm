import type { RuntimeStateValue } from "../model/project-types.js";
/** Versioned retention contract: paired opcode bytes, decoder state, exact counts and memory facts. */
export declare const SNES_ANALYSIS_TRACE_PROFILE = "65816-analysis-v3";
/** Aliases remain distinct so missing, invalid and conflicting values keep decoder fallback behavior. */
export declare const SNES_ANALYSIS_STATE_FIELDS: readonly ["p", "P", "e", "E", "db", "DB", "d", "D"];
/** Non-width P flags do not change instruction decoding or captured-code identities. */
export declare const SNES_ANALYSIS_STATE_MASKS: {
    readonly p: {
        readonly max: 255;
        readonly mask: 48;
    };
    readonly P: {
        readonly max: 255;
        readonly mask: 48;
    };
};
/**
 * Project a SNES snapshot before indexing. Input hashing still covers the original full snapshot.
 * Only valid integer P values are masked; malformed or unknown values must reach decoder fallbacks.
 */
export declare function snesAnalysisTraceState(state: Readonly<Record<string, RuntimeStateValue>>): Readonly<Record<string, RuntimeStateValue>>;
//# sourceMappingURL=runtime-analysis-profile.d.ts.map