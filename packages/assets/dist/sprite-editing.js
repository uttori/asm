import { indexedPalette, indexedPaletteChanges } from "./indexed-values.js";
import { ASSET_LIMITS, boundedSum, rasterArea } from "./limits.js";
import { integer } from "./validation.js";
/**
 * Narrow a value to a plain non-array object.
 * @param value Untrusted value.
 * @returns Whether `value` is a non-null, non-array object.
 */
function record(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Require a bounded array.
 * @param value Untrusted value.
 * @param label Inventory name used in the error message.
 * @param maximum Largest accepted length.
 * @returns The same array, unvalidated element-wise.
 */
function array(value, label, maximum) {
    if (!Array.isArray(value) || value.length > maximum) {
        throw new Error(`Invalid ${label} inventory.`);
    }
    return value;
}
/**
 * Require a non-empty identity string of at most 1024 characters.
 * @param value Untrusted value.
 * @returns The validated identity.
 */
function identifier(value) {
    if (typeof value !== "string" || !value.length || value.length > 1024) {
        throw new Error("Invalid sprite owner identity.");
    }
    return value;
}
/**
 * Require an integer number within an inclusive range.
 * @param value Untrusted value; non-number types are rejected before range checks.
 * @param label Field name used in the error message.
 * @param minimum Inclusive lower bound.
 * @param maximum Inclusive upper bound.
 * @returns The validated integer.
 */
function number(value, label, minimum, maximum) {
    if (typeof value !== "number") {
        throw new Error(`Invalid ${label}.`);
    }
    return integer(value, label, minimum, maximum);
}
/** Copy validated readonly colors into tuples the editor may mutate without changing the baseline. */
function colors(value) {
    return indexedPalette(value).map(([r, g, b, a]) => [r, g, b, a]);
}
/**
 * Reject repeated identities.
 * @param values Identities to check.
 * @param label Inventory name used in the error message.
 */
function uniqueIds(values, label) {
    if (new Set(values).size !== values.length) {
        throw new Error(`Duplicate ${label} identity.`);
    }
}
/** Bound dimensions, inventory and adapter capabilities before allocating editor images. */
export function validateSpriteEditorBundle(bundle) {
    // Serialized bundles can reach this public validator without compile-time literal guarantees.
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (bundle.format !== "uttori-sprite-editor" || bundle.version !== 1) {
        throw new Error("Unsupported sprite editing schema.");
    }
    identifier(bundle.session);
    identifier(bundle.adapter);
    const width = number(bundle.width, "Canvas width", 1, 4096);
    const height = number(bundle.height, "Canvas height", 1, 4096);
    rasterArea(width, height, "Sprite canvas", ASSET_LIMITS.interchangeSide);
    const palette = colors(bundle.palette);
    number(bundle.transparentIndex, "Transparency slot", 0, palette.length - 1);
    const editable = array(bundle.editablePaletteIndexes, "editable palette", 256).map((v) => number(v, "Editable palette slot", 0, palette.length - 1));
    if (new Set(editable).size !== editable.length) {
        throw new Error("Duplicate editable palette slot.");
    }
    const frames = array(bundle.frames, "frame", 1024).map(identifier);
    if (!frames.length) {
        throw new Error("Missing sprite frames.");
    }
    uniqueIds(frames, "frame");
    const images = array(bundle.images, "image", 4096);
    if (!images.length) {
        throw new Error("Missing sprite images.");
    }
    let totalPixels = 0;
    for (const input of images) {
        if (!record(input)) {
            throw new Error("Invalid sprite image.");
        }
        const id = identifier(input.id);
        identifier(input.owner);
        if (!frames.includes(identifier(input.frame))) {
            throw new Error("Unknown image frame.");
        }
        const w = number(input.width, "Image width", 1, width);
        const h = number(input.height, "Image height", 1, height);
        // Inventory bytes are independent of canvas area: multiple frames may share a canvas.
        const pixelCount = rasterArea(w, h, "Sprite image", ASSET_LIMITS.interchangeSide);
        totalPixels = boundedSum(totalPixels, pixelCount, ASSET_LIMITS.decodedBytes, "Sprite image inventory");
        const x = number(input.x, "Image x", -4096, 4096);
        const y = number(input.y, "Image y", -4096, 4096);
        const allowed = array(input.allowedIndexes, "allowed index", 256).map((v) => number(v, "Allowed slot", 0, palette.length - 1));
        if (!allowed.length || new Set(allowed).size !== allowed.length) {
            throw new Error("Invalid slot map.");
        }
        const pixels = array(input.indexes, "pixel", ASSET_LIMITS.rasterPixels);
        if (pixels.length !== w * h ||
            pixels.some((v) => !allowed.includes(number(v, "Pixel", 0, 255)))) {
            throw new Error(`Invalid indexed pixels: ${id}.`);
        }
        if (input.role === "placement") {
            const bounds = array(input.moveBounds, "coordinate", 4).map((v) => number(v, "Coordinate bound", -4096, 4096));
            if (bounds.length !== 4 || bounds[0] > bounds[2] || bounds[1] > bounds[3]) {
                throw new Error("Invalid coordinate bounds.");
            }
            if (x < bounds[0] || x > bounds[2] || y < bounds[1] || y > bounds[3]) {
                throw new Error("Initial placement is outside its coordinate capability.");
            }
        }
        else if (input.role !== "pixels" || input.moveBounds !== undefined) {
            throw new Error("Invalid image editing capability.");
        }
    }
    uniqueIds(bundle.images.map((v) => v.id), "image");
}
/** Validate complete output and derive permitted deltas. No native bytes or files are changed. */
export function inspectSpriteEditorResult(bundle, input) {
    validateSpriteEditorBundle(bundle);
    if (!record(input) ||
        input.format !== "uttori-sprite-result" ||
        input.version !== 1 ||
        input.session !== bundle.session ||
        input.width !== bundle.width ||
        input.height !== bundle.height ||
        input.transparentIndex !== bundle.transparentIndex) {
        throw new Error("Sprite session, schema, canvas or transparency changed.");
    }
    const frames = array(input.frames, "frame", 1024).map(identifier);
    uniqueIds(frames, "frame");
    if (frames.length !== bundle.frames.length || frames.some((id) => !bundle.frames.includes(id))) {
        throw new Error("Sprite frame inventory changed.");
    }
    const palette = colors(input.palette);
    if (palette.length !== bundle.palette.length) {
        throw new Error("Sprite palette inventory changed.");
    }
    const changedColors = indexedPaletteChanges(bundle.palette, palette, bundle.editablePaletteIndexes).map(({ index, color }) => ({ index, color: [...color] }));
    const images = array(input.images, "image", 4096);
    if (images.length !== bundle.images.length) {
        throw new Error("Sprite image inventory changed.");
    }
    const seen = new Set();
    const pixels = [];
    const positions = [];
    const moves = new Map();
    const pixelOwners = new Map();
    for (const image of images) {
        if (!record(image)) {
            throw new Error("Invalid sprite cel.");
        }
        const id = identifier(image.id);
        if (seen.has(id)) {
            throw new Error(`Duplicate image identity: ${id}.`);
        }
        seen.add(id);
        const order = bundle.images.findIndex((v) => v.id === id);
        // A missing identity yields -1; reject it rather than letting Array.at select the last image.
        const before = order < 0 ? undefined : bundle.images.at(order);
        if (!before ||
            image.frame !== before.frame ||
            image.width !== before.width ||
            image.height !== before.height ||
            image.opacity !== 255 ||
            image.zIndex !== 0 ||
            image.layerOrder !== order) {
            throw new Error(`Unknown owner or unsupported cel transform: ${id}.`);
        }
        const indexes = array(image.indexes, "pixel", before.width * before.height).map((v) => number(v, "Pixel index", 0, 255));
        if (indexes.length !== before.indexes.length ||
            indexes.some((v) => !before.allowedIndexes.includes(v))) {
            throw new Error(`Image dimensions or palette group changed: ${id}.`);
        }
        if (indexes.some((v, i) => v !== before.indexes[i])) {
            if (before.role !== "pixels") {
                throw new Error(`Derived artwork changed: ${id}.`);
            }
            pixels.push({ id, indexes });
        }
        const x = number(image.x, "Cel x", -4096, 4096);
        const y = number(image.y, "Cel y", -4096, 4096);
        if (before.role === "pixels") {
            if (x !== before.x || y !== before.y) {
                throw new Error(`Native pixel view moved: ${id}.`);
            }
            // Exact shared pixel views cannot choose a last writer, including when one alias is unchanged.
            const value = JSON.stringify([before.width, before.height, indexes]);
            if (pixelOwners.has(before.owner) && pixelOwners.get(before.owner) !== value) {
                throw new Error(`Conflicting shared-owner pixels: ${before.owner}.`);
            }
            pixelOwners.set(before.owner, value);
        }
        else {
            const bounds = before.moveBounds;
            if (x < bounds[0] || x > bounds[2] || y < bounds[1] || y > bounds[3]) {
                throw new Error(`Native coordinate limit exceeded: ${id}.`);
            }
            // Shared records are one owner. An unchanged alias also participates in agreement.
            const delta = JSON.stringify([x - before.x, y - before.y]);
            if (moves.has(before.owner) && moves.get(before.owner) !== delta) {
                throw new Error(`Conflicting shared-owner positions: ${before.owner}.`);
            }
            moves.set(before.owner, delta);
            if (x !== before.x || y !== before.y) {
                positions.push({ id, x, y });
            }
        }
    }
    return { pixels, positions, colors: changedColors };
}
/** Build an owned no-edit result for fixtures and adapters. */
export function spriteEditorBaselineResult(bundle) {
    validateSpriteEditorBundle(bundle);
    return {
        format: "uttori-sprite-result",
        version: 1,
        session: bundle.session,
        width: bundle.width,
        height: bundle.height,
        transparentIndex: bundle.transparentIndex,
        palette: bundle.palette.map((v) => [...v]),
        frames: [...bundle.frames],
        images: bundle.images.map((image, layerOrder) => ({
            id: image.id,
            frame: image.frame,
            width: image.width,
            height: image.height,
            x: image.x,
            y: image.y,
            indexes: [...image.indexes],
            opacity: 255,
            zIndex: 0,
            layerOrder,
        })),
    };
}
//# sourceMappingURL=sprite-editing.js.map