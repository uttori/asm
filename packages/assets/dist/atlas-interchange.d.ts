import { type IndexedRegion } from "./indexed-edit.js";
import { type IndexedColor } from "./indexed-values.js";
/** Ordered RGBA8 slot. Equal colors remain different identities. */
export type AtlasColor = IndexedColor;
/** Normalized indexed canvas, independent of an editor's layers/cels or a game's tile grammar. */
export interface AtlasDocument {
    /** Canvas width in pixels. */
    readonly width: number;
    /** Canvas height in pixels. */
    readonly height: number;
    /** Row-major palette slots covering the canvas. */
    readonly indexes: Uint8Array;
    /** Ordered display colors; slot index is identity. */
    readonly palette: readonly AtlasColor[];
    /** Palette slot treated as fully transparent when compositing. */
    readonly transparentIndex: number;
    /** Optional durable export locator; authority resides in the selected project's baseline. */
    readonly exportId?: string;
}
/** File conversion only: implementations own returned buffers and never access paths or processes. */
export interface AtlasFileCodec {
    /** Stable codec identity for manifest and registry lookup. */
    readonly id: string;
    /** Schema revision for encoded bytes. */
    readonly version: number;
    /** Filename suffix including the leading dot. */
    readonly extension: string;
    /** Advertised edit features for manifests and host policy intersection. */
    readonly capabilities: {
        /** Whether round-trips may change palette slot colors. */
        readonly paletteEdits: boolean;
        /** Whether the wire format carries a durable export identity. */
        readonly embeddedIdentity: boolean;
    };
    /** Serialize a validated document to owned wire bytes. */
    encode(document: AtlasDocument): Promise<Uint8Array>;
    /** Parse wire bytes into an owned document without host side effects. */
    decode(bytes: Uint8Array): Promise<AtlasDocument>;
}
/** One fixed source rectangle; index mapping and orientation are supplied by the game adapter. */
export interface AtlasPixelOwner extends IndexedRegion {
    /** Stable owner identity referenced by edit policy and change records. */
    readonly id: string;
}
/** Host/adapter-owned capabilities, never inferred from artwork or imported metadata. */
export interface AtlasEditPolicy {
    /** Non-overlapping pixel authorities covering editable regions. */
    readonly owners: readonly AtlasPixelOwner[];
    /** Palette slot indices whose RGB may change in place. */
    readonly editablePaletteSlots: readonly number[];
}
/** Exact accepted native-index and same-slot color deltas; all escaping arrays are owned copies. */
export interface AtlasChanges {
    /** Per-owner index buffers that differ from the baseline canvas. */
    readonly pixels: readonly {
        readonly owner: string;
        readonly indexes: Uint8Array;
    }[];
    /** Same-slot palette color deltas within editable slots. */
    readonly colors: readonly {
        readonly index: number;
        readonly color: AtlasColor;
    }[];
}
/** Portable locator and advertised capabilities; source paths and native addresses stay in the host. */
export interface AtlasExportManifest {
    /** Manifest discriminator. */
    readonly format: "uttori-atlas-export";
    /** Manifest schema revision. */
    readonly version: 1;
    /** Durable export identity echoed by edited documents. */
    readonly id: string;
    /** Owning project slug from the host baseline. */
    readonly project: string;
    /** Asset path within the project. */
    readonly asset: string;
    /** Host adapter that interprets native ownership. */
    readonly adapter: string;
    /** Codec id used for the on-disk interchange file. */
    readonly codec: string;
    /** Codec schema revision at export time. */
    readonly codecVersion: number;
    /** Exported canvas width in pixels. */
    readonly width: number;
    /** Exported canvas height in pixels. */
    readonly height: number;
    /** Transparent palette slot frozen for the export. */
    readonly transparentIndex: number;
    /** Owner identities present in the edit policy. */
    readonly owners: readonly string[];
    /** Palette slots editable under the export policy. */
    readonly editablePaletteSlots: readonly number[];
}
/** Shared container limits are deliberately smaller than arbitrary editor document limits. */
export declare const ATLAS_FILE_LIMIT: number;
/** Validate before allocation/conversion; indexes and palette slot order must agree exactly. */
export declare function validateAtlasDocument(document: AtlasDocument): void;
/** Read a decoded PNG without converting to RGB or merging duplicate slots. */
export declare function indexedAtlasDocument(value: unknown, transparentIndex: number): AtlasDocument;
/**
 * Compare normalized file content against the exported canvas. No changed padding/preview pixels,
 * palette remapping, geometry or alpha is silently discarded. Overlapping authorities reject.
 */
export declare function inspectAtlasChanges(before: AtlasDocument, after: AtlasDocument, policy: AtlasEditPolicy): AtlasChanges;
//# sourceMappingURL=atlas-interchange.d.ts.map