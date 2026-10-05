import { validateAsepriteDocument } from "./aseprite-document.js";
import { validateAtlasDocument } from "./atlas-interchange.js";
import { extractIndexedRegion } from "./indexed-edit.js";
import { reconcileIndexedViews, validateIndexedOwnership, } from "./indexed-ownership.js";
import { indexedPaletteChanges } from "./indexed-values.js";
import { planIndexedPresentation } from "./presentation-layout.js";
/** Reuse the v1 raster file contract while retaining the structural codec's one normalized document value. */
export function rasterInterchangeDocument(atlas) {
    validateAtlasDocument(atlas);
    return {
        width: atlas.width,
        height: atlas.height,
        palette: atlas.palette,
        transparentIndex: atlas.transparentIndex,
        exportId: atlas.exportId,
        layers: [{ kind: "raster", flags: 3, name: "Native views — fixed raster inventory" }],
        tilesets: [],
        tags: [],
        frames: [
            {
                durationMs: 100,
                cels: [
                    {
                        kind: "raster",
                        layer: 0,
                        x: 0,
                        y: 0,
                        zIndex: 0,
                        width: atlas.width,
                        height: atlas.height,
                        indexes: Uint8Array.from(atlas.indexes),
                    },
                ],
            },
        ],
    };
}
/** Normalize trimmed saved raster cels without color conversion, transparency inference or geometry edits. */
export function rasterInterchangeAtlas(document) {
    validateAsepriteDocument(document);
    if (document.frames.length !== 1 ||
        document.layers.length !== 1 ||
        document.layers[0].kind !== "raster" ||
        !(document.layers[0].flags & 1) ||
        document.tilesets.length ||
        document.tags.length) {
        throw new Error("Raster interchange requires one visible raster layer and one fixed frame.");
    }
    const cels = document.frames[0].cels;
    if (cels.length > 1 || cels.some((cel) => cel.kind !== "raster" || cel.zIndex !== 0)) {
        throw new Error("Raster interchange does not support linked cels or additional composition.");
    }
    const indexes = new Uint8Array(document.width * document.height).fill(document.transparentIndex);
    for (const cel of cels) {
        if (cel.kind !== "raster") {
            throw new Error("Invalid raster cel.");
        }
        if (cel.x < 0 ||
            cel.y < 0 ||
            cel.x + cel.width > document.width ||
            cel.y + cel.height > document.height) {
            throw new Error("Raster cel exceeds the fixed inventory canvas.");
        }
        for (let y = 0; y < cel.height; y++) {
            indexes.set(cel.indexes.subarray(y * cel.width, (y + 1) * cel.width), (y + cel.y) * document.width + cel.x);
        }
    }
    const result = {
        width: document.width,
        height: document.height,
        indexes,
        palette: document.palette,
        transparentIndex: document.transparentIndex,
        exportId: document.exportId,
    };
    validateAtlasDocument(result);
    return result;
}
/**
 * Pack every declared view, including unused/blank/duplicate owners, into one fixed raster.
 * A raster file has no shared tile references or measured preview timeline; those capabilities remain explicit.
 */
export function createRasterInterchange(source) {
    validateIndexedOwnership(source.ownership);
    const views = source.ownership.views;
    let tileWidth = 1, tileHeight = 1;
    // Large inventories must not become a JavaScript argument list or a second full dimensions array.
    for (const view of views) {
        tileWidth = Math.max(tileWidth, view.width);
        tileHeight = Math.max(tileHeight, view.height);
    }
    const layout = planIndexedPresentation(tileWidth, tileHeight, tileWidth, tileHeight, views.length);
    if (layout.pages !== 1) {
        throw new Error("Complete inventory exceeds the single raster presentation budget; use tilemaps.");
    }
    const indexes = new Uint8Array(layout.width * layout.height).fill(source.document.transparentIndex);
    const placements = views.map((view, index) => {
        const x = (index % layout.columns) * tileWidth, y = Math.floor(index / layout.columns) * tileHeight;
        for (let row = 0; row < view.height; row++) {
            indexes.set(view.indexes.subarray(row * view.width, (row + 1) * view.width), (y + row) * layout.width + x);
        }
        return { view: view.id, x, y };
    });
    return {
        kind: "raster",
        ownership: source.ownership,
        placements,
        editablePaletteSlots: source.editablePaletteSlots,
        capabilities: { ...source.capabilities, tileReferences: false, previewTimeline: false },
        document: rasterInterchangeDocument({
            width: layout.width,
            height: layout.height,
            indexes,
            palette: source.document.palette,
            transparentIndex: source.document.transparentIndex,
            exportId: source.document.exportId,
        }),
    };
}
/** Reconcile raster aliases through the same native owner planner used by tilemap inventories. */
export function inspectRasterInterchange(baseline, document) {
    validateIndexedOwnership(baseline.ownership);
    const before = rasterInterchangeAtlas(baseline.document), after = rasterInterchangeAtlas(document);
    if (before.width !== after.width ||
        before.height !== after.height ||
        before.transparentIndex !== after.transparentIndex ||
        before.exportId !== after.exportId ||
        baseline.document.frames[0].durationMs !== document.frames[0].durationMs) {
        throw new Error("Raster canvas, transparency, timing or export identity changed.");
    }
    if (baseline.placements.length !== baseline.ownership.views.length) {
        throw new Error("Incomplete private raster view inventory.");
    }
    const views = new Map(baseline.ownership.views.map((view) => [view.id, view]));
    const seen = new Set(), claimed = new Uint8Array(before.indexes.length);
    const candidates = baseline.placements.map((placement) => {
        const view = views.get(placement.view);
        if (!view || seen.has(view.id)) {
            throw new Error("Missing or duplicate private raster view.");
        }
        seen.add(view.id);
        const region = { x: placement.x, y: placement.y, width: view.width, height: view.height };
        const old = extractIndexedRegion(before, region), next = extractIndexedRegion(after, region);
        if (old.indexes.some((slot, index) => slot !== view.indexes[index])) {
            throw new Error(`Inconsistent private raster view ${view.id}.`);
        }
        for (let row = 0; row < view.height; row++) {
            for (let column = 0; column < view.width; column++) {
                const offset = (placement.y + row) * before.width + placement.x + column;
                if (claimed[offset]) {
                    throw new Error("Overlapping private raster inventory views.");
                }
                claimed[offset] = 1;
            }
        }
        return { ...next, id: view.id };
    });
    if (after.indexes.some((slot, index) => slot !== before.indexes[index] && !claimed[index])) {
        throw new Error("Read-only raster inventory padding changed.");
    }
    const pixels = reconcileIndexedViews(baseline.ownership, candidates);
    const colors = indexedPaletteChanges(before.palette, after.palette, baseline.editablePaletteSlots);
    if ((!baseline.capabilities.pixelEdits && pixels.length) ||
        (!baseline.capabilities.paletteEdits && colors.length)) {
        throw new Error("Raster edits exceed the advertised native capabilities.");
    }
    return { pixels, colors };
}
//# sourceMappingURL=raster-interchange.js.map