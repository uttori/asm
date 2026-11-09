/**
 * Creates the absorbing unknown direct-page value.
 * @returns Unknown direct page.
 */
const unknown = () => ({ kind: "unknown" });
/**
 * Wraps a concrete direct-page base.
 * @param value `$0000` or `$0100`.
 * @returns Known direct page.
 */
const known = (value) => ({ kind: "known", value });
/**
 * Fully unknown reset-independent SPC700 state.
 * @returns Unknown direct page with no tracked stack prefix.
 */
export const unknownSpc700State = () => ({
    directPage: unknown(),
    stack: { entries: [] },
});
/**
 * Applies a manual direct-page overlay without changing the tracked stack prefix.
 * @param state Incoming state.
 * @param override Known values to overlay.
 * @returns Updated state.
 */
export const applySpc700StateOverride = (state, override) => override.directPage === undefined ? state : { ...state, directPage: known(override.directPage) };
/**
 * Joins direct-page values: unknown wins; otherwise the union of candidate bases is
 * known when it has one member and conflicting, sorted ascending, when it has two.
 * @param left First incoming value.
 * @param right Second incoming value.
 * @returns Joined value.
 */
const joinDirectPage = (left, right) => {
    if (left.kind === "unknown" || right.kind === "unknown") {
        return unknown();
    }
    const values = new Set([
        ...(left.kind === "known" ? [left.value] : left.values),
        ...(right.kind === "known" ? [right.value] : right.values),
    ]);
    if (values.size === 1) {
        return known([...values][0]);
    }
    return { kind: "conflicting", values: [...values].toSorted((a, b) => a - b) };
};
/**
 * Structural equality for stack entries.
 * @param left First entry.
 * @param right Second entry.
 * @returns Whether both entries serialize identically.
 */
const sameStackEntry = (left, right) => JSON.stringify(left) === JSON.stringify(right);
/**
 * Keeps only the longest common top-of-stack prefix; deeper bytes become unknown.
 * @param left First incoming stack.
 * @param right Second incoming stack.
 * @returns Joined stack.
 */
const joinStack = (left, right) => {
    const entries = [];
    const length = Math.min(left.entries.length, right.entries.length);
    for (let index = 0; index < length; index++) {
        if (!sameStackEntry(left.entries[index], right.entries[index])) {
            break;
        }
        entries.push(left.entries[index]);
    }
    return { entries };
};
/**
 * Conservative lattice join at an SPC700 CFG merge.
 * @param left First incoming state.
 * @param right Second incoming state.
 * @returns Joined state.
 */
export const joinSpc700States = (left, right) => ({
    directPage: joinDirectPage(left.directPage, right.directPage),
    stack: joinStack(left.stack, right.stack),
});
/**
 * Stable serialization used by the generic worklist's fixed-point check.
 * @param state State to identify.
 * @returns Deterministic state key.
 */
export const spc700StateKey = (state) => JSON.stringify(state);
/**
 * Projects abstract PSW.P knowledge into the decoder's direct-page base.
 * @param state Abstract analysis state.
 * @returns Decoder input.
 */
export const spc700DecodeState = (state) => ({
    directPage: state.directPage.kind === "known" ? state.directPage.value : "unknown",
});
/**
 * Pushes one tracked byte, discarding entries beyond the 16-entry prefix bound.
 * @param state Incoming state.
 * @param entry Pushed byte.
 * @returns State with the new top entry.
 */
const push = (state, entry) => ({
    ...state,
    stack: { entries: [entry, ...state.stack.entries].slice(0, 16) },
});
/**
 * Pops the top tracked byte.
 * @param state Incoming state.
 * @returns Remaining state and the popped entry, `undefined` when the prefix was empty.
 */
const pop = (state) => [
    { ...state, stack: { entries: state.stack.entries.slice(1) } },
    state.stack.entries[0],
];
/**
 * Applies declarative PSW and explicit PUSH/POP effects to SPC700 state.
 * @param instruction Decoded instruction and declarative effects.
 * @param incoming Incoming state.
 * @returns Outgoing state.
 */
export const transferSpc700State = (instruction, incoming) => {
    const state = { ...incoming };
    for (const effect of instruction.effects) {
        if (effect.kind === "clearBits" && effect.target === "p" && (effect.mask & 0x20) !== 0) {
            Object.assign(state, { directPage: known(0) });
        }
        else if (effect.kind === "setBits" && effect.target === "p" && (effect.mask & 0x20) !== 0) {
            Object.assign(state, { directPage: known(0x100) });
        }
        else if (effect.kind === "push") {
            Object.assign(state, push(state, instruction.mode === "registerP"
                ? { kind: "status", directPage: state.directPage }
                : { kind: "unknown" }));
        }
        else if (effect.kind === "pull" && effect.target === "operand-register") {
            const [popped, entry] = pop(state);
            Object.assign(state, popped);
            if (instruction.mode === "registerP") {
                Object.assign(state, {
                    directPage: entry?.kind === "status" ? entry.directPage : unknown(),
                });
            }
        }
        else if (effect.kind === "pull" && effect.target === "p") {
            Object.assign(state, { directPage: unknown(), stack: { entries: [] } });
        }
    }
    return state;
};
//# sourceMappingURL=spc700-state.js.map