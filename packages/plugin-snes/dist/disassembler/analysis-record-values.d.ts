import type { StaticAnalysisIncompleteReason, StaticCoverageSummary, StaticEffectiveAddress } from "@uttori/asm-disassembler";
import type { Cpu65816AbstractState } from "./65816-state.js";
import type { Spc700AbstractState } from "./spc700-state.js";
import type { SuperFxAbstractState } from "./superfx-state.js";
/**
 * Copies 65816 abstract state into an analysis-record field.
 * @param state Incoming or outgoing analyzer state.
 * @returns Plain record of the tracked fields.
 */
export declare function cpu65816StateRecord(state: Cpu65816AbstractState): Readonly<Record<string, unknown>>;
/**
 * Copies SPC700 abstract state into an analysis-record field.
 * @param state Incoming or outgoing analyzer state.
 * @returns Plain record of the tracked fields.
 */
export declare function spc700StateRecord(state: Spc700AbstractState): Readonly<Record<string, unknown>>;
/**
 * Copies SuperFX abstract state into an analysis-record field.
 * @param state Incoming or outgoing analyzer state.
 * @returns Plain record of the tracked fields.
 */
export declare function superFxStateRecord(state: SuperFxAbstractState): Readonly<Record<string, unknown>>;
/**
 * Copies coverage counters into the summary record.
 * @param coverage Worklist coverage.
 * @returns Plain numeric record.
 */
export declare function coverageRecord(coverage: StaticCoverageSummary): Readonly<Record<string, number>>;
/**
 * Copies effective addresses into analysis-record fields.
 * @param addresses Memory operands for one instruction.
 * @returns Plain records in the same order.
 */
export declare function effectiveAddressRecords(addresses: readonly StaticEffectiveAddress[]): readonly Readonly<Record<string, unknown>>[];
/**
 * Copies incomplete reasons into the summary record.
 * @param reasons Worklist stop reasons.
 * @returns Plain records in the same order.
 */
export declare function incompleteReasonRecords(reasons: readonly StaticAnalysisIncompleteReason[]): readonly Readonly<Record<string, unknown>>[];
//# sourceMappingURL=analysis-record-values.d.ts.map