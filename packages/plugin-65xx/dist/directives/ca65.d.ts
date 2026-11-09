/**
 * ca65 source-compatibility directives for the 65xx NES target.
 *
 * This is the Zelda-1 slice, not full ca65:
 * `.segment`, `.export`, `.import`, `.byte`/`.byt`, `.addr`/`.word`,
 * `.lobytes`, `.hibytes`, `.dbyt`.
 */
import type { PluginSessionCapabilities } from "@uttori/asm-core/plugin";
import { type Ca65SessionState } from "../ca65-profile.js";
import type { Ld65Segment } from "../linker-config.js";
import type { Nes65xxSessionState } from "../session-state.js";
/**
 * Splits remaining directive words on commas.
 * @param words Tokenized line, keyword first.
 * @returns Parameter expressions.
 */
export declare function parameterList(words: readonly string[]): string[];
/**
 * Promotes a name to session-global and copies any already-defined file-local
 * value onto the unqualified key.
 * @param session Host assembler session.
 * @param name Exported/imported identifier.
 */
export declare function markGlobalSymbol(session: PluginSessionCapabilities, name: string): void;
/**
 * Closes the active ld65 segment: records the next load cursor and emits
 * `__NAME_LOAD__` / `__NAME_RUN__` / `__NAME_SIZE__` / `__NAME_RUN_END__`.
 * @param session Host assembler session.
 * @param state Mutable NES session state.
 */
export declare function closeActiveSegment(session: PluginSessionCapabilities, state: Nes65xxSessionState): void;
/**
 * Evaluates SYMBOLS block expressions after the last segment closes.
 * @param session Host assembler session.
 * @param state Mutable NES session state.
 */
export declare function applyLinkerSymbols(session: PluginSessionCapabilities, state: Nes65xxSessionState): void;
/**
 * Opens an ld65 segment: `org` to the load address, `base` to the run address
 * when they differ (overlay copy-to-RAM).
 * @param session Host assembler session.
 * @param state Mutable NES session state.
 * @param segment Segment to activate.
 */
export declare function openSegment(session: PluginSessionCapabilities, state: Nes65xxSessionState, segment: Ld65Segment): void;
/**
 * Handles `.segment "NAME"`.
 * @param session Host assembler session.
 * @param state Mutable NES session state.
 * @param words Tokenized line, keyword first.
 */
export declare function handleSegment(session: PluginSessionCapabilities, state: Nes65xxSessionState, words: readonly string[]): void;
/**
 * Handles `.export ident[, ident...]`.
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleExport(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Handles `.import ident[, ident...]`.
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleImport(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Handles `.byte` / `.byt`.
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleByte(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Handles `.addr` / `.word` (16-bit little-endian).
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleAddr(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Handles `.lobytes expr[, expr...]`.
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleLobytes(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Handles `.hibytes expr[, expr...]`.
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleHibytes(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Handles `.dbyt expr[, expr...]` (16-bit big-endian).
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleDbyt(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Handles `.dword` / `.faraddr` (32-bit or 24-bit little-endian).
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 * @param width Emitted value width.
 */
export declare function handleDword(session: PluginSessionCapabilities, words: readonly string[], width?: 3 | 4): void;
/**
 * Selects one of the 65xx-owned ca65 CPUs.
 * @param session Host assembler session.
 * @param state ca65 session state.
 * @param words Tokenized line, keyword first.
 */
export declare function handleSetcpu(session: PluginSessionCapabilities, state: Ca65SessionState, words: readonly string[]): void;
/**
 * Saves the current CPU for `.popcpu`.
 * @param session Host assembler session.
 * @param state ca65 session state.
 */
export declare function handlePushcpu(session: PluginSessionCapabilities, state: Ca65SessionState): void;
/**
 * Restores the most recently pushed CPU.
 * @param session Host assembler session.
 * @param state ca65 session state.
 */
export declare function handlePopcpu(session: PluginSessionCapabilities, state: Ca65SessionState): void;
/**
 * Handles `.p02`, `.p6280`, and the other ca65 CPU shorthand directives.
 * @param session Host assembler session.
 * @param state ca65 session state.
 * @param words Tokenized line, keyword first.
 */
export declare function handleCpuShorthand(session: PluginSessionCapabilities, state: Ca65SessionState, words: readonly string[]): void;
/**
 * Emits `.res count[, fill]`.
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleRes(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Pads to the next `.align boundary[, fill]`.
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleAlign(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Includes `.incbin "file"[, offset[, size]]` using ca65's offset/length convention.
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleCa65Incbin(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Implements the flat-image subset of ca65 `.assert`, deferring provisional asset layouts in tooling.
 * @param session Host assembler session.
 * @param words Tokenized line, keyword first.
 */
export declare function handleCa65Assert(session: PluginSessionCapabilities, words: readonly string[]): void;
/**
 * Enters a ca65 `.scope` or `.proc` using the core namespace mechanism.
 * @param session Host assembler session.
 * @param state ca65 session state.
 * @param words Tokenized line, keyword first.
 * @param procedure Whether the scope declares a procedure label.
 */
export declare function handleScope(session: PluginSessionCapabilities, state: Ca65SessionState, words: readonly string[], procedure: boolean): void;
/**
 * Leaves the most recent ca65 `.scope` or `.proc`.
 * @param session Host assembler session.
 * @param state ca65 session state.
 */
export declare function handleEndScope(session: PluginSessionCapabilities, state: Ca65SessionState): void;
/**
 * Records flat-image `.segment` intent without pretending to create an object segment.
 * @param state ca65 session state.
 * @param words Tokenized line, keyword first.
 */
export declare function handleFlatSegment(state: Ca65SessionState, words: readonly string[]): void;
/**
 * Saves the active flat segment for a later `.popseg`.
 * @param state ca65 session state.
 */
export declare function handlePushseg(state: Ca65SessionState): void;
/**
 * Restores the flat segment saved by the matching `.pushseg`; throws when the stack is empty.
 * @param state ca65 session state.
 */
export declare function handlePopseg(state: Ca65SessionState): void;
/**
 * Rejects directives that require ca65 object/linker semantics.
 * @param words Tokenized line, keyword first.
 * @returns This handler always throws.
 */
export declare function handleUnsupportedCa65(words: readonly string[]): never;
//# sourceMappingURL=ca65.d.ts.map