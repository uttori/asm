import { type IndexedImage } from "@uttori/asm-assets/image";
import type { AssemblerEnvironment } from "@uttori/asm-core";
import type { AssetSource } from "@uttori/asm-core/plugin";
/** Versioned deterministic recipe. Paths returned by plugins must resolve inside owned inputs. */
export interface OwnedAssetRecipe {
    readonly format: string;
    readonly version: string;
    readonly mediaType: string;
    readonly output?: string;
    readonly options?: Readonly<Record<string, unknown>>;
    /** Indexed PNG imports must preserve these exact slot identities; edit palettes as separate owned assets. */
    readonly palette?: IndexedImage["palette"];
    readonly transforms?: readonly {
        readonly id: string;
        readonly version: string;
        readonly options?: Readonly<Record<string, unknown>>;
    }[];
}
/** Encode with the baseline's trusted plugin environment and verify every compression stage reversibly.
 * @param {Uint8Array} source Editable input bytes, borrowed only during this call.
 * @param {OwnedAssetRecipe} recipe Pinned codec versions and explicit selected output.
 * @param {AssemblerEnvironment} environment Trusted host-resolved plugin capabilities.
 * @param {(name: string) => AssetSource} resource Snapshotting reader restricted to the modification inputs directory.
 * @returns {Uint8Array} Owned encoded bytes; placement and fill are enforced separately by the ROM builder.
 */
export declare function encodeOwnedAsset(source: Uint8Array, recipe: OwnedAssetRecipe, environment: AssemblerEnvironment, resource: (name: string) => AssetSource): Uint8Array;
/** Native extraction is capability-limited: no arbitrary plugin decoder or palette guess is invented.
 * @param {Uint8Array} bytes Complete uncompressed native stream, excluding allocation padding.
 * @param {string} format Canonical native format ID.
 * @param {Uint8Array} paletteBytes Exact BGR555 palette required for a tile PNG; omitted for native JSON models.
 * @returns {object} Editable document bytes, extension and versioned recipe. Slot zero is SNES transparency.
 */
export declare function extractOwnedAsset(bytes: Uint8Array, format: string, paletteBytes?: Uint8Array): {
    bytes: Uint8Array;
    extension: string;
    recipe: OwnedAssetRecipe;
};
/** Infer only standard resource media types; unknown native/game files remain opaque bytes.
 * @param {string} name Owned resource filename.
 * @returns {string} Media type passed to the selected codec.
 */
export declare function ownedAssetMediaType(name: string): string;
//# sourceMappingURL=modification-assets.d.ts.map