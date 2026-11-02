import { withSourceSyntax, recordSyntaxBoundary } from "../internal-instrumentation.js";
import { splitRespectingFunctions } from "../services/command-text-service.js";
import { dataResolutionExpression } from "./directive-arguments.js";
import { parseExpressionAtSite, type ExpressionNode } from "./expression-node.js";
import { fragmentText, sourceFragment, type SourceFragment } from "./source-fragment.js";

/** A data element owns its spelling for diagnostics; its expression supplies all value semantics. */
export type DataOperand = {
  /** Operand spelling as written, before `#` stripping or define binding. */
  text: string;
  /** Parsed value; string operands keep their escapes undecoded. */
  expression: ExpressionNode;
};

/** Data strings preserve escapes for the character-table/define phase, unlike function string arguments. */
export function parseDataOperand(text: string): DataOperand {
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
export function parseDataList(text: string): DataOperand[] {
  return splitRespectingFunctions(text).map(parseDataOperand);
}

/**
 * Bind grammar-changing defines before selecting data elements. This is a source-generation
 * boundary: values remain unevaluated, and execution order is still owned by the data writer.
 */
export function bindDataOperand(
  operand: DataOperand,
  bind: (fragment: SourceFragment) => SourceFragment,
): readonly DataOperand[] {
  if (operand.expression.type !== "template" || operand.expression.form !== "source") {
    return [operand];
  }
  let text = operand.expression.text;
  let fragment = sourceFragment(text, []);
  const seen = new Set<string>();
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
