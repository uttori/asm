import { type ExpressionNode } from "./expression-node.js";
/** A function keeps syntax and lexical substitution sites; invocation values never enter this cache. */
export type FunctionTemplate = {
    /** Function body expression text as defined. */
    readonly text: string;
    /** Body parsed once without binding parameters or resolving symbols. */
    readonly syntax: ExpressionNode;
    /** Parameter names in declaration order. */
    readonly parameters: readonly string[];
    /** Whole-word half-open UTF-16 occurrences in `text`, indexed parallel to `parameters`. */
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