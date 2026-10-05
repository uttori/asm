import { validateIndexedOwnership } from "./indexed-ownership.js";
import { interchangeIdentity } from "./interchange.js";
import { ASSET_LIMITS, boundedProduct } from "./limits.js";
import { planIndexedPresentation } from "./presentation-layout.js";
/** Pixel-positioned type-3 cel; adapters keep cell units and native transform meaning outside this storage helper. */
export function tilemapPresentationCel(layer, x, y, columns, rows, cells) {
    return {
        kind: "tilemap",
        layer,
        x,
        y,
        zIndex: 0,
        columns,
        rows,
        cells,
        bits: 32,
        idMask: 0x1fffffff,
        flipXMask: 0x80000000,
        flipYMask: 0x40000000,
        diagonalMask: 0x20000000,
    };
}
/**
 * Build a visible, complete shared inventory on separate presentation frames.
 * Read-only views use a labeled layer. Container tile zero remains empty and never absorbs a blank native owner.
 */
export function createTilemapInventory(ownership, nativeWidth, nativeHeight, name) {
    validateIndexedOwnership(ownership);
    const { views } = ownership, first = views[0];
    if (!first || views.some((view) => view.width !== first.width || view.height !== first.height)) {
        throw new Error("A shared tileset inventory requires uniform view geometry.");
    }
    const area = first.width * first.height, layout = planIndexedPresentation(nativeWidth, nativeHeight, first.width, first.height, views.length), strip = new Uint8Array(boundedProduct(views.length + 1, area, ASSET_LIMITS.decodedBytes, "Inventory tile pixels")), owners = new Map(ownership.owners.map((owner) => [owner.id, owner])), readonlyViews = views.map((view) => owners.get(view.owner)?.editable === false);
    views.forEach((view, index) => strip.set(view.indexes, (index + 1) * area));
    const layers = [
        {
            kind: "tilemap",
            flags: 3,
            tileset: 0,
            name: "Tiles — edit pixels in Manual mode",
            userData: interchangeIdentity.role("inventory"),
        },
    ];
    if (readonlyViews.some(Boolean)) {
        layers.push({
            kind: "tilemap",
            flags: 1,
            tileset: 0,
            name: "Tiles (read-only: native inverse unproven)",
            userData: interchangeIdentity.role("inventory-readonly"),
        });
    }
    const frames = [], tags = [];
    for (let page = 0; page < layout.pages; page++) {
        const count = Math.min(layout.capacity, views.length - page * layout.capacity), rows = Math.ceil(count / layout.columns), cels = [];
        for (let layer = 0; layer < layers.length; layer++) {
            const cells = new Uint32Array(layout.columns * rows);
            for (let index = 0; index < count; index++) {
                const view = page * layout.capacity + index;
                if (readonlyViews[view] === (layer === 1)) {
                    cells[index] = view + 1;
                }
            }
            cels.push(tilemapPresentationCel(layer, 0, 0, layout.columns, rows, cells));
        }
        frames.push({ durationMs: 100, cels });
        tags.push({
            name: `Tiles ${page + 1} (presentation)`,
            from: page,
            to: page,
            direction: 0,
            repeat: 1,
            userData: interchangeIdentity.timeline(`inventory:${page}`),
        });
    }
    return {
        width: layout.width,
        height: layout.height,
        layers,
        frames,
        tags,
        tileset: {
            id: 0,
            flags: 30,
            name,
            baseIndex: 0,
            tileWidth: first.width,
            tileHeight: first.height,
            tileCount: views.length + 1,
            indexes: strip,
            userData: interchangeIdentity.tileset("native-views"),
            tileData: [undefined, ...views.map((view) => interchangeIdentity.view(view.id))],
        },
    };
}
//# sourceMappingURL=tilemap-presentation.js.map