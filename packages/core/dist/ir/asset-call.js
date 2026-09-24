import { createSourceSpan } from "../source-location.js";
/** Parse only the `includeAsset(...)` form; leave all other commands alone.
 * @param {string} command Normalized source command.
 * @param {number} [line] Zero-based source line for argument spans.
 * @returns {ParsedAssetCall | undefined} Typed call with argument spans, if present.
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
                const escaped = command[at++];
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
        return { kind: "number", expression, span: span(start, at) };
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
    if (positional.length !== 2 ||
        positional[0].kind !== "string" ||
        positional[1].kind !== "string") {
        fail("expected exactly two leading string arguments");
    }
    return {
        path: positional[0],
        format: positional[1],
        options,
        span: span(callStart, at),
    };
}
//# sourceMappingURL=asset-call.js.map