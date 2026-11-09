/** Evaluated emission attribution identifies the call; raw syntax supplies only precise edit coordinates. */
export interface AssetCallLocation {
    /** Inclusive UTF-16 start offset of the includeAsset call span. */
    readonly start: number;
    /** Exclusive UTF-16 end offset of the includeAsset call span. */
    readonly end: number;
    /** UTF-16 span of the asset path literal within the call. */
    readonly path: {
        readonly start: number;
        readonly end: number;
    };
    /** Evaluated includeAsset option map keyed by option name. */
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