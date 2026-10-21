import { recordSyntaxBoundary, withSourceSyntax } from "../internal-instrumentation.js";
import { inheritExpressionOccurrence, parseExpressionAtSite, } from "./expression-node.js";
import { bindSourceFragment, fragmentText, sourceFragment, } from "./source-fragment.js";
// Weak ownership follows the definition; bounded variants prevent unbounded string arguments
// from retaining an entire invocation history. Values are evaluated afresh from the cached syntax.
const generatedSyntax = new WeakMap();
/** Parameter matching follows the original whole-word rule, including quoted strings and member names. */
function parameterSites(text, name) {
    const sites = [];
    if (!name) {
        return sites;
    }
    for (let start = text.indexOf(name); start >= 0; start = text.indexOf(name, start + name.length)) {
        const end = start + name.length;
        const before = /\w/.test(text[start - 1] ?? "");
        const first = /\w/.test(name[0]);
        const last = /\w/.test(name.at(-1) ?? "");
        const after = /\w/.test(text[end] ?? "");
        if (before !== first && last !== after) {
            sites.push({ start, end });
        }
    }
    return sites;
}
/** Compile without resolving symbols, invoking host functions, or validating an inactive body. */
export function compileFunctionTemplate(text, parameters) {
    return {
        text,
        parameters: [...parameters],
        syntax: parseExpressionAtSite(text, "command"),
        sites: parameters.map((name) => parameterSites(text, name)),
    };
}
/** Preserve the dialect's replacement-string dollar escapes as explicit literal fragments. */
function replacementText(value, input, start, end) {
    let result = "";
    for (let index = 0; index < value.length; index++) {
        if (value[index] === "$" && index + 1 < value.length) {
            const next = value[index + 1];
            if (next === "$") {
                result += "$";
                index++;
                continue;
            }
            if (next === "&") {
                result += input.slice(start, end);
                index++;
                continue;
            }
            if (next === "`") {
                result += input.slice(0, start);
                index++;
                continue;
            }
            if (next === "'") {
                result += input.slice(end);
                index++;
                continue;
            }
        }
        result += value[index];
    }
    return result;
}
/** Bind numeric parameter occurrences directly only when every lexical site is an expression leaf. */
function bindNumericTemplate(template, values) {
    if (values.some((value) => typeof value !== "number" || !Number.isFinite(value) || /e/i.test(String(value)))) {
        return undefined;
    }
    const counts = template.parameters.map(() => 0);
    const visit = (node) => {
        if (node.type === "identifier") {
            const index = template.parameters.indexOf(node.name);
            if (index >= 0) {
                counts[index]++;
                const value = values[index];
                if (typeof value !== "number") {
                    return node;
                }
                const text = String(value);
                let replacement = { type: "literal", value: text, numericValue: value };
                // A negative replacement is unary syntax, not an implicit group; exponent/rounding semantics stay lexical.
                if (value < 0) {
                    replacement = {
                        type: "unary",
                        operator: "-",
                        argument: { type: "literal", value: String(-value), numericValue: -value },
                    };
                }
                return inheritExpressionOccurrence(replacement, node);
            }
            return node;
        }
        switch (node.type) {
            case "binary":
                return { ...node, left: visit(node.left), right: visit(node.right) };
            case "unary":
                return { ...node, argument: visit(node.argument) };
            case "call":
                return { ...node, arguments: node.arguments.map(visit) };
            case "range":
                return { ...node, start: visit(node.start), end: visit(node.end) };
            // Replacing reference roots/properties can change grammar; the fragment path owns those sites.
            case "index":
                return { ...node, index: visit(node.index) };
            case "defineReference":
            case "error":
            case "literal":
            case "member":
            case "raw":
            case "relativeReference":
            case "sourceText":
            case "string":
            case "template":
                return node;
        }
        return node;
    };
    const result = visit(template.syntax);
    return counts.every((count, index) => count === template.sites[index].length)
        ? result
        : undefined;
}
/** Ordered lexical binding is intentional source generation when a substitution can change grammar. */
export function bindFunctionTemplate(template, values) {
    const numeric = bindNumericTemplate(template, values);
    if (numeric) {
        return numeric;
    }
    let fragment = sourceFragment(template.text);
    for (let index = 0; index < template.parameters.length; index++) {
        const text = fragmentText(fragment);
        const sites = text === template.text
            ? template.sites[index]
            : parameterSites(text, template.parameters[index]);
        const value = values[index];
        const spelling = typeof value === "string" ? JSON.stringify(value) : String(value);
        fragment = bindSourceFragment(fragment, sites.map((site) => ({
            start: site.start,
            end: site.end,
            value: sourceFragment(replacementText(spelling, text, site.start, site.end)),
        })));
    }
    const text = fragmentText(fragment);
    let cache = generatedSyntax.get(template);
    if (!cache) {
        cache = new Map();
        generatedSyntax.set(template, cache);
    }
    let syntax = cache.get(text);
    if (!syntax) {
        recordSyntaxBoundary("generated-fragment-parse");
        syntax = withSourceSyntax(() => parseExpressionAtSite(text, "generated-expression"));
        if (cache.size >= 128) {
            cache.delete(cache.keys().next().value);
        }
        cache.set(text, syntax);
    }
    return syntax;
}
//# sourceMappingURL=function-template.js.map