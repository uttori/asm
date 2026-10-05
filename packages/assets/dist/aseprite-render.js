import { resolveAsepriteCels, validateAsepriteDocument, } from "./aseprite-document.js";
import { ASSET_LIMITS, boundedProduct, boundedSum } from "./limits.js";
import { integer } from "./validation.js";
/**
 * Render one indexed frame with explicit clipping to its canvas. The parser preserves
 * diagonal flags independently of console policy; rectangular diagonal rendering rejects
 * until a proven rectangle transform is supplied. Input buffers are never modified.
 */
export function renderAsepriteFrame(document, frameIndex, signal) {
    validateAsepriteDocument(document);
    integer(frameIndex, "Aseprite render frame", 0, document.frames.length - 1);
    signal?.throwIfAborted();
    const resolved = resolveAsepriteCels(document);
    const tilesets = new Map(document.tilesets.map((set) => [set.id, set]));
    const indexes = new Uint8Array(document.width * document.height).fill(document.transparentIndex);
    const cels = document.frames[frameIndex].cels.toSorted((a, b) => a.layer + a.zIndex - (b.layer + b.zIndex) || a.zIndex - b.zIndex);
    let work = 0;
    const put = (x, y, index) => {
        if (index !== document.transparentIndex &&
            x >= 0 &&
            y >= 0 &&
            x < document.width &&
            y < document.height) {
            indexes[y * document.width + x] = index;
        }
    };
    for (const cel of cels) {
        signal?.throwIfAborted();
        if (!(document.layers[cel.layer].flags & 1)) {
            continue;
        }
        const payload = resolved.get(cel);
        if (payload.kind === "raster") {
            work = boundedSum(work, payload.indexes.length, ASSET_LIMITS.renderPixels, "Frame rendering work");
            for (let y = 0; y < payload.height; y++) {
                signal?.throwIfAborted();
                for (let x = 0; x < payload.width; x++) {
                    put(cel.x + x, cel.y + y, payload.indexes[y * payload.width + x]);
                }
            }
        }
        else {
            const layer = document.layers[cel.layer];
            if (layer.kind !== "tilemap") {
                throw new Error("Tilemap render layer mismatch.");
            }
            const set = tilesets.get(layer.tileset);
            const tileArea = set.tileWidth * set.tileHeight;
            work = boundedSum(work, boundedProduct(payload.cells.length, tileArea, ASSET_LIMITS.renderPixels, "Tilemap rendering work"), ASSET_LIMITS.renderPixels, "Frame rendering work");
            for (let cell = 0; cell < payload.cells.length; cell++) {
                signal?.throwIfAborted();
                const word = payload.cells[cell], id = (word & payload.idMask) >>> 0;
                if ((set.flags & 4 && id === 0) || (!(set.flags & 4) && word === 0xffffffff)) {
                    continue;
                }
                const diagonal = (word & payload.diagonalMask) !== 0;
                if (diagonal && set.tileWidth !== set.tileHeight) {
                    throw new Error("Rectangular diagonal tile rendering requires a supported transform.");
                }
                for (let y = 0; y < set.tileHeight; y++) {
                    for (let x = 0; x < set.tileWidth; x++) {
                        let sx = word & payload.flipXMask ? set.tileWidth - 1 - x : x;
                        let sy = word & payload.flipYMask ? set.tileHeight - 1 - y : y;
                        // Reflection precedes axis swap in Aseprite's source-coordinate transform.
                        if (diagonal) {
                            [sx, sy] = [sy, sx];
                        }
                        const index = set.indexes[id * tileArea + sy * set.tileWidth + sx];
                        put(cel.x + (cell % payload.columns) * set.tileWidth + x, cel.y + Math.floor(cell / payload.columns) * set.tileHeight + y, index);
                    }
                }
            }
        }
    }
    return { width: document.width, height: document.height, indexes };
}
//# sourceMappingURL=aseprite-render.js.map