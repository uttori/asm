import type { SessionStateKey } from "@uttori/asm-core/plugin";

import type { Ld65Config } from "./linker-config.js";

/** Plugin-owned session slot id. Keep in sync with the contribution in `index.ts`. */
export const NES_65XX_SESSION_STATE_ID = "65xx.nes-session-state";

/**
 * Per-session NES iNES / ld65 layout state. Cloned per pass; the current
 * segment and memory cursors are cleared in `resetForStage` so a later stage
 * cannot inherit an open overlay.
 */
export interface Nes65xxSessionState {
  readonly header: readonly number[];
  readonly fillByte: number;
  readonly linker: Ld65Config;
  /** Next load address per MEMORY region, keyed by region name. */
  memoryCursors: Record<string, number>;
  currentSegment: string | null;
  currentLoadMemory: string | null;
  segmentLoadStart: number;
  segmentRunStart: number;
}

/**
 * Branded key for `SessionStateStore.get`. The brand is compile-time only.
 */
export const nes65xxSessionStateKey = {
  id: NES_65XX_SESSION_STATE_ID,
} as SessionStateKey<Nes65xxSessionState>;

/**
 * Deep-clones mutable nested fields so pass clones cannot share cursors.
 * @param {Nes65xxSessionState} value The session state to clone.
 * @returns {Nes65xxSessionState} A deep-cloned session state.
 */
export function cloneNes65xxSessionState(value: Nes65xxSessionState): Nes65xxSessionState {
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
export function resetNes65xxStageState(state: Nes65xxSessionState): void {
  state.memoryCursors = {};
  for (const memory of state.linker.memories.values()) {
    state.memoryCursors[memory.name] = memory.start;
  }
  state.currentSegment = null;
  state.currentLoadMemory = null;
  state.segmentLoadStart = 0;
  state.segmentRunStart = 0;
}
