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
 * Deprecated asar `warnpc addr`, equivalent to `assert pc() <= addr`.
 * Fails only when the SNES PC is strictly past the bound.
 * @param {DiagnosticDirectiveContext} ctx Session with PC and numeric evaluation.
 * @param {readonly string[]} _words Tokenized command. Unused; parse from `raw`.
 * @param {string} raw Full command text.
 * @throws {Error} If the address is missing or `pc > addr`.
 */
export declare const handleWarnpc: ({ session }: DiagnosticDirectiveContext, _words: readonly string[], raw: string) => void;
export declare const registerMiscDirectives: (registry: DirectiveRegistry, context: MiscDirectiveContexts) => void;
//# sourceMappingURL=misc.d.ts.map