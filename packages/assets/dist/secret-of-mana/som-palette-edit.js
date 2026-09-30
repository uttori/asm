import { rewriteIndexedPng } from "@uttori/asm-assets/image";
import { readAssetPng } from "../png.js";
import { convertBossImage } from "./som-asset-plugin.js";
import { inspectFrameAtlas, encodeInspectedFrameSegment } from "./som-frame-atlas.js";
import { spritePaletteBytes, spritePaletteColors, } from "./som-sprite-palettes.js";
/** A use is an identity tuple, not a display name or an ordering-dependent user entry.
 * @param {string} palette Catalogue palette id.
 * @param {string} atlas Atlas id.
 * @param {string} role `primary` or `runtime-variant`.
 * @param {readonly string[]} segments Segment names that use the palette.
 * @returns {string} Stable identity key.
 */
function useKey(palette, atlas, role, segments) {
    return JSON.stringify([palette, atlas, role, [...segments].sort()]);
}
/** Cross-check all catalogue users against supplied layouts, independent of filesystem/bank names.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @param {readonly {id: string, layout: FrameLayout}[]} atlases Layouts to reconcile.
 * @returns {{errors: string[], uses: number}} Mismatches and the number of actual uses.
 */
export function inspectSpritePaletteUsers(catalog, atlases) {
    const actual = new Set();
    const declared = new Set();
    const errors = [];
    const atlasIds = new Set();
    for (const { id, layout } of atlases) {
        if (atlasIds.has(id)) {
            errors.push(`Duplicate atlas ${id}.`);
        }
        atlasIds.add(id);
        for (const [group, palette] of layout.paletteRefs.entries()) {
            const segments = Object.keys(layout.segments).filter((name) => layout.segments[name].palette === group);
            if (!segments.length) {
                errors.push(`${id}: palette group ${group} has no segment.`);
            }
            actual.add(useKey(palette, id, "primary", segments));
        }
        for (const variant of layout.paletteVariants ?? []) {
            const segments = Object.keys(layout.segments).filter((name) => layout.segments[name].palette === variant.group);
            if (!segments.length) {
                errors.push(`${id}: runtime variant has no segment.`);
            }
            actual.add(useKey(variant.palette, id, "runtime-variant", segments));
        }
    }
    for (const [id, palette] of Object.entries(catalog.palettes)) {
        try {
            spritePaletteBytes(catalog, id);
        }
        catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }
        if (!Array.isArray(palette.users)) {
            errors.push(`${id}: users must be an array.`);
            continue;
        }
        for (const user of palette.users) {
            if (typeof user.atlas !== "string" ||
                !Array.isArray(user.segments) ||
                user.segments.some((s) => typeof s !== "string") ||
                !["primary", "runtime-variant"].includes(user.role)) {
                errors.push(`${id}: invalid palette user.`);
                continue;
            }
            const key = useKey(id, user.atlas, user.role, user.segments);
            if (declared.has(key)) {
                errors.push(`Duplicate palette use: ${key}.`);
            }
            declared.add(key);
        }
    }
    for (const use of actual) {
        if (!declared.has(use)) {
            errors.push(`Unlisted atlas palette use: ${use}.`);
        }
    }
    for (const use of declared) {
        if (!actual.has(use)) {
            errors.push(`Stale catalogue palette use: ${use}.`);
        }
    }
    return { errors, uses: actual.size };
}
/** Check compressed graphics through the registered game policy, never infer storage from a filename.
 * @param {SpriteAtlasSource} atlas Atlas that declares native compression.
 * @param {AssetInput} source PNG bytes to convert.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @param {string} segment Segment name.
 * @returns {Uint8Array | undefined} Preserved native bytes, when this segment declares storage.
 */
function nativeBytes(atlas, source, catalog, segment) {
    const options = atlas.nativeOptions?.[segment];
    if (!options) {
        return undefined;
    }
    const result = convertBossImage(source, { ...options, segment, layout: "layout.json", palettes: "palettes.json" }, {
        "layout.json": {
            bytes: new TextEncoder().encode(JSON.stringify(atlas.layout)),
            mediaType: "application/json",
        },
        "palettes.json": {
            bytes: new TextEncoder().encode(JSON.stringify(catalog)),
            mediaType: "application/json",
        },
    });
    return result.outputs.graphics.bytes;
}
/**
 * Return explicitly validated native chunk names that an indexed PNG rewrite may retain.
 * Callers supply compression declarations from the include map. Unknown native chunks are
 * not retained implicitly, and an undeclared boss stream fails before authoring changes.
 * @param {SpriteAtlasSource} atlas Atlas PNG and layout.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @returns {string[]} Private PNG chunk names safe to retain.
 */
export function frameAtlasPreservedChunks(atlas, catalog) {
    const bytes = atlas.source.bytes;
    // Validate the game-specific palette/layout contract before allowing native retention.
    inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
    const image = readAssetPng(bytes);
    const names = [];
    for (const { type: name } of image.chunks) {
        if (/^soM[A-Z]$/.test(name)) {
            const segment = Object.keys(atlas.layout.segments)[name.charCodeAt(3) - 65];
            if (!segment || !atlas.nativeOptions?.[segment]) {
                throw new Error(`Missing native storage declaration for ${atlas.id}/${name}.`);
            }
            nativeBytes(atlas, atlas.source, catalog, segment);
            names.push(name);
        }
    }
    return names;
}
/**
 * Plan exact RGB8 edits by catalogue slot. All atlases must be supplied so stale users fail.
 * Results are owned values; the host publishes them together. Variant-only users retain
 * their primary PNG palette. Unrepresentable colors fail instead of being quantized.
 * @param {object} catalog Current shared palette catalogue.
 * @param {Array} atlases Identified sources/layouts and optional native compression declarations.
 * @param {Array<{palette: string, index: number, rgb: number[]}>} edits Palette slot edits (index includes firstIndex).
 * @returns {{catalog: SpritePaletteCatalog, images: Map<string, Uint8Array>, palettes: string[]}} Updated catalogue and owned PNG bytes.
 */
export function planSpritePaletteEdits(catalog, atlases, edits) {
    const audit = inspectSpritePaletteUsers(catalog, atlases);
    if (audit.errors.length) {
        throw new Error(audit.errors.join("\n"));
    }
    const next = structuredClone(catalog);
    const changed = new Set();
    const slots = new Set();
    for (const edit of edits) {
        spritePaletteBytes(catalog, edit.palette);
        const record = next.palettes[edit.palette];
        const offset = edit.index - record.firstIndex;
        if (!Number.isSafeInteger(edit.index) ||
            offset < 0 ||
            offset >= record.words.length ||
            !Array.isArray(edit.rgb) ||
            edit.rgb.length !== 3) {
            throw new Error(`Invalid palette slot ${edit.palette}:${edit.index}.`);
        }
        const key = `${edit.palette}:${edit.index}`;
        if (slots.has(key)) {
            throw new Error(`Duplicate palette edit ${key}.`);
        }
        slots.add(key);
        const channels = edit.rgb.map((color) => {
            if (!Number.isInteger(color) || color < 0 || color > 255) {
                throw new Error("Palette edits require RGB8.");
            }
            const value = color >>> 3;
            if (((value << 3) | (value >>> 2)) !== color) {
                throw new Error(`RGB channel ${color} is not exactly BGR555 representable.`);
            }
            return value;
        });
        const highBit = Number.parseInt(record.words[offset], 16) & 0x8000;
        const word = (highBit | channels[0] | (channels[1] << 5) | (channels[2] << 10))
            .toString(16)
            .toUpperCase()
            .padStart(4, "0");
        if (record.words[offset].toUpperCase() !== word) {
            record.words[offset] = word;
            changed.add(edit.palette);
        }
    }
    const images = new Map();
    for (const atlas of atlases) {
        if (!atlas.layout.paletteRefs.some((id) => changed.has(id))) {
            continue;
        }
        const before = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
        const palette = before.image.palette.map((color) => [
            color[0],
            color[1],
            color[2],
            color[3],
        ]);
        for (const [group, id] of atlas.layout.paletteRefs.entries()) {
            if (!changed.has(id)) {
                continue;
            }
            spritePaletteColors(next, id).forEach((color, index) => {
                palette[group * 16 + index] = color;
            });
        }
        const bytes = rewriteIndexedPng(atlas.source.bytes, {
            palette,
            preserveChunks: frameAtlasPreservedChunks(atlas, catalog),
        });
        const source = { bytes, mediaType: "image/png" };
        const after = inspectFrameAtlas(source, atlas.layout, next, { whole: true });
        if (after.image.indexes.some((value, i) => value !== before.image.indexes[i])) {
            throw new Error(`Palette edit changed indexes: ${atlas.id}.`);
        }
        for (const segment of Object.keys(atlas.layout.segments)) {
            const oldTiles = encodeInspectedFrameSegment(before, segment);
            const newTiles = encodeInspectedFrameSegment(after, segment);
            if (oldTiles.some((value, i) => value !== newTiles[i])) {
                throw new Error(`Palette edit changed tiles: ${atlas.id}/${segment}.`);
            }
            const oldNative = nativeBytes(atlas, atlas.source, catalog, segment);
            const newNative = nativeBytes(atlas, source, next, segment);
            if (oldNative &&
                (!newNative ||
                    oldNative.length !== newNative.length ||
                    oldNative.some((v, i) => v !== newNative[i]))) {
                throw new Error(`Palette edit changed native stream: ${atlas.id}/${segment}.`);
            }
        }
        images.set(atlas.id, bytes);
    }
    return { catalog: next, images, palettes: [...changed] };
}
//# sourceMappingURL=som-palette-edit.js.map