import { type StructInitializerEntry } from "../services/struct-initializer.js";
import { type ExpressionNode } from "./expression-node.js";
import { type FunctionTemplate } from "./function-template.js";
/** Parsed declaration syntax is reusable across passes; all addresses and counts remain expressions. */
export type DeclarationNode = {
    kind: "invalid";
    context: "function" | "character" | "struct";
    message: string;
} | {
    kind: "character";
    character: string;
    expression: ExpressionNode;
} | {
    kind: "function";
    name: string;
    template: FunctionTemplate;
} | {
    kind: "struct";
    name: string;
    parent?: string;
    base?: ExpressionNode;
    baseText?: string;
} | {
    kind: "endStruct";
    options: readonly {
        name: "align" | "count" | "firstindex";
        expression: ExpressionNode;
    }[];
} | {
    kind: "structField";
    name: string;
    storage?: {
        width: number;
        count?: ExpressionNode;
    };
    skip?: ExpressionNode;
    error?: string;
} | {
    kind: "dataStruct";
    reference: RecordReference;
    fields: readonly StructInitializerEntry[];
} | {
    kind: "dataStructRow";
    index: ExpressionNode;
    indexText: string;
    fields: readonly StructInitializerEntry[];
} | {
    kind: "dataStructs";
    name: string;
} | {
    kind: "endDataStructs";
    argumentCount: number;
};
/** The index is evaluated in the current pass, independently of the declaration's physical spelling. */
export type RecordReference = {
    /** Previously declared dataStruct record name. */
    name: string;
    /** Unevaluated logical record index; undefined addresses record 0. */
    index?: ExpressionNode;
    /** Reference spelling used in diagnostics. */
    text: string;
};
/** Parse candidates only. Diagnostics are inert until the declaration is selected for execution. */
export declare function parseDeclarationNode(text: string, words: readonly string[]): DeclarationNode | undefined;
/** Activate a saved parser diagnostic without reinterpreting a declaration's source text. */
export declare function checkedDeclaration(node: DeclarationNode | undefined): Exclude<DeclarationNode, {
    kind: "invalid";
}> | undefined;
/** Only executable record/declaration variants cross the directive transport boundary. */
export declare const structDeclarationGuard: import("./syntax-codec.js").SyntaxGuard<{
    kind: "struct";
    name: string;
    parent: string | undefined;
    base: ExpressionNode | undefined;
    baseText: string | undefined;
} | {
    kind: "endStruct";
    options: {
        name: "align" | "count" | "firstindex";
        expression: ExpressionNode;
    }[];
} | {
    kind: "dataStruct";
    reference: {
        name: string;
        text: string;
        index: ExpressionNode | undefined;
    };
    fields: {
        name: string;
        value: {
            text: string;
            expression: ExpressionNode;
        }[] | {
            text: string;
            expression: ExpressionNode;
        };
        start: number;
        expressions: {
            text: string;
            start: number;
        }[];
    }[];
} | {
    kind: "dataStructs";
    name: string;
} | {
    kind: "endDataStructs";
    argumentCount: number;
}>;
//# sourceMappingURL=declaration-node.d.ts.map