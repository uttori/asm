import { ASSET_LIMITS, boundedProduct, boundedSum, rasterArea } from "../limits.js";
import { decodePlanarTiles } from "../snes.js";
import { integer } from "../validation.js";
const LIMITATION = "Background geometry only; omits actors, BG3, camera, mutable clones and color math.";
/** Preserve the room preview's floor-based 5-bit expansion; native high bits remain in paletteWords. */
export function somRoomPaletteColor(word, transparent) {
    integer(word, "Room palette word", 0, 65535);
    if (transparent) {
        return [0, 0, 0, 0];
    }
    return [
        Math.floor(((word & 31) * 255) / 31),
        Math.floor((((word >>> 5) & 31) * 255) / 31),
        Math.floor((((word >>> 10) & 31) * 255) / 31),
        255,
    ];
}
/** Invert the established floor expansion exactly, preserving bit 15; off-grid RGB8 colors require an explicit user correction. */
export function somRoomPaletteWord(before, color) {
    integer(before, "Room palette word", 0, 65535);
    if (color.length !== 4 || color[3] !== 255) {
        throw new Error("Room palette edits require opaque RGB8.");
    }
    let word = before & 0x8000;
    for (let channel = 0; channel < 3; channel++) {
        const value = integer(color[channel], "Room palette channel", 0, 255), native = Math.round((value * 31) / 255);
        if (Math.floor((native * 255) / 31) !== value) {
            throw new Error(`RGB channel ${value} is not exactly room BGR555 representable.`);
        }
        word |= native << (channel * 5);
    }
    return word;
}
/** Decode bounded hex without a match array containing one temporary string per byte. */
function physicalGraphics(graphics, mask) {
    if (typeof graphics !== "string" ||
        !graphics.length ||
        graphics.length > 32768 * 2 ||
        graphics.length % 64 ||
        !/^[\da-f]+$/i.test(graphics)) {
        throw new Error("Invalid or oversized planar room graphics.");
    }
    if (typeof mask !== "string" || mask.length !== graphics.length || !/^(?:00|01)+$/.test(mask)) {
        throw new Error("Preview graphics require a matching physical-coverage mask.");
    }
    const bytes = new Uint8Array(graphics.length / 2), known = new Uint8Array(bytes.length);
    for (let offset = 0; offset < bytes.length; offset++) {
        bytes[offset] = Number.parseInt(graphics.slice(offset * 2, offset * 2 + 2), 16);
        known[offset] = mask.charCodeAt(offset * 2 + 1) - 48;
    }
    return { bytes, known };
}
/** Resolve inclusive story predicates and native piece overwrite order before expanding metatile quadrants. */
export function composeSomRoom(room, preview, story) {
    if (room.format !== "som.room" ||
        room.version !== 1 ||
        preview.format !== "som.room.preview" ||
        preview.version !== 1) {
        throw new Error("Unsupported room composition inputs.");
    }
    if (!Array.isArray(room.header) || room.header.length !== 8) {
        throw new Error("Room header requires eight bytes.");
    }
    room.header.forEach((value) => integer(value, "Room header byte", 0, 255));
    integer(room.pieces.length, "Room piece count", 0, 65536);
    const key = `${room.header[0] & 63}:${room.header[2]}:${room.header[1] & 127}`;
    if (!Object.hasOwn(preview.tilesets, key)) {
        throw new Error(`Preview resources do not contain tileset ${key}.`);
    }
    const assets = preview.tilesets[key], states = { ...room.previewStory, ...story }, pieces = [];
    let columns = 0, rows = 0, placementWork = 0;
    for (const [sourceIndex, piece] of room.pieces.entries()) {
        integer(piece.variable, "Story variable", 0, 255);
        integer(piece.minimum, "Story minimum", 0, 15);
        integer(piece.maximum, "Story maximum", piece.minimum, 15);
        const value = integer(states[piece.variable], `Preview story ${piece.variable}`, 0, 255);
        if (value < piece.minimum || value > piece.maximum) {
            continue;
        }
        integer(piece.x, "Piece x", 0, 127);
        integer(piece.y, "Piece y", 0, 127);
        integer(piece.layer, "Piece layer", 1, 2);
        integer(piece.layout, "Layout id", 1, 1023);
        const layout = Object.hasOwn(preview.layouts, piece.layout)
            ? preview.layouts[piece.layout]
            : undefined;
        if (!layout) {
            throw new Error("Missing or incomplete layout preview.");
        }
        integer(layout.width, "Layout width", 1, 128);
        integer(layout.height, "Layout height", 1, 128);
        const area = layout.width * layout.height;
        if (!Array.isArray(layout.tiles) || layout.tiles.length !== area) {
            throw new Error("Missing or incomplete layout preview.");
        }
        columns = Math.max(columns, piece.x + layout.width);
        rows = Math.max(rows, piece.y + layout.height);
        if (columns > 128 || rows > 128) {
            throw new Error("Room pieces exceed the native 128-tile layer bounds.");
        }
        // Bound repeated overlapping declarations too, rather than only charging for the final visible rectangle.
        placementWork = boundedSum(placementWork, area * 256, ASSET_LIMITS.renderPixels, "Room placement work");
        layout.tiles.forEach((tile) => integer(tile, "Static metatile id", 0, 191));
        pieces.push({ ...piece, sourceIndex, width: layout.width, height: layout.height });
    }
    if (!pieces.length) {
        throw new Error("No active room pieces in this preview state.");
    }
    const width = columns * 16, height = rows * 16;
    rasterArea(width, height, "Room composition", ASSET_LIMITS.interchangeSide);
    const maps = [
        new Int16Array(columns * rows).fill(-1),
        new Int16Array(columns * rows).fill(-1),
    ];
    for (const piece of pieces) {
        const layout = preview.layouts[piece.layout], map = maps[piece.layer - 1];
        // Later active pieces replace earlier metatiles on the same native layer; transparent pixels do not undo placement.
        for (let y = 0; y < piece.height; y++) {
            map.set(layout.tiles.slice(y * piece.width, (y + 1) * piece.width), (piece.y + y) * columns + piece.x);
        }
    }
    const { bytes: graphics, known: graphicsKnown } = physicalGraphics(assets.graphics, assets.graphicsKnown);
    if (!Array.isArray(assets.colors) ||
        assets.colors.length !== 128 ||
        !Array.isArray(assets.layerWords) ||
        assets.layerWords.length !== 2) {
        throw new Error("Incomplete palette/metatile preview.");
    }
    const paletteWords = Uint16Array.from(assets.colors, (word) => integer(word, "Palette word", 0, 65535)), palette = Array.from(paletteWords, (word, index) => somRoomPaletteColor(word, index % 16 === 0));
    for (const words of assets.layerWords) {
        if (!Array.isArray(words) || words.length !== 768) {
            throw new Error("Incomplete metatile preview.");
        }
        words.forEach((word) => integer(word, "Metatile word", 0, 65535));
    }
    const tiles = decodePlanarTiles(graphics, 4).map((tile) => Uint8Array.from(tile.flat())), passOrder = [
        [2, 0],
        [1, 0],
        [2, 1],
        [1, 1],
    ];
    const passes = passOrder.map(([layer, priority]) => {
        const cells = [], map = maps[layer - 1], words = assets.layerWords[layer - 1];
        for (let position = 0; position < map.length; position++) {
            const metatile = map[position];
            if (metatile < 0) {
                continue;
            }
            for (let quadrant = 0; quadrant < 4; quadrant++) {
                const word = words[metatile * 4 + quadrant];
                if (((word >>> 13) & 1) !== priority) {
                    continue;
                }
                const tile = word & 1023, offset = tile * 32;
                if (offset + 32 > graphics.length) {
                    throw new Error("Preview references uncaptured graphics.");
                }
                if (!graphicsKnown.subarray(offset, offset + 32).every((byte) => byte === 1)) {
                    throw new Error("Preview references unknown physical graphics bytes.");
                }
                cells.push({
                    x: (position % columns) * 16 + (quadrant % 2) * 8,
                    y: Math.floor(position / columns) * 16 + (quadrant >>> 1) * 8,
                    metatile,
                    word,
                    tile,
                    palette: (word >>> 10) & 7,
                    flipX: !!(word & 0x4000),
                    flipY: !!(word & 0x8000),
                });
            }
        }
        return { layer, priority, cells };
    });
    return {
        width,
        height,
        tileset: key,
        activePieces: pieces,
        metatiles: maps,
        passes,
        graphics,
        graphicsKnown,
        tiles,
        paletteWords,
        palette,
        provenance: structuredClone(preview.provenance),
        limitation: LIMITATION,
    };
}
/** Render the shared Mode-1 value at native scale, preserving the established opaque preview backdrop. */
export function renderSomRoomComposition(composition, layer) {
    if (layer !== undefined) {
        integer(layer, "Room render layer", 1, 2);
    }
    const area = rasterArea(composition.width, composition.height, "Room render", ASSET_LIMITS.interchangeSide);
    let work = 0;
    integer(composition.passes.length, "Room passes", 1, 4);
    integer(composition.tiles.length, "Room tiles", 1, 1024);
    if (composition.palette.length !== 128) {
        throw new Error("Incomplete room render palette.");
    }
    for (const tile of composition.tiles) {
        if (!(tile instanceof Uint8Array) || tile.length !== 64 || tile.some((slot) => slot > 15)) {
            throw new Error("Invalid room render tile.");
        }
    }
    for (const pass of composition.passes) {
        integer(pass.layer, "Room pass layer", 1, 2);
        integer(pass.priority, "Room pass priority", 0, 1);
        if (layer !== undefined && pass.layer !== layer) {
            continue;
        }
        work = boundedSum(work, pass.cells.length * 64, ASSET_LIMITS.renderPixels, "Room rendering work");
        for (const cell of pass.cells) {
            integer(cell.x, "Room cell x", 0, composition.width - 8);
            integer(cell.y, "Room cell y", 0, composition.height - 8);
            integer(cell.tile, "Room cell tile", 0, composition.tiles.length - 1);
            integer(cell.palette, "Room cell palette", 0, 7);
        }
    }
    // Validate aggregate work and referenced bounds before allocating a full-resolution output.
    const rgba = new Uint8Array(boundedProduct(area, 4, ASSET_LIMITS.decodedBytes, "Room RGBA bytes"));
    for (let pixel = 0; pixel < rgba.length; pixel += 4) {
        rgba.set([10, 14, 22, 255], pixel);
    }
    for (const pass of composition.passes) {
        if (layer !== undefined && pass.layer !== layer) {
            continue;
        }
        for (const cell of pass.cells) {
            const tile = composition.tiles[cell.tile];
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    const sourceX = cell.flipX ? 7 - x : x, sourceY = cell.flipY ? 7 - y : y, slot = tile[sourceY * 8 + sourceX];
                    if (slot === 0) {
                        continue;
                    }
                    const at = ((cell.y + y) * composition.width + cell.x + x) * 4;
                    rgba.set(composition.palette[cell.palette * 16 + slot], at);
                }
            }
        }
    }
    return { rgba, width: composition.width, height: composition.height };
}
//# sourceMappingURL=som-room-composition.js.map