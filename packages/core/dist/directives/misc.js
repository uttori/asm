import { parseDirectiveExpression } from "../ir/directive-arguments.js";
import { syntaxBoolean, syntaxExpression, syntaxOptional, syntaxRecord, syntaxString, } from "../ir/syntax-codec.js";
import { splitRespectingFunctions } from "../services/command-text-service.js";
/**
 * Restores the previously saved character mapping table.
 * @param ctx The directive context.
 * @param ctx.session The table-capable assembly session.
 * @throws {Error} If `pulltable` is called without `pushtable`.
 */
export const handlePullTable = ({ session }) => {
    if (session.tableStack.length === 0) {
        throw new Error("pulltable without pushtable");
    }
    session.characterMappings = session.tableStack.pop();
};
/**
 * Saves the current character mapping table.
 * @param ctx The directive context.
 * @param ctx.session The table-capable assembly session.
 */
export const handlePushTable = ({ session }) => {
    session.tableStack.push(new Map(session.characterMappings));
};
/**
 * Drops a leading `@keyword` / `keyword` from the raw command line.
 * @param raw Full command text.
 * @param keyword Canonical directive name.
 * @returns Operand text after the keyword.
 */
const stripLeadingKeyword = (raw, keyword) => {
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
 * @param fragment A `print`-style argument.
 * @returns Dequoted text, or the original fragment.
 */
const unwrapQuoted = (fragment) => {
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
 * Concatenates asar `print` arguments. Quoted strings are dequoted. Math/print
 * functions are left literal until those helpers are wired for diagnostics.
 * @param parts Top-level comma-split print arguments.
 * @returns Concatenated message text.
 */
const formatPrintArgs = (parts) => {
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
 * State-dependent checks wait for a build when editor analysis has skipped asset bytes.
 * @param ctx Session with `evaluateAssertion`.
 * @param _words Tokenized command. Unused. Parse from `raw`.
 * @param raw Full command text.
 * @throws {Error} If the condition is missing or evaluates to zero.
 */
export const handleAssert = (ctx, _words, raw) => {
    executeAssert({ diagnostic: ctx }, parseAssert({ text: raw }));
};
/**
 * Asar `error [print-args...]`. Always fails the assemble.
 * @param _ctx Unused session.
 * @param _words Tokenized command. Unused. Parse from `raw`.
 * @param raw Full command text.
 * @throws {Error} Always. Message matches asar's `Eerror_command`.
 */
export const handleError = (ctx, _words, raw) => {
    executeError({ diagnostic: ctx }, parseError({ text: raw }));
};
/**
 * Formats a logical address as 6-digit uppercase hex for asar `warnpc` messages.
 * @param value Address.
 * @returns Zero-padded hex without a `$` prefix.
 */
const hex6 = (value) => (value >>> 0).toString(16).toUpperCase().padStart(6, "0");
/**
 * Asar-style table parse error for a 1-based source line.
 * @param lineNumber Table file line number.
 * @returns `Invalid table file: line N`.
 */
const invalidTableLine = (lineNumber) => new Error(`Invalid table file: line ${lineNumber}`);
/**
 * Parses one asar `table` file line. LTR is `char=hex` with the mapped character
 * at index 0 - leading space is significant (` =20`). Hex is a single integer,
 * not a byte list. `db` later truncates it to 8 bits.
 * @param line One table line, with trailing CR already stripped.
 * @param rtl When true, the line is `hex=char` instead of `char=hex`.
 * @param lineNumber 1-based source line, used in asar-style errors.
 * @returns Mapping, or undefined for a blank line.
 * @throws {Error} If the line is present but not a valid asar table entry.
 */
const parseAsarTableLine = (line, rtl, lineNumber) => {
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
 * @param ctx The table-capable session.
 */
export const handleClearTable = ({ session }) => {
    session.characterMappings.clear();
    session.currentTable = null;
};
/**
 * Deprecated asar `table "file"[,ltr|rtl]`. Loads `char=hex` lines into the
 * mapping table. Unlike asar we leave unmapped characters as identity instead
 * of filling a garbage sentinel - SMRPG dialogue only uses listed glyphs, and
 * remaining bank data is raw `db $xx` after `cleartable`.
 * @param ctx Session with `includeSource.readFile`.
 * @param _words Tokenized command. Unused. Parse from `raw`.
 * @param raw Full command text.
 * @throws {Error} If the filename is missing or a table line is invalid.
 */
export const handleTable = ({ session }, _words, raw) => {
    executeTable({ session }, parseTable({ text: raw }));
};
/** File contents are table data; only the assembly path/direction grammar is parsed ahead of execution. */
function executeTable({ session }, { filename, rtl }) {
    const contents = session.includeSource.readFile(filename, "utf8");
    if (typeof contents !== "string") {
        throw new Error(`Error reading file: ${filename}`);
    }
    session.characterMappings.clear();
    session.currentTable = filename;
    const lines = contents.split("\n");
    for (let index = 0; index < lines.length; index++) {
        let line = lines[index];
        // Split was on `\n` only. Strip the CR from CRLF without trimming the
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
}
/**
 * Deprecated asar `warnpc addr`, equivalent to `assert pc() <= addr`.
 * Fails only when the logical program counter is strictly past the bound.
 * @param ctx Session with PC and numeric evaluation.
 * @param _words Tokenized command. Unused. Parse from `raw`.
 * @param raw Full command text.
 * @throws {Error} If the address is missing or `pc > addr`.
 */
export const handleWarnpc = (ctx, _words, raw) => {
    executeWarnpc({ diagnostic: ctx }, parseWarnpc({ text: raw }));
};
/**
 * Registers table and diagnostic directives when those core groups are enabled.
 * @param registry The directive registry.
 * @param context Table and diagnostic sessions.
 * @param [enabledGroups] Groups to register. Defaults to both.
 */
/** No-op metadata hook for directives that only invoke session side effects. */
const empty = () => ({});
/** Registers table and diagnostic directives when their groups are enabled. */
export const registerMiscDirectives = (registry, context, enabledGroups = new Set(["table", "diagnostic"])) => {
    const emptySyntax = syntaxRecord({});
    if (enabledGroups.has("table")) {
        registry.registerImmutableTyped("pulltable", empty, emptySyntax, () => handlePullTable(context.table));
        registry.registerImmutableTyped("pushtable", empty, emptySyntax, () => handlePushTable(context.table));
        registry.registerImmutableTyped("cleartable", empty, emptySyntax, () => handleClearTable(context.table));
        registry.registerImmutableTyped("table", parseTable, syntaxRecord({ filename: syntaxString, rtl: syntaxBoolean }), (payload) => executeTable(context.table, payload));
    }
    if (enabledGroups.has("diagnostic")) {
        registry.registerImmutableTyped("assert", parseAssert, syntaxRecord({ condition: syntaxExpression, message: syntaxOptional(syntaxString) }), (payload) => executeAssert(context, payload));
        registry.registerImmutableTyped("error", parseError, syntaxRecord({ message: syntaxString }), (payload) => executeError(context, payload));
        registry.registerImmutableTyped("warnpc", parseWarnpc, syntaxRecord({ address: syntaxExpression }), (payload) => executeWarnpc(context, payload));
    }
};
/** Shared source/public-entry grammar for `assert`. */
const parseAssert = ({ text }) => {
    const parts = splitRespectingFunctions(stripLeadingKeyword(text, "assert"));
    if (!parts[0]) {
        throw new Error("Broken conditional: assert");
    }
    return {
        condition: parseDirectiveExpression(parts[0], false),
        message: parts.length > 1 ? formatPrintArgs(parts.slice(1)) : undefined,
    };
};
/** Applies a parsed `assert` operation to the current stage. */
const executeAssert = (context, { condition, message }) => {
    if (context.diagnostic.session.evaluateAssertion(condition) !== false) {
        return;
    }
    throw new Error(message === undefined ? "Assertion failed." : `Assertion failed: ${message}`);
};
/** Shared source/public-entry grammar for `error`. */
const parseError = ({ text }) => {
    const payload = stripLeadingKeyword(text, "error");
    return {
        message: payload
            ? `error command: ${formatPrintArgs(splitRespectingFunctions(payload))}`
            : "error command.",
    };
};
/** Applies a parsed `error` operation to the current stage. */
const executeError = (_context, { message }) => {
    throw new Error(message);
};
/** Shared source/public-entry grammar for `warnpc`. */
const parseWarnpc = ({ text }) => {
    const payload = stripLeadingKeyword(text, "warnpc");
    if (!payload) {
        throw new Error("warnpc requires an address");
    }
    return { address: parseDirectiveExpression(payload) };
};
/** Applies a parsed `warnpc` operation to the current stage. */
const executeWarnpc = (context, { address }) => {
    const { session } = context.diagnostic;
    const maxpos = session.operandResolver.getnum(address);
    if (session.currentTargetAddress > maxpos) {
        throw new Error(`warnpc failed: Current pc = $${hex6(session.currentTargetAddress)}, wanted <= $${hex6(maxpos)}`);
    }
};
/** Shared assembly path and direction grammar; file contents remain table data. */
const parseTable = ({ text }) => {
    let payload = stripLeadingKeyword(text, "table");
    const rtl = /,\s*rtl\s*$/i.test(payload);
    payload = payload.replace(/,\s*(?:rtl|ltr)\s*$/i, "").trim();
    const filename = unwrapQuoted(payload);
    if (!filename) {
        throw new Error("table requires a filename");
    }
    return { filename, rtl };
};
//# sourceMappingURL=misc.js.map