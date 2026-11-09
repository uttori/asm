import { createSourceSpan } from "../source-location.js";
import { parseDirectiveExpression } from "./directive-arguments.js";
import { syntaxExpression, syntaxSpan, syntaxObject } from "./syntax-codec.js";
/**
 * Parse only the `includeAsset(...)` form; leave all other commands alone.
 * @param command Normalized source command.
 * @param [line] Zero-based source line for argument spans.
 * @returns Typed call with argument spans, if present.
 */
export function parseAssetCall(command, line) {
    const leading = command.length - command.trimStart().length;
    const trimmed = command.slice(leading);
    const label = /^[\w$.?]+:/.exec(trimmed);
    let callStart = leading;
    if (label && /\s/.test(trimmed[label[0].length] ?? "")) {
        callStart += label[0].length;
        while (/\s/.test(command[callStart] ?? "")) {
            callStart++;
        }
    }
    const prefix = /^includeasset\s*\(/i.exec(command.slice(callStart));
    if (!prefix) {
        return undefined;
    }
    let at = callStart + prefix[0].length;
    const span = (start, end) => createSourceSpan(start, end, line);
    const fail = (message) => {
        throw new Error(`includeAsset at column ${at + 1}: ${message}`);
    };
    const skip = () => {
        while (/\s/.test(command[at] ?? "") && at < command.length) {
            at++;
        }
    };
    const string = () => {
        const start = at;
        const quote = command[at++];
        let value = "";
        while (at < command.length) {
            const character = command[at++];
            if (character === quote) {
                return { kind: "string", value, span: span(start, at) };
            }
            if (character === "\\") {
                const escaped = at < command.length ? command[at] : undefined;
                at++;
                if (escaped === undefined) {
                    fail("unterminated string escape");
                }
                // Preserve assembler define escapes; decode only syntax escapes.
                if (escaped === quote || escaped === "\\") {
                    value += escaped;
                }
                else if (escaped === "n") {
                    value += "\n";
                }
                else if (escaped === "t") {
                    value += "\t";
                }
                else {
                    value += `\\${escaped}`;
                }
            }
            else {
                value += character;
            }
        }
        return fail("unterminated string");
    };
    const value = () => {
        skip();
        const start = at;
        const character = command[at];
        if (character === '"' || character === "'") {
            return string();
        }
        if (character === "[") {
            at++;
            const items = [];
            skip();
            while (command[at] !== "]") {
                items.push(value());
                skip();
                if (command[at] === "]") {
                    break;
                }
                if (command[at++] !== ",") {
                    fail("expected ',' in array");
                }
                skip();
            }
            if (command[at++] !== "]") {
                fail("unterminated array");
            }
            return { kind: "array", items, span: span(start, at) };
        }
        if (character === "{") {
            at++;
            const entries = {};
            skip();
            while (command[at] !== "}") {
                let key;
                if (command[at] === '"' || command[at] === "'") {
                    key = string().value;
                }
                else {
                    const match = /^[A-Z_a-z][\w-]*/.exec(command.slice(at));
                    if (!match) {
                        return fail("expected object key");
                    }
                    key = match[0];
                    at += key.length;
                }
                skip();
                if (command[at++] !== ":") {
                    fail("expected ':' after object key");
                }
                if (Object.hasOwn(entries, key)) {
                    fail(`duplicate object key '${key}'`);
                }
                entries[key] = value();
                skip();
                if (command[at] === "}") {
                    break;
                }
                if (command[at++] !== ",") {
                    fail("expected ',' in object");
                }
                skip();
            }
            if (command[at++] !== "}") {
                fail("unterminated object");
            }
            return { kind: "object", entries, span: span(start, at) };
        }
        let parens = 0;
        while (at < command.length) {
            const next = command[at];
            if (next === "(") {
                parens++;
            }
            else if (next === ")") {
                if (parens === 0) {
                    break;
                }
                parens--;
            }
            else if (parens === 0 && (next === "," || next === "]" || next === "}")) {
                break;
            }
            at++;
        }
        if (parens !== 0) {
            fail("unbalanced numeric expression");
        }
        const expression = command.slice(start, at).trim();
        if (expression === "true" || expression === "false") {
            return { kind: "boolean", value: expression === "true", span: span(start, at) };
        }
        if (!expression) {
            fail("expected value");
        }
        return {
            kind: "number",
            expression: parseDirectiveExpression(expression, false),
            text: expression,
            span: span(start, at),
        };
    };
    const positional = [];
    const options = {};
    let named = false;
    while (true) {
        skip();
        if (command[at] === ")") {
            break;
        }
        const namedMatch = /^([A-Z_a-z][\w-]*)\s*:/.exec(command.slice(at));
        if (namedMatch) {
            named = true;
            at += namedMatch[0].length;
            if (Object.hasOwn(options, namedMatch[1])) {
                fail(`duplicate option '${namedMatch[1]}'`);
            }
            options[namedMatch[1]] = value();
        }
        else {
            if (named) {
                fail("positional argument after named argument");
            }
            positional.push(value());
        }
        skip();
        if (command[at] === ")") {
            break;
        }
        if (command[at++] !== ",") {
            fail("expected ',' between arguments");
        }
    }
    if (command[at++] !== ")") {
        fail("unterminated call");
    }
    skip();
    if (at !== command.length) {
        fail("unexpected text after call");
    }
    const stringArgument = (argument) => {
        if (!argument || argument.kind !== "string") {
            throw new Error(`includeAsset at column ${at + 1}: expected exactly two leading string arguments`);
        }
        return argument;
    };
    if (positional.length !== 2) {
        fail("expected exactly two leading string arguments");
    }
    return {
        path: stringArgument(positional[0]),
        format: stringArgument(positional[1]),
        options,
        span: span(callStart, at),
    };
}
/** Transport validation mirrors the recursive asset grammar without interpreting string data. */
export const assetCallGuard = (value) => {
    if (!syntaxObject(value)) {
        return false;
    }
    const call = value;
    return (assetValueGuard(call.path) &&
        call.path.kind === "string" &&
        assetValueGuard(call.format) &&
        call.format.kind === "string" &&
        assetEntriesGuard(call.options) &&
        syntaxSpan(call.span));
};
/** Accepts a plain non-array object whose every value is a valid asset value node. */
function assetEntriesGuard(value) {
    return (!!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.values(value).every(assetValueGuard));
}
/** Recursively validates one asset value node, including its span and kind-specific payload. */
function assetValueGuard(value) {
    if (!syntaxObject(value)) {
        return false;
    }
    const node = value;
    if (!syntaxSpan(node.span)) {
        return false;
    }
    switch (node.kind) {
        case "string":
            return typeof node.value === "string";
        case "boolean":
            return typeof node.value === "boolean";
        case "number":
            return typeof node.text === "string" && syntaxExpression(node.expression);
        case "array":
            return Array.isArray(node.items) && node.items.every(assetValueGuard);
        case "object":
            return assetEntriesGuard(node.entries);
        default:
            return false;
    }
}
//# sourceMappingURL=asset-call.js.map