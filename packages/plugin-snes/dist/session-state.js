/** Plugin-owned session slot id. Keep in sync with the contribution in `index.ts`. */
export const SNES_SESSION_STATE_ID = "snes.session-state";
/**
 * Attaches the compile-time session-state brand. The brand is not a runtime property;
 * a non-empty id is the only value `SessionStateStore` reads.
 * @param {{ readonly id: string }} value Key candidate.
 * @returns {boolean} True when the id can identify a session slot.
 */
function isSessionStateKey(value) {
    return value.id.length > 0;
}
/**
 * Builds the branded SNES session slot key.
 * @param {string} id Plugin-owned slot id.
 * @returns {SessionStateKey<T>} Key for `SessionStateStore.get`.
 */
function createSessionStateKey(id) {
    const key = { id };
    if (!isSessionStateKey(key)) {
        throw new Error(`Invalid session state key '${id}'.`);
    }
    return key;
}
/** Branded key for `SessionStateStore.get`. The brand is compile-time only. */
export const snesSessionStateKey = createSessionStateKey(SNES_SESSION_STATE_ID);
/**
 * Deep-clones mutable nested fields so parallel/pass clones cannot share banks
 * or an open SPC block.
 * @param {SnesSessionState} value The session state to clone.
 * @returns {SnesSessionState} A deep-cloned session state.
 */
export function cloneSnesSessionState(value) {
    return {
        ...value,
        sa1Banks: [...value.sa1Banks],
        spcBlock: value.spcBlock ? { ...value.spcBlock } : null,
        cpuStack: [...value.cpuStack],
    };
}
//# sourceMappingURL=session-state.js.map