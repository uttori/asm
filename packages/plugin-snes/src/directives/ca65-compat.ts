import type { PluginSessionCapabilities } from "@uttori/asm-core/plugin";
/**
 * ca65-compatible directives for the SNES plugin.
 *
 * These handlers implement the supported ca65 65816/SNES source-compatibility surface:
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
 * All handlers receive the `PluginSessionCapabilities` session directly so they can reach
 * the active `Arch65816` encoder without touching SNES-owned mapper or SPC
 * state.  The CPU stack for `.pushcpu`/`.popcpu` is stored in `SnesSessionState`
 * so it participates in the normal clone/reset lifecycle.
 */

import { Arch65816 } from "../architectures/65816.js";
import { Typed65816 } from "../architectures/typed-65816.js";
import type { SnesSessionState } from "../session-state.js";
import { parseSnesDirective } from "./syntax-parser.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the active `Arch65816` encoder, or `undefined` if the current
 * architecture is not the 65816 (e.g. SPC700 or Super FX are active).
 * @param session The host assembler session.
 * @returns The encoder, if present.
 */
export function getActiveArch65816(
  session: PluginSessionCapabilities,
): Arch65816 | Typed65816 | undefined {
  const { definition } = session.resolveActiveArchitecture();
  if (definition?.encoder instanceof Arch65816) {
    return definition.encoder;
  }
  if (definition?.encoder.typed instanceof Typed65816) {
    return definition.encoder.typed;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Accumulator width (.a8 / .a16 / .accu)
// ---------------------------------------------------------------------------

/**
 * Sets the assembler's accumulator width hint to 8-bit.
 * Equivalent to ca65's `.A8` directive.
 * @param session The host assembler session.
 */
export function handleA8(session: PluginSessionCapabilities): void {
  getActiveArch65816(session)?.setAccumulatorWidth(false);
}

/**
 * Sets the assembler's accumulator width hint to 16-bit.
 * Equivalent to ca65's `.A16` directive.
 * @param session The host assembler session.
 */
export function handleA16(session: PluginSessionCapabilities): void {
  getActiveArch65816(session)?.setAccumulatorWidth(true);
}

/**
 * Handles the `.accu 8|16` directive (ca65 alias for `.a8` / `.a16`).
 * @param session The host assembler session.
 * @param words Tokenized line, keyword first.
 */
export function handleAccu(session: PluginSessionCapabilities, words: readonly string[]): void {
  const node = parseSnesDirective("snes.directive.ca65.accu", { words });
  if (node.operation !== "width") {
    throw new Error("Unexpected SNES directive operation.");
  }
  getActiveArch65816(session)?.setAccumulatorWidth(node.wide);
}

// ---------------------------------------------------------------------------
// Index register width (.i8 / .i16 / .index)
// ---------------------------------------------------------------------------

/**
 * Sets the assembler's index register width hint to 8-bit.
 * Equivalent to ca65's `.I8` directive.
 * @param session The host assembler session.
 */
export function handleI8(session: PluginSessionCapabilities): void {
  getActiveArch65816(session)?.setIndexWidth(false);
}

/**
 * Sets the assembler's index register width hint to 16-bit.
 * Equivalent to ca65's `.I16` directive.
 * @param session The host assembler session.
 */
export function handleI16(session: PluginSessionCapabilities): void {
  getActiveArch65816(session)?.setIndexWidth(true);
}

/**
 * Handles the `.index 8|16` directive (ca65 alias for `.i8` / `.i16`).
 * @param session The host assembler session.
 * @param words Tokenized line, keyword first.
 */
export function handleIndex(session: PluginSessionCapabilities, words: readonly string[]): void {
  const node = parseSnesDirective("snes.directive.ca65.index", { words });
  if (node.operation !== "width") {
    throw new Error("Unexpected SNES directive operation.");
  }
  getActiveArch65816(session)?.setIndexWidth(node.wide);
}

// ---------------------------------------------------------------------------
// Smart mode (.smart)
// ---------------------------------------------------------------------------

/**
 * Handles the `.smart [on|off]` directive.
 * Without an argument or with `on`, enables automatic M/X tracking via
 * `SEP`/`REP` (the assembler default).  With `off`, disables auto-tracking so
 * only explicit `.a8`/`.a16`/`.i8`/`.i16` directives change the width hints.
 * @param session The host assembler session.
 * @param words Tokenized line, keyword first.
 */
export function handleSmart(session: PluginSessionCapabilities, words: readonly string[]): void {
  const node = parseSnesDirective("snes.directive.ca65.smart", { words });
  if (node.operation !== "smart") {
    throw new Error("Unexpected SNES directive operation.");
  }
  getActiveArch65816(session)?.setSmartMode(node.enabled);
}

// ---------------------------------------------------------------------------
// CPU selection (.setcpu / .pushcpu / .popcpu)
// ---------------------------------------------------------------------------

export { resolveSnesCpuName } from "./cpu-name.js";

/**
 * Handles the `.setcpu "name"` directive for SNES architectures.
 * The CPU name is stripped of surrounding quotes (single or double).
 * Throws for names that are not available on the SNES target. For names that
 * are unrecognised SNES CPUs but are valid 65xx names the caller should
 * propagate an "unknown architecture" diagnostic rather than silently no-op.
 * @param session The host assembler session.
 * @param words Tokenized line, keyword first.
 */
export function handleSetcpu(session: PluginSessionCapabilities, words: readonly string[]): void {
  const node = parseSnesDirective("snes.directive.ca65.setcpu", { words });
  if (node.operation !== "cpu") {
    throw new Error("Unexpected SNES directive operation.");
  }
  session.selectArchitecture(node.architecture, node.alias);
}

/**
 * Handles the `.pushcpu` directive.
 * Saves the current architecture id onto `SnesSessionState.cpuStack` so it
 * can be restored by `.popcpu`.
 * @param session The host assembler session.
 * @param state Mutable SNES session state.
 */
export function handlePushcpu(session: PluginSessionCapabilities, state: SnesSessionState): void {
  const { name } = session.resolveActiveArchitecture();
  state.cpuStack.push(name);
}

/**
 * Handles the `.popcpu` directive.
 * Restores the architecture saved by the most recent `.pushcpu`.
 * @param session The host assembler session.
 * @param state Mutable SNES session state.
 */
export function handlePopcpu(session: PluginSessionCapabilities, state: SnesSessionState): void {
  if (state.cpuStack.length === 0) {
    throw new Error(".popcpu: CPU stack is empty.");
  }
  const archId = state.cpuStack.pop()!;
  session.selectArchitecture(archId, archId);
}
