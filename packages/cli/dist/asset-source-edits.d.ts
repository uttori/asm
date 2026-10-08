/** Evaluated emission attribution identifies the call; raw syntax supplies only precise edit coordinates. */
export interface AssetCallLocation {
    readonly start: number;
    readonly end: number;
    readonly path: {
        readonly start: number;
        readonly end: number;
    };
    readonly options: Readonly<Partial<Record<string, {
        readonly start: number;
        readonly end: number;
    }>>>;
}
/** Resolve a multiline call attributed to a one-based emitted source line; ambiguous same-line calls fail. */
export declare function locateAssetCall(text: string, line: number): AssetCallLocation;
/** Replace the selected operand, never a shared define. Existing option values and comments keep their original positions. */
export declare function editAssetCall(text: string, location: AssetCallLocation, options: {
    path?: string;
    values?: Readonly<Record<string, unknown>>;
}): string;
//# sourceMappingURL=asset-source-edits.d.ts.map