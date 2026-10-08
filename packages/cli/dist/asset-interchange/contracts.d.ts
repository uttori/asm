import type { AsepriteDocument } from "@uttori/asm-assets/aseprite";
import type { InterchangeCapabilities, InterchangeChanges, TilemapInterchangeBaseline } from "@uttori/asm-assets/interchange";
import type { RasterInterchangeBaseline } from "@uttori/asm-assets/raster-interchange";
import type { SourceFileReplacement, SourceRepository } from "@uttori/asm-disassembler";
import type { SourceProjectInspection } from "../source.js";
/** One native authority can be presented as shared tilemaps or fixed raster views. */
export type AssetInterchangeBaseline = TilemapInterchangeBaseline | RasterInterchangeBaseline;
/** Portable locator. Paths, native addresses, encoding options and source authority remain private. */
export interface AssetExportManifest {
    readonly format: "uttori-asset-export";
    readonly version: 2;
    readonly id: string;
    readonly project: string;
    readonly asset: string;
    readonly adapter: {
        readonly id: string;
        readonly version: number;
    };
    readonly codec: {
        readonly id: string;
        readonly version: number;
    };
    readonly capabilities: InterchangeCapabilities;
}
/** Structure conversion owns buffers and is portable. Container limits cannot be raised by a document. */
export interface AssetStructureCodec {
    readonly id: string;
    readonly version: number;
    readonly fileBytes: number;
    readonly capabilities: InterchangeCapabilities;
    /** Defaults to true. PNG uses the explicitly selected manifest and private view positions instead. */
    readonly embeddedIdentity?: boolean;
    /** Optional representation conversion retains the adapter's complete native ownership. */
    prepare?(baseline: TilemapInterchangeBaseline): AssetInterchangeBaseline;
    encode(document: AsepriteDocument, signal?: AbortSignal): Promise<Uint8Array>;
    decode(bytes: Uint8Array, signal?: AbortSignal, baseline?: AsepriteDocument): Promise<AsepriteDocument>;
}
/** The adapter reads exact normal-build snapshots and attributes its own native meaning. */
export interface AssetAdapterContext {
    readonly project: string;
    readonly build: SourceProjectInspection;
    readonly signal?: AbortSignal;
    /** Read and retain exact declaration/resource bytes; returned copies cannot mutate the normal build snapshot. */
    read(name: string): Uint8Array;
}
/** Complete fixed output replacement attributed by the adapter, including any explicit derived/checksum effects. */
export interface AssetNativeEffect {
    readonly resource: string;
    readonly offset: number;
    readonly before: Uint8Array;
    readonly after: Uint8Array;
    /** Consumer identities make effects of an aliased resource visible during review. */
    readonly consumers: readonly string[];
}
/** Validated logical changes and prospective source bytes; no file writes are permitted in adapter planning. */
export interface AssetAdapterPlan {
    readonly files: readonly SourceFileReplacement[];
    readonly effects: readonly AssetNativeEffect[];
}
/** Complete native authority and presentation from an adapter, before any saved document is published. */
export interface AssetAdapterExport<Bindings> {
    readonly asset: string;
    readonly baseline: TilemapInterchangeBaseline;
    readonly bindings: Bindings;
    /** Complete declarations/resources/alias closure, relative to the selected project. */
    readonly dependencies: readonly string[];
}
/** Game adapters own native decomposition and encoding; the source host contains no tile-size/address assumptions. */
export interface AssetSourceAdapter<Selection, Bindings> {
    readonly id: string;
    readonly version: number;
    /** Trusted packaged entry point used for runtime dependency fingerprinting. */
    readonly module: string;
    readonly capabilities: InterchangeCapabilities;
    readSelection(value: unknown): Selection;
    readBindings(value: unknown): Bindings;
    export(context: AssetAdapterContext, selection: Selection, exportId: string): AssetAdapterExport<Bindings> | Promise<AssetAdapterExport<Bindings>>;
    plan(context: AssetAdapterContext, selection: Selection, bindings: Bindings, changes: InterchangeChanges): AssetAdapterPlan | Promise<AssetAdapterPlan>;
    /** Additional native logical validation supplements the host's complete byte oracle. */
    verify?(context: AssetAdapterContext, planned: AssetAdapterPlan, overlay: SourceProjectInspection): void | Promise<void>;
}
/** Relevant saved-source drafts are diagnosed and preserved, including opaque custom-editor buffers. */
export interface AssetSourceDraft {
    /** Absolute file path or a name relative to the selected source root; saved interchange documents count too. */
    readonly path: string;
    readonly version: number;
    readonly opaque: boolean;
}
/** Production defaults use the normal source build. Injection supports editor coordination and independent game fixtures. */
export interface AssetSourceHost {
    open(directory: string): Promise<{
        readonly repository: SourceRepository;
        readonly project: string;
    }>;
    inspect(directory: string, overlays?: ReadonlyMap<string, Uint8Array | null>, signal?: AbortSignal): Promise<SourceProjectInspection>;
    drafts?(): readonly AssetSourceDraft[];
    /** Tests may pin a deterministic installed-package identity without an external checkout. */
    implementationIdentity?(adapterModule: string): string;
    /** Recheck live editor versions after worker validation, immediately before synchronous source publication. */
    beforePublish?(paths: readonly string[]): Promise<void>;
    /** Coalesce watcher/build reload after a completed publication; never called for a no-op. */
    completed?(): Promise<void>;
}
/** Stable review summary. The private persisted plan owns complete bytes and dependency identities. */
export interface AssetImportReview {
    readonly format: "uttori-asset-review";
    readonly version: 2;
    readonly id: string;
    readonly exportId: string;
    readonly documentSha256: string;
    readonly outputSha256: string;
    readonly files: readonly {
        readonly path: string;
        readonly before: string;
        readonly after: string;
    }[];
    readonly effects: readonly {
        readonly resource: string;
        readonly offset: number;
        readonly size: number;
        readonly consumers: readonly string[];
    }[];
}
//# sourceMappingURL=contracts.d.ts.map