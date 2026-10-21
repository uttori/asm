import { inheritExpressionOccurrence, parseLiteralValue, } from "./expression-node.js";
import { bindSourceFragment, fragmentText, sourceFragment, } from "./source-fragment.js";
import { parseNumericDataStatement } from "./statement-node.js";
const patterns = {
    defineName: /!<(\w+)>/g,
    deprecated: /<!(\w+)>/g,
    named: /<(\w+)>/g,
    backslash: /\\([A-Z_a-z]\w*)/g,
    variadic: /<(?:\.{3}|…)\[([^\]]+)]>/g,
    count: /sizeof\((?:\.{3}|…)\)/g,
};
/** Each phase has its own matches because define-name and named placeholders can overlap. */
function placeholders(text, kind) {
    return Array.from(text.matchAll(patterns[kind]), (match) => ({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        payload: match.length > 1 ? match[1] : "",
    }));
}
/** Capture replacement positions without resolving parameters, defines, or control expressions. */
export function createMacroLineTemplate(command) {
    const text = command.command;
    return {
        command,
        text,
        numericData: /<\w+>/.test(text) ? parseNumericDataStatement(command) : undefined,
        placeholders: {
            defineName: placeholders(text, "defineName"),
            deprecated: placeholders(text, "deprecated"),
            named: placeholders(text, "named"),
            backslash: placeholders(text, "backslash"),
            variadic: placeholders(text, "variadic"),
            count: placeholders(text, "count"),
        },
    };
}
/** Bind atomic data parameters as syntax; separator/identifier/string-generating values use fragments. */
export function bindNumericMacroTemplate(template, args, fragment) {
    if (!template.numericData || !template.placeholders.named.length) {
        return undefined;
    }
    if (["defineName", "deprecated", "backslash", "variadic", "count"].some((kind) => template.placeholders[kind].length > 0)) {
        return undefined;
    }
    const replacements = new Map();
    for (const part of template.placeholders.named) {
        const value = args.get(part.payload)?.trim();
        // oxlint-disable-next-line security/detect-unsafe-regex -- Each anchored alternative has disjoint radix/decimal delimiters.
        if (!value || !/^(?:\$[\dA-Fa-f]+|%[01]+|\d+(?:\.\d+)?)$/.test(value)) {
            return undefined;
        }
        const numericValue = parseLiteralValue(value);
        if (!Number.isFinite(numericValue)) {
            return undefined;
        }
        replacements.set(part.payload, { type: "literal", value, numericValue });
    }
    let boundSites = 0;
    const visit = (node) => {
        if (node.type === "template" && node.form === "parameter" && node.name) {
            const replacement = replacements.get(node.name);
            if (replacement) {
                boundSites++;
                return inheritExpressionOccurrence(replacement, node);
            }
        }
        if (node.type === "binary") {
            return { ...node, left: visit(node.left), right: visit(node.right) };
        }
        if (node.type === "unary") {
            return { ...node, argument: visit(node.argument) };
        }
        if (node.type === "call") {
            return { ...node, arguments: node.arguments.map(visit) };
        }
        if (node.type === "index") {
            return { ...node, index: visit(node.index) };
        }
        return node;
    };
    const bindText = (text) => fragmentText(bindMacroFragment(undefined, sourceFragment(text), "named", (part) => sourceFragment(args.get(part.payload)?.trim() ?? part.text)));
    const statement = {
        ...template.numericData,
        operands: template.numericData.operands.map((operand) => ({
            text: bindText(operand.text),
            expression: visit(operand.expression),
        })),
    };
    // A lexical occurrence in a string, member name or callee can alter grammar or source data.
    // Only reuse syntax when every replacement was an expression leaf.
    if (boundSites !== template.placeholders.named.length) {
        return undefined;
    }
    const text = fragmentText(fragment);
    const command = template.command;
    return {
        ...command,
        kind: "directive",
        command: text,
        words: command.words.map(bindText),
        source: {
            ...command.source,
            raw: text,
            normalized: text,
            fragment,
            physical: { text: command.source.physical?.text ?? command.source.raw },
        },
        parsed: {
            ...command.parsed,
            dataDirective: {
                ...command.parsed.dataDirective,
                operands: statement.operands.map((operand) => operand.text),
            },
        },
        syntax: { kind: "numericData", statement },
    };
}
/** Rescan a phase after earlier substitutions change its input; cached positions never index changed text. */
export function replaceMacroPlaceholders(template, text, kind, resolve) {
    return fragmentText(bindMacroFragment(template, sourceFragment(text), kind, (part) => sourceFragment(resolve(part.text, part.payload))));
}
/** Parse one ordered phase against its actual input, then bind sites without losing source contributors. */
export function bindMacroFragment(template, fragment, kind, resolve) {
    const text = fragmentText(fragment);
    const parts = template?.text === text ? template.placeholders[kind] : placeholders(text, kind);
    return bindSourceFragment(fragment, parts.map((part) => ({ start: part.start, end: part.end, value: resolve(part) })));
}
export { parseMacroArguments } from "./macro-arguments.js";
//# sourceMappingURL=macro-template.js.map