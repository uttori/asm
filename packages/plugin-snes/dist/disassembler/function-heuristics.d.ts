import { type AnalysisProjectShards, type EvidenceRecord, type ProjectComment } from "@uttori/asm-disassembler";
export type SnesRoleConfidence = "high" | "medium" | "low";
export interface SnesRegisterRoleRule {
    readonly id: string;
    readonly role: string;
    readonly addresses: readonly number[];
    readonly access: "read" | "write";
    readonly confidence: SnesRoleConfidence;
}
/** Declarative rules only: no executable expressions from project configuration. */
export interface SnesHeuristicConfiguration {
    readonly enabled?: boolean;
    readonly minimumConfidence?: SnesRoleConfidence;
    readonly maxWindowInstructions?: number;
    readonly disabledRules?: readonly string[];
    readonly registerRules?: readonly SnesRegisterRoleRule[];
}
export interface SnesFunctionRole {
    readonly id: string;
    readonly rule: string;
    readonly role: string;
    readonly addressSpace: string;
    readonly address: number;
    readonly confidence: SnesRoleConfidence;
    readonly relationship: "direct" | "delegated";
    readonly instructions: readonly number[];
    readonly explanation: string;
    readonly evidence: readonly string[];
}
export interface SnesHeuristicResult {
    readonly roles: readonly SnesFunctionRole[];
    readonly comments: readonly ProjectComment[];
    readonly evidence: readonly EvidenceRecord[];
}
export declare const SNES_HEURISTIC_RULE_IDS: readonly [...string[], "observed-access", "apu-handshake", "apu-upload", "vblank-wait", "dma-destination", "display-fade", "mode7-setup", "block-copy", "wrapper"];
/**
 * Reject malformed configuration before changing any project files.
 * @param {unknown} value Untrusted configuration.
 * @returns {SnesHeuristicConfiguration} Validated configuration.
 */
export declare const validateSnesHeuristicConfiguration: (value: unknown) => SnesHeuristicConfiguration;
/**
 * Bounded structural matching. Never renames symbols or changes code/data classifications.
 * @param {AnalysisProjectShards} shards Persisted analysis and observations.
 * @param {SnesHeuristicConfiguration} options Declarative rule configuration.
 * @param {Iterable} [runtime] Optional streamed runtime observations.
 * @returns {SnesHeuristicResult} Findings and their comments/evidence.
 */
export declare const analyzeSnesFunctionRoles: (shards: AnalysisProjectShards, options?: SnesHeuristicConfiguration, runtime?: Iterable<AnalysisProjectShards["runtime"][number]>) => SnesHeuristicResult;
//# sourceMappingURL=function-heuristics.d.ts.map