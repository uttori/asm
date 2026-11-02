import type { AsepriteDocument } from "@uttori/asm-assets/aseprite";
import type {
  InterchangeCapabilities,
  InterchangeChanges,
  TilemapInterchangeBaseline,
} from "@uttori/asm-assets/interchange";
import type { RasterInterchangeBaseline } from "@uttori/asm-assets/raster-interchange";
import type {
  SourceFileReplacement,
  SourceRepository,
} from "@uttori/asm-disassembler/source-project";

import type { SourceProjectInspection } from "../source.js";

/** One native authority can be presented as shared tilemaps or fixed raster views. */
export type AssetInterchangeBaseline = TilemapInterchangeBaseline | RasterInterchangeBaseline;

/** Portable locator. Paths, native addresses, encoding options and source authority remain private. */
export interface AssetExportManifest {
  /** Manifest format discriminator. */
  readonly format: "uttori-asset-export";
  /** Manifest schema generation. */
  readonly version: 2;
  /** Stable export identity referenced by reviews and imports. */
  readonly id: string;
  /** Project slug owning the exported asset. */
  readonly project: string;
  /** Logical asset name within the project. */
  readonly asset: string;
  /** Game adapter identity and revision that produced the export. */
  readonly adapter: { readonly id: string; readonly version: number };
  /** Structure codec identity and revision encoding the portable document. */
  readonly codec: { readonly id: string; readonly version: number };
  /** Capability contract shared by the adapter and codec for this export. */
  readonly capabilities: InterchangeCapabilities;
}

/** Structure conversion owns buffers and is portable. Container limits cannot be raised by a document. */
export interface AssetStructureCodec {
  /** Codec identifier used in manifests and dependency fingerprints. */
  readonly id: string;
  /** Codec revision paired with the identifier. */
  readonly version: number;
  /** Maximum encoded document size the codec accepts. */
  readonly fileBytes: number;
  /** Interchange features the codec can round-trip. */
  readonly capabilities: InterchangeCapabilities;
  /** Defaults to true. PNG uses the explicitly selected manifest and private view positions instead. */
  readonly embeddedIdentity?: boolean;
  /** Optional representation conversion retains the adapter's complete native ownership. */
  prepare?(baseline: TilemapInterchangeBaseline): AssetInterchangeBaseline;
  /**
   * Serialize an edited document to portable bytes.
   * @param document Aseprite document to encode.
   * @param signal Optional cooperative cancellation.
   * @returns Encoded interchange bytes.
   */
  encode(document: AsepriteDocument, signal?: AbortSignal): Promise<Uint8Array>;
  /**
   * Decode portable bytes back into an Aseprite document.
   * @param bytes Encoded interchange payload.
   * @param signal Optional cooperative cancellation.
   * @param baseline Optional prior document used for incremental decode.
   * @returns Decoded Aseprite document.
   */
  decode(
    bytes: Uint8Array,
    signal?: AbortSignal,
    baseline?: AsepriteDocument,
  ): Promise<AsepriteDocument>;
}

/** The adapter reads exact normal-build snapshots and attributes its own native meaning. */
export interface AssetAdapterContext {
  /** Project slug selected for the operation. */
  readonly project: string;
  /** Normal-build inspection snapshot the adapter must treat as authoritative. */
  readonly build: SourceProjectInspection;
  /** Optional cancellation forwarded to adapter IO. */
  readonly signal?: AbortSignal;
  /** Read and retain exact declaration/resource bytes; returned copies cannot mutate the normal build snapshot. */
  read(name: string): Uint8Array;
}

/** Complete fixed output replacement attributed by the adapter, including any explicit derived/checksum effects. */
export interface AssetNativeEffect {
  /** Native resource path receiving the effect. */
  readonly resource: string;
  /** Byte offset within the resource. */
  readonly offset: number;
  /** Bytes before the planned change at the offset. */
  readonly before: Uint8Array;
  /** Bytes after the planned change at the offset. */
  readonly after: Uint8Array;
  /** Consumer identities make effects of an aliased resource visible during review. */
  readonly consumers: readonly string[];
}

/** Validated logical changes and prospective source bytes; no file writes are permitted in adapter planning. */
export interface AssetAdapterPlan {
  /** Source file replacements proposed by the adapter. */
  readonly files: readonly SourceFileReplacement[];
  /** Native byte effects attributed to the planned replacements. */
  readonly effects: readonly AssetNativeEffect[];
}

/** Complete native authority and presentation from an adapter, before any saved document is published. */
export interface AssetAdapterExport<Bindings> {
  /** Logical asset name being exported. */
  readonly asset: string;
  /** Tilemap baseline the adapter owns for interchange. */
  readonly baseline: TilemapInterchangeBaseline;
  /** Adapter-specific binding payload carried through import. */
  readonly bindings: Bindings;
  /** Complete declarations/resources/alias closure, relative to the selected project. */
  readonly dependencies: readonly string[];
}

/** Game adapters own native decomposition and encoding; the source host contains no tile-size/address assumptions. */
export interface AssetSourceAdapter<Selection, Bindings> {
  /** Adapter identifier referenced by manifests. */
  readonly id: string;
  /** Adapter revision paired with the identifier. */
  readonly version: number;
  /** Trusted packaged entry point used for runtime dependency fingerprinting. */
  readonly module: string;
  /** Interchange capabilities advertised by the adapter. */
  readonly capabilities: InterchangeCapabilities;
  /**
   * Parse persisted selection JSON into a typed selection.
   * @param value Untrusted selection payload.
   * @returns Adapter selection value.
   */
  readSelection(value: unknown): Selection;
  /**
   * Parse persisted binding JSON into a typed binding payload.
   * @param value Untrusted bindings payload.
   * @returns Adapter bindings value.
   */
  readBindings(value: unknown): Bindings;
  /**
   * Build a portable export from the current normal build.
   * @param context Read-only adapter host context.
   * @param selection Asset selection for the export.
   * @param exportId Stable export identity for the manifest.
   * @returns Export baseline, bindings, and dependency closure.
   */
  export(
    context: AssetAdapterContext,
    selection: Selection,
    exportId: string,
  ): AssetAdapterExport<Bindings> | Promise<AssetAdapterExport<Bindings>>;
  /**
   * Plan source replacements for interchange edits without writing files.
   * @param context Read-only adapter host context.
   * @param selection Asset selection for the edit.
   * @param bindings Persisted adapter bindings.
   * @param changes Interchange edits requested by the editor.
   * @returns Proposed file replacements and native effects.
   */
  plan(
    context: AssetAdapterContext,
    selection: Selection,
    bindings: Bindings,
    changes: InterchangeChanges,
  ): AssetAdapterPlan | Promise<AssetAdapterPlan>;
  /** Additional native logical validation supplements the host's complete byte oracle. */
  verify?(
    context: AssetAdapterContext,
    planned: AssetAdapterPlan,
    overlay: SourceProjectInspection,
  ): void | Promise<void>;
}

/** Relevant saved-source drafts are diagnosed and preserved, including opaque custom-editor buffers. */
export interface AssetSourceDraft {
  /** Absolute file path or a name relative to the selected source root; saved interchange documents count too. */
  readonly path: string;
  /** Draft revision recorded by the editor. */
  readonly version: number;
  /** Whether the draft bytes are opaque to interchange decoding. */
  readonly opaque: boolean;
}

/** Production defaults use the normal source build. Injection supports editor coordination and independent game fixtures. */
export interface AssetSourceHost {
  /**
   * Open a source repository rooted at the given directory.
   * @param directory Project directory containing `.uttori` metadata.
   * @returns Open repository handle and project slug.
   */
  open(
    directory: string,
  ): Promise<{ readonly repository: SourceRepository; readonly project: string }>;
  /**
   * Inspect the saved source tree, optionally overlaying unsaved editor bytes.
   * @param directory Project directory to inspect.
   * @param overlays Optional unsaved file overlays keyed by path.
   * @param signal Optional cooperative cancellation.
   * @returns Complete source inspection snapshot.
   */
  inspect(
    directory: string,
    overlays?: ReadonlyMap<string, Uint8Array | null>,
    signal?: AbortSignal,
  ): Promise<SourceProjectInspection>;
  /** Optional saved interchange drafts visible to the host. */
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
  /** Review artifact format discriminator. */
  readonly format: "uttori-asset-review";
  /** Review schema generation. */
  readonly version: 2;
  /** Review identity paired with the import transaction. */
  readonly id: string;
  /** Export identity being reviewed. */
  readonly exportId: string;
  /** SHA-256 of the interchange document under review. */
  readonly documentSha256: string;
  /** SHA-256 of the adapter's planned native output bundle. */
  readonly outputSha256: string;
  /** Per-file before/after digests for human review. */
  readonly files: readonly {
    /** Source-relative file path. */
    readonly path: string;
    /** Hex digest of bytes before the import. */
    readonly before: string;
    /** Hex digest of bytes after the import. */
    readonly after: string;
  }[];
  /** Summarized native effects for review dashboards. */
  readonly effects: readonly {
    /** Native resource receiving the effect. */
    readonly resource: string;
    /** Byte offset within the resource. */
    readonly offset: number;
    /** Effect span length in bytes. */
    readonly size: number;
    /** Logical consumers of the affected resource. */
    readonly consumers: readonly string[];
  }[];
}
