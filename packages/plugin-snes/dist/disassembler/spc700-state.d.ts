import type { StaticInstruction } from "@uttori/asm-disassembler";
import type { Spc700DecodeState } from "../architectures/spc700-decoder.js";
/** Abstract value for the PSW.P-selected direct-page base. */
export type Spc700DirectPageValue = {
    readonly kind: "known";
    readonly value: 0 | 0x100;
} | {
    readonly kind: "unknown";
} | {
    readonly kind: "conflicting";
    readonly values: readonly (0 | 0x100)[];
};
/** One explicitly pushed byte tracked above an unknown pre-analysis stack tail. */
export type Spc700StackEntry = {
    readonly kind: "status";
    readonly directPage: Spc700DirectPageValue;
} | {
    readonly kind: "unknown";
};
/** Conservative known stack prefix. Deeper pre-analysis bytes remain unknown. */
export interface Spc700AbstractStack {
    /** Most recently pushed byte first; capped at 16 entries. */
    readonly entries: readonly Spc700StackEntry[];
}
/** SPC700 state needed for direct-page address resolution. */
export interface Spc700AbstractState {
    /** Direct-page base selected by PSW.P. */
    readonly directPage: Spc700DirectPageValue;
    /** Tracked stack prefix used to restore PSW.P across `PUSH PSW`/`POP PSW`. */
    readonly stack: Spc700AbstractStack;
}
/** Explicit state overlay accepted on an SPC700 analysis entry point. */
export interface Spc700StateOverride {
    /** Known direct-page base; omitted leaves the incoming value. */
    readonly directPage?: 0 | 0x100;
}
/**
 * Fully unknown reset-independent SPC700 state.
 * @returns Unknown direct page with no tracked stack prefix.
 */
export declare const unknownSpc700State: () => Spc700AbstractState;
/**
 * Applies a manual direct-page overlay without changing the tracked stack prefix.
 * @param state Incoming state.
 * @param override Known values to overlay.
 * @returns Updated state.
 */
export declare const applySpc700StateOverride: (state: Spc700AbstractState, override: Spc700StateOverride) => Spc700AbstractState;
/**
 * Conservative lattice join at an SPC700 CFG merge.
 * @param left First incoming state.
 * @param right Second incoming state.
 * @returns Joined state.
 */
export declare const joinSpc700States: (left: Spc700AbstractState, right: Spc700AbstractState) => Spc700AbstractState;
/**
 * Stable serialization used by the generic worklist's fixed-point check.
 * @param state State to identify.
 * @returns Deterministic state key.
 */
export declare const spc700StateKey: (state: Spc700AbstractState) => string;
/**
 * Projects abstract PSW.P knowledge into the decoder's direct-page base.
 * @param state Abstract analysis state.
 * @returns Decoder input.
 */
export declare const spc700DecodeState: (state: Spc700AbstractState) => Spc700DecodeState;
/**
 * Applies declarative PSW and explicit PUSH/POP effects to SPC700 state.
 * @param instruction Decoded instruction and declarative effects.
 * @param incoming Incoming state.
 * @returns Outgoing state.
 */
export declare const transferSpc700State: (instruction: StaticInstruction, incoming: Spc700AbstractState) => Spc700AbstractState;
//# sourceMappingURL=spc700-state.d.ts.map