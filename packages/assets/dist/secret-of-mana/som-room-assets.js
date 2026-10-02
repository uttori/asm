/** Editable room records with fixed ROM ownership and a native-data background preview. */
import assert from "node:assert/strict";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isRoomEntity(value) {
    return isRecord(value);
}
function isRoomPiece(value) {
    return isRecord(value);
}
function isRoomPreview(value) {
    return (isRecord(value) &&
        value.format === "som.room.preview" &&
        value.version === 1 &&
        isRecord(value.tilesets) &&
        isRecord(value.layouts));
}
function isRoomAsset(value) {
    return (isRecord(value) &&
        Array.isArray(value.entities) &&
        value.entities.every(isRoomEntity) &&
        Array.isArray(value.pieces) &&
        value.pieces.every(isRoomPiece) &&
        Array.isArray(value.triggers) &&
        value.triggers.every((item) => typeof item === "number"));
}
/** Reject truncation rather than silently masking a user's edited field.
 * @param {unknown} value Field to check.
 * @param {number} maximum Inclusive upper bound.
 * @param {string} name Field name used in the error.
 * @returns {number} The validated integer.
 */
function integer(value, maximum, name) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > maximum) {
        assert.fail(`${name} must be 0..${maximum}.`);
    }
    return value;
}
/** One room owns three discontiguous sections; shared layouts, graphics and palettes remain references.
 * @param {AssetInput} source JSON room records.
 * @returns {RoomAsset} Validated room.
 */
export function parseRoomAsset(source) {
    assert.equal(source.mediaType, "application/json", "Room source must be JSON.");
    const parsed = JSON.parse(new TextDecoder().decode(source.bytes));
    if (!isRecord(parsed)) {
        assert.fail("Room source must be a JSON object.");
    }
    assert.equal(parsed.format, "som.room");
    assert.equal(parsed.version, 1);
    integer(parsed.id, 510, "room id");
    assert(Array.isArray(parsed.header) && parsed.header.length === 8, "Room header requires eight bytes.");
    for (const byte of parsed.header) {
        integer(byte, 255, "header byte");
    }
    for (const key of ["entities", "pieces", "triggers"]) {
        assert(Array.isArray(parsed[key]), `Missing room ${key}.`);
    }
    if (!isRoomAsset(parsed)) {
        assert.fail("Room entities, pieces, and triggers must match the room record.");
    }
    return parsed;
}
/** Parse a captured preview sidecar. Render still checks tileset and layout contents.
 * @param {Uint8Array} bytes JSON bytes for a `som.room.preview` document.
 * @returns {RoomPreview} Preview envelope with tileset and layout records.
 */
export function parseRoomPreview(bytes) {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(parsed)) {
        assert.fail("Room preview resource must be a JSON object.");
    }
    assert.equal(parsed.format, "som.room.preview");
    assert.equal(parsed.version, 1);
    if (!isRoomPreview(parsed)) {
        assert.fail("Room preview resource must include tileset and layout records.");
    }
    return parsed;
}
/** Encode whole-byte story predicates with packed inclusive nibbles, without changing their semantics.
 * @param {RoomCondition} record Story variable and inclusive nibble range.
 * @returns {number[]} Variable byte and packed minimum/maximum.
 */
function condition(record) {
    const variable = integer(record.variable, 255, "story variable");
    const minimum = integer(record.minimum, 15, "story minimum"), maximum = integer(record.maximum, 15, "story maximum");
    assert(minimum <= maximum, "Story range is reversed.");
    return [variable, (minimum << 4) | maximum];
}
/**
 * Repack one fixed section. Changing record counts or adding layer markers requires relocation,
 * so length changes fail instead of silently overwriting an adjacent room's records.
 * @param {RoomAsset} room Editable room records.
 * @param {string} section `objects`, `assembly`, or `triggers`.
 * @returns {Uint8Array} Native bytes for that fixed span.
 */
export function encodeRoomSection(room, section) {
    assert(["objects", "assembly", "triggers"].includes(section), "Room section must be objects, assembly or triggers.");
    const bytes = [];
    if (section === "objects") {
        bytes.push(...room.header);
        for (const entity of room.entities) {
            const flags = integer(entity.flags, 255, "entity flags");
            assert.equal(flags & 0x3f, 0, "Only packed entity flags 40/80 are defined.");
            const event = integer(entity.event, 4095, "entity event");
            bytes.push(...condition(entity), integer(entity.x, 127, "entity x") | ((flags & 0x40) << 1), integer(entity.y, 127, "entity y") | (flags & 0x80), integer(entity.orientationAndLayer, 255, "orientation/layer byte"), integer(entity.entity, 255, "entity id"), event & 255, (integer(entity.interaction, 15, "interaction flags") << 4) | (event >>> 8));
        }
    }
    else if (section === "assembly") {
        let layer = 1;
        for (const piece of room.pieces) {
            if (piece.marker !== undefined) {
                assert(piece.marker === 0xfe || piece.marker === 0xff, "Layer marker must be FE or FF.");
                bytes.push(piece.marker);
                layer = piece.marker - 0xfd;
            }
            assert.equal(piece.layer, layer, "A layer change requires an explicit marker.");
            const predicate = condition(piece);
            assert(predicate[0] < 0xfe, "FE/FF are layer markers, not piece story indexes.");
            const layout = integer(piece.layout, 1023, "layout id");
            assert(layout > 0, "Native layout IDs are one-based.");
            bytes.push(...predicate, layout & 255, (integer(piece.x, 127, "piece x") << 1) | ((layout >>> 8) & 1), (integer(piece.y, 127, "piece y") << 1) | ((layout >>> 9) & 1));
        }
    }
    else {
        for (const trigger of room.triggers) {
            integer(trigger, 65535, "packed trigger word");
            bytes.push(trigger & 255, trigger >>> 8);
        }
    }
    const owner = room.sections?.[section];
    assert(owner && Number.isInteger(owner.address) && Number.isInteger(owner.bytes), "Missing fixed section ownership.");
    assert.equal(bytes.length, owner.bytes, "Room edit changes its fixed ROM extent; relocation is required.");
    return Uint8Array.from(bytes);
}
/**
 * Validate every section, so an invalid edit cannot hide behind a different include.
 * @param {{mediaType: string, bytes: Uint8Array}} source Serialized editable room records.
 * @param {{section?: unknown}} options Selects one of the three fixed ROM spans.
 * @returns {{primaryOutput: string, outputs: Record<string, {bytes: Uint8Array}>}} Validated native bytes for all spans.
 */
export function convertRoomAsset(source, options) {
    const room = parseRoomAsset(source);
    const outputs = {};
    for (const section of ["objects", "assembly", "triggers"]) {
        outputs[section] = { bytes: encodeRoomSection(room, section) };
    }
    const selected = options.section;
    assert(typeof selected === "string" && Object.hasOwn(outputs, selected), "Select a room section.");
    return { primaryOutput: selected, outputs };
}
/** Validate the selected captured tileset and compose current conditional placements at native scale.
 * @param {RoomAsset} room Editable room records.
 * @param {RoomPreview} preview Captured tilesets and layouts.
 * @param {unknown} [layer] Background layer 1, 2, or both when omitted.
 * @param {Readonly<Record<string, number>>} [story] Story-variable overrides.
 * @returns {{rgba: Uint8Array, width: number, height: number, tileset: string, activePieces: number[], limitation: string}} Native-scale preview.
 */
export function renderRoomAsset(room, preview, { layer, story } = {}) {
    assert.equal(preview.format, "som.room.preview");
    assert.equal(preview.version, 1);
    assert(layer === undefined || layer === 1 || layer === 2, "Preview layer must be 1 or 2.");
    const selectedLayer = layer === 1 || layer === 2 ? layer : undefined;
    const key = `${room.header[0] & 63}:${room.header[2]}:${room.header[1] & 127}`;
    const assets = preview.tilesets[key];
    assert(assets, `Preview resources do not contain tileset ${key}.`);
    const states = { ...room.previewStory, ...story };
    const pieces = room.pieces.filter((piece) => {
        const value = states[piece.variable];
        integer(value, 255, `preview story ${piece.variable}`);
        return value >= piece.minimum && value <= piece.maximum;
    });
    assert(pieces.length, "No active room pieces in this preview state.");
    let width = 0, height = 0;
    for (const piece of pieces) {
        integer(piece.x, 127, "piece x");
        integer(piece.y, 127, "piece y");
        assert(piece.layer === 1 || piece.layer === 2, "Piece layer must be 1 or 2.");
        const layout = Object.hasOwn(preview.layouts, piece.layout)
            ? preview.layouts[piece.layout]
            : undefined;
        if (!layout || layout.tiles.length !== layout.width * layout.height) {
            assert(false, "Missing or incomplete layout preview.");
        }
        integer(layout.width, 128, "layout width");
        integer(layout.height, 128, "layout height");
        assert(layout.width && layout.height, "Layout dimensions must be positive.");
        width = Math.max(width, piece.x + layout.width);
        height = Math.max(height, piece.y + layout.height);
    }
    assert(width <= 128 && height <= 128, "Room pieces exceed the native 128-tile layer bounds.");
    const maps = [new Map(), new Map()];
    for (const piece of pieces) {
        const layout = preview.layouts[piece.layout];
        for (let y = 0; y < layout.height; y++) {
            for (let x = 0; x < layout.width; x++) {
                maps[piece.layer - 1].set((piece.y + y) * width + piece.x + x, layout.tiles[y * layout.width + x]);
            }
        }
    }
    const pixelWidth = width * 16, pixelHeight = height * 16;
    const rgba = new Uint8Array(pixelWidth * pixelHeight * 4);
    for (let i = 0; i < rgba.length; i += 4) {
        rgba.set([10, 14, 22, 255], i);
    }
    assert(assets.graphics.length % 2 === 0 && /^[\da-f]+$/i.test(assets.graphics), "Invalid planar graphics.");
    const graphicsPairs = assets.graphics.match(/../g);
    assert(graphicsPairs, "Invalid planar graphics.");
    const graphics = Uint8Array.from(graphicsPairs, (byte) => parseInt(byte, 16));
    assert(typeof assets.graphicsKnown === "string" &&
        /^(?:00|01)+$/.test(assets.graphicsKnown) &&
        assets.graphicsKnown.length === assets.graphics.length, "Preview graphics require a matching physical-coverage mask.");
    const knownPairs = assets.graphicsKnown.match(/../g);
    assert(knownPairs, "Preview graphics require a matching physical-coverage mask.");
    const graphicsKnown = Uint8Array.from(knownPairs, (byte) => parseInt(byte, 16));
    assert(assets.colors.length === 128 && assets.layerWords.length === 2, "Incomplete palette/metatile preview.");
    // Mode-1 background priority order; sprites, BG3, scroll and color math are intentionally absent.
    const passes = selectedLayer
        ? [
            [selectedLayer - 1, 0],
            [selectedLayer - 1, 1],
        ]
        : [
            [1, 0],
            [0, 0],
            [1, 1],
            [0, 1],
        ];
    for (const [plane, priority] of passes) {
        for (const [position, tile] of maps[plane]) {
            integer(tile, 191, "static metatile id");
            const words = assets.layerWords[plane];
            assert.equal(words.length, 768);
            const mapX = position % width, mapY = Math.floor(position / width);
            for (let part = 0; part < 4; part++) {
                const word = integer(words[tile * 4 + part], 65535, "metatile word");
                if (((word >>> 13) & 1) !== priority) {
                    continue;
                }
                const offset = (word & 1023) * 32;
                assert(offset + 32 <= graphics.length, "Preview references uncaptured graphics.");
                assert(graphicsKnown.subarray(offset, offset + 32).every((byte) => byte === 1), "Preview references unknown physical graphics bytes.");
                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++) {
                        const sx = word & 0x4000 ? 7 - x : x, sy = word & 0x8000 ? 7 - y : y;
                        let color = 0;
                        for (let bit = 0; bit < 4; bit++) {
                            color |=
                                ((graphics[offset + (bit >>> 1) * 16 + sy * 2 + (bit % 2)] >>> (7 - sx)) & 1) <<
                                    bit;
                        }
                        if (!color) {
                            continue;
                        }
                        const bgr = integer(assets.colors[((word >>> 10) & 7) * 16 + color], 65535, "palette word");
                        const at = ((mapY * 16 + (part >>> 1) * 8 + y) * pixelWidth + mapX * 16 + (part % 2) * 8 + x) *
                            4;
                        rgba.set([0, 5, 10].map((shift) => Math.floor((((bgr >>> shift) & 31) * 255) / 31)), at);
                    }
                }
            }
        }
    }
    return {
        rgba,
        width: pixelWidth,
        height: pixelHeight,
        tileset: key,
        activePieces: pieces.map((piece) => piece.layout),
        limitation: "Background geometry only; omits actors, BG3, camera, mutable clones and color math.",
    };
}
//# sourceMappingURL=som-room-assets.js.map