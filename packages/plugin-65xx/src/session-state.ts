import type { SessionStateKey } from "@uttori/asm-core/plugin";

import type { Ld65Config } from "./linker-config.js";

/** Plugin-owned session slot id. Keep in sync with the contribution in `index.ts`. */
export const NES_65XX_SESSION_STATE_ID = "65xx.nes-session-state";

/**
 * Per-session NES iNES / ld65 layout state. Cloned per pass. The current
 * segment and memory cursors are cleared in `resetForStage` so a later stage
 * cannot inherit an open overlay.
 */
export interface Nes65xxSessionState {
  /** Parsed or declared header bytes. */
  readonly header: readonly number[];
  /** Byte used to prefill unused PRG and header gaps. */
  readonly fillByte: number;
  /** Parsed ld65 configuration driving NES section placement. */
  readonly linker: Ld65Config;
  /** Next load address per MEMORY region, keyed by region name. */
  memoryCursors: Record<string, number>;
  /** Active ca65 segment name while emitting object bytes. */
  currentSegment: string | null;
  /** MEMORY region receiving the active segment load address. */
  currentLoadMemory: string | null;
  /** Load address where the current segment began. */
  segmentLoadStart: number;
  /** Run address where the current segment began. */
  segmentRunStart: number;
}

/**
 * Attaches the compile-time session-state brand. The brand is not a runtime property;
 * a non-empty id is the only value `SessionStateStore` reads.
 * @param value Key candidate.
 * @returns True when the id can identify a session slot.
 */
function isSessionStateKey<T>(value: { readonly id: string }): value is SessionStateKey<T> {
  return value.id.length > 0;
}

/**
 * Builds the branded NES session slot key.
 * @param id Plugin-owned slot id.
 * @returns Key for `SessionStateStore.get`.
 */
function createSessionStateKey<T>(id: string): SessionStateKey<T> {
  const key = { id };
  if (!isSessionStateKey<T>(key)) {
    throw new Error(`Invalid session state key '${id}'.`);
  }
  return key;
}

/** Branded key for `SessionStateStore.get`. The brand is compile-time only. */
export const nes65xxSessionStateKey =
  createSessionStateKey<Nes65xxSessionState>(NES_65XX_SESSION_STATE_ID);

/**
 * Deep-clones mutable nested fields so pass clones cannot share cursors.
 * @param value The session state to clone.
 * @returns A deep-cloned session state.
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
 * @param state Mutable NES session state.
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
