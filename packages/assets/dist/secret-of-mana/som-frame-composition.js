import { expandIndexedGrid } from "@uttori/asm-assets/image";
import { decodeBodyFrame } from "./som-body-frame.js";
/** True when a block stores a list rather than a ROM address.
 * @param {unknown} value Candidate tile reference.
 * @returns {boolean} Whether `value` is an array.
 */
function isUnknownArray(value) {
    return Array.isArray(value);
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
/** Canonical comparable fields; descriptive extensions never supply competing geometry.
 * @param {FramePlacement} p One derived tile occurrence.
 * @returns {unknown[]} Fields that must agree between stored and derived geometry.
 */
function placementValue(p) {
    return [
        p.id,
        p.block,
        p.quadrant,
        p.x,
        p.y,
        p.flipX,
        p.flipY,
        p.segment ?? null,
        p.tile ?? null,
        p.external?.romAddress ?? null,
        p.external?.indexes ?? null,
    ];
}
/**
 * Resolve the adapter's ROM/expanded-slot references, then use the portable grid expander.
 * Existing external references are an explicit read-only inventory, never guessed pixels.
 * @param {FrameLayout} layout Frame atlas sidecar.
 * @param {FrameRecord} frame Pose whose blocks expand into occurrences.
 * @returns {object[]} Derived 8×8 occurrences.
 */
export function deriveFramePlacements(layout, frame) {
    if (!Array.isArray(frame.blocks) || !frame.blocks.length) {
        throw new Error(`Missing native blocks: ${frame.id}.`);
    }
    const external = new Map();
    for (const p of frame.placements ?? []) {
        if (!p.external) {
            continue;
        }
        const e = p.external;
        if (!/^[\dA-F]{6}$/.test(e.romAddress) ||
            !Array.isArray(e.indexes) ||
            e.indexes.length !== 64 ||
            e.indexes.some((v) => v !== 0)) {
            throw new Error(`Invalid external blank reference: ${frame.id}.`);
        }
        external.set(e.romAddress, e);
    }
    const resolve = (ref) => {
        if (isUnknownArray(ref)) {
            const segmentName = ref[0];
            const tile = ref[1];
            const segment = typeof segmentName === "string" && Object.hasOwn(layout.segments, segmentName)
                ? layout.segments[segmentName]
                : undefined;
            if (ref.length !== 2 ||
                typeof segmentName !== "string" ||
                typeof tile !== "number" ||
                !Number.isSafeInteger(tile) ||
                tile < 0 ||
                tile >= (segment?.tiles.length ?? 0)) {
                throw new Error(`Invalid expanded graphics reference: ${frame.id}.`);
            }
            return { segment: segmentName, tile };
        }
        if (typeof ref !== "number" || !Number.isSafeInteger(ref) || ref < 0 || ref > 0xffffff) {
            throw new Error(`Invalid ROM tile reference: ${frame.id}.`);
        }
        const matches = Object.entries(layout.segments).flatMap(([segment, value]) => {
            const delta = ref - Number.parseInt(value.romAddress, 16);
            return delta >= 0 && delta % 32 === 0 && delta / 32 < value.tiles.length
                ? [{ segment, tile: delta / 32 }]
                : [];
        });
        if (matches.length > 1) {
            throw new Error(`Ambiguous ROM tile ownership: ${ref.toString(16)}.`);
        }
        if (matches.length) {
            return matches[0];
        }
        const e = external.get(ref.toString(16).toUpperCase().padStart(6, "0"));
        if (!e) {
            throw new Error(`Unresolved ROM tile reference: ${ref.toString(16)}.`);
        }
        return { external: structuredClone(e) };
    };
    const ids = new Set();
    return frame.blocks.flatMap((block) => {
        if (typeof block.id !== "string" ||
            !block.id ||
            ids.has(block.id) ||
            ![8, 16, 32, 64].includes(block.size) ||
            !Array.isArray(block.tiles) ||
            block.tiles.length !== (block.size / 8) ** 2 ||
            typeof block.flipX !== "boolean" ||
            typeof block.flipY !== "boolean") {
            throw new Error(`Invalid native block: ${frame.id}/${block.id}.`);
        }
        ids.add(block.id);
        const references = block.tiles.map(resolve);
        return expandIndexedGrid({
            ...block,
            columns: block.size / 8,
            cellWidth: 8,
            cellHeight: 8,
            cells: references.map((_, index) => ({ source: String(index) })),
        }).map((p, index) => Object.assign({}, {
            id: `${block.id}:tile-${index}`,
            block: block.id,
            quadrant: index,
            x: p.x,
            y: p.y,
            flipX: p.flipX,
            flipY: p.flipY,
        }, references[index]));
    });
}
/** Check raw body evidence against editable blocks before interpreting any derived geometry.
 * @param {FrameRecord} frame Pose that may carry a native body record.
 * @returns {void} Nothing; invalid records throw.
 */
export function validateNativeFrame(frame) {
    const native = frame.nativeFrame;
    if (!native || Object.keys(native).length === 0) {
        return;
    } // Boss capture parts have a separate native codec.
    let graphicsBase;
    if (!native.bytes ||
        !frame.blocks ||
        !Number.isSafeInteger(native.address) ||
        native.address < 0 ||
        native.address > 0xffffff ||
        !Number.isSafeInteger(native.end) ||
        native.end - native.address !== native.bytes.length) {
        throw new Error(`Invalid native frame extent: ${frame.id}.`);
    }
    const decoded = decodeBodyFrame(native.bytes);
    if (decoded.groups !== frame.blocks.length) {
        throw new Error(`Native block count differs: ${frame.id}.`);
    }
    for (const [index, block] of frame.blocks.entries()) {
        const expected = decoded.blocks[index];
        if (block.size !== 16 ||
            block.flipY ||
            block.x !== expected.x ||
            block.y !== expected.y ||
            block.flipX !== expected.flipX ||
            block.priority !== expected.priority) {
            throw new Error(`Native frame and block disagree: ${frame.id}/${block.id}.`);
        }
        for (const [quadrant, address] of block.tiles.entries()) {
            if (typeof address !== "number" || !Number.isSafeInteger(address)) {
                throw new Error(`Body tiles require ROM addresses: ${frame.id}.`);
            }
            const relative = decoded.tileOffsets[index * 4 + quadrant];
            const base = (address & 0xff0000) | ((address - relative) & 0xffff);
            graphicsBase ??= base;
            if (base !== graphicsBase) {
                throw new Error(`Native tile references disagree: ${frame.id}/${block.id}.`);
            }
        }
    }
}
/** Validate optional v1 composition as one coherent model; legacy assembly-only layouts remain valid.
 * @param {FrameLayout} layout Frame atlas sidecar.
 * @param {FrameRecord} frame Pose to check.
 * @returns {object[] | undefined} Derived placements when the pose retains composition.
 */
export function validateFrameComposition(layout, frame) {
    const retained = frame.blocks !== undefined ||
        frame.placements !== undefined ||
        frame.nativeFrame !== undefined ||
        frame.origin !== undefined;
    if (!retained) {
        return undefined;
    }
    const placements = frame.placements;
    if (!isIntegerPair(frame.origin) || !placements) {
        throw new Error(`Incomplete retained composition: ${frame.id}.`);
    }
    const expected = deriveFramePlacements(layout, frame);
    validateNativeFrame(frame);
    if (placements.length !== expected.length ||
        expected.some((p, i) => JSON.stringify(placementValue(p)) !== JSON.stringify(placementValue(placements[i])))) {
        throw new Error(`Derived placements disagree with native blocks: ${frame.id}.`);
    }
    return expected;
}
//# sourceMappingURL=som-frame-composition.js.map