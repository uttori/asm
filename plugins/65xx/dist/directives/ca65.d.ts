/**
 * ca65 source-compatibility directives for the 65xx NES target.
 *
 * This is the Zelda-1 slice, not full ca65:
 * `.segment`, `.export`, `.import`, `.byte`/`.byt`, `.addr`/`.word`,
 * `.lobytes`, `.hibytes`, `.dbyt`.
 */
import type { Assembler } from "@uttori/asm-core";
import type { Nes65xxSessionState } from "../session-state.js";
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
 * Handles `.export ident[, ident…]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleExport(session: Assembler, words: readonly string[]): void;
/**
 * Handles `.import ident[, ident…]`.
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
 * Handles `.lobytes expr[, expr…]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleLobytes(session: Assembler, words: readonly string[]): void;
/**
 * Handles `.hibytes expr[, expr…]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleHibytes(session: Assembler, words: readonly string[]): void;
/**
 * Handles `.dbyt expr[, expr…]` (16-bit big-endian).
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export declare function handleDbyt(session: Assembler, words: readonly string[]): void;
//# sourceMappingURL=ca65.d.ts.map