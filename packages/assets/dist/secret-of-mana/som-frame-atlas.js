import { extractIndexedRegion, pngImporter, renderIndexedPlacements, } from "@uttori/asm-assets/image";
import { encodePlanarTiles } from "@uttori/asm-assets/snes";
import { validateFrameComposition } from "./som-frame-composition.js";
import { spritePaletteColors } from "./som-sprite-palettes.js";
/** Reject malformed editor rectangles only when their consuming scope requests them.
 * @param {readonly number[] | undefined} bounds X, y, width, and height.
 * @param {number} width Canvas width.
 * @param {number} height Canvas height.
 * @param {string} label Rectangle described in the error.
 * @returns {void} Nothing; invalid rectangles throw.
 */
function rectangle(bounds, width, height, label) {
    if (!Array.isArray(bounds) ||
        bounds.length !== 4 ||
        bounds.some((v) => !Number.isSafeInteger(v)) ||
        bounds[0] < 0 ||
        bounds[1] < 0 ||
        bounds[2] < 1 ||
        bounds[3] < 1 ||
        bounds[0] + bounds[2] > width ||
        bounds[1] + bounds[3] > height) {
        throw new Error(`Invalid ${label} bounds.`);
    }
}
/** Version, segment map, and integer dimensions required before any segment is read.
 * @param {unknown} value Candidate frame-atlas sidecar.
 * @returns {boolean} Whether the envelope can be validated as a version-one layout.
 */
function isVersionOneLayout(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    if (!("version" in value) ||
        !("segments" in value) ||
        !("width" in value) ||
        !("height" in value)) {
        return false;
    }
    return (value.version === 1 &&
        Boolean(value.segments) &&
        Number.isInteger(value.width) &&
        Number.isInteger(value.height));
}
/** Accept only the omitted mode or the native-strip mode.
 * @param {unknown} value `tileSources` field from a sidecar.
 * @returns {boolean} Whether the mode is known.
 */
function isKnownTileSource(value) {
    return value === undefined || value === "native-strip";
}
/** One RGBA8 color, as stored in an atlas index palette.
 * @param {unknown} color Candidate palette entry.
 * @returns {boolean} Whether `color` is four integer channels in byte range.
 */
function isRgba8(color) {
    if (!Array.isArray(color) || color.length !== 4) {
        return false;
    }
    for (const channel of color) {
        if (typeof channel !== "number" || !Number.isInteger(channel) || channel < 0 || channel > 255) {
            return false;
        }
    }
    return true;
}
/** Two finite integers, the shape stored for a frame origin.
 * @param {unknown} value Candidate origin pair.
 * @returns {boolean} Whether `value` is a safe-integer pair.
 */
function isIntegerPair(value) {
    if (!Array.isArray(value) || value.length !== 2) {
        return false;
    }
    for (const component of value) {
        if (typeof component !== "number" || !Number.isSafeInteger(component)) {
            return false;
        }
    }
    return true;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isIndexedSourceDepth(value) {
    return value === 1 || value === 2 || value === 4 || value === 8;
}
function isRgbaTuple(value) {
    return (Array.isArray(value) &&
        value.length === 4 &&
        value.every((channel) => typeof channel === "number" && Number.isInteger(channel) && channel >= 0 && channel <= 255));
}
function readIndexedImage(value) {
    if (!isRecord(value) ||
        value.kind !== "indexed-image" ||
        typeof value.width !== "number" ||
        typeof value.height !== "number" ||
        !(value.indexes instanceof Uint8Array) ||
        !Array.isArray(value.palette) ||
        !isIndexedSourceDepth(value.sourceBitDepth)) {
        throw new Error("Frame atlas must be an indexed PNG with the layout's exact dimensions.");
    }
    const palette = [];
    for (const color of value.palette) {
        if (!isRgbaTuple(color)) {
            throw new Error("Frame atlas must be an indexed PNG with the layout's exact dimensions.");
        }
        const entry = [
            color[0],
            color[1],
            color[2],
            color[3],
        ];
        palette.push(entry);
    }
    return {
        kind: "indexed-image",
        width: value.width,
        height: value.height,
        indexes: value.indexes,
        palette,
        sourceBitDepth: value.sourceBitDepth,
    };
}
/** Blank external tiles are 64 zero indexes. Missing indexes are not blank.
 * @param {unknown} indexes Candidate index list.
 * @returns {boolean} Whether every index is zero and the list has tile length.
 */
function isBlankExternalIndexes(indexes) {
    if (!Array.isArray(indexes) || indexes.length !== 64) {
        return false;
    }
    for (const value of indexes) {
        if (value !== 0) {
            return false;
        }
    }
    return true;
}
/**
 * Validate one assembly segment, or all segments and editor metadata in whole-atlas mode.
 * @param {FrameLayout} layout Frame atlas sidecar.
 * @param {string} [segmentName] Segment validated for assembly.
 * @param {boolean} [whole] Validate every segment and frame record.
 * @returns {FrameLayout} The same layout after validation.
 */
export function validateFrameLayout(layout, { segmentName, whole = false } = {}) {
    if (!isVersionOneLayout(layout)) {
        throw new Error("Frame atlas requires a version 1 layout with dimensions and segments.");
    }
    if (!Array.isArray(layout.paletteRefs) ||
        layout.paletteRefs.length < 1 ||
        layout.paletteRefs.length > 15) {
        throw new Error("Frame atlas layout must reference one to fifteen ROM palettes.");
    }
    if (layout.guideIndex !== layout.paletteRefs.length * 16) {
        throw new Error("Frame atlas guide index must follow the source palette groups.");
    }
    if (layout.indexPalette !== undefined &&
        (!Array.isArray(layout.indexPalette) ||
            layout.indexPalette.length !== layout.guideIndex ||
            layout.indexPalette.some((color) => !isRgba8(color)))) {
        throw new Error("Frame atlas indexPalette must bind every native slot to an RGBA8 color.");
    }
    for (const variant of layout.paletteVariants ?? []) {
        if (!Number.isInteger(variant.group) ||
            variant.group < 0 ||
            variant.group >= layout.paletteRefs.length) {
            throw new Error("Frame atlas palette variant refers to an invalid source group.");
        }
    }
    if (!isKnownTileSource(layout.tileSources)) {
        throw new Error("Unknown atlas tile source mode.");
    }
    const names = whole ? Object.keys(layout.segments) : [segmentName ?? ""];
    for (const name of names) {
        const segment = Object.hasOwn(layout.segments, name) ? layout.segments[name] : undefined;
        if (!segment || !Array.isArray(segment.tiles) || segment.tiles.length === 0) {
            throw new Error(`Unknown or empty frame atlas segment: ${name}.`);
        }
        if (!Number.isInteger(segment.palette) ||
            segment.palette < 0 ||
            segment.palette >= layout.paletteRefs.length) {
            throw new Error(`Frame atlas segment ${name} has no source palette.`);
        }
        if (layout.tileSources === "native-strip") {
            if (!segment.tileAtlas) {
                throw new Error(`Missing stable tile storage: ${name}.`);
            }
            rectangle(segment.tileAtlas.bounds, layout.width, layout.height, `${name} stable storage`);
        }
        for (const [index, tile] of segment.tiles.entries()) {
            if (layout.tileSources === "native-strip") {
                const strip = segment.tileAtlas;
                if (!strip) {
                    throw new Error(`Missing stable tile storage: ${name}.`);
                }
                if (tile.x !== strip.bounds[0] + (index % strip.columns) * strip.step ||
                    tile.y !== strip.bounds[1] + Math.floor(index / strip.columns) * strip.step ||
                    tile.flipX ||
                    tile.flipY) {
                    throw new Error(`Stable tile source moved into pose geometry: ${name}/${index}.`);
                }
            }
            rectangle([tile.x, tile.y, 8, 8], layout.width, layout.height, `source rectangle for ${name} tile ${index}`);
            if ((tile.flipX !== undefined && typeof tile.flipX !== "boolean") ||
                (tile.flipY !== undefined && typeof tile.flipY !== "boolean")) {
                throw new Error(`Invalid source rectangle flips for ${name} tile ${index}.`);
            }
        }
        if ((whole || layout.tileSources === "native-strip") && segment.tileAtlas) {
            const strip = segment.tileAtlas;
            rectangle(strip.bounds, layout.width, layout.height, `${name} tile atlas`);
            if (!Number.isSafeInteger(strip.columns) ||
                strip.columns < 1 ||
                !Number.isSafeInteger(strip.step) ||
                strip.step < 8 ||
                !Array.isArray(strip.sourceOnly) ||
                new Set(strip.sourceOnly).size !== strip.sourceOnly.length) {
                throw new Error(`Invalid tile atlas for ${name}.`);
            }
            for (const i of strip.sourceOnly) {
                if (!Number.isSafeInteger(i) || i < 0 || i >= segment.tiles.length) {
                    throw new Error(`Invalid source-only tile ${name}:${i}.`);
                }
                const source = segment.tiles[i];
                if (source.x !== strip.bounds[0] + (i % strip.columns) * strip.step ||
                    source.y !== strip.bounds[1] + Math.floor(i / strip.columns) * strip.step ||
                    source.flipX ||
                    source.flipY) {
                    throw new Error(`Source-only tile ${name}:${i} must use its native-order rectangle.`);
                }
            }
            if (Math.min(segment.tiles.length, strip.columns) * strip.step > strip.bounds[2] ||
                Math.ceil(segment.tiles.length / strip.columns) * strip.step > strip.bounds[3]) {
                throw new Error(`Tile atlas ${name} is too small.`);
            }
        }
    }
    if (whole) {
        if (!Array.isArray(layout.frames)) {
            throw new Error("Frame atlas frames must be an array.");
        }
        const ids = new Set();
        const nativeRecords = new Map();
        for (const frame of layout.frames) {
            const validId = (typeof frame.id === "string" && frame.id.length > 0) || Number.isSafeInteger(frame.id);
            if (!validId || ids.has(frame.id)) {
                throw new Error(`Duplicate/empty frame ${frame.id}.`);
            }
            ids.add(frame.id);
            rectangle(frame.bounds, layout.width, layout.height, `frame ${frame.id}`);
            validateFrameComposition(layout, frame);
            const record = frame.nativeFrame;
            if (record?.bytes) {
                const previous = nativeRecords.get(record.address);
                if (previous && JSON.stringify(previous) !== JSON.stringify(record)) {
                    throw new Error(`Shared native frame records disagree: ${frame.id}.`);
                }
                nativeRecords.set(record.address, record);
            }
        }
        const ordered = [...nativeRecords.values()].toSorted((a, b) => a.address - b.address);
        for (let i = 1; i < ordered.length; i++) {
            if (ordered[i].address < ordered[i - 1].end) {
                throw new Error("Overlapping native frame records.");
            }
        }
        if (layout.tileSources === "native-strip") {
            const strips = Object.entries(layout.segments).map(([name, segment]) => {
                if (!segment.tileAtlas) {
                    throw new Error(`Missing stable tile storage: ${name}.`);
                }
                return {
                    id: name,
                    bounds: segment.tileAtlas.bounds,
                };
            });
            // Native storage must never share pixels with a movable pose or another segment.
            for (const [index, strip] of strips.entries()) {
                const [x, y, width, height] = strip.bounds;
                for (const other of [...layout.frames, ...strips.slice(index + 1)]) {
                    const [ox, oy, ow, oh] = other.bounds;
                    if (x < ox + ow && ox < x + width && y < oy + oh && oy < y + height) {
                        throw new Error(`Stable storage overlaps ${other.id}: ${strip.id}.`);
                    }
                }
            }
        }
    }
    return layout;
}
/** Record an already verified PNG slot binding before making independent catalog color edits. */
export function bindFrameAtlasPalette(source, layout, catalog) {
    inspectFrameAtlas(source, layout, catalog, { whole: true });
    // Rebinding an atlas after a catalog edit must not forget the colors still stored in its PNG.
    if (layout.indexPalette) {
        return { ...layout, indexPalette: layout.indexPalette.map((color) => [...color]) };
    }
    return {
        ...layout,
        indexPalette: layout.paletteRefs.flatMap((id) => spritePaletteColors(catalog, id)),
    };
}
/** Parse and validate the authored pixels once, keeping SoM palette/group policy in this adapter.
 * @param {AssetInput} source Indexed PNG.
 * @param {FrameLayout} layout Frame atlas sidecar.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @param {FrameLayoutScope} [options] Segment or whole-atlas scope.
 * @returns {InspectedFrameAtlas} Validated image, layout, and extracted tiles.
 */
export function inspectFrameAtlas(source, layout, catalog, options = {}) {
    validateFrameLayout(layout, options);
    let image = readIndexedImage(pngImporter.import(source).value);
    if (image.width !== layout.width || image.height !== layout.height) {
        throw new Error("Frame atlas must be an indexed PNG with the layout's exact dimensions.");
    }
    const colors = layout.paletteRefs.flatMap((id) => spritePaletteColors(catalog, id));
    if (!image.palette[layout.guideIndex]) {
        throw new Error("Frame atlas is missing its guide index.");
    }
    for (const variant of layout.paletteVariants ?? []) {
        spritePaletteColors(catalog, variant.palette);
    }
    const matches = (expected) => expected.every((color, index) => color.every((component, channel) => component === image.palette[index][channel]));
    if (!matches(colors) && (!layout.indexPalette || !matches(layout.indexPalette))) {
        throw new Error("Frame atlas palette no longer matches its stable index binding. Restore the PNG palette order; edit shared colors in the palette catalog.");
    }
    // PNG indexes author tiles; the catalog authors ROM colors. A verified original palette binds
    // the same slots after a catalog edit, and previews use the current colors without rewriting PNGs.
    image = { ...image, palette: [...colors, ...image.palette.slice(colors.length)] };
    const tiles = new Map();
    const names = options.whole ? Object.keys(layout.segments) : [options.segmentName ?? ""];
    for (const name of names) {
        const segment = Object.hasOwn(layout.segments, name) ? layout.segments[name] : undefined;
        if (!segment) {
            throw new Error(`Unknown or empty frame atlas segment: ${name}.`);
        }
        const indexMap = Array.from({ length: 256 }, () => null);
        for (let i = 0; i < 16; i++) {
            indexMap[segment.palette * 16 + i] = i;
        }
        // Global transparency and diagnostic guide pixels encode as native color zero.
        indexMap[0] = 0;
        indexMap[layout.guideIndex] = 0;
        tiles.set(name, segment.tiles.map((placement, index) => {
            try {
                return extractIndexedRegion(image, { ...placement, width: 8, height: 8, indexMap });
            }
            catch (cause) {
                const message = cause instanceof Error ? cause.message : String(cause);
                throw new Error(`Frame atlas ${name} tile ${index}: ${message}`, { cause });
            }
        }));
    }
    return { image, layout, tiles };
}
/** Encode the already inspected native indexes with the game's 4bpp storage codec.
 * @param {InspectedFrameAtlas} inspected Validated atlas.
 * @param {string} segmentName Segment to encode.
 * @returns {Uint8Array} Native 4bpp tile bytes.
 */
export function encodeInspectedFrameSegment(inspected, segmentName) {
    const tiles = inspected.tiles.get(segmentName);
    if (!tiles) {
        throw new Error(`Segment ${segmentName} was not inspected.`);
    }
    return encodePlanarTiles(tiles.map((tile) => Array.from({ length: 8 }, (_, y) => Array.from(tile.indexes.subarray(y * 8, y * 8 + 8)))), 4);
}
/** Read mutually exclusive assembly selectors; omission selects the whole contiguous atlas.
 * @param {Readonly<Record<string, unknown>>} options Resolved assembly options.
 * @returns {string | string[] | undefined} Named segment, selected run, or whole-atlas selection.
 * Invalid types and simultaneous selectors throw before encoding or previewing.
 */
export function readFrameAtlasSelection(options) {
    if (options.segment !== undefined && options.segments !== undefined) {
        throw new Error("Specify segment or segments, not both.");
    }
    if (options.segment !== undefined) {
        if (typeof options.segment !== "string") {
            throw new Error("Frame atlas segment must be a string.");
        }
        return options.segment;
    }
    if (options.segments !== undefined) {
        if (!Array.isArray(options.segments) ||
            options.segments.some((name) => typeof name !== "string")) {
            throw new Error("Frame atlas segments must be an array of strings.");
        }
        return options.segments.map((name) => {
            if (typeof name !== "string") {
                throw new Error("Invalid frame atlas segment.");
            }
            return name;
        });
    }
    return undefined;
}
/** Resolve a nonempty selection in ROM order, rejecting gaps, overlaps and duplicate ownership.
 * Each native 4bpp tile occupies 32 bytes; the selected spans must form one continuous run.
 * @param {FrameLayout} layout Sidecar retaining physical segment identities.
 * @param {readonly string[]} [selection] Segment names; omission selects the entire atlas.
 * @returns {string[]} Names in ascending ROM address order; malformed spans throw.
 */
export function frameAtlasSegmentOrder(layout, selection) {
    const names = selection ?? Object.keys(layout.segments);
    if (!names.length || new Set(names).size !== names.length) {
        throw new Error("Frame atlas selection must contain unique, nonempty segments.");
    }
    const spans = names
        .map((name) => {
        const segment = Object.hasOwn(layout.segments, name) ? layout.segments[name] : undefined;
        if (!segment ||
            !/^[\da-f]{6}$/i.test(segment.romAddress) ||
            !Array.isArray(segment.tiles) ||
            !segment.tiles.length) {
            throw new Error(`Invalid native frame atlas span: ${name}.`);
        }
        const start = Number.parseInt(segment.romAddress, 16);
        const end = start + segment.tiles.length * 32;
        if (end > 0x1000000) {
            throw new Error(`Native frame atlas span exceeds the 24-bit address space: ${name}.`);
        }
        return { name, start, end };
    })
        .sort((a, b) => a.start - b.start);
    for (let index = 1; index < spans.length; index++) {
        // Concatenation cannot insert padding or emit the same ROM bytes twice.
        if (spans[index].start !== spans[index - 1].end) {
            throw new Error("Selected frame atlas segments must be contiguous without gaps or overlaps.");
        }
    }
    return spans.map((span) => span.name);
}
/** Encode one continuous run from a whole-atlas inspection, preserving each segment's palette indexes.
 * @param {InspectedFrameAtlas} inspected Whole-atlas inspection containing every selected segment.
 * @param {readonly string[]} [selection] Physical segment names; omission selects the entire atlas.
 * @returns {Uint8Array} Owned native tile bytes in ROM order; invalid ownership throws.
 */
export function encodeInspectedFrameSegments(inspected, selection) {
    const chunks = frameAtlasSegmentOrder(inspected.layout, selection).map((name) => encodeInspectedFrameSegment(inspected, name));
    const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes;
}
/** Assembly entry point for a named segment or a continuous run of segments.
 * @param {AssetInput} source Indexed PNG.
 * @param {FrameLayout} layout Frame atlas sidecar.
 * @param {string | readonly string[] | undefined} segmentName One segment, a contiguous selection,
 * or undefined for the entire atlas. Multiple spans are emitted in ROM address order.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @returns {Uint8Array} Native 4bpp tile bytes; gapped or overlapping selections throw.
 */
export function encodeFrameAtlas(source, layout, segmentName, catalog) {
    if (typeof segmentName !== "string") {
        return encodeInspectedFrameSegments(inspectFrameAtlas(source, layout, catalog, { whole: true }), segmentName);
    }
    return encodeInspectedFrameSegment(inspectFrameAtlas(source, layout, catalog, { segmentName }), segmentName);
}
/**
 * Refresh every recorded occurrence and bottom strip from current authoritative pixels.
 * Composition is additive metadata from reviewed evidence; it cannot be inferred from RGB.
 * Returns owned indexes, retaining guides outside painted pixels and all source-only tiles.
 * @param {InspectedFrameAtlas} inspected Whole-atlas inspection.
 * @returns {IndexedPixels} Rebuilt atlas indexes.
 */
export function refreshFrameAtlas(inspected) {
    const { image, layout, tiles } = inspected;
    validateFrameLayout(layout, { whole: true });
    const sources = new Map();
    const placements = [];
    for (const [name, segment] of Object.entries(layout.segments)) {
        const native = tiles.get(name);
        if (!native || !segment.tileAtlas) {
            throw new Error(`Refresh requires whole-atlas inspection and native strip for ${name}.`);
        }
        native.forEach((tile, index) => sources.set(`${name}:${index}`, tile));
    }
    const frames = layout.frames;
    if (!frames) {
        throw new Error("Frame atlas frames must be an array.");
    }
    for (const frame of frames) {
        validateFrameComposition(layout, frame);
        if (!isIntegerPair(frame.origin) || !Array.isArray(frame.placements)) {
            throw new Error(`Frame ${frame.id} lacks retained composition; enrich it from evidence first.`);
        }
        const ids = new Set();
        for (const occurrence of frame.placements) {
            if (typeof occurrence.id !== "string" || !occurrence.id || ids.has(occurrence.id)) {
                throw new Error(`Invalid occurrence identity in ${frame.id}.`);
            }
            ids.add(occurrence.id);
            if (!Number.isSafeInteger(occurrence.x) || !Number.isSafeInteger(occurrence.y)) {
                throw new Error(`Invalid occurrence coordinates in ${frame.id}.`);
            }
            let source;
            let palette = 0;
            if (occurrence.external) {
                // External references are retained read-only. Only independently verified blank
                // tiles are supported here; a missing nonblank reference must not disappear.
                if (!/^[\dA-F]{6}$/.test(occurrence.external.romAddress) ||
                    !isBlankExternalIndexes(occurrence.external.indexes)) {
                    throw new Error(`Unresolved external tile in ${frame.id}.`);
                }
                source = `external:${occurrence.external.romAddress}`;
                sources.set(source, { width: 8, height: 8, indexes: new Uint8Array(64) });
            }
            else {
                const segmentName = occurrence.segment;
                const tileIndex = occurrence.tile;
                const segment = segmentName === undefined ? undefined : layout.segments[segmentName];
                if (!segment ||
                    tileIndex === undefined ||
                    !Number.isSafeInteger(tileIndex) ||
                    tileIndex < 0 ||
                    tileIndex >= segment.tiles.length) {
                    throw new Error(`Unknown tile reference in ${frame.id}:${occurrence.id}.`);
                }
                source = `${segmentName}:${tileIndex}`;
                palette = segment.palette;
            }
            const x = frame.origin[0] + occurrence.x;
            const y = frame.origin[1] + occurrence.y;
            if (x < frame.bounds[0] ||
                y < frame.bounds[1] ||
                x + 8 > frame.bounds[0] + frame.bounds[2] ||
                y + 8 > frame.bounds[1] + frame.bounds[3]) {
                throw new Error(`Occurrence exceeds frame ${frame.id}.`);
            }
            placements.push({
                ...occurrence,
                id: `${frame.id}:${occurrence.id}`,
                source,
                x,
                y,
                indexMap: Array.from({ length: 16 }, (_, i) => palette * 16 + i),
            });
        }
    }
    for (const [name, segment] of Object.entries(layout.segments)) {
        const strip = segment.tileAtlas;
        if (!strip) {
            throw new Error(`Refresh requires whole-atlas inspection and native strip for ${name}.`);
        }
        segment.tiles.forEach((_, index) => placements.push({
            id: `strip:${name}:${index}`,
            source: `${name}:${index}`,
            x: strip.bounds[0] + (index % strip.columns) * strip.step,
            y: strip.bounds[1] + Math.floor(index / strip.columns) * strip.step,
            indexMap: Array.from({ length: 16 }, (_entry, i) => segment.palette * 16 + i),
        }));
    }
    const background = image.indexes.slice();
    // Clear all covered rectangles before compositing, so transparency edits reveal
    // lower layers rather than stale painted pixels. Existing guide dots survive.
    for (const p of placements) {
        for (let y = p.y; y < p.y + 8; y++) {
            for (let x = p.x; x < p.x + 8; x++) {
                const i = y * image.width + x;
                if (background[i] !== layout.guideIndex) {
                    background[i] = 0;
                }
            }
        }
    }
    return renderIndexedPlacements(sources, placements, { x: 0, y: 0, width: image.width, height: image.height }, background);
}
/** Parse the declared layout resource. Validation occurs at the consumer's selected scope.
 * @param {Readonly<Record<string, unknown>>} options Include options naming `layout`.
 * @param {Readonly<Record<string, AssetInput>>} resources Declared sidecar files.
 * @returns {FrameLayout} Parsed layout sidecar.
 */
export function readFrameLayout(options, resources) {
    if (typeof options.layout !== "string" || !options.layout.endsWith(".json")) {
        throw new Error("Frame atlas layout must name a JSON sidecar.");
    }
    const resource = Object.hasOwn(resources, options.layout) ? resources[options.layout] : undefined;
    if (!resource) {
        throw new Error(`Missing frame atlas layout: ${options.layout}.`);
    }
    let parsed;
    try {
        parsed = JSON.parse(new TextDecoder().decode(resource.bytes));
    }
    catch (error) {
        throw new Error(`Invalid frame atlas layout: ${options.layout}.`, { cause: error });
    }
    if (!isVersionOneLayout(parsed)) {
        throw new Error("Frame atlas requires a version 1 layout with dimensions and segments.");
    }
    return parsed;
}
//# sourceMappingURL=som-frame-atlas.js.map