import { incrementInternalCounter } from "../internal-instrumentation.js";
import { createLineSpan, deriveTokenSpans } from "../source-location.js";
import { parseExpressionNode, } from "./expression-node.js";
const EMPTY_COMMAND_SPAN = Object.freeze({ start: 0, end: 0 });
const EMPTY_TOKEN_SPANS = Object.freeze([]);
/**
 * Creates immutable provenance metadata for a normalized command.
 * @param {string} raw The original source line.
 * @param {string} normalized The normalized line after pre-dispatch cleanup.
 * @param {string[]} words The tokenized command words.
 * @param {string} file The current source file.
 * @param {number} line The current source line number.
 * @param {boolean} [collectSourceMetadata] Whether to derive precise source spans.
 * @returns {CommandProvenance} The command provenance.
 */
export function createCommandProvenance(raw, normalized, words, file, line, collectSourceMetadata = true) {
    if (!collectSourceMetadata) {
        return {
            file,
            line,
            raw,
            normalized,
            span: EMPTY_COMMAND_SPAN,
            normalizedSpan: EMPTY_COMMAND_SPAN,
            tokenSpans: EMPTY_TOKEN_SPANS,
        };
    }
    return {
        file,
        line,
        raw,
        normalized,
        span: createLineSpan(raw, line),
        normalizedSpan: createLineSpan(normalized, line),
        tokenSpans: deriveTokenSpans(raw, words, line),
    };
}
/**
 * Builds the normalized command node used by the command pipeline.
 * @param {string} raw The original source line.
 * @param {string} normalized The normalized line after pre-dispatch cleanup.
 * @param {string[]} words The tokenized command words.
 * @param {string} file The current source file.
 * @param {number} line The current source line number.
 * @param {boolean} [collectSourceMetadata] Whether to derive precise source spans.
 * @returns {NormalizedCommand} The normalized command node.
 */
export function createNormalizedCommand(raw, normalized, words, file, line, collectSourceMetadata = true) {
    const command = normalized.trim();
    const keyword = words[0] ?? "";
    return {
        kind: classifyCommand(command, words),
        source: createCommandProvenance(raw, normalized, words, file, line, collectSourceMetadata),
        command,
        words,
        keyword,
        labelName: deriveLabelName(keyword),
        assignmentTarget: deriveAssignmentTarget(words),
        parsed: deriveCommandSemantics(command, words),
    };
}
/**
 * Creates an isolated execution copy so runtime preprocessing can mutate command
 * state without changing cached front-end program nodes.
 * @param {NormalizedCommand} command The command to clone.
 * @returns {NormalizedCommand} The detached execution command.
 */
export function cloneNormalizedCommand(command) {
    incrementInternalCounter("normalizedCommandClones");
    return { ...command };
}
/**
 * Replaces a command node's tokenized words and derived fields.
 * @param {NormalizedCommand} command The command node to update.
 * @param {string[]} words The updated token list.
 * @param {string} [normalized] Optional normalized command text.
 * @returns {NormalizedCommand} The same command node for chaining.
 */
export function setCommandWords(command, words, normalized) {
    command.words = words;
    command.keyword = words[0] ?? "";
    command.command = (normalized ?? words.join(" ")).trim();
    const normalizedSource = normalized ?? command.command;
    if (command.source.tokenSpans === EMPTY_TOKEN_SPANS) {
        command.source = {
            ...command.source,
            normalized: normalizedSource,
            normalizedSpan: EMPTY_COMMAND_SPAN,
            tokenSpans: EMPTY_TOKEN_SPANS,
        };
    }
    else {
        command.source = {
            ...command.source,
            normalized: normalizedSource,
            normalizedSpan: createLineSpan(normalizedSource, command.source.line),
            tokenSpans: deriveTokenSpans(command.source.raw, words, command.source.line),
        };
    }
    command.labelName = deriveLabelName(command.keyword);
    command.assignmentTarget = deriveAssignmentTarget(words);
    command.parsed = deriveCommandSemantics(command.command, words);
    command.kind = classifyCommand(command.command, words);
    return command;
}
/**
 * Reclassifies a normalized command without changing any other fields.
 * @param {NormalizedCommand} command The command node to update.
 * @param {CommandKind} kind The new command kind.
 * @returns {NormalizedCommand} The same command node for chaining.
 */
export function setCommandKind(command, kind) {
    command.kind = kind;
    return command;
}
/**
 * Applies lightweight heuristics to classify a normalized command.
 * @param {string} command The normalized command text.
 * @param {string[]} words The tokenized command words.
 * @returns {CommandKind} The inferred command kind.
 */
function classifyCommand(command, words) {
    const trimmed = command.trim();
    const keyword = (words[0] ?? "").toLowerCase();
    if (!trimmed || trimmed.startsWith(";")) {
        return "commentOrEmpty";
    }
    if (words.length === 3 &&
        words[1] === "=" &&
        (words[0]?.startsWith("'") || words[0]?.startsWith('"'))) {
        return "characterMapping";
    }
    if (trimmed.startsWith("!")) {
        return "defineCommand";
    }
    if (keyword === "macro" || keyword === "endmacro" || keyword.startsWith("%")) {
        return "macroDefinitionOrInvoke";
    }
    if (keyword === "undef") {
        return "defineCommand";
    }
    if (keyword === "struct" ||
        keyword === "endstruct" ||
        keyword === "skip" ||
        keyword === "datastruct" ||
        keyword === "datastructs" ||
        keyword === "enddatastructs" ||
        /^\[[^\]]+]\s*=/.test(trimmed)) {
        return "structCommand";
    }
    if (keyword === "function") {
        return "functionDefinition";
    }
    if (keyword === "global") {
        return "labelDefinition";
    }
    if (words.length === 3 && (words[1] === "=" || words[1] === ":=")) {
        return "staticAssignment";
    }
    if (deriveLabelName(words[0] ?? "")) {
        return "labelDefinition";
    }
    return keyword ? "opcodeCandidate" : "unknown";
}
/**
 * Extracts a label name from a potential label token.
 * @param {string} keyword The candidate label token.
 * @returns {string | undefined} The label name when present.
 */
function deriveLabelName(keyword) {
    if (!keyword) {
        return undefined;
    }
    if (keyword === ":") {
        return ":";
    }
    if (/^\++:?$/.test(keyword) || /^-+:?$/.test(keyword)) {
        return keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
    }
    if (keyword.endsWith(":") || keyword.startsWith(".")) {
        return keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
    }
    return undefined;
}
/**
 * Extracts a static assignment target from a simple `name = value` command.
 * @param {string[]} words The tokenized command words.
 * @returns {string | undefined} The assignment target when present.
 */
function deriveAssignmentTarget(words) {
    if (words.length === 3 && (words[1] === "=" || words[1] === ":=")) {
        return words[0];
    }
    return undefined;
}
/**
 * Derives semantic payloads from a normalized command's stable syntax.
 * @param {string} command The normalized command text.
 * @param {string[]} words The tokenized command words.
 * @returns {CommandSemantics} Parsed semantic payloads keyed by construct type.
 */
function deriveCommandSemantics(command, words) {
    const keyword = (words[0] ?? "").toLowerCase();
    const bareKeyword = keyword.startsWith(".") ? keyword.slice(1) : keyword;
    const semantics = {};
    if ((keyword === "if" || keyword === "elseif" || keyword === "while") && words.length > 1) {
        semantics.condition = {
            expression: parseExpressionNode(words.slice(1).join(" ")),
        };
    }
    if (keyword === "for" && words.length >= 4 && words[2] === "=") {
        const variable = words[1];
        const parsedRange = parseExpressionNode(words.slice(3).join(" "));
        if (parsedRange.type === "range") {
            semantics.forLoop = {
                variable,
                range: parsedRange,
                start: parsedRange.start,
                end: parsedRange.end,
            };
        }
    }
    if (words.length === 3 &&
        (words[1] === "=" || words[1] === ":=") &&
        !(words[0]?.startsWith("'") || words[0]?.startsWith('"'))) {
        semantics.assignment = {
            target: words[0],
            expression: parseExpressionNode(words[2]),
        };
    }
    if (bareKeyword === "incbin" && words.length >= 2) {
        const incbinSource = command
            .slice((words[0] ?? "").length)
            .split(/\s+->\s+/u, 1)[0]
            .trim();
        const colonIndex = incbinSource.indexOf(":");
        const rangeCandidate = colonIndex === -1 ? undefined : incbinSource.slice(colonIndex + 1);
        if (rangeCandidate) {
            const parsedRange = parseExpressionNode(rangeCandidate);
            if (parsedRange.type === "range") {
                semantics.incbinRange = {
                    range: parsedRange,
                    start: parsedRange.start,
                    end: parsedRange.end,
                };
            }
        }
        const includePath = extractIncludePath(incbinSource);
        if (includePath) {
            semantics.includeTarget = { directive: "incbin", target: includePath };
        }
    }
    if (keyword.startsWith("%")) {
        const invocationText = command.trim().slice(1);
        const openParen = invocationText.indexOf("(");
        if (openParen !== -1 && invocationText.endsWith(")")) {
            const name = invocationText.slice(0, openParen).trim();
            const argsText = invocationText.slice(openParen + 1, -1);
            const args = splitCommaArguments(argsText);
            semantics.macroInvocation = { name, args };
        }
        else if (invocationText) {
            semantics.macroInvocation = { name: invocationText.trim(), args: [] };
        }
    }
    if ((bareKeyword === "include" || bareKeyword === "incsrc") && words.length >= 2) {
        semantics.includeTarget = {
            directive: bareKeyword,
            target: words.slice(1).join(" ").trim(),
        };
    }
    const labelSplit = extractLabelSplit(command);
    if (labelSplit) {
        semantics.labelSplit = labelSplit;
    }
    if (["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"].includes(keyword) && words.length >= 2) {
        const payload = command.slice((words[0] ?? "").length).trim();
        semantics.dataDirective = {
            directive: keyword,
            operands: splitCommaArguments(payload),
        };
    }
    if (keyword && !keyword.startsWith("%") && !keyword.startsWith("!")) {
        const payload = command.slice((words[0] ?? "").length).trim();
        const args = semantics.dataDirective?.operands ?? (payload ? splitCommaArguments(payload) : []);
        semantics.directiveArgs = {
            name: keyword,
            args,
        };
        if (!deriveLabelName(words[0] ?? "") && payload) {
            semantics.opcodeOperands = {
                mnemonic: words[0] ?? "",
                operandText: payload,
                operands: args,
            };
        }
    }
    // void command.
    return semantics;
}
/**
 * Extracts an include/incbin path, stripping quotes and an optional `:range` suffix.
 * @param {string} raw The raw filename operand.
 * @returns {string} The path token.
 */
function extractIncludePath(raw) {
    const trimmed = raw.trim();
    const quote = trimmed[0];
    if (quote === '"' || quote === "'" || quote === "`") {
        const end = trimmed.indexOf(quote, 1);
        if (end !== -1) {
            return trimmed.slice(1, end);
        }
    }
    const colonIndex = trimmed.indexOf(":");
    const pathToken = colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex);
    return pathToken.replace(/^["'`]+|["'`]+$/g, "");
}
/**
 * Extracts the label split from a command.
 * @param {string} command The command to extract the label split from.
 * @returns {ParsedLabelSplit | undefined} The label split when present.
 */
function extractLabelSplit(command) {
    const trimmed = command.trim();
    const labelMatch = trimmed.match(/^([$.?A-Z_a-z][\w$.?]*):\s*(.*)$/);
    if (!labelMatch) {
        return undefined;
    }
    const trailing = labelMatch[2].trim();
    return {
        label: labelMatch[1],
        trailing: trailing || undefined,
    };
}
/**
 * Splits comma-separated arguments into an array of strings.
 * Handles quoted strings and nested parentheses.
 * @param {string} input The input string to split.
 * @returns {string[]} An array of split values.
 */
function splitCommaArguments(input) {
    const values = [];
    let current = "";
    let depth = 0;
    let inQuote = false;
    let quoteChar = "";
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if ((char === '"' || char === "'") && input[i - 1] !== "\\") {
            if (!inQuote) {
                inQuote = true;
                quoteChar = char;
            }
            else if (quoteChar === char) {
                inQuote = false;
            }
            current += char;
            continue;
        }
        if (!inQuote && char === "(") {
            depth++;
            current += char;
            continue;
        }
        if (!inQuote && char === ")") {
            depth = Math.max(0, depth - 1);
            current += char;
            continue;
        }
        if (!inQuote && depth === 0 && char === ",") {
            const normalized = current.trim();
            if (normalized) {
                values.push(normalized);
            }
            current = "";
            continue;
        }
        current += char;
    }
    const tail = current.trim();
    if (tail) {
        values.push(tail);
    }
    return values;
}
//# sourceMappingURL=normalized-command.js.map