import type { AssetInput } from "../registry.js";
/** Editable room records with fixed ROM ownership and a native-data background preview. */
import { invariant as assert, equal, fail } from "../validation.js";
import { composeSomRoom, renderSomRoomComposition } from "./som-room-composition.js";

/** Inclusive story-variable predicate shared by entities and layout pieces. */
interface RoomCondition {
  variable: number;
  minimum: number;
  maximum: number;
}

/** One object record in the room objects section. */
interface RoomEntity extends RoomCondition {
  flags: number;
  event: number;
  x: number;
  y: number;
  orientationAndLayer: number;
  entity: number;
  interaction: number;
}

/** Native conditional placement in 16-pixel metatile units; a layer transition retains its explicit marker. */
export interface RoomPiece extends RoomCondition {
  /** Optional FE/FF layer transition marker preceding this piece. */
  marker?: number;
  /** Active BG layer after applying any preceding marker. */
  layer: number;
  /** One-based layout id referenced by preview sidecars. */
  layout: number;
  /** Horizontal metatile origin in 16-pixel units. */
  x: number;
  /** Vertical metatile origin in 16-pixel units. */
  y: number;
}

/** One room owns three discontiguous sections; shared layouts, graphics and palettes remain references. */
export interface RoomAsset {
  /** Room record discriminator. */
  format: string;
  /** Room schema revision. */
  version: number;
  /** Native room id in 0..510. */
  id: number;
  /** Eight-byte header selecting preview tileset and loader context. */
  header: number[];
  /** Object records repacked into the objects ROM span. */
  entities: RoomEntity[];
  /** Conditional layout pieces repacked into the assembly span. */
  pieces: RoomPiece[];
  /** Packed trigger words for the triggers span. */
  triggers: number[];
  /** Fixed ROM ownership for each repackable section. */
  sections?: Record<string, { address: number; bytes: number }>;
  /** Default story-variable values used when previewing. */
  previewStory?: Record<string, number>;
  /** Optional human label; not encoded into ROM. */
  name?: string;
}

/** Metatile grid captured for one layout id in a preview sidecar. */
interface RoomPreviewLayout {
  tiles: number[];
  width: number;
  height: number;
}

/** Planar graphics and palette words for one preview tileset key. */
interface RoomPreviewTileset {
  graphics: string;
  graphicsKnown: string;
  colors: number[];
  layerWords: number[][];
}

/** Captured tilesets and layouts used only by the room preview. */
export interface RoomPreview {
  /** Preview sidecar discriminator. */
  format: string;
  /** Preview schema revision. */
  version: number;
  /** Tileset records keyed by header-derived preview id. */
  tilesets: Record<string, RoomPreviewTileset>;
  /** Layout metatile grids keyed by layout id. */
  layouts: Record<string, RoomPreviewLayout>;
  /** Descriptive capture/initial-loader evidence; source write authority is resolved separately. */
  provenance?: unknown;
}

/** Narrow JSON values to plain objects during room parsing. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accept any object as a room entity pending field validation elsewhere. */
function isRoomEntity(value: unknown): value is RoomEntity {
  return isRecord(value);
}

/** Accept any object as a room piece pending field validation elsewhere. */
function isRoomPiece(value: unknown): value is RoomPiece {
  return isRecord(value);
}

/** Structural guard for a parsed room preview sidecar envelope. */
function isRoomPreview(value: unknown): value is RoomPreview {
  return (
    isRecord(value) &&
    value.format === "som.room.preview" &&
    value.version === 1 &&
    isRecord(value.tilesets) &&
    isRecord(value.layouts)
  );
}

/** Structural guard for room entities, pieces and triggers arrays. */
function isRoomAsset(value: unknown): value is RoomAsset {
  return (
    isRecord(value) &&
    Array.isArray(value.entities) &&
    value.entities.every(isRoomEntity) &&
    Array.isArray(value.pieces) &&
    value.pieces.every(isRoomPiece) &&
    Array.isArray(value.triggers) &&
    value.triggers.every((item): item is number => typeof item === "number")
  );
}

/**
 * Reject truncation rather than silently masking a user's edited field.
 * @param value Field to check.
 * @param maximum Inclusive upper bound.
 * @param name Field name used in the error.
 * @returns The validated integer.
 */
function integer(value: unknown, maximum: number, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > maximum) {
    fail(`${name} must be 0..${maximum}.`);
  }
  return value;
}

/**
 * One room owns three discontiguous sections; shared layouts, graphics and palettes remain references.
 * @param source JSON room records.
 * @returns Validated room.
 */
export function parseRoomAsset(source: AssetInput): RoomAsset {
  equal(source.mediaType, "application/json", "Room source must be JSON.");
  const parsed: unknown = JSON.parse(new TextDecoder().decode(source.bytes));
  if (!isRecord(parsed)) {
    fail("Room source must be a JSON object.");
  }
  equal(parsed.format, "som.room");
  equal(parsed.version, 1);
  integer(parsed.id, 510, "room id");
  assert(
    Array.isArray(parsed.header) && parsed.header.length === 8,
    "Room header requires eight bytes.",
  );
  for (const byte of parsed.header) {
    integer(byte, 255, "header byte");
  }
  for (const key of ["entities", "pieces", "triggers"] as const) {
    assert(Array.isArray(parsed[key]), `Missing room ${key}.`);
  }
  if (!isRoomAsset(parsed)) {
    fail("Room entities, pieces, and triggers must match the room record.");
  }
  return parsed;
}

/**
 * Parse a captured preview sidecar. Render still checks tileset and layout contents.
 * @param bytes JSON bytes for a `som.room.preview` document.
 * @returns Preview envelope with tileset and layout records.
 */
export function parseRoomPreview(bytes: Uint8Array): RoomPreview {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
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

/**
 * Encode whole-byte story predicates with packed inclusive nibbles, without changing their semantics.
 * @param record Story variable and inclusive nibble range.
 * @returns Variable byte and packed minimum/maximum.
 */
function condition(record: RoomCondition) {
  const variable = integer(record.variable, 255, "story variable");
  const minimum = integer(record.minimum, 15, "story minimum"),
    maximum = integer(record.maximum, 15, "story maximum");
  assert(minimum <= maximum, "Story range is reversed.");
  return [variable, (minimum << 4) | maximum];
}

/**
 * Repack one fixed section. Changing record counts or adding layer markers requires relocation,
 * so length changes fail instead of silently overwriting an adjacent room's records.
 * @param room Editable room records.
 * @param section `objects`, `assembly`, or `triggers`.
 * @returns Native bytes for that fixed span.
 */
export function encodeRoomSection(room: RoomAsset, section: string) {
  assert(
    ["objects", "assembly", "triggers"].includes(section),
    "Room section must be objects, assembly or triggers.",
  );
  const bytes = [];
  if (section === "objects") {
    bytes.push(...room.header);
    for (const entity of room.entities) {
      const flags = integer(entity.flags, 255, "entity flags");
      equal(flags & 0x3f, 0, "Only packed entity flags 40/80 are defined.");
      const event = integer(entity.event, 4095, "entity event");
      bytes.push(
        ...condition(entity),
        integer(entity.x, 127, "entity x") | ((flags & 0x40) << 1),
        integer(entity.y, 127, "entity y") | (flags & 0x80),
        integer(entity.orientationAndLayer, 255, "orientation/layer byte"),
        integer(entity.entity, 255, "entity id"),
        event & 255,
        (integer(entity.interaction, 15, "interaction flags") << 4) | (event >>> 8),
      );
    }
  } else if (section === "assembly") {
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
      bytes.push(
        ...predicate,
        layout & 255,
        (integer(piece.x, 127, "piece x") << 1) | ((layout >>> 8) & 1),
        (integer(piece.y, 127, "piece y") << 1) | ((layout >>> 9) & 1),
      );
    }
  } else {
    for (const trigger of room.triggers) {
      integer(trigger, 65535, "packed trigger word");
      bytes.push(trigger & 255, trigger >>> 8);
    }
  }
  const owner = room.sections?.[section];
  assert(
    owner && Number.isInteger(owner.address) && Number.isInteger(owner.bytes),
    "Missing fixed section ownership.",
  );
  equal(
    bytes.length,
    owner.bytes,
    "Room edit changes its fixed ROM extent; relocation is required.",
  );
  return Uint8Array.from(bytes);
}

/**
 * Validate every section, so an invalid edit cannot hide behind a different include.
 * @param source Serialized editable room records.
 * @param options Selects one of the three fixed ROM spans.
 * @returns Validated native bytes for all spans.
 */
export function convertRoomAsset(source: AssetInput, options: Readonly<Record<string, unknown>>) {
  const room = parseRoomAsset(source);
  const outputs: Record<string, { bytes: Uint8Array }> = {};
  for (const section of ["objects", "assembly", "triggers"]) {
    outputs[section] = { bytes: encodeRoomSection(room, section) };
  }
  const selected = options.section;
  assert(
    typeof selected === "string" && Object.hasOwn(outputs, selected),
    "Select a room section.",
  );
  return { primaryOutput: selected, outputs };
}

/**
 * Validate the selected captured tileset and compose current conditional placements at native scale.
 * @param room Editable room records.
 * @param preview Captured tilesets and layouts.
 * @param [layer] Background layer 1, 2, or both when omitted.
 * @param [story] Story-variable overrides.
 * @returns Native-scale preview.
 */
export function renderRoomAsset(
  room: RoomAsset,
  preview: RoomPreview,
  { layer, story }: { layer?: unknown; story?: Readonly<Record<string, number>> } = {},
) {
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
