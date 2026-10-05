import { randomFillSync } from "node:crypto";

import { test } from "../../../tests/ava-helper.js";
import { decodeAsepriteAtlas, encodeAsepriteAtlas } from "../src/aseprite.js";
import { validateAtlasDocument } from "../src/atlas-interchange.js";
import { validateIndexedPixels } from "../src/indexed-edit.js";
import { ASSET_LIMITS, boundedProduct, boundedSum, rasterArea } from "../src/limits.js";
import { createIndexedPng, rewriteIndexedPng } from "../src/png-edit.js";
import { pngImporter } from "../src/png.js";
import { rgbaNativePng, rgbaPreviewPng } from "../src/preview.js";

test("raster boundaries distinguish skinny buffers, interchange sides, area and arithmetic overflow", (t) => {
  t.is(rasterArea(4096, 1024), ASSET_LIMITS.rasterPixels);
  t.is(rasterArea(1, ASSET_LIMITS.rasterPixels), ASSET_LIMITS.rasterPixels);
  for (const [width, height] of [
    [4096, 1025],
    [1, ASSET_LIMITS.rasterPixels + 1],
    [0, 1],
    [1.5, 2],
    [Number.MAX_SAFE_INTEGER, 2],
  ]) {
    t.throws(() => rasterArea(width, height));
  }
  t.is(
    boundedProduct(Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER, "Bytes"),
    Number.MAX_SAFE_INTEGER,
  );
  t.throws(() => boundedProduct(Number.MAX_SAFE_INTEGER, 2, Number.MAX_SAFE_INTEGER, "Bytes"));
  t.throws(() => boundedSum(Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER, "Bytes"));
  t.throws(() => boundedSum(0, -1, 16, "Bytes"));
  const skinny = { width: 1, height: 4097, indexes: new Uint8Array(4097) };
  t.notThrows(() => validateIndexedPixels(skinny));
  t.throws(
    () => validateAtlasDocument({ ...skinny, palette: [[0, 0, 0, 0]], transparentIndex: 0 }),
    { message: /height/ },
  );
});

test("exact four-megapixel indexed canvases survive PNG, editing and Aseprite conversion", async (t) => {
  const document = {
    width: 4096,
    height: 1024,
    indexes: new Uint8Array(ASSET_LIMITS.rasterPixels).fill(1),
    palette: [
      [0, 0, 0, 0],
      [8, 16, 24, 255],
      [8, 16, 24, 255],
    ] as const,
    transparentIndex: 0,
  };
  document.indexes[document.indexes.length - 1] = 2;
  const png = createIndexedPng(document);
  const decoded = pngImporter.import({ bytes: png, mediaType: "image/png" }).value;
  if (
    !decoded ||
    typeof decoded !== "object" ||
    !("indexes" in decoded) ||
    !(decoded.indexes instanceof Uint8Array)
  ) {
    throw new Error("Expected indexed PNG.");
  }
  t.true(decoded.indexes.every((index, offset) => index === document.indexes[offset]));
  document.indexes[0] = 2;
  const edited = rewriteIndexedPng(png, { indexes: document.indexes });
  const result = pngImporter.import({ bytes: edited, mediaType: "image/png" }).value;
  if (
    !result ||
    typeof result !== "object" ||
    !("indexes" in result) ||
    !(result.indexes instanceof Uint8Array)
  ) {
    throw new Error("Expected indexed PNG.");
  }
  t.is(result.indexes[0], 2);
  const aseprite = await decodeAsepriteAtlas(encodeAsepriteAtlas(document));
  t.true(aseprite.indexes.every((index, offset) => index === document.indexes[offset]));
  t.deepEqual(aseprite.palette, document.palette);
});

test("poorly compressing four-megapixel RGBA PNG exceeds sixteen MiB and remains bounded", (t) => {
  const rgba = randomFillSync(new Uint8Array(ASSET_LIMITS.rasterPixels * 4));
  const bytes = rgbaNativePng(rgba, 4096, 1024);
  t.true(bytes.length > 16 * 1024 * 1024);
  t.true(bytes.length <= ASSET_LIMITS.pngBytes);
  const result = pngImporter.import({ bytes, mediaType: "image/png" }).value;
  if (
    !result ||
    typeof result !== "object" ||
    !("rgba" in result) ||
    !(result.rgba instanceof Uint8Array)
  ) {
    throw new Error("Expected RGBA PNG.");
  }
  t.true(result.rgba.every((byte, offset) => byte === rgba[offset]));
  const preview = pngImporter.import({
    bytes: rgbaPreviewPng(rgba, 4096, 1024, 1024),
    mediaType: "image/png",
  }).value;
  if (!preview || typeof preview !== "object" || !("width" in preview) || !("height" in preview)) {
    throw new Error("Expected preview PNG.");
  }
  t.is(preview.width, 1024);
  t.is(preview.height, 256);
});
