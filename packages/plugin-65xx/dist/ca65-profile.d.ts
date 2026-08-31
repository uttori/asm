import { type SyntaxProfile, type SyntaxRewriteContext } from "@uttori/asm-core";
import type { SessionStateKey } from "@uttori/asm-core/plugin";
/** Plugin-owned state for ca65 CPU, scope, and flat-segment stacks. */
export interface Ca65SessionState {
    defaultArchitecture: string;
    currentArchitecture: string;
    cpuStack: string[];
    scopeStack: string[];
    segmentStack: string[];
    currentFlatSegment: string;
}
export declare const CA65_65XX_SESSION_STATE_ID = "65xx.ca65-session-state";
export declare const ca65SessionStateKey: SessionStateKey<Ca65SessionState>;
export declare function createCa65SessionState(): Ca65SessionState;
export declare function cloneCa65SessionState(state: Ca65SessionState): Ca65SessionState;
export declare function resetCa65StageState(state: Ca65SessionState): void;
/** ca65 spelling → canonical 65xx architecture identity. */
export declare const ca65CpuNames: Readonly<Record<string, string>>;
export declare function resolve65xxCpuName(name: string): string | undefined;
/** ca65 CPU shorthand directives. */
export declare const ca65CpuShorthands: Readonly<Record<string, string>>;
export declare const ca65CpuPredicateByArchitecture: Readonly<Record<string, string>>;
/**
 * Rewrites structural ca65 syntax into target-neutral core forms.
 * @param {string} command The source command.
 * @param {SyntaxRewriteContext} context Source location metadata.
 * @returns {string} The target-neutral command.
 */
export declare function rewriteCa65Command(command: string, context: SyntaxRewriteContext): string;
/** 65xx-owned ca65 source profile layered on the neutral core contract. */
export declare const CA65_65XX_SYNTAX_PROFILE: SyntaxProfile;
//# sourceMappingURL=ca65-profile.d.ts.map