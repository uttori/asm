import { type SourceSpan } from "../source-location.js";
/** Typed source value; numeric leaves keep assembler expressions for later evaluation. */
export type AssetValueNode = {
    readonly kind: "string";
    readonly value: string;
    readonly span: SourceSpan;
} | {
    readonly kind: "boolean";
    readonly value: boolean;
    readonly span: SourceSpan;
} | {
    readonly kind: "number";
    readonly expression: string;
    readonly span: SourceSpan;
} | {
    readonly kind: "array";
    readonly items: readonly AssetValueNode[];
    readonly span: SourceSpan;
} | {
    readonly kind: "object";
    readonly entries: Readonly<Record<string, AssetValueNode>>;
    readonly span: SourceSpan;
};
/** One source statement with exactly two string operands and named options. */
export interface ParsedAssetCall {
    readonly path: Extract<AssetValueNode, {
        kind: "string";
    }>;
    readonly format: Extract<AssetValueNode, {
        kind: "string";
    }>;
    readonly options: Readonly<Record<string, AssetValueNode>>;
    readonly span: SourceSpan;
}
/** Parse only the `includeAsset(...)` form; leave all other commands alone.
 * @param {string} command Normalized source command.
 * @param {number} [line] Zero-based source line for argument spans.
 * @returns {ParsedAssetCall | undefined} Typed call with argument spans, if present.
 */
export declare function parseAssetCall(command: string, line?: number): ParsedAssetCall | undefined;
//# sourceMappingURL=asset-call.d.ts.map