/** Plugin-owned session slot id. Keep in sync with the contribution in `index.ts`. */
export const NES_65XX_SESSION_STATE_ID = "65xx.nes-session-state";
/**
 * Attaches the compile-time session-state brand. The brand is not a runtime property;
 * a non-empty id is the only value `SessionStateStore` reads.
 * @param value Key candidate.
 * @returns True when the id can identify a session slot.
 */
function isSessionStateKey(value) {
    return value.id.length > 0;
}
/**
 * Builds the branded NES session slot key.
 * @param id Plugin-owned slot id.
 * @returns Key for `SessionStateStore.get`.
 */
function createSessionStateKey(id) {
    const key = { id };
    if (!isSessionStateKey(key)) {
        throw new Error(`Invalid session state key '${id}'.`);
    }
    return key;
}
/** Branded key for `SessionStateStore.get`. The brand is compile-time only. */
export const nes65xxSessionStateKey = createSessionStateKey(NES_65XX_SESSION_STATE_ID);
/**
 * Deep-clones mutable nested fields so pass clones cannot share cursors.
 * @param value The session state to clone.
 * @returns A deep-cloned session state.
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
 * @param state Mutable NES session state.
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