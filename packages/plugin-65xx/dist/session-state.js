/** Plugin-owned session slot id. Keep in sync with the contribution in `index.ts`. */
export const NES_65XX_SESSION_STATE_ID = "65xx.nes-session-state";
/**
 * Branded key for `SessionStateStore.get`. The brand is compile-time only.
 */
export const nes65xxSessionStateKey = {
    id: NES_65XX_SESSION_STATE_ID,
};
/**
 * Deep-clones mutable nested fields so pass clones cannot share cursors.
 * @param {Nes65xxSessionState} value The session state to clone.
 * @returns {Nes65xxSessionState} A deep-cloned session state.
 */
export function cloneNes65xxSessionState(value) {
    return {
        ...value,
        header: [...value.header],
        memoryCursors: { ...value.memoryCursors },
    };
}
/**
 * Resets per-stage allocation so `.segment` walks MEMORY from the start again.
 * @param {Nes65xxSessionState} state Mutable NES session state.
 * @returns {void}
 */
export function resetNes65xxStageState(state) {
    state.memoryCursors = {};
    for (const memory of state.linker.memories.values()) {
        state.memoryCursors[memory.name] = memory.start;
    }
    state.currentSegment = null;
    state.currentLoadMemory = null;
    state.segmentLoadStart = 0;
    state.segmentRunStart = 0;
}
//# sourceMappingURL=session-state.js.map