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
import type { SnesSessionState } from "../session-state.js";
/**
 * Sets the assembler's accumulator width hint to 8-bit.
 * Equivalent to ca65's `.A8` directive.
 * @param {Assembler} session The host assembler session.
 * @returns {void}
 */
export declare function handleA8(session: Assembler): void;
/**
 * Sets the assembler's accumulator width hint to 16-bit.
 * Equivalent to ca65's `.A16` directive.
 * @param {Assembler} session The host assembler session.
 * @returns {void}
 */
export declare function handleA16(session: Assembler): void;
/**
 * Handles the `.accu 8|16` directive (ca65 alias for `.a8` / `.a16`).
 * @param {Assembler} session The host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleAccu(session: Assembler, words: readonly string[]): void;
/**
 * Sets the assembler's index register width hint to 8-bit.
 * Equivalent to ca65's `.I8` directive.
 * @param {Assembler} session The host assembler session.
 * @returns {void}
 */
export declare function handleI8(session: Assembler): void;
/**
 * Sets the assembler's index register width hint to 16-bit.
 * Equivalent to ca65's `.I16` directive.
 * @param {Assembler} session The host assembler session.
 * @returns {void}
 */
export declare function handleI16(session: Assembler): void;
/**
 * Handles the `.index 8|16` directive (ca65 alias for `.i8` / `.i16`).
 * @param {Assembler} session The host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleIndex(session: Assembler, words: readonly string[]): void;
/**
 * Handles the `.smart [on|off]` directive.
 * Without an argument or with `on`, enables automatic M/X tracking via
 * `SEP`/`REP` (the assembler default).  With `off`, disables auto-tracking so
 * only explicit `.a8`/`.a16`/`.i8`/`.i16` directives change the width hints.
 * @param {Assembler} session The host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleSmart(session: Assembler, words: readonly string[]): void;
/**
 * Maps a ca65 CPU name string to the SNES architecture id it should activate.
 * Returns `undefined` for names that are not SNES-owned CPU identifiers.
 * @param {string} name CPU name as used in ca65 `.setcpu`.
 * @returns {string | undefined} The resolved SNES architecture id.
 */
export declare function resolveSnesCpuName(name: string): string | undefined;
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
export declare function handleSetcpu(session: Assembler, words: readonly string[]): void;
/**
 * Handles the `.pushcpu` directive.
 * Saves the current architecture id onto `SnesSessionState.cpuStack` so it
 * can be restored by `.popcpu`.
 * @param {Assembler} session The host assembler session.
 * @param {SnesSessionState} state Mutable SNES session state.
 * @returns {void}
 */
export declare function handlePushcpu(session: Assembler, state: SnesSessionState): void;
/**
 * Handles the `.popcpu` directive.
 * Restores the architecture saved by the most recent `.pushcpu`.
 * @param {Assembler} session The host assembler session.
 * @param {SnesSessionState} state Mutable SNES session state.
 * @returns {void}
 */
export declare function handlePopcpu(session: Assembler, state: SnesSessionState): void;
//# sourceMappingURL=ca65-compat.d.ts.map