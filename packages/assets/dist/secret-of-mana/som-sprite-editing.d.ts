import type { SpriteEditorBundle, SpriteEditorChanges } from "../sprite-editing.js";
import { type SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { SpriteAtlasSource } from "./som-types.js";
/** Export one uncompressed ordinary-body atlas. Unsupported codecs fail before opening the editor. */
export declare function createSomSpriteEditorBundle(atlas: SpriteAtlasSource, catalog: SpritePaletteCatalog, session: string): SpriteEditorBundle;
/** One whole fixed record; the host turns only changed coordinate scalars into source edits. */
export interface SomBodySourceChange {
    readonly address: number;
    readonly before: Uint8Array;
    readonly after: Uint8Array;
}
/** Combine all deltas against current native pixels before rendering new derived views. No filesystem access. */
export declare function planSomSpriteEditorChanges(atlas: SpriteAtlasSource, catalog: SpritePaletteCatalog, changes: SpriteEditorChanges): {
    layout: import("./som-types.js").FrameLayout;
    catalog: SpritePaletteCatalog;
    png: Uint8Array<ArrayBufferLike>;
    bodies: SomBodySourceChange[];
    palettes: string[];
};
//# sourceMappingURL=som-sprite-editing.d.ts.map