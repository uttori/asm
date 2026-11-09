import { isSuperFxAltState } from "../architectures/superfx-spec.js";
/**
 * Wraps a concrete register value.
 * @param value Known value.
 * @returns Known lattice value.
 */
const known = (value) => ({ kind: "known", value });
/**
 * Creates the absorbing unknown lattice value.
 * @returns Unknown lattice value.
 */
const unknown = () => ({ kind: "unknown" });
/**
 * Prefix-free GSU entry state: no ALT bits and R0 as both source and destination.
 * @param programBank Optional entry bank, masked to 8 bits; unknown when omitted.
 * @returns Entry state.
 */
export const initialSuperFxState = (programBank) => ({
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
const joinValue = (left, right) => {
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
export const joinSuperFxStates = (left, right) => ({
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
const decodeValue = (value) => value.kind === "known" ? value.value : "unknown";
/**
 * Projects abstract GSU state into decoder input.
 * @param state Abstract analysis state.
 * @returns Decoder input.
 */
export const superFxDecodeState = (state) => ({
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
export const enterSuperFxAddress = (state, address) => ({ ...state, programBank: known((address >>> 16) & 0xff) });
/**
 * Reads the numeric `register` or `alt` detail of a named custom decoder effect.
 * @param instruction Instruction effects.
 * @param name Custom effect name.
 * @returns Detail value, or `undefined` when the effect or a numeric detail is absent.
 */
const detailNumber = (instruction, name) => {
    const effect = instruction.effects.find((entry) => entry.kind === "custom" && entry.name === name);
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
export const transferSuperFxState = (instruction, state) => {
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
export const superFxStateKey = (state) => JSON.stringify([state.alt, state.destinationRegister, state.sourceRegister, state.programBank]);
//# sourceMappingURL=superfx-state.js.map