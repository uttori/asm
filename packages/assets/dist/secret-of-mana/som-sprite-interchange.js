import { interchangeIdentity, inspectTilemapInterchange, } from "../interchange.js";
import { ASSET_LIMITS, boundedSum, rasterArea } from "../limits.js";
import { createTilemapInventory, tilemapPresentationCel as tileCel, } from "../tilemap-presentation.js";
import { inspectFrameAtlas } from "./som-frame-atlas.js";
import { validateFrameComposition } from "./som-frame-composition.js";
import { spritePaletteColors } from "./som-sprite-palettes.js";
const X = 0x80000000, Y = 0x40000000;
/**
 * Present every native owner in an obvious Tiles frame, and each pose as real per-block
 * tilemaps sharing the same inventory. Display layout is independent of source PNG geometry.
 * Measured runs use the same common pivot; the static pose frames are presentation state.
 */
export function createSomSpriteInterchange(atlas, catalog, exportId, runs = []) {
    if (atlas.layout.tileSources !== "native-strip") {
        throw new Error("Sprite interchange requires declared native-strip ownership.");
    }
    const inspected = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
    const paletteIds = [
        ...new Set([
            ...atlas.layout.paletteRefs,
            ...(atlas.layout.paletteVariants ?? []).map((variant) => variant.palette),
        ]),
    ];
    if (paletteIds.length > 16) {
        throw new Error("Sprite palette views exceed indexed document slots.");
    }
    const palette = paletteIds.flatMap((name) => spritePaletteColors(catalog, name));
    const paletteSlots = paletteIds.flatMap((name) => Array.from({ length: 16 }, (_, index) => ({ palette: name, index })));
    const editablePaletteSlots = paletteSlots.flatMap((slot, index) => {
        const stored = catalog.palettes[slot.palette];
        return slot.index > 0 &&
            slot.index >= stored.firstIndex &&
            slot.index < stored.firstIndex + stored.words.length
            ? [index]
            : [];
    });
    const owners = [], views = [], references = new Map();
    const nativeSlots = Array.from({ length: 16 }, (_, slot) => slot), maps = new Map();
    for (const [segmentName, tiles] of inspected.tiles) {
        const segment = atlas.layout.segments[segmentName], primary = atlas.layout.paletteRefs[segment.palette];
        const variants = [
            ...new Set([
                primary,
                ...(atlas.layout.paletteVariants ?? [])
                    .filter((variant) => variant.group === segment.palette)
                    .map((variant) => variant.palette),
            ]),
        ];
        tiles.forEach((tile, index) => {
            const owner = JSON.stringify([segmentName, index]);
            owners.push({
                ...tile,
                indexes: Uint8Array.from(tile.indexes),
                id: owner,
                allowedIndexes: nativeSlots,
            });
            for (const name of variants) {
                const bank = paletteIds.indexOf(name), id = JSON.stringify([owner, name]), cached = maps.get(bank);
                let indexMap = cached;
                if (!indexMap) {
                    const slots = Array(256).fill(null);
                    for (let slot = 1; slot < 16; slot++) {
                        slots[bank * 16 + slot] = slot;
                    }
                    slots[0] = 0;
                    maps.set(bank, slots);
                    indexMap = slots;
                }
                views.push({
                    id,
                    owner,
                    width: 8,
                    height: 8,
                    indexes: Uint8Array.from(tile.indexes, (slot) => (slot === 0 ? 0 : bank * 16 + slot)),
                    indexMap,
                });
                if (name === primary) {
                    references.set(owner, views.length);
                }
            }
        });
    }
    boundedSum(0, owners.length, ASSET_LIMITS.owners, "Sprite native owners");
    const poses = (atlas.layout.frames ?? []).map((frame) => {
        const placements = validateFrameComposition(atlas.layout, frame);
        if (!placements) {
            throw new Error(`Pose ${frame.id}: retained native composition is required.`);
        }
        return { frame, placements };
    });
    let minX = 0, minY = 0, maxX = 8, maxY = 8, blocks = 0;
    for (const pose of poses) {
        blocks = Math.max(blocks, pose.frame.blocks?.length ?? 0);
        for (const placement of pose.placements) {
            minX = Math.min(minX, placement.x);
            minY = Math.min(minY, placement.y);
            maxX = Math.max(maxX, placement.x + 8);
            maxY = Math.max(maxY, placement.y + 8);
        }
    }
    // Pivot-relative measured poses participate in the same bounds, so evidence playback cannot silently clip them.
    for (const run of runs) {
        for (const observed of run.frames) {
            const pose = poses.find((entry) => String(entry.frame.id) === observed.pose);
            if (!pose) {
                throw new Error(`Sequence ${run.sequence}: unknown pose ${observed.pose}.`);
            }
            // Native placements are already actor-relative. The PNG's packed origin must never offset playback.
            for (const placement of pose.placements) {
                minX = Math.min(minX, placement.x + run.pivot.x);
                minY = Math.min(minY, placement.y + run.pivot.y);
                maxX = Math.max(maxX, placement.x + run.pivot.x + 8);
                maxY = Math.max(maxY, placement.y + run.pivot.y + 8);
            }
        }
    }
    const displayOrigin = { x: -minX, y: -minY };
    const inventory = createTilemapInventory({ owners, views }, maxX - minX, maxY - minY, `${atlas.id} native views`);
    const { width, height, layers, frames, tags } = inventory;
    rasterArea(width, height, "Sprite presentation", ASSET_LIMITS.interchangeSide);
    for (let index = 0; index < blocks; index++) {
        layers.push({
            kind: "tilemap",
            flags: 3,
            name: `Part ${index + 1}`,
            tileset: 0,
            userData: interchangeIdentity.role(`part-${index}`),
        });
    }
    const poseFrames = new Map();
    for (const { frame, placements } of poses) {
        const key = String(frame.id);
        if (poseFrames.has(key)) {
            throw new Error(`Duplicate sprite pose ${key}.`);
        }
        const cels = [];
        (frame.blocks ?? []).forEach((block, index) => {
            const members = placements.filter((placement) => placement.block === block.id), columns = block.size / 8;
            const values = new Uint32Array(columns * columns);
            for (const placement of members) {
                if (placement.external) {
                    continue;
                } // Only validated blank external cells are supported by this native frame adapter.
                const reference = references.get(JSON.stringify([placement.segment, placement.tile]));
                if (!reference) {
                    throw new Error(`Pose ${key}: unknown native view ${placement.id}.`);
                }
                const x = (placement.x - block.x) / 8, y = (placement.y - block.y) / 8;
                if (!Number.isInteger(x) ||
                    !Number.isInteger(y) ||
                    x < 0 ||
                    y < 0 ||
                    x >= columns ||
                    y >= columns) {
                    throw new Error(`Pose ${key}: block grid phase changed.`);
                }
                values[y * columns + x] =
                    (reference | (placement.flipX ? X : 0) | (placement.flipY ? Y : 0)) >>> 0;
            }
            cels.push(tileCel(index + 1, block.x + displayOrigin.x, block.y + displayOrigin.y, columns, columns, values));
        });
        const index = frames.length;
        poseFrames.set(key, index);
        frames.push({ durationMs: 100, cels });
        tags.push({
            name: `Pose ${key} (presentation)`,
            from: index,
            to: index,
            direction: 0,
            repeat: 1,
            userData: interchangeIdentity.timeline(`pose:${key}`),
        });
    }
    for (const run of runs) {
        const start = frames.length;
        for (const observed of run.frames) {
            const target = poseFrames.get(observed.pose);
            if (target === undefined) {
                throw new Error(`Sequence ${run.sequence}: unknown pose ${observed.pose}.`);
            }
            // Static cels already share the native origin. Move that origin to the measured pivot while sharing their tile cells.
            const cels = frames[target].cels.map((cel) => ({
                kind: "linked",
                layer: cel.layer,
                x: cel.x + run.pivot.x,
                y: cel.y + run.pivot.y,
                zIndex: cel.zIndex,
                frame: target,
            }));
            frames.push({ durationMs: observed.durationMs, cels });
        }
        if (frames.length === start) {
            continue;
        }
        tags.push({
            name: `${run.sequence} (${run.provenance.kind})`,
            from: start,
            to: frames.length - 1,
            direction: 0,
            repeat: 1,
            userData: interchangeIdentity.timeline(run.id),
        });
    }
    const baseline = {
        kind: "tilemap",
        ownership: { owners, views },
        editablePaletteSlots,
        nativeTransforms: ["flipX", "flipY"],
        capabilities: {
            pixelEdits: true,
            paletteEdits: true,
            tileReferences: true,
            previewTimeline: true,
        },
        document: {
            width,
            height,
            palette,
            transparentIndex: 0,
            exportId,
            layers,
            frames,
            tags,
            tilesets: [inventory.tileset],
        },
    };
    inspectTilemapInterchange(baseline, baseline.document);
    return { baseline, paletteSlots, displayOrigin };
}
//# sourceMappingURL=som-sprite-interchange.js.map