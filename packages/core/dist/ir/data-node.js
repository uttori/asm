import { withSourceSyntax, recordSyntaxBoundary } from "../internal-instrumentation.js";
import { splitRespectingFunctions } from "../services/command-text-service.js";
import { dataResolutionExpression } from "./directive-arguments.js";
import { parseExpressionAtSite } from "./expression-node.js";
import { fragmentText, sourceFragment } from "./source-fragment.js";
/** Data strings preserve escapes for the character-table/define phase, unlike function string arguments. */
export function parseDataOperand(text) {
    let value = text.trim();
    const quote = value[0];
    if (quote === '"' || quote === "'") {
        return { text, expression: { type: "string", quote, value: value.slice(1, -1) } };
    }
    if (value.startsWith("#")) {
        value = value.slice(1);
    }
    if (/![\w{]/.test(value)) {
        return { text, expression: { type: "template", form: "source", text: value } };
    }
    return {
        text,
        expression: dataResolutionExpression(value, parseExpressionAtSite(value, "statement")),
    };
}
/** Pure grammar entry for source-generated lists; functions and quoted commas stay in one element. */
export function parseDataList(text) {
    return splitRespectingFunctions(text).map(parseDataOperand);
}
/**
 * Bind grammar-changing defines before selecting data elements. This is a source-generation
 * boundary: values remain unevaluated, and execution order is still owned by the data writer.
 */
export function bindDataOperand(operand, bind) {
    if (operand.expression.type !== "template" || operand.expression.form !== "source") {
        return [operand];
    }
    let text = operand.expression.text;
    let fragment = sourceFragment(text, []);
    const seen = new Set();
    while (!seen.has(text)) {
        seen.add(text);
        fragment = bind(fragment);
        const next = fragmentText(fragment);
        if (next === text) {
            if (text === operand.text.trim()) {
                return [operand];
            }
            recordSyntaxBoundary("generated-fragment-parse");
            return withSourceSyntax(() => parseDataList(text));
        }
        text = next;
    }
    throw new Error("Recursive define in data operand.");
}
//# sourceMappingURL=data-node.js.map