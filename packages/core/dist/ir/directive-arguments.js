import { recordExecutionParser } from "../internal-instrumentation.js";
import { parseExpressionAtSite, } from "./expression-node.js";
/** Bind lexical defines before numeric argument dispatch; substitutions may change call/list grammar. */
export function parseDirectiveExpression(text, numeric = true, source) {
    recordExecutionParser("directive");
    if (/![\w{]/.test(text)) {
        return { type: "template", form: "source", text };
    }
    const node = parseExpressionAtSite(text, "statement", source);
    return numeric ? dataResolutionExpression(text, node) : node;
}
/** Quoted directive names and paths keep escape sequences as data for their owning runtime. */
export function unquoteDirectiveText(text) {
    const quote = text[0];
    if ((quote === '"' || quote === "'") && text.endsWith(quote) && text.length > 1) {
        return text.slice(1, -1);
    }
    return text;
}
/** Grouped dotted/indexed atoms historically name a symbol including parentheses in numeric data. */
export function dataResolutionExpression(text, node) {
    if (node.parenthesized &&
        (node.type === "member" ||
            node.type === "index" ||
            (node.type === "literal" && node.value.includes(".")))) {
        return { type: "identifier", name: text, ...(node.span ? { span: node.span } : {}) };
    }
    return node;
}
//# sourceMappingURL=directive-arguments.js.map