import type { DecodedInstruction } from "@uttori/asm-core";
import type { SuperFxDecodeState } from "../architectures/superfx-decoder.js";
import { type SuperFxAltState } from "../architectures/superfx-spec.js";
/**
 * Lattice value for one tracked GSU register. `unknown` absorbs everything in a join;
 * `conflict` records that incoming paths disagreed on otherwise known values.
 */
export type SuperFxKnown<T extends number> = {
    readonly kind: "known";
    readonly value: T;
} | {
    readonly kind: "unknown";
} | {
    readonly kind: "conflict";
};
/** GSU prefix and bank state that changes how the next opcode decodes. */
export interface SuperFxAbstractState {
    /** ALT1/ALT2 prefix bits pending for the next instruction. */
    readonly alt: SuperFxKnown<SuperFxAltState>;
    /** Register selected by `TO`/`WITH`; reset to R0 after every non-prefix instruction. */
    readonly destinationRegister: SuperFxKnown<number>;
    /** Register selected by `FROM`/`WITH`; reset to R0 after every non-prefix instruction. */
    readonly sourceRegister: SuperFxKnown<number>;
    /** 8-bit PBR bank used for program fetches. */
    readonly programBank: SuperFxKnown<number>;
}
/**
 * Prefix-free GSU entry state: no ALT bits and R0 as both source and destination.
 * @param programBank Optional entry bank, masked to 8 bits; unknown when omitted.
 * @returns Entry state.
 */
export declare const initialSuperFxState: (programBank?: number) => SuperFxAbstractState;
/**
 * Conservative lattice join at a GSU CFG merge, applied per tracked register.
 * @param left First incoming state.
 * @param right Second incoming state.
 * @returns Joined state.
 */
export declare const joinSuperFxStates: (left: SuperFxAbstractState, right: SuperFxAbstractState) => SuperFxAbstractState;
/**
 * Projects abstract GSU state into decoder input.
 * @param state Abstract analysis state.
 * @returns Decoder input.
 */
export declare const superFxDecodeState: (state: SuperFxAbstractState) => SuperFxDecodeState;
/**
 * Sets the program bank from a 24-bit entry or branch target, keeping prefix state.
 * @param state Incoming state.
 * @param address 24-bit GSU address being entered.
 * @returns State with a known program bank.
 */
export declare const enterSuperFxAddress: (state: SuperFxAbstractState, address: number) => SuperFxAbstractState;
/**
 * Applies one GSU instruction. Prefix opcodes accumulate ALT bits or select registers;
 * any other instruction consumes the prefixes and resets ALT, source and destination to 0.
 * An ALT prefix leaves unknown or conflicting incoming ALT state unchanged.
 * @param instruction Decoded instruction effects.
 * @param state Incoming state.
 * @returns Outgoing state.
 */
export declare const transferSuperFxState: (instruction: Pick<DecodedInstruction, "effects">, state: SuperFxAbstractState) => SuperFxAbstractState;
/**
 * Stable serialization used by the generic worklist's fixed-point check.
 * @param state State to identify.
 * @returns Deterministic state key.
 */
export declare const superFxStateKey: (state: SuperFxAbstractState) => string;
//# sourceMappingURL=superfx-state.d.ts.map