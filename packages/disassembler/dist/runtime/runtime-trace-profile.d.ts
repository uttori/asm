import type { RuntimeStateValue } from "../model/project-types.js";
/** Versioned working-index contract: joint bytes and the inputs consumed by native 65816 decoding. */
export declare const RUNTIME_ANALYSIS_PROFILE = "65816-analysis-v2";
/**
 * Normalize aliases and unknowns exactly as native runtime decoding does. P contributes only M/X.
 * Emulation mode forces both widths. Program bank comes from the qualified instruction address.
 * A/X/Y/S, flags unrelated to width, and redundant PB/PC remain optional archive detail.
 * @param {Readonly<Record<string, RuntimeStateValue>>} state Original joint register observation.
 * @returns {Record<string, RuntimeStateValue>} Fresh canonical decoder inputs. Omitted fields remain unknown.
 */
export declare const project65816AnalysisState: (state: Readonly<Record<string, RuntimeStateValue>>) => Record<string, RuntimeStateValue>;
//# sourceMappingURL=runtime-trace-profile.d.ts.map