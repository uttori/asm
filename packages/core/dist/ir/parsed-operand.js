import { parseDirectiveExpression } from "./directive-arguments.js";
import { parseExpressionAtSite, isReferenceExpressionNode, } from "./expression-node.js";
import { sourceFragment, fragmentText } from "./source-fragment.js";
/** Pure target-selected operand grammar shared by physical input and attributed generated fragments. */
export function parseInstructionOperands(mnemonic, text, grammar) {
    const suffix = /\.([blw])$/i.exec(mnemonic)?.[1]?.toLowerCase();
    let width;
    if (suffix === "b") {
        width = 1;
    }
    else if (suffix === "w") {
        width = 2;
    }
    else if (suffix === "l") {
        width = 3;
    }
    const mnemonicBit = grammar.bitSelectors
        ? /^(?:bbs|bbc|set1|clr1)([0-7])$/i.exec(mnemonic)?.[1]
        : undefined;
    const result = {
        operands: [],
    };
    if (width) {
        result.width = width;
    }
    if (mnemonicBit !== undefined) {
        result.mnemonicBit = Number(mnemonicBit);
    }
    if (!text.trim()) {
        return result;
    }
    // A define may generate separators/registers, so bind the whole operand fragment before classification.
    if (grammar.templates !== false && /![\w{]|<[^>]+>|\\[A-Z_a-z]/.test(text)) {
        result.operands.push({
            kind: "template",
            fragment: sourceFragment(text, []),
            structure: parseInstructionOperands(mnemonic, text, { ...grammar, templates: false }),
            span: { start: 0, end: text.length },
        });
        return result;
    }
    try {
        const parts = operandParts(text, ",");
        for (let index = 0; index < parts.length; index++) {
            let part = parts[index];
            const next = parts[index + 1];
            if (grammar.commaIndex && next && grammar.indexRegisters.includes(next.text.toLowerCase())) {
                part = { text: text.slice(part.start, next.end), start: part.start, end: next.end };
                index++;
            }
            result.operands.push(parseOperand(part.text, part.start, grammar));
        }
    }
    catch (cause) {
        result.operands = [
            {
                kind: "invalid",
                message: cause instanceof Error ? cause.message : String(cause),
                span: { start: 0, end: text.length },
            },
        ];
    }
    return result;
}
/** Delimiter-aware splitting preserves expression grouping, calls, indexes and quoted arguments. */
function operandParts(text, separator) {
    const parts = [];
    const stack = [];
    let quote = "";
    let start = 0;
    const append = (end) => {
        const raw = text.slice(start, end);
        const value = raw.trim();
        const offset = start + raw.length - raw.trimStart().length;
        parts.push({ text: value, start: offset, end: offset + value.length });
    };
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (quote) {
            if (char === "\\") {
                index++;
            }
            else if (char === quote) {
                quote = "";
            }
        }
        else if (char === '"' || char === "'") {
            quote = char;
        }
        else if ("([{".includes(char)) {
            stack.push(char);
        }
        else if (")]}".includes(char)) {
            const opening = { ")": "(", "]": "[", "}": "{" }[char];
            if (stack.pop() !== opening) {
                throw new Error("Mismatched operand delimiters.");
            }
        }
        else if (char === separator && stack.length === 0) {
            append(index);
            start = index + 1;
        }
    }
    if (quote || stack.length) {
        throw new Error("Unclosed operand delimiter.");
    }
    append(text.length);
    return parts;
}
/** Width intent is read once from source atoms; resolved values never become hexadecimal source. */
function scalar(text, start, force) {
    const expression = parseDirectiveExpression(text, true, { text, offset: 0, line: 0 });
    let spelling = "expression";
    let literalBytes;
    const hex = /^\$([\da-f]+)$/i.exec(text);
    const binary = /^%([01]+)$/.exec(text);
    if (hex) {
        spelling = "hex";
        literalBytes = Math.max(1, Math.ceil(hex[1].length / 2));
    }
    else if (binary) {
        spelling = "binary";
        literalBytes = Math.max(1, Math.ceil(binary[1].length / 8));
        // eslint-disable-next-line security/detect-unsafe-regex -- Repeated fields are separated by mandatory delimiters.
    }
    else if (/^-?\d+(?:\.\d+)?$/.test(text)) {
        spelling = "decimal";
    }
    else if (isReferenceExpressionNode(expression)) {
        spelling = "symbol";
    }
    return {
        expression,
        ...(expression.type === "template"
            ? {
                referenceExpression: parseExpressionAtSite(text, "statement", {
                    text,
                    offset: 0,
                    line: 0,
                }),
            }
            : {}),
        width: {
            spelling,
            grouped: expression.parenthesized === true,
            ...(force ? { forcedBytes: force } : {}),
            ...(literalBytes ? { literalBytes } : {}),
        },
        span: { start, end: start + text.length },
    };
}
function parseOperand(text, start, grammar) {
    const span = { start, end: start + text.length };
    if (!text) {
        return { kind: "invalid", message: "Missing operand.", span };
    }
    const name = text.toLowerCase();
    if (grammar.registers.includes(name)) {
        return { kind: "register", name, span };
    }
    if (text.startsWith("#")) {
        const value = text.slice(1).trim();
        return { kind: "immediate", value: scalar(value, start + text.indexOf(value, 1)), span };
    }
    let body = text;
    let offset = start;
    let force;
    const prefix = grammar.ca65Widths ? /^([afz]):\s*/i.exec(body) : undefined;
    if (prefix) {
        const code = prefix[1].toLowerCase();
        if (code === "z") {
            force = 1;
        }
        else if (code === "a") {
            force = 2;
        }
        else {
            force = 3;
        }
        body = body.slice(prefix[0].length);
        offset += prefix[0].length;
    }
    let inverted = false;
    if (grammar.bitSelectors && body.startsWith("/")) {
        inverted = true;
        body = body.slice(1);
        offset++;
    }
    let index;
    const outside = grammar.commaIndex ? operandParts(body, ",") : operandParts(body, "+");
    if ((grammar.commaIndex || grammar.plusIndex) && outside.length > 1) {
        const last = outside.at(-1);
        if (grammar.indexRegisters.includes(last.text.toLowerCase())) {
            index = {
                register: last.text.toLowerCase(),
                position: "outside",
                separator: grammar.commaIndex ? "," : "+",
            };
            body = body
                .slice(0, last.start - 1)
                .replace(/[+,]\s*$/, "")
                .trimEnd();
        }
    }
    let postIncrement = false;
    if (grammar.plusIndex && /\)\s*\+$/.test(body)) {
        postIncrement = true;
        body = body.slice(0, body.lastIndexOf("+")).trimEnd();
    }
    let delimiter = "none";
    if ((body.startsWith("(") && body.endsWith(")")) ||
        (body.startsWith("[") && body.endsWith("]"))) {
        // Only an outer pair enclosing the complete address is addressing punctuation.
        const inner = body.slice(1, -1);
        try {
            operandParts(inner, ",");
            delimiter = body[0] === "(" ? "parentheses" : "brackets";
            const trimmed = inner.trim();
            offset += 1 + inner.length - inner.trimStart().length;
            body = trimmed;
        }
        catch {
            /* Arithmetic such as `(a)+(b)` retains its expression groups. */
        }
    }
    if (delimiter !== "none" && grammar.plusIndex && body.endsWith("+")) {
        const candidate = body.slice(0, -1).trimEnd();
        // SPC source accepts both (X)+ and (X+); only a register may own post-increment.
        if (grammar.registers.includes(candidate.toLowerCase())) {
            postIncrement = true;
            body = candidate;
        }
    }
    if (delimiter !== "none") {
        const inside = operandParts(body, grammar.commaIndex ? "," : "+");
        if (inside.length === 2 && grammar.indexRegisters.includes(inside[1].text.toLowerCase())) {
            if (index) {
                // Stack-relative indirect addressing has both an inner stack register and outer Y.
                const address = scalar(inside[0].text, offset + inside[0].start, force);
                return {
                    kind: "memory",
                    address,
                    delimiter,
                    index,
                    innerIndex: inside[1].text.toLowerCase(),
                    span,
                };
            }
            index = {
                register: inside[1].text.toLowerCase(),
                position: "inside",
                separator: grammar.commaIndex ? "," : "+",
            };
            body = inside[0].text;
            offset += inside[0].start;
        }
    }
    let bit;
    const bitMatch = grammar.bitSelectors ? /\.([0-7])$/.exec(body) : undefined;
    if (bitMatch) {
        bit = { selector: scalar(bitMatch[1], offset + body.length - 1), inverted };
        body = body.slice(0, bitMatch.index).trimEnd();
    }
    const register = body.toLowerCase();
    const address = delimiter !== "none" && grammar.registers.includes(register)
        ? {
            kind: "register",
            name: register,
            span: { start: offset, end: offset + body.length },
        }
        : scalar(body, offset, force);
    return {
        kind: "memory",
        address,
        delimiter,
        span,
        ...(index ? { index } : {}),
        ...(postIncrement ? { postIncrement } : {}),
        ...(bit ? { bit } : {}),
    };
}
/** A failed generated-operand binding retains a structured reason for target-stage diagnostics. */
export class OperandTemplateBindingError extends Error {
    reason;
    constructor(reason, message) {
        super(message);
        this.reason = reason;
    }
}
/** Re-enter only the selected target grammar when define/macro binding can change operand structure. */
export function bindInstructionOperands(syntax, bind, parse) {
    // Most operands contain no template; allocate cycle tracking only for actual binding work.
    if (syntax.operands.length !== 1 || syntax.operands[0].kind !== "template") {
        return syntax;
    }
    const seen = new Set();
    // Every iteration is a declared source-generation boundary. Bound the chain as well as
    // detecting cycles, since a recursive definition may grow instead of repeating its text.
    for (let depth = 0; depth < 128; depth++) {
        if (syntax.operands.length !== 1 || syntax.operands[0].kind !== "template") {
            return syntax;
        }
        const template = syntax.operands[0];
        const text = fragmentText(template.fragment);
        if (seen.has(text)) {
            throw new OperandTemplateBindingError("recursive", "Recursive operand template.");
        }
        seen.add(text);
        const fragment = bind(template.fragment);
        const next = fragmentText(fragment);
        if (next === text) {
            throw new OperandTemplateBindingError("unbound", "Unbound operand template.");
        }
        syntax = parse(next);
        if (syntax.operands.length === 1 && syntax.operands[0].kind === "template") {
            syntax = { ...syntax, operands: [{ ...syntax.operands[0], fragment }] };
        }
    }
    throw new OperandTemplateBindingError("depth", "Operand template expansion exceeds 128 phases.");
}
//# sourceMappingURL=parsed-operand.js.map