/** Editable room records with fixed ROM ownership and a native-data background preview. */
import { invariant as assert, equal, fail } from "../validation.js";
import { composeSomRoom, renderSomRoomComposition } from "./som-room-composition.js";
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
        fail(`${name} must be 0..${maximum}.`);
    }
    return value;
}
/** One room owns three discontiguous sections; shared layouts, graphics and palettes remain references.
 * @param {AssetInput} source JSON room records.
 * @returns {RoomAsset} Validated room.
 */
export function parseRoomAsset(source) {
    equal(source.mediaType, "application/json", "Room source must be JSON.");
    const parsed = JSON.parse(new TextDecoder().decode(source.bytes));
    if (!isRecord(parsed)) {
        fail("Room source must be a JSON object.");
    }
    equal(parsed.format, "som.room");
    equal(parsed.version, 1);
    integer(parsed.id, 510, "room id");
    assert(Array.isArray(parsed.header) && parsed.header.length === 8, "Room header requires eight bytes.");
    for (const byte of parsed.header) {
        integer(byte, 255, "header byte");
    }
    for (const key of ["entities", "pieces", "triggers"]) {
        assert(Array.isArray(parsed[key]), `Missing room ${key}.`);
    }
    if (!isRoomAsset(parsed)) {
        fail("Room entities, pieces, and triggers must match the room record.");
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
        fail("Room preview resource must be a JSON object.");
    }
    equal(parsed.format, "som.room.preview");
    equal(parsed.version, 1);
    if (!isRoomPreview(parsed)) {
        fail("Room preview resource must include tileset and layout records.");
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
            equal(flags & 0x3f, 0, "Only packed entity flags 40/80 are defined.");
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
            equal(piece.layer, layer, "A layer change requires an explicit marker.");
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
    equal(bytes.length, owner.bytes, "Room edit changes its fixed ROM extent; relocation is required.");
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
    if (layer !== undefined && layer !== 1 && layer !== 2) {
        throw new Error("Preview layer must be 1 or 2.");
    }
    const composition = composeSomRoom(room, preview, story);
    return {
        ...renderSomRoomComposition(composition, layer),
        tileset: composition.tileset,
        activePieces: composition.activePieces.map((piece) => piece.layout),
        limitation: composition.limitation,
    };
}
//# sourceMappingURL=som-room-assets.js.map