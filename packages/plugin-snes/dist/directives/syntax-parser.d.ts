import { type SyntaxParseInput } from "@uttori/asm-core/plugin";
/** Typed union of every lowered SNES directive payload shape. */
export declare const snesDirectiveSchema: import("@uttori/asm-core/plugin").SyntaxGuard<{
    operation: "mapper";
    mapper: string;
    banks: number[] | undefined;
    error: string | undefined;
} | {
    operation: "optimize";
    enabled: boolean | undefined;
} | {
    operation: "noop";
} | {
    operation: "width";
    register: "accumulator" | "index";
    wide: boolean;
} | {
    operation: "smart";
    enabled: boolean;
} | {
    operation: "cpu";
    architecture: string;
    alias: string;
} | {
    operation: "popcpu" | "pushcpu";
} | {
    operation: "freespace";
    keyword: string;
} | {
    operation: "freespacebyte";
    expression: import("@uttori/asm-core").ExpressionNode;
} | {
    operation: "prot";
    labels: string[];
} | {
    operation: "spcblock";
    block: {
        destination: import("@uttori/asm-core").ExpressionNode;
        destinationText: string;
        modeError: string | undefined;
    };
} | {
    operation: "endspcblock";
    block: {
        execute: import("@uttori/asm-core").ExpressionNode | undefined;
        error: string | undefined;
    };
} | {
    operation: "startpos";
    expression: import("@uttori/asm-core").ExpressionNode | undefined;
    error: string | undefined;
}>;
/** Infers the validated payload type from a syntax guard union. */
type ExtractGuard<G> = G extends ((value: unknown) => value is infer T) ? T : never;
/** Parsed SNES directive payload accepted by the execution handlers. */
type Payload = ExtractGuard<typeof snesDirectiveSchema>;
/** Select a target operation without invoking mapping, CPU changes, file reads or expression functions. */
export declare function parseSnesDirective(id: string, { words }: Pick<SyntaxParseInput, "words">): Payload;
export {};
//# sourceMappingURL=syntax-parser.d.ts.map