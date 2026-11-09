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
/**
 * Returns the active `Arch65816` encoder, or `undefined` if the current
 * architecture is not the 65816 (e.g. SPC700 or Super FX are active).
 * @param session The host assembler session.
 * @returns The encoder, if present.
 */
export declare function getActiveArch65816(session: PluginSessionCapabilities): Arch65816 | Typed65816 | undefined;
/**
 * Sets the assembler's accumulator width hint to 8-bit.
 * Equivalent to ca65's `.A8` directive.
 * @param session The host assembler session.
 */
export declare function handleA8(session: PluginSessionCapabilities): void;
/**
 * Sets the assembler's accumulator width hint to 16-bit.
 * Equivalent to ca65's `.A16` directive.
 * @param session The host assembler session.
 */
export declare function handleA16(session: PluginSessionCapabilities): void;
/**
 * Handles the `.accu 8|16` directive (ca65 alias for `.a8` / `.a16`).
 * @param session The host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleAccu(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Sets the assembler's index register width hint to 8-bit.
 * Equivalent to ca65's `.I8` directive.
 * @param session The host assembler session.
 */
export declare function handleI8(session: PluginSessionCapabilities): void;
/**
 * Sets the assembler's index register width hint to 16-bit.
 * Equivalent to ca65's `.I16` directive.
 * @param session The host assembler session.
 */
export declare function handleI16(session: PluginSessionCapabilities): void;
/**
 * Handles the `.index 8|16` directive (ca65 alias for `.i8` / `.i16`).
 * @param session The host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleIndex(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Handles the `.smart [on|off]` directive.
 * Without an argument or with `on`, enables automatic M/X tracking via
 * `SEP`/`REP` (the assembler default).  With `off`, disables auto-tracking so
 * only explicit `.a8`/`.a16`/`.i8`/`.i16` directives change the width hints.
 * @param session The host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleSmart(session: PluginSessionCapabilities, words: readonly string[]): void;
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
export declare function handleSetcpu(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Handles the `.pushcpu` directive.
 * Saves the current architecture id onto `SnesSessionState.cpuStack` so it
 * can be restored by `.popcpu`.
 * @param session The host assembler session.
 * @param state Mutable SNES session state.
 */
export declare function handlePushcpu(session: PluginSessionCapabilities, state: SnesSessionState): void;
/**
 * Handles the `.popcpu` directive.
 * Restores the architecture saved by the most recent `.pushcpu`.
 * @param session The host assembler session.
 * @param state Mutable SNES session state.
 */
export declare function handlePopcpu(session: PluginSessionCapabilities, state: SnesSessionState): void;
//# sourceMappingURL=ca65-compat.d.ts.map