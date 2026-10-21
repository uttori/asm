import { type ExpressionSource, type ExpressionNode } from "./expression-node.js";
/** Bind lexical defines before numeric argument dispatch; substitutions may change call/list grammar. */
export declare function parseDirectiveExpression(text: string, numeric?: boolean, source?: ExpressionSource): ExpressionNode;
/** Quoted directive names and paths keep escape sequences as data for their owning runtime. */
export declare function unquoteDirectiveText(text: string): string;
/** Grouped dotted/indexed atoms historically name a symbol including parentheses in numeric data. */
export declare function dataResolutionExpression(text: string, node: ExpressionNode): ExpressionNode;
//# sourceMappingURL=directive-arguments.d.ts.map