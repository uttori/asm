import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { crc32 } from "node:zlib";

import { test } from "../../../tests/ava-helper.js";
import { createIndexedPng, pngImporter, rewriteIndexedPng } from "../src/image.js";
import { rgbaPreviewPng } from "../src/preview.js";

const fixture = (name: string): Buffer =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

/** Frame an ancillary chunk independently of the production writer. */
function withChunk(source: Uint8Array, type: string, payload: Uint8Array): Uint8Array {
  const chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length, 0);
  chunk.write(type, 4, "ascii");
  chunk.set(payload, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return Buffer.concat([source.subarray(0, -12), chunk, source.subarray(-12)]);
}

test("asset PNG policy rejects animation, oversized input and oversized edited canvases", (t) => {
  const bytes = fixture("indexed-4bpp.png");
  const animated = withChunk(bytes, "acTL", Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 0));
  t.throws(() => pngImporter.import({ bytes: animated, mediaType: "image/png" }), {
    message: /Animated PNG/,
  });
  t.throws(() => rewriteIndexedPng(animated, {}), { message: /Animated PNG/ });
  t.throws(
    () =>
      pngImporter.import({
        bytes: new Uint8Array(16 * 1024 * 1024 + 1),
        mediaType: "image/png",
      }),
    { message: /input byte limit/ },
  );
  t.throws(
    () =>
      rewriteIndexedPng(bytes, {
        dimensions: { width: 1024, height: 1025 },
        indexes: new Uint8Array(1),
      }),
    { message: /pixel limit/ },
  );
  t.throws(
    () =>
      createIndexedPng({
        width: 1024,
        height: 1025,
        indexes: new Uint8Array(1),
        palette: [[0, 0, 0, 0]],
      }),
    { message: /one-megapixel/ },
  );
});

test("imported pixel ownership is independent of compressed Buffer input", (t) => {
  for (const name of ["indexed-4bpp-adam7.png", "rgba-transparent.png"]) {
    const bytes = fixture(name);
    const input = Buffer.from(bytes);
    const document = pngImporter.import({ bytes: input, mediaType: "image/png" });
    const value = document.value as { indexes?: Uint8Array; rgba?: Uint8Array };
    const pixels = value.indexes ?? value.rgba!;
    const before = pixels.slice();
    input.fill(0);
    t.deepEqual(pixels, before);
    pixels.fill(0);
    t.deepEqual(bytes, fixture(name));
  }
});

test("PNG previews retain measured encoding and shared-scale samples for odd aspect ratios", (t) => {
  // Identities include hidden RGB, alpha, unaligned source views and no-upscale behavior.
  const cases = [
    [16, 16, 256, "786bb36c967ed4fe70b5a25a164d7e8a535f223158b5efe0f2f8400e8a15f9f7"],
    [13, 7, 10, "446f3d4e44dc4da9f72ac5b67359ee92cde8fbb147403cb106f0ea04e62442c5"],
    [257, 129, 256, "4b22b8b9cc0e30a0c24b872d3d3d0a5235a735ac5a99899ef1e9ba851dd31630"],
    [11, 19, 7, "2ebf231a9aa7324bcade5d87bf9c7a8f5888c5966f3345c10793af3b72b348be"],
    [1, 17, 3, "db9b184a323980d9a592a21f2239dcdf6143ca4421b5395f7b1d4be3978adb35"],
  ] as const;
  for (const [width, height, maxEdge, expected] of cases) {
    const rgba = Uint8Array.from(
      { length: width * height * 4 + 1 },
      (_, i) => (i * 17) & 255,
    ).subarray(1);
    const bytes = rgbaPreviewPng(rgba, width, height, maxEdge);
    t.is(createHash("sha256").update(bytes).digest("hex"), expected);
  }
});

test("PNG previews accept offset Canvas buffers without changing their pixels", (t) => {
  const pixels = Uint8ClampedArray.from({ length: 13 * 7 * 4 + 9 }, (_, i) => (i * 17) & 255);
  const before = pixels.slice();
  const rgba = pixels.subarray(5, 5 + 13 * 7 * 4);
  t.deepEqual(rgbaPreviewPng(rgba, 13, 7, 10), rgbaPreviewPng(Uint8Array.from(rgba), 13, 7, 10));
  t.deepEqual(pixels, before);
});
