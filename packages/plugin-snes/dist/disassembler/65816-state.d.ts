import type { StaticInstruction } from "@uttori/asm-disassembler";
import type { Cpu65816DecodeState } from "../architectures/65816-decoder.js";
/**
 * Three-way lattice used for every tracked 65816 register and flag.
 * `known` is an exact value, `unknown` has no evidence, and `conflicting`
 * records distinct known values that met at a CFG join.
 */
export type Cpu65816AbstractValue = {
    readonly kind: "known";
    readonly value: number;
} | {
    readonly kind: "unknown";
} | {
    readonly kind: "conflicting";
    readonly values: readonly number[];
};
/**
 * `PHP` snapshot of E/M/X/C restored by a later `PLP`.
 * Emulation (`e`) is included so `XCE` after `PLP` stays conservative.
 */
export interface Cpu65816StatusStackEntry {
    readonly kind: "status";
    /** Emulation flag at the matching `PHP`. */
    readonly e: Cpu65816AbstractValue;
    /** Accumulator-width flag at the matching `PHP` (1 = 8-bit). */
    readonly m: Cpu65816AbstractValue;
    /** Index-width flag at the matching `PHP` (1 = 8-bit). */
    readonly x: Cpu65816AbstractValue;
    /** Carry flag at the matching `PHP`; needed for `XCE`. */
    readonly carry: Cpu65816AbstractValue;
}
/** Register or immediate bytes pushed by `PHA`/`PHX`/`PHY`/`PHB`/`PHD`/`PEA`/`PEI`/`PER`. */
export interface Cpu65816ValueStackEntry {
    readonly kind: "value";
    /** Effect source id (`a`, `x`, `y`, `dbr`, `d`, `pbr`, or an immediate). */
    readonly source: string;
    /** Encoded width at the push; pull must use the same width. */
    readonly bytes: 1 | 2;
    /** Abstract payload; `unknown` when the source register is not tracked. */
    readonly value: Cpu65816AbstractValue;
}
/**
 * One abstract stack slot. `unknown` is a hole of known width when the
 * pushed value itself cannot be tracked (for example `PHA` with unknown M).
 */
export type Cpu65816StackEntry = Cpu65816StatusStackEntry | Cpu65816ValueStackEntry | {
    readonly kind: "unknown";
    readonly bytes: 1 | 2;
};
/**
 * Conservative stack prefix used by PHP/PLP and bank/page restores.
 * Only the top 16 entries are kept; anything deeper is dropped.
 */
export type Cpu65816AbstractStack = {
    readonly kind: "known";
    readonly entries: readonly Cpu65816StackEntry[];
} | {
    readonly kind: "unknown";
} | {
    readonly kind: "conflicting";
};
/**
 * Abstract 65816 CPU state consumed by decode and the static-analysis worklist.
 * Flag polarity matches hardware: M/X `1` is 8-bit, `0` is 16-bit. E=`1`
 * forces M=X=`1` after every transfer and join.
 */
export interface Cpu65816AbstractState {
    /** Emulation flag. */
    readonly e: Cpu65816AbstractValue;
    /** Accumulator/memory width (M). */
    readonly m: Cpu65816AbstractValue;
    /** Index width (X). */
    readonly x: Cpu65816AbstractValue;
    /** Carry; tracked because `XCE` swaps it with E. */
    readonly carry: Cpu65816AbstractValue;
    /** Program bank (K / PBR). */
    readonly pbr: Cpu65816AbstractValue;
    /** Data bank (DBR). */
    readonly dbr: Cpu65816AbstractValue;
    /** Direct page (D). */
    readonly d: Cpu65816AbstractValue;
    /** Stack pointer (S). */
    readonly s: Cpu65816AbstractValue;
    /** Abstract stack prefix used to restore P/DBR/D after PHP/PHB/PHD. */
    readonly stack: Cpu65816AbstractStack;
}
/**
 * Partial known-state overlay from a project annotation, label, or entry point.
 * Booleans are accepted as `true` for 1 and `false` for 0. Unspecified fields are left alone.
 */
export interface Cpu65816StateOverride {
    /** Emulation flag. */
    readonly e?: 0 | 1 | boolean;
    /** Accumulator/memory width (M); 1 = 8-bit. */
    readonly m?: 0 | 1 | boolean;
    /** Index width (X); 1 = 8-bit. */
    readonly x?: 0 | 1 | boolean;
    /** Carry; used with `XCE`. */
    readonly carry?: 0 | 1 | boolean;
    /** Program bank (PBR), masked to 8 bits. */
    readonly programBank?: number;
    /** Data bank (DBR), masked to 8 bits. */
    readonly dataBank?: number;
    /** Direct page (D), masked to 16 bits. */
    readonly directPage?: number;
    /** Stack pointer (S), masked to 16 bits. */
    readonly stackPointer?: number;
}
/**
 * Fully unknown state. Used when a seed has no hardware or annotation evidence.
 * @returns {Cpu65816AbstractState} Every register and the stack are `unknown`.
 */
export declare const unknownCpu65816State: () => Cpu65816AbstractState;
/**
 * Hardware RESET: emulation, 8-bit A/XY, PBR=DBR=0, D=0, S=$01FF, empty stack.
 * Carry is unknown. Matches the 65816 coming out of `/RESET`.
 * @returns {Cpu65816AbstractState} State for the `$00FFFC` RESET vector target.
 */
export declare const resetCpu65816State: () => Cpu65816AbstractState;
/**
 * Native-mode interrupt entry: E=0 and PBR=0; M/X/C/DBR/D/S/stack stay unknown.
 * @returns {Cpu65816AbstractState} State for native COP/BRK/ABORT/NMI/IRQ.
 */
export declare const nativeVectorCpu65816State: () => Cpu65816AbstractState;
/**
 * Emulation-mode interrupt entry: E=M=X=1 and PBR=0; C/DBR/D/S/stack stay unknown.
 * @returns {Cpu65816AbstractState} State for emulation COP/ABORT/NMI/IRQ/BRK.
 */
export declare const emulationVectorCpu65816State: () => Cpu65816AbstractState;
/**
 * Lattice join at a CFG merge. `unknown` absorbs; two distinct known values
 * become `conflicting`. E=1 still forces M=X=1 after the join.
 * @param {Cpu65816AbstractState} left Incoming state from one predecessor.
 * @param {Cpu65816AbstractState} right Incoming state from another predecessor.
 * @returns {Cpu65816AbstractState} The least upper bound of both states.
 */
export declare const joinCpu65816States: (left: Cpu65816AbstractState, right: Cpu65816AbstractState) => Cpu65816AbstractState;
/**
 * Overlays known fields from a project annotation or configured entry point.
 * Banks are masked to 8 bits; D and S are masked to 16 bits.
 * @param {Cpu65816AbstractState} state State to update.
 * @param {Cpu65816StateOverride} override Partial known values to apply.
 * @returns {Cpu65816AbstractState} Normalized state with the overlay applied.
 */
export declare const applyCpu65816StateOverride: (state: Cpu65816AbstractState, override: Cpu65816StateOverride) => Cpu65816AbstractState;
/**
 * Sets PBR from bits 23–16 of a 24-bit CPU address before decode at that PC.
 * @param {Cpu65816AbstractState} state Incoming state.
 * @param {number} address 24-bit SNES CPU address being entered.
 * @returns {Cpu65816AbstractState} `state` with PBR replaced.
 */
export declare const enterCpu65816Address: (state: Cpu65816AbstractState, address: number) => Cpu65816AbstractState;
/**
 * Projects the analysis lattice onto decoder flags. Known E/M/X become 0/1;
 * anything else is `"unknown"`. Known PBR/DBR/D are copied when present.
 * @param {Cpu65816AbstractState} state Analysis state at the instruction.
 * @returns {Cpu65816DecodeState} Decoder input; omitted banks/page stay unset.
 */
export declare const cpu65816DecodeState: (state: Cpu65816AbstractState) => Cpu65816DecodeState;
/**
 * Applies one instruction's decoded effects conservatively.
 * Tracks SEP/REP, PHP/PLP, PHB/PLB, PHD/PLD, XCE, and TCD/TCS; loses stack
 * precision on `BRK`/`COP`/`JSR`/`JSL` and when M/X width is unknown at a push/pull.
 * @param {StaticInstruction} instruction Normalized instruction from the worklist.
 * @param {Cpu65816AbstractState} input State immediately before the instruction.
 * @returns {Cpu65816AbstractState} Outgoing state after effects and E=1 forcing.
 */
export declare const transferCpu65816State: (instruction: StaticInstruction, input: Cpu65816AbstractState) => Cpu65816AbstractState;
/**
 * Stable worklist identity for a state. JSON order matches object insertion.
 * @param {Cpu65816AbstractState} state State to key.
 * @returns {string} Canonical JSON used as a CFG node context key.
 */
export declare const cpu65816StateKey: (state: Cpu65816AbstractState) => string;
//# sourceMappingURL=65816-state.d.ts.map