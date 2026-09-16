/** Plugin-owned session slot id. Keep in sync with the contribution in `index.ts`. */
export const SNES_SESSION_STATE_ID = "snes.session-state";
/**
 * Branded key for `SessionStateStore.get`. The brand is compile-time only.
 */
export const snesSessionStateKey = {
    id: SNES_SESSION_STATE_ID,
};
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