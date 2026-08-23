import type { DirectiveRegistry } from "./registry.js";
import { ASAR_COMPAT_NO_OP_DIRECTIVES } from "../compatibility/asar-compatibility-profile.js";
import { splitRespectingFunctions } from "../services/command-text-service.js";
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
export const handlePullTable = ({ session }: TableDirectiveContext): void => {
  // debug("handlePullTable");
  if (session.tableStack.length === 0) {
    throw new Error("pulltable without pushtable");
  }
  session.characterMappings = session.tableStack.pop()!;
};

/**
 * Saves the current character mapping table.
 * @param {TableDirectiveContext} ctx The directive context.
 * @param {DirectiveTableCapability} ctx.session The table-capable assembly session.
 */
export const handlePushTable = ({ session }: TableDirectiveContext): void => {
  // debug("handlePushTable");
  session.tableStack.push(new Map(session.characterMappings));
};

/**
 * Drops a leading `@keyword` / `keyword` from the raw command line.
 * @param {string} raw Full command text.
 * @param {string} keyword Canonical directive name.
 * @returns {string} Operand text after the keyword.
 */
const stripLeadingKeyword = (raw: string, keyword: string): string => {
  const trimmed = raw.trim();
  let rest = trimmed;
  if (rest.startsWith("@")) {
    rest = rest.slice(1);
  }
  if (rest.length < keyword.length) {
    return "";
  }
  if (rest.slice(0, keyword.length).toLowerCase() !== keyword) {
    return trimmed;
  }
  return rest.slice(keyword.length).trim();
};

/**
 * Strips one matching pair of wrapping quotes. Print functions stay as-is.
 * @param {string} fragment A `print`-style argument.
 * @returns {string} Dequoted text, or the original fragment.
 */
const unwrapQuoted = (fragment: string): string => {
  const text = fragment.trim();
  if (text.length < 2) {
    return text;
  }
  const quote = text[0];
  if ((quote === '"' || quote === "'") && text.endsWith(quote)) {
    return text.slice(1, -1);
  }
  return text;
};

/**
 * Concatenates asar `print` arguments. Quoted strings are dequoted; math/print
 * functions are left literal until those helpers are wired for diagnostics.
 * @param {readonly string[]} parts Top-level comma-split print arguments.
 * @returns {string} Concatenated message text.
 */
const formatPrintArgs = (parts: readonly string[]): string => {
  let out = "";
  for (const part of parts) {
    out += unwrapQuoted(part);
  }
  return out;
};

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
export const handleAssert = (
  { session }: DiagnosticDirectiveContext,
  _words: readonly string[],
  raw: string,
): void => {
  const payload = stripLeadingKeyword(raw, "assert");
  const parts = splitRespectingFunctions(payload);
  const condition = parts[0] ?? "";
  if (condition === "") {
    throw new Error("Broken conditional: assert");
  }
  if (session.evaluateExpression(condition)) {
    return;
  }
  const messageParts = parts.slice(1);
  if (messageParts.length === 0) {
    throw new Error("Assertion failed.");
  }
  throw new Error(`Assertion failed: ${formatPrintArgs(messageParts)}`);
};

/**
 * Asar `error [print-args...]`. Always fails the assemble.
 * @param {DiagnosticDirectiveContext} _ctx Unused session.
 * @param {readonly string[]} _words Tokenized command. Unused; parse from `raw`.
 * @param {string} raw Full command text.
 * @throws {Error} Always. Message matches asar's `Eerror_command`.
 */
export const handleError = (
  _ctx: DiagnosticDirectiveContext,
  _words: readonly string[],
  raw: string,
): void => {
  const payload = stripLeadingKeyword(raw, "error");
  if (payload === "") {
    throw new Error("error command.");
  }
  throw new Error(`error command: ${formatPrintArgs(splitRespectingFunctions(payload))}`);
};

const hex6 = (value: number): string =>
  (value >>> 0).toString(16).toUpperCase().padStart(6, "0");

/**
 * Deprecated asar `warnpc addr`, equivalent to `assert pc() <= addr`.
 * Fails only when the SNES PC is strictly past the bound.
 * @param {DiagnosticDirectiveContext} ctx Session with PC and numeric evaluation.
 * @param {readonly string[]} _words Tokenized command. Unused; parse from `raw`.
 * @param {string} raw Full command text.
 * @throws {Error} If the address is missing or `pc > addr`.
 */
export const handleWarnpc = (
  { session }: DiagnosticDirectiveContext,
  _words: readonly string[],
  raw: string,
): void => {
  const payload = stripLeadingKeyword(raw, "warnpc");
  if (payload === "") {
    throw new Error("warnpc requires an address");
  }
  const maxpos = session.operandResolver.getnum(session.resolvedefines(payload));
  if (session.currentTargetAddress > maxpos) {
    throw new Error(
      `warnpc failed: Current pc = $${hex6(session.currentTargetAddress)}, wanted <= $${hex6(maxpos)}`,
    );
  }
};

export const registerMiscDirectives = (
  registry: DirectiveRegistry,
  context: MiscDirectiveContexts,
): void => {
  registry.register("pulltable", context.table, handlePullTable);

  registry.register("pushtable", context.table, handlePushTable);

  registry.register([...ASAR_COMPAT_NO_OP_DIRECTIVES], context.table, () => {
    // Compatibility no-ops kept to preserve current fixture behavior.
  });

  registry.register("assert", context.diagnostic, handleAssert);

  registry.register("error", context.diagnostic, handleError);

  registry.register("warnpc", context.diagnostic, handleWarnpc);
};
