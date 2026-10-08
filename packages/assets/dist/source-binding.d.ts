/** Portable authoring authority. Adapter-specific mappings stay in declared resources, never private editor sessions. */
export interface AssetSourceBinding {
    readonly format: "uttori-asset-source";
    readonly version: 1;
    /** Stable opaque asset identity, also embedded by codecs that support it. */
    readonly id: string;
    readonly adapter: string;
    readonly source: {
        readonly path: string;
        readonly representation: string;
    };
    /** Paths resolve relative to this binding. Reference data stays fixed across representation switches. */
    readonly resources: Readonly<Record<string, string>>;
    /** Native declarations retain their segment identities, options and codec independently of source representation. */
    readonly native: readonly {
        readonly format: string;
        readonly options: Readonly<Record<string, unknown>>;
    }[];
}
/** Portable relative paths may reach adjacent source directories but cannot invoke platform/URL resolution. */
export declare function sourceResourcePath(value: unknown): string;
/** Bounded portable source metadata is validated before callers can discover its resources. */
export declare function readAssetSourceBinding(bytes: Uint8Array): AssetSourceBinding;
/** Keys include the declaring binding identity, so sibling sidecars with equal relative filenames cannot collide. */
export declare function bindingResourceKey(binding: string, resource: string): string;
/** Incremental source-resource request, structurally compatible with assembler discovery without a runtime dependency. */
export interface SourceResourceDependency {
    readonly key: string;
    readonly path: string;
    readonly relativeTo?: string;
    readonly mediaType?: string;
}
//# sourceMappingURL=source-binding.d.ts.map