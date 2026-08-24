import type { DirectiveRegistry } from "./registry.js";
import type { DiagnosticDirectiveContext, TableDirectiveContext } from "./types.js";
export type MiscDirectiveContexts = {
    table: TableDirectiveContext;
    diagnostic: DiagnosticDirectiveContext;
};
/**
 * Restores the previously saved character mapping table.
 * @param {TableDirectiveContext} ctx The directive context.
 * @param {DirectiveTableCapability} ctx.session The table-capable assembly session.
 * @throws {Error} If `pulltable` is called without `pushtable`.
 */
export declare const handlePullTable: ({ session }: TableDirectiveContext) => void;
/**
 * Saves the current character mapping table.
 * @param {TableDirectiveContext} ctx The directive context.
 * @param {DirectiveTableCapability} ctx.session The table-capable assembly session.
 */
export declare const handlePushTable: ({ session }: TableDirectiveContext) => void;
/**
 * Asar `assert condition[, print-args...]`. Condition can contain commas inside
 * calls (`select(1, 1, 0)`), so the split is paren/quote-aware.
 * Failed asserts match asar's `Eassertion_failed`: `"Assertion failed."` or
 * `"Assertion failed: " + message`.
 * @param {DiagnosticDirectiveContext} ctx Session with `evaluateExpression`.
 * @param {readonly string[]} _words Tokenized command. Unused; parse from `raw`.
 * @param {string} raw Full command text.
 * @throws {Error} If the condition is missing or evaluates to zero.
 */
export declare const handleAssert: ({ session }: DiagnosticDirectiveContext, _words: readonly string[], raw: string) => void;
/**
 * Asar `error [print-args...]`. Always fails the assemble.
 * @param {DiagnosticDirectiveContext} _ctx Unused session.
 * @param {readonly string[]} _words Tokenized command. Unused; parse from `raw`.
 * @param {string} raw Full command text.
 * @throws {Error} Always. Message matches asar's `Eerror_command`.
 */
export declare const handleError: (_ctx: DiagnosticDirectiveContext, _words: readonly string[], raw: string) => void;
/**
 * Asar `cleartable`. Restores identity mapping (each code point encodes as itself).
 * An empty Map plus `processStringWithMapping`'s charCode fallback matches that.
 * @param {TableDirectiveContext} ctx The table-capable session.
 */
export declare const handleClearTable: ({ session }: TableDirectiveContext) => void;
/**
 * Deprecated asar `table "file"[,ltr|rtl]`. Loads `char=hex` lines into the
 * mapping table. Unlike asar we leave unmapped characters as identity instead
 * of filling a garbage sentinel — SMRPG dialogue only uses listed glyphs, and
 * remaining bank data is raw `db $xx` after `cleartable`.
 * @param {TableDirectiveContext} ctx Session with `includeSource.readFile`.
 * @param {readonly string[]} _words Tokenized command. Unused; parse from `raw`.
 * @param {string} raw Full command text.
 * @throws {Error} If the filename is missing or a table line is invalid.
 */
export declare const handleTable: ({ session }: TableDirectiveContext, _words: readonly string[], raw: string) => void;
/**
 * Deprecated asar `warnpc addr`, equivalent to `assert pc() <= addr`.
 * Fails only when the SNES PC is strictly past the bound.
 * @param {DiagnosticDirectiveContext} ctx Session with PC and numeric evaluation.
 * @param {readonly string[]} _words Tokenized command. Unused; parse from `raw`.
 * @param {string} raw Full command text.
 * @throws {Error} If the address is missing or `pc > addr`.
 */
export declare const handleWarnpc: ({ session }: DiagnosticDirectiveContext, _words: readonly string[], raw: string) => void;
export declare const registerMiscDirectives: (registry: DirectiveRegistry, context: MiscDirectiveContexts) => void;
export declare const registerAsarCompatibilityDirectives: (registry: DirectiveRegistry, context: TableDirectiveContext) => void;
//# sourceMappingURL=misc.d.ts.map