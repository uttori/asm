/**
 * ca65-compatible directives for the SNES plugin.
 *
 * These handlers implement the ca65 65816/SNES source-compatibility slice
 * defined in Phase 7 of the 65xx implementation plan:
 *
 *  - `.a8` / `.a16`            – explicit accumulator width hint
 *  - `.i8` / `.i16`            – explicit index register width hint
 *  - `.accu 8|16`              – alias for `.a8` / `.a16`
 *  - `.index 8|16`             – alias for `.i8` / `.i16`
 *  - `.smart [on|off]`         – enable/disable SEP/REP auto-tracking
 *  - `.setcpu "name"`          – select a CPU by name
 *  - `.pushcpu`                – save the current CPU to a stack
 *  - `.popcpu`                 – restore the last saved CPU from the stack
 *
 * All handlers receive the `Assembler` session directly so they can reach
 * the active `Arch65816` encoder without touching SNES-owned mapper or SPC
 * state.  The CPU stack for `.pushcpu`/`.popcpu` is stored in `SnesSessionState`
 * so it participates in the normal clone/reset lifecycle.
 */

import type { Assembler } from "@uttori/asm-core";
import { Arch65816 } from "../architectures/65816.js";
import type { SnesSessionState } from "../session-state.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the active `Arch65816` encoder, or `undefined` if the current
 * architecture is not the 65816 (e.g. SPC700 or Super FX are active).
 * @param {Assembler} session The host assembler session.
 * @returns {Arch65816 | undefined} The encoder, if present.
 */
function getActiveArch65816(session: Assembler): Arch65816 | undefined {
  const { definition } = session.resolveActiveArchitecture();
  if (definition?.encoder instanceof Arch65816) {
    return definition.encoder;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Accumulator width (.a8 / .a16 / .accu)
// ---------------------------------------------------------------------------

/**
 * Sets the assembler's accumulator width hint to 8-bit.
 * Equivalent to ca65's `.A8` directive.
 * @param {Assembler} session The host assembler session.
 * @returns {void}
 */
export function handleA8(session: Assembler): void {
  getActiveArch65816(session)?.setAccumulatorWidth(false);
}

/**
 * Sets the assembler's accumulator width hint to 16-bit.
 * Equivalent to ca65's `.A16` directive.
 * @param {Assembler} session The host assembler session.
 * @returns {void}
 */
export function handleA16(session: Assembler): void {
  getActiveArch65816(session)?.setAccumulatorWidth(true);
}

/**
 * Handles the `.accu 8|16` directive (ca65 alias for `.a8` / `.a16`).
 * @param {Assembler} session The host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleAccu(session: Assembler, words: readonly string[]): void {
  const widthToken = words[1]?.trim();
  if (widthToken === "8") {
    handleA8(session);
  } else if (widthToken === "16") {
    handleA16(session);
  } else {
    throw new Error(`.accu requires an argument of 8 or 16, got: ${widthToken ?? "<none>"}`);
  }
}

// ---------------------------------------------------------------------------
// Index register width (.i8 / .i16 / .index)
// ---------------------------------------------------------------------------

/**
 * Sets the assembler's index register width hint to 8-bit.
 * Equivalent to ca65's `.I8` directive.
 * @param {Assembler} session The host assembler session.
 * @returns {void}
 */
export function handleI8(session: Assembler): void {
  getActiveArch65816(session)?.setIndexWidth(false);
}

/**
 * Sets the assembler's index register width hint to 16-bit.
 * Equivalent to ca65's `.I16` directive.
 * @param {Assembler} session The host assembler session.
 * @returns {void}
 */
export function handleI16(session: Assembler): void {
  getActiveArch65816(session)?.setIndexWidth(true);
}

/**
 * Handles the `.index 8|16` directive (ca65 alias for `.i8` / `.i16`).
 * @param {Assembler} session The host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleIndex(session: Assembler, words: readonly string[]): void {
  const widthToken = words[1]?.trim();
  if (widthToken === "8") {
    handleI8(session);
  } else if (widthToken === "16") {
    handleI16(session);
  } else {
    throw new Error(`.index requires an argument of 8 or 16, got: ${widthToken ?? "<none>"}`);
  }
}

// ---------------------------------------------------------------------------
// Smart mode (.smart)
// ---------------------------------------------------------------------------

/**
 * Handles the `.smart [on|off]` directive.
 * Without an argument or with `on`, enables automatic M/X tracking via
 * `SEP`/`REP` (the assembler default).  With `off`, disables auto-tracking so
 * only explicit `.a8`/`.a16`/`.i8`/`.i16` directives change the width hints.
 * @param {Assembler} session The host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleSmart(session: Assembler, words: readonly string[]): void {
  const arg = words[1]?.trim().toLowerCase();
  const enabled = arg !== "off";
  getActiveArch65816(session)?.setSmartMode(enabled);
}

// ---------------------------------------------------------------------------
// CPU selection (.setcpu / .pushcpu / .popcpu)
// ---------------------------------------------------------------------------

/**
 * Maps a ca65 CPU name string to the SNES architecture id it should activate.
 * Returns `undefined` for names that are not SNES-owned CPU identifiers.
 * @param {string} name CPU name as used in ca65 `.setcpu`.
 * @returns {string | undefined} The resolved SNES architecture id.
 */
export function resolveSnesCpuName(name: string): string | undefined {
  switch (name.toLowerCase()) {
    case "65816":
    case "65c816":
    case "65802":
      return "snes.65816";
    case "spc700":
      return "snes.spc700";
    case "superfx":
      return "snes.superfx";
    default:
      return undefined;
  }
}

/**
 * Handles the `.setcpu "name"` directive for SNES architectures.
 * The CPU name is stripped of surrounding quotes (single or double).
 * Throws for names that are not available on the SNES target; for names that
 * are unrecognised SNES CPUs but are valid 65xx names the caller should
 * propagate an "unknown architecture" diagnostic rather than silently no-op.
 * @param {Assembler} session The host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleSetcpu(session: Assembler, words: readonly string[]): void {
  if (!words[1]) {
    throw new Error(".setcpu requires a CPU name argument.");
  }
  const raw = words[1].trim().replace(/^["']|["']$/g, "");
  const archId = resolveSnesCpuName(raw);
  if (!archId) {
    throw new Error(
      `.setcpu "${raw}" is not available on the SNES target. Supported names: 65816, 65C816, 65802, spc700, superfx.`,
    );
  }
  session.selectArchitecture(archId, raw.toLowerCase());
}

/**
 * Handles the `.pushcpu` directive.
 * Saves the current architecture id onto `SnesSessionState.cpuStack` so it
 * can be restored by `.popcpu`.
 * @param {Assembler} session The host assembler session.
 * @param {SnesSessionState} state Mutable SNES session state.
 * @returns {void}
 */
export function handlePushcpu(session: Assembler, state: SnesSessionState): void {
  const { name } = session.resolveActiveArchitecture();
  state.cpuStack.push(name);
}

/**
 * Handles the `.popcpu` directive.
 * Restores the architecture saved by the most recent `.pushcpu`.
 * @param {Assembler} session The host assembler session.
 * @param {SnesSessionState} state Mutable SNES session state.
 * @returns {void}
 */
export function handlePopcpu(session: Assembler, state: SnesSessionState): void {
  if (state.cpuStack.length === 0) {
    throw new Error(".popcpu: CPU stack is empty.");
  }
  const archId = state.cpuStack.pop()!;
  session.selectArchitecture(archId, archId);
}
