import { type ExpressionNode } from "./expression-node.js";
/** A function keeps syntax and lexical substitution sites; invocation values never enter this cache. */
export type FunctionTemplate = {
    readonly text: string;
    readonly syntax: ExpressionNode;
    readonly parameters: readonly string[];
    readonly sites: readonly (readonly {
        start: number;
        end: number;
    }[])[];
};
/** Compile without resolving symbols, invoking host functions, or validating an inactive body. */
export declare function compileFunctionTemplate(text: string, parameters: readonly string[]): FunctionTemplate;
/** Ordered lexical binding is intentional source generation when a substitution can change grammar. */
export declare function bindFunctionTemplate(template: FunctionTemplate, values: readonly (number | string)[]): ExpressionNode;
//# sourceMappingURL=function-template.d.ts.map