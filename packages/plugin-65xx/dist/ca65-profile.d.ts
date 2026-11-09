import { type SyntaxProfile, type SyntaxRewriteContext } from "@uttori/asm-core";
import type { SessionStateKey } from "@uttori/asm-core/plugin";
/** Plugin-owned state for ca65 CPU, scope, and flat-segment stacks. */
export interface Ca65SessionState {
    /** Architecture id restored at the start of every assembly stage. */
    defaultArchitecture: string;
    /** Architecture id selected by the most recent `.setcpu`/shorthand directive. */
    currentArchitecture: string;
    /** Architecture ids saved by `.pushcpu`, innermost last. */
    cpuStack: string[];
    /** Enclosing namespaces saved on `.scope`/`.proc` entry, innermost last. */
    scopeStack: string[];
    /** Flat segment names saved by `.pushseg`, innermost last. */
    segmentStack: string[];
    /** Name of the active flat-image `.segment`; empty before any segment is selected. */
    currentFlatSegment: string;
}
/** Session-state slot id owned by the 65xx ca65 profile. */
export declare const CA65_65XX_SESSION_STATE_ID = "65xx.ca65-session-state";
/** Typed key for the shared ca65 session-state slot. */
export declare const ca65SessionStateKey: SessionStateKey<Ca65SessionState>;
/**
 * Creates fresh ca65 state targeting the NMOS 6502 with empty stacks.
 * @returns New mutable session state.
 */
export declare function createCa65SessionState(): Ca65SessionState;
/**
 * Copies ca65 state so the clone's stacks can be mutated independently.
 * @param state State to copy.
 * @returns Clone with fresh stack arrays.
 */
export declare function cloneCa65SessionState(state: Ca65SessionState): Ca65SessionState;
/**
 * Restores the default CPU and clears scope, segment, and CPU stacks before a new stage.
 * @param state State to reset in place.
 */
export declare function resetCa65StageState(state: Ca65SessionState): void;
/** ca65 spelling → canonical 65xx architecture identity. */
export declare const ca65CpuNames: Readonly<Record<string, string>>;
/**
 * Resolves a ca65 CPU spelling case-insensitively, ignoring surrounding whitespace.
 * @param name ca65 CPU name such as `65C02`.
 * @returns Canonical architecture id, or undefined when ca65 has no such CPU.
 */
export declare function resolve65xxCpuName(name: string): string | undefined;
/** ca65 CPU shorthand directives. */
export declare const ca65CpuShorthands: Readonly<Record<string, string>>;
/** Canonical architecture id → ca65 `__CA65_CPU_*__` predicate symbol defined for that CPU; 2A03 shares the 6502X symbol. */
export declare const ca65CpuPredicateByArchitecture: Readonly<Record<string, string>>;
/**
 * Rewrites structural ca65 syntax into target-neutral core forms.
 * @param command The source command.
 * @param context Source location metadata.
 * @returns The target-neutral command.
 */
export declare function rewriteCa65Command(command: string, context: SyntaxRewriteContext): string;
/** 65xx-owned ca65 source profile layered on the neutral core contract. */
export declare const CA65_65XX_SYNTAX_PROFILE: SyntaxProfile;
//# sourceMappingURL=ca65-profile.d.ts.map