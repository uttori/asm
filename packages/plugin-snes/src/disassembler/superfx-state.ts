import type { DecodedInstruction } from "@uttori/asm-core";

import type { SuperFxDecodeState } from "../architectures/superfx-decoder.js";
import { isSuperFxAltState, type SuperFxAltState } from "../architectures/superfx-spec.js";

/**
 * Lattice value for one tracked GSU register. `unknown` absorbs everything in a join;
 * `conflict` records that incoming paths disagreed on otherwise known values.
 */
export type SuperFxKnown<T extends number> =
  | { readonly kind: "known"; readonly value: T }
  | { readonly kind: "unknown" }
  | { readonly kind: "conflict" };

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
 * Wraps a concrete register value.
 * @param value Known value.
 * @returns Known lattice value.
 */
const known = <T extends number>(value: T): SuperFxKnown<T> => ({ kind: "known", value });
/**
 * Creates the absorbing unknown lattice value.
 * @returns Unknown lattice value.
 */
const unknown = <T extends number>(): SuperFxKnown<T> => ({ kind: "unknown" });

/**
 * Prefix-free GSU entry state: no ALT bits and R0 as both source and destination.
 * @param programBank Optional entry bank, masked to 8 bits; unknown when omitted.
 * @returns Entry state.
 */
export const initialSuperFxState = (programBank?: number): SuperFxAbstractState => ({
  alt: known(0),
  destinationRegister: known(0),
  sourceRegister: known(0),
  programBank: programBank === undefined ? unknown() : known(programBank & 0xff),
});

/**
 * Joins one register value: unknown wins, then conflict, and differing known values conflict.
 * @param left First incoming value.
 * @param right Second incoming value.
 * @returns Joined value.
 */
const joinValue = <T extends number>(
  left: SuperFxKnown<T>,
  right: SuperFxKnown<T>,
): SuperFxKnown<T> => {
  if (left.kind === "unknown" || right.kind === "unknown") {
    return { kind: "unknown" };
  }
  if (left.kind === "conflict" || right.kind === "conflict") {
    return { kind: "conflict" };
  }
  return left.value === right.value ? left : { kind: "conflict" };
};

/**
 * Conservative lattice join at a GSU CFG merge, applied per tracked register.
 * @param left First incoming state.
 * @param right Second incoming state.
 * @returns Joined state.
 */
export const joinSuperFxStates = (
  left: SuperFxAbstractState,
  right: SuperFxAbstractState,
): SuperFxAbstractState => ({
  alt: joinValue(left.alt, right.alt),
  destinationRegister: joinValue(left.destinationRegister, right.destinationRegister),
  sourceRegister: joinValue(left.sourceRegister, right.sourceRegister),
  programBank: joinValue(left.programBank, right.programBank),
});

/**
 * Collapses unknown and conflicting values into the decoder's `"unknown"` marker.
 * @param value Lattice value.
 * @returns Concrete value or `"unknown"`.
 */
const decodeValue = <T extends number>(value: SuperFxKnown<T>): T | "unknown" =>
  value.kind === "known" ? value.value : "unknown";

/**
 * Projects abstract GSU state into decoder input.
 * @param state Abstract analysis state.
 * @returns Decoder input.
 */
export const superFxDecodeState = (state: SuperFxAbstractState): SuperFxDecodeState => ({
  alt: decodeValue(state.alt),
  destinationRegister: decodeValue(state.destinationRegister),
  sourceRegister: decodeValue(state.sourceRegister),
  programBank: decodeValue(state.programBank),
});

/**
 * Sets the program bank from a 24-bit entry or branch target, keeping prefix state.
 * @param state Incoming state.
 * @param address 24-bit GSU address being entered.
 * @returns State with a known program bank.
 */
export const enterSuperFxAddress = (
  state: SuperFxAbstractState,
  address: number,
): SuperFxAbstractState => ({ ...state, programBank: known((address >>> 16) & 0xff) });

/**
 * Reads the numeric `register` or `alt` detail of a named custom decoder effect.
 * @param instruction Instruction effects.
 * @param name Custom effect name.
 * @returns Detail value, or `undefined` when the effect or a numeric detail is absent.
 */
const detailNumber = (
  instruction: Pick<DecodedInstruction, "effects">,
  name: string,
): number | undefined => {
  const effect = instruction.effects.find(
    (entry) => entry.kind === "custom" && entry.name === name,
  );
  if (effect?.kind !== "custom") {
    return undefined;
  }
  const value = effect.details?.register ?? effect.details?.alt;
  return typeof value === "number" ? value : undefined;
};

/**
 * Applies one GSU instruction. Prefix opcodes accumulate ALT bits or select registers;
 * any other instruction consumes the prefixes and resets ALT, source and destination to 0.
 * An ALT prefix leaves unknown or conflicting incoming ALT state unchanged.
 * @param instruction Decoded instruction effects.
 * @param state Incoming state.
 * @returns Outgoing state.
 */
export const transferSuperFxState = (
  instruction: Pick<DecodedInstruction, "effects">,
  state: SuperFxAbstractState,
): SuperFxAbstractState => {
  const alt = detailNumber(instruction, "set-superfx-alt");
  if (alt !== undefined) {
    if (state.alt.kind !== "known") {
      return { ...state, alt: state.alt };
    }
    const masked = (state.alt.value | alt) & 3;
    if (!isSuperFxAltState(masked)) {
      return { ...state, alt: state.alt };
    }
    return { ...state, alt: known(masked) };
  }
  const destination = detailNumber(instruction, "select-superfx-destination");
  if (destination !== undefined) {
    return { ...state, destinationRegister: known(destination) };
  }
  const paired = detailNumber(instruction, "select-superfx-source-destination");
  if (paired !== undefined) {
    return {
      ...state,
      destinationRegister: known(paired),
      sourceRegister: known(paired),
    };
  }
  const source = detailNumber(instruction, "select-superfx-source");
  if (source !== undefined) {
    return { ...state, sourceRegister: known(source) };
  }
  return {
    ...state,
    alt: known(0),
    destinationRegister: known(0),
    sourceRegister: known(0),
  };
};

/**
 * Stable serialization used by the generic worklist's fixed-point check.
 * @param state State to identify.
 * @returns Deterministic state key.
 */
export const superFxStateKey = (state: SuperFxAbstractState): string =>
  JSON.stringify([state.alt, state.destinationRegister, state.sourceRegister, state.programBank]);
