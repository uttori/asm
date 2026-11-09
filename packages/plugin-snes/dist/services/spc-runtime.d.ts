import type { ExpressionNode } from "@uttori/asm-core";
import { type PluginSessionCapabilities } from "@uttori/asm-core/plugin";
import type { SnesSessionState } from "../session-state.js";
/** Prepared operands preserve validation timing relative to block-state checks and header writes. */
export type SpcBlockSyntax = {
    /** Parsed 16-bit SPC load address expression. */
    destination: ExpressionNode;
    /** Original destination token text for diagnostics. */
    destinationText: string;
    /** Non-NSPC mode or arity error deferred until after destination binding. */
    modeError?: string;
};
/** Parsed `endspcblock` trailer and validation errors. */
export type EndSpcBlockSyntax = {
    /** Optional execute address expression for the NSPC trailer word pair. */
    execute?: ExpressionNode;
    /** Line format error detected during tokenization. */
    error?: string;
};
/**
 * Tokenizes an `spcblock` directive line into a validated syntax payload.
 * @param words Tokenized directive words beginning with `spcblock`.
 * @returns Parsed block open payload.
 */
export declare function parseSpcBlock(words: readonly string[]): SpcBlockSyntax;
/**
 * Tokenizes an `endspcblock` directive line into trailer operands or errors.
 * @param words Tokenized directive words beginning with `endspcblock`.
 * @returns Parsed block close payload.
 */
export declare function parseEndSpcBlock(words: readonly string[]): EndSpcBlockSyntax;
/**
 * Session-bound runtime for SPC block directives and stage cleanup.
 *
 * NSPC on-disk shape:
 *   `dw size, dest`  then payload assembled at `dest` in SPC RAM,
 *   optionally `dw 0, execute` as a terminator/execute trailer.
 *
 * While open, architecture is forced to `spc700` and labels live under
 * `:SPCBLOCK:_` + the previous namespace so they cannot collide with SNES labels.
 */
export declare class SnesSpcRuntimeService {
    readonly session: PluginSessionCapabilities;
    readonly state: SnesSessionState;
    constructor(session: PluginSessionCapabilities, state: SnesSessionState);
    /**
     * Closes an implicit inline-SPC block (`arch spc700-inline`), then errors if
     * a block is still open. Called from `onStageEnd`.
     */
    finishPass(): void;
    /**
     * Opens an NSPC block: writes size/dest placeholders, retargets PC to the
     * 16-bit SPC destination, and switches architecture.
     *
     * `custom` with a macro name is recognized as Asar syntax but not implemented.
     *
     * @param words Tokenized line: `spcblock dest [nspc|custom [macro]]`.
     */
    handleSpcblock(words: readonly string[]): void;
    /** Bind destination before reporting mode errors, then commit the NSPC header and switch CPU. */
    executeSpcblock(node: SpcBlockSyntax): void;
    /**
     * Closes the open block: patches the NSPC size word, optionally writes an
     * execute trailer, then restores namespace and the previous architecture.
     *
     * Size is `(pc - dest) & $FFFF` - 64 KiB wrap, matching Asar.
     * Size is only patched when `canFinalize` (emit pass). Collect/layout leave
     * the placeholder so later passes can rewrite it.
     *
     * Trailer priority: `endspcblock execute <addr>` > `startpos` > none.
     *
     * @param words Tokenized line.
     */
    handleEndSpcblock(words: readonly string[]): void;
    /** Size patching precedes trailer validation; an execute expression runs after its zero word. */
    executeEndSpcblock(node: EndSpcBlockSyntax): void;
}
//# sourceMappingURL=spc-runtime.d.ts.map