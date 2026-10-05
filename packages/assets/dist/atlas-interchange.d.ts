import { type IndexedRegion } from "./indexed-edit.js";
import { type IndexedColor } from "./indexed-values.js";
/** Ordered RGBA8 slot. Equal colors remain different identities. */
export type AtlasColor = IndexedColor;
/** Normalized indexed canvas, independent of an editor's layers/cels or a game's tile grammar. */
export interface AtlasDocument {
    readonly width: number;
    readonly height: number;
    readonly indexes: Uint8Array;
    readonly palette: readonly AtlasColor[];
    readonly transparentIndex: number;
    /** Optional durable export locator; authority resides in the selected project's baseline. */
    readonly exportId?: string;
}
/** File conversion only: implementations own returned buffers and never access paths or processes. */
export interface AtlasFileCodec {
    readonly id: string;
    readonly version: number;
    readonly extension: string;
    readonly capabilities: {
        readonly paletteEdits: boolean;
        readonly embeddedIdentity: boolean;
    };
    encode(document: AtlasDocument): Promise<Uint8Array>;
    decode(bytes: Uint8Array): Promise<AtlasDocument>;
}
/** One fixed source rectangle; index mapping and orientation are supplied by the game adapter. */
export interface AtlasPixelOwner extends IndexedRegion {
    readonly id: string;
}
/** Host/adapter-owned capabilities, never inferred from artwork or imported metadata. */
export interface AtlasEditPolicy {
    readonly owners: readonly AtlasPixelOwner[];
    readonly editablePaletteSlots: readonly number[];
}
/** Exact accepted native-index and same-slot color deltas; all escaping arrays are owned copies. */
export interface AtlasChanges {
    readonly pixels: readonly {
        readonly owner: string;
        readonly indexes: Uint8Array;
    }[];
    readonly colors: readonly {
        readonly index: number;
        readonly color: AtlasColor;
    }[];
}
/** Portable locator and advertised capabilities; source paths and native addresses stay in the host. */
export interface AtlasExportManifest {
    readonly format: "uttori-atlas-export";
    readonly version: 1;
    readonly id: string;
    readonly project: string;
    readonly asset: string;
    readonly adapter: string;
    readonly codec: string;
    readonly codecVersion: number;
    readonly width: number;
    readonly height: number;
    readonly transparentIndex: number;
    readonly owners: readonly string[];
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