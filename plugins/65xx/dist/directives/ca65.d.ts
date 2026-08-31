/**
 * ca65 source-compatibility directives for the 65xx NES target.
 *
 * This is the Zelda-1 slice, not full ca65:
 * `.segment`, `.export`, `.import`, `.byte`/`.byt`, `.addr`/`.word`,
 * `.lobytes`, `.hibytes`, `.dbyt`.
 */
import type { Assembler } from "@uttori/asm-core";
import type { Nes65xxSessionState } from "../session-state.js";
import { type Ca65SessionState } from "../ca65-profile.js";
/**
 * Closes the active ld65 segment: records the next load cursor and emits
 * `__NAME_LOAD__` / `__NAME_RUN__` / `__NAME_SIZE__` / `__NAME_RUN_END__`.
 * @param {Assembler} session Host assembler session.
 * @param {Nes65xxSessionState} state Mutable NES session state.
 * @returns {void}
 */
export declare function closeActiveSegment(session: Assembler, state: Nes65xxSessionState): void;
/**
 * Evaluates SYMBOLS block expressions after the last segment closes.
 * @param {Assembler} session Host assembler session.
 * @param {Nes65xxSessionState} state Mutable NES session state.
 * @returns {void}
 */
export declare function applyLinkerSymbols(session: Assembler, state: Nes65xxSessionState): void;
/**
 * Handles `.segment "NAME"`.
 * @param {Assembler} session Host assembler session.
 * @param {Nes65xxSessionState} state Mutable NES session state.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleSegment(session: Assembler, state: Nes65xxSessionState, words: readonly string[]): void;
/**
 * Handles `.export ident[, ident...]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleExport(session: Assembler, words: readonly string[]): void;
/**
 * Handles `.import ident[, ident...]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleImport(session: Assembler, words: readonly string[]): void;
/**
 * Handles `.byte` / `.byt`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleByte(session: Assembler, words: readonly string[]): void;
/**
 * Handles `.addr` / `.word` (16-bit little-endian).
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleAddr(session: Assembler, words: readonly string[]): void;
/**
 * Handles `.lobytes expr[, expr...]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleLobytes(session: Assembler, words: readonly string[]): void;
/**
 * Handles `.hibytes expr[, expr...]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleHibytes(session: Assembler, words: readonly string[]): void;
/**
 * Handles `.dbyt expr[, expr...]` (16-bit big-endian).
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleDbyt(session: Assembler, words: readonly string[]): void;
/**
 * Handles `.dword` / `.faraddr` (32-bit or 24-bit little-endian).
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @param {3 | 4} width Emitted value width.
 */
export declare function handleDword(session: Assembler, words: readonly string[], width?: 3 | 4): void;
/**
 * Selects one of the 65xx-owned ca65 CPUs.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export declare function handleSetcpu(session: Assembler, state: Ca65SessionState, words: readonly string[]): void;
/**
 * Saves the current CPU for `.popcpu`.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 */
export declare function handlePushcpu(session: Assembler, state: Ca65SessionState): void;
/**
 * Restores the most recently pushed CPU.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 */
export declare function handlePopcpu(session: Assembler, state: Ca65SessionState): void;
/**
 * Handles `.p02`, `.p6280`, and the other ca65 CPU shorthand directives.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export declare function handleCpuShorthand(session: Assembler, state: Ca65SessionState, words: readonly string[]): void;
/**
 * Emits `.res count[, fill]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export declare function handleRes(session: Assembler, words: readonly string[]): void;
/**
 * Pads to the next `.align boundary[, fill]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export declare function handleAlign(session: Assembler, words: readonly string[]): void;
/**
 * Includes `.incbin "file"[, offset[, size]]` using ca65's offset/length convention.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export declare function handleCa65Incbin(session: Assembler, words: readonly string[]): void;
/**
 * Implements the flat-image subset of ca65 `.assert`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export declare function handleCa65Assert(session: Assembler, words: readonly string[]): void;
/**
 * Enters a ca65 `.scope` or `.proc` using the core namespace mechanism.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @param {boolean} procedure Whether the scope declares a procedure label.
 */
export declare function handleScope(session: Assembler, state: Ca65SessionState, words: readonly string[], procedure: boolean): void;
/**
 * Leaves the most recent ca65 `.scope` or `.proc`.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 */
export declare function handleEndScope(session: Assembler, state: Ca65SessionState): void;
/**
 * Records flat-image `.segment` intent without pretending to create an object segment.
 * @param {Ca65SessionState} state ca65 session state.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export declare function handleFlatSegment(state: Ca65SessionState, words: readonly string[]): void;
/** @param {Ca65SessionState} state ca65 session state. */
export declare function handlePushseg(state: Ca65SessionState): void;
/** @param {Ca65SessionState} state ca65 session state. */
export declare function handlePopseg(state: Ca65SessionState): void;
/**
 * Rejects directives that require ca65 object/linker semantics.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {never} This handler always throws.
 */
export declare function handleUnsupportedCa65(words: readonly string[]): never;
//# sourceMappingURL=ca65.d.ts.map