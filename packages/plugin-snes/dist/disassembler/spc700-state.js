const unknown = () => ({ kind: "unknown" });
const known = (value) => ({ kind: "known", value });
/**
 * Fully unknown reset-independent SPC700 state.
 * @returns {Spc700AbstractState} Unknown direct page with no tracked stack prefix.
 */
export const unknownSpc700State = () => ({
    directPage: unknown(),
    stack: { entries: [] },
});
/**
 * Applies a manual direct-page overlay without changing the tracked stack prefix.
 * @param {Spc700AbstractState} state Incoming state.
 * @param {Spc700StateOverride} override Known values to overlay.
 * @returns {Spc700AbstractState} Updated state.
 */
export const applySpc700StateOverride = (state, override) => override.directPage === undefined ? state : { ...state, directPage: known(override.directPage) };
const joinDirectPage = (left, right) => {
    if (left.kind === "unknown" || right.kind === "unknown")
        return unknown();
    const values = new Set([
        ...(left.kind === "known" ? [left.value] : left.values),
        ...(right.kind === "known" ? [right.value] : right.values),
    ]);
    if (values.size === 1)
        return known([...values][0]);
    return { kind: "conflicting", values: [...values].sort((a, b) => a - b) };
};
const sameStackEntry = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const joinStack = (left, right) => {
    const entries = [];
    const length = Math.min(left.entries.length, right.entries.length);
    for (let index = 0; index < length; index++) {
        if (!sameStackEntry(left.entries[index], right.entries[index]))
            break;
        entries.push(left.entries[index]);
    }
    return { entries };
};
/**
 * Conservative lattice join at an SPC700 CFG merge.
 * @param {Spc700AbstractState} left First incoming state.
 * @param {Spc700AbstractState} right Second incoming state.
 * @returns {Spc700AbstractState} Joined state.
 */
export const joinSpc700States = (left, right) => ({
    directPage: joinDirectPage(left.directPage, right.directPage),
    stack: joinStack(left.stack, right.stack),
});
/**
 * Stable serialization used by the generic worklist's fixed-point check.
 * @param {Spc700AbstractState} state State to identify.
 * @returns {string} Deterministic state key.
 */
export const spc700StateKey = (state) => JSON.stringify(state);
/**
 * Projects abstract PSW.P knowledge into the decoder's direct-page base.
 * @param {Spc700AbstractState} state Abstract analysis state.
 * @returns {Spc700DecodeState} Decoder input.
 */
export const spc700DecodeState = (state) => ({
    directPage: state.directPage.kind === "known" ? state.directPage.value : "unknown",
});
const push = (state, entry) => ({
    ...state,
    stack: { entries: [entry, ...state.stack.entries].slice(0, 16) },
});
const pop = (state) => [
    { ...state, stack: { entries: state.stack.entries.slice(1) } },
    state.stack.entries[0],
];
/**
 * Applies declarative PSW and explicit PUSH/POP effects to SPC700 state.
 * @param {StaticInstruction} instruction Decoded instruction and declarative effects.
 * @param {Spc700AbstractState} incoming Incoming state.
 * @returns {Spc700AbstractState} Outgoing state.
 */
export const transferSpc700State = (instruction, incoming) => {
    let state = incoming;
    for (const effect of instruction.effects) {
        if (effect.kind === "clearBits" && effect.target === "p" && (effect.mask & 0x20) !== 0) {
            state = { ...state, directPage: known(0) };
        }
        else if (effect.kind === "setBits" && effect.target === "p" && (effect.mask & 0x20) !== 0) {
            state = { ...state, directPage: known(0x100) };
        }
        else if (effect.kind === "push") {
            state = push(state, instruction.mode === "registerP"
                ? { kind: "status", directPage: state.directPage }
                : { kind: "unknown" });
        }
        else if (effect.kind === "pull" && effect.target === "operand-register") {
            const [popped, entry] = pop(state);
            state =
                instruction.mode === "registerP"
                    ? {
                        ...popped,
                        directPage: entry?.kind === "status" ? entry.directPage : unknown(),
                    }
                    : popped;
        }
        else if (effect.kind === "pull" && effect.target === "p") {
            state = { ...state, directPage: unknown(), stack: { entries: [] } };
        }
    }
    return state;
};
//# sourceMappingURL=spc700-state.js.map