import type { DirectiveRegistry } from "./registry.js";
import { splitRespectingFunctions } from "../services/command-text-service.js";
import type { DiagnosticDirectiveContext, TableDirectiveContext } from "./types.js";
import type { CoreDirectiveGroup } from "../directive-groups.js";

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

const hex6 = (value: number): string => (value >>> 0).toString(16).toUpperCase().padStart(6, "0");

const invalidTableLine = (lineNumber: number): Error =>
  new Error(`Invalid table file: line ${lineNumber}`);

/**
 * Parses one asar `table` file line. LTR is `char=hex` with the mapped character
 * at index 0 - leading space is significant (` =20`). Hex is a single integer,
 * not a byte list; `db` later truncates it to 8 bits.
 * @param {string} line One table line, with trailing CR already stripped.
 * @param {boolean} rtl When true, the line is `hex=char` instead of `char=hex`.
 * @param {number} lineNumber 1-based source line, used in asar-style errors.
 * @returns {{ char: string; value: number } | undefined} Mapping, or undefined for a blank line.
 * @throws {Error} If the line is present but not a valid asar table entry.
 */
const parseAsarTableLine = (
  line: string,
  rtl: boolean,
  lineNumber: number,
): { char: string; value: number } | undefined => {
  if (line.length === 0) {
    return undefined;
  }
  // Asar: strlen < 4 || strlen & 1 || strlen > 10.
  if (line.length < 4 || (line.length & 1) !== 0 || line.length > 10) {
    throw invalidTableLine(lineNumber);
  }
  if (rtl) {
    if (line[1] === "x" || line[1] === "X") {
      throw invalidTableLine(lineNumber);
    }
    const eq = line.indexOf("=");
    if (eq < 1 || eq !== line.length - 2) {
      throw invalidTableLine(lineNumber);
    }
    const hex = line.slice(0, eq);
    if (!/^[\dA-Fa-f]+$/.test(hex)) {
      throw invalidTableLine(lineNumber);
    }
    return { char: line[eq + 1], value: Number.parseInt(hex, 16) };
  }
  if (line[1] !== "=" || line[3] === "x" || line[3] === "X") {
    throw invalidTableLine(lineNumber);
  }
  const hex = line.slice(2);
  if (!/^[\dA-Fa-f]+$/.test(hex)) {
    throw invalidTableLine(lineNumber);
  }
  return { char: line[0], value: Number.parseInt(hex, 16) };
};

/**
 * Asar `cleartable`. Restores identity mapping (each code point encodes as itself).
 * An empty Map plus `processStringWithMapping`'s charCode fallback matches that.
 * @param {TableDirectiveContext} ctx The table-capable session.
 */
export const handleClearTable = ({ session }: TableDirectiveContext): void => {
  session.characterMappings.clear();
  session.currentTable = null;
};

/**
 * Deprecated asar `table "file"[,ltr|rtl]`. Loads `char=hex` lines into the
 * mapping table. Unlike asar we leave unmapped characters as identity instead
 * of filling a garbage sentinel - SMRPG dialogue only uses listed glyphs, and
 * remaining bank data is raw `db $xx` after `cleartable`.
 * @param {TableDirectiveContext} ctx Session with `includeSource.readFile`.
 * @param {readonly string[]} _words Tokenized command. Unused; parse from `raw`.
 * @param {string} raw Full command text.
 * @throws {Error} If the filename is missing or a table line is invalid.
 */
export const handleTable = (
  { session }: TableDirectiveContext,
  _words: readonly string[],
  raw: string,
): void => {
  let payload = stripLeadingKeyword(raw, "table");
  let rtl = false;
  if (/,\s*rtl\s*$/i.test(payload)) {
    rtl = true;
    payload = payload.replace(/,\s*rtl\s*$/i, "").trim();
  } else if (/,\s*ltr\s*$/i.test(payload)) {
    payload = payload.replace(/,\s*ltr\s*$/i, "").trim();
  }
  const filename = unwrapQuoted(payload);
  if (filename === "") {
    throw new Error("table requires a filename");
  }

  const contents = session.includeSource.readFile(filename, "utf8");
  if (typeof contents !== "string") {
    throw new Error(`Error reading file: ${filename}`);
  }

  session.characterMappings.clear();
  session.currentTable = filename;
  const lines = contents.split("\n");
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index];
    // Split was on `\n` only; strip the CR from CRLF without trimming the
    // mapped character, which may itself be a leading space.
    if (line.endsWith("\r")) {
      line = line.slice(0, -1);
    }
    const parsed = parseAsarTableLine(line, rtl, index + 1);
    if (!parsed) {
      continue;
    }
    session.characterMappings.set(parsed.char, parsed.value);
  }
};

/**
 * Deprecated asar `warnpc addr`, equivalent to `assert pc() <= addr`.
 * Fails only when the logical program counter is strictly past the bound.
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
  enabledGroups: ReadonlySet<CoreDirectiveGroup> = new Set(["table", "diagnostic"]),
): void => {
  if (enabledGroups.has("table")) {
    registry.registerLowered("pulltable", context.table, handlePullTable);

    registry.registerLowered("pushtable", context.table, handlePushTable);

    registry.registerLowered("cleartable", context.table, handleClearTable);

    registry.registerLowered("table", context.table, handleTable);
  }

  if (enabledGroups.has("diagnostic")) {
    registry.registerLowered("assert", context.diagnostic, handleAssert);

    registry.registerLowered("error", context.diagnostic, handleError);

    registry.registerLowered("warnpc", context.diagnostic, handleWarnpc);
  }
};
