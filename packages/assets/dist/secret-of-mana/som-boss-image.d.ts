import type { AssetInput } from "../registry.js";
import { type SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { FrameLayout } from "./som-types.js";
/**
 * Rebuild native graphics from previewable pixels. An unchanged PNG retains its exact
 * token choices. Fixed sizing pads after the complete stream; encoded sizing exposes
 * growth to the source layout/relocation service instead of truncating or allocating here.
 * @param source Indexed PNG, optionally carrying a native chunk.
 * @param options Storage, original byteLength, optional native resource, sizePolicy (fixed by default or encoded), and atlas resources.
 * @param [resources] Layout and palette sidecars.
 * @param [normalized] Authoritative in-memory mapping and reconciled palette supplied by source normalization.
 * @returns Independently decoded native bytes.
 */
export declare function convertBossImage(source: AssetInput, options: Readonly<Record<string, unknown>>, resources?: Readonly<Record<string, AssetInput>>, normalized?: {
    readonly layout: FrameLayout;
    readonly catalog: SpritePaletteCatalog;
}): {
    primaryOutput: string;
    outputs: {
        graphics: {
            bytes: Uint8Array<ArrayBufferLike>;
        };
    };
};
/** Extract and independently validate a PNG's exact compression reference before moving it to a durable source resource. */
export declare function readBossNativeReference(source: AssetInput, options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetInput>>): Uint8Array | undefined;
//# sourceMappingURL=som-boss-image.d.ts.map