import { type ExpressionNode } from "./expression-node.js";
import { type SourceFragment } from "./source-fragment.js";
/** A data element owns its spelling for diagnostics; its expression supplies all value semantics. */
export type DataOperand = {
    /** Operand spelling as written, before `#` stripping or define binding. */
    text: string;
    /** Parsed value; string operands keep their escapes undecoded. */
    expression: ExpressionNode;
};
/** Data strings preserve escapes for the character-table/define phase, unlike function string arguments. */
export declare function parseDataOperand(text: string): DataOperand;
/** Pure grammar entry for source-generated lists; functions and quoted commas stay in one element. */
export declare function parseDataList(text: string): DataOperand[];
/**
 * Bind grammar-changing defines before selecting data elements. This is a source-generation
 * boundary: values remain unevaluated, and execution order is still owned by the data writer.
 */
export declare function bindDataOperand(operand: DataOperand, bind: (fragment: SourceFragment) => SourceFragment): readonly DataOperand[];
//# sourceMappingURL=data-node.d.ts.map