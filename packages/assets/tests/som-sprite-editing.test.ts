import { test } from "../../../tests/ava-helper.js";
import { mutableSpriteResult, spriteFixture } from "../../../tests/fixtures/sprite-source.js";
import { encodeFrameAtlas } from "../src/secret-of-mana/som-frame-atlas.js";
import {
  createSomSpriteEditorBundle,
  planSomSpriteEditorChanges,
} from "../src/secret-of-mana/som-sprite-editing.js";
import { inspectSpriteEditorResult } from "../src/sprite-editing.js";

test("SoM adapter combines native pixels, physical palette words and flag-preserving coordinates", (t) => {
  const { catalog, layout, png } = spriteFixture();
  const atlas = { id: "sprite.png", source: { bytes: png, mediaType: "image/png" }, layout };
  const bundle = createSomSpriteEditorBundle(atlas, catalog, "fixture");
  const result = mutableSpriteResult(bundle);
  t.deepEqual(
    planSomSpriteEditorChanges(atlas, catalog, inspectSpriteEditorResult(bundle, result)).png,
    png,
  );
  result.images[0].indexes[0] ^= 1;
  result.images[1].x++;
  result.palette[1] = [16, 0, 0, 255];
  const plan = planSomSpriteEditorChanges(
    atlas,
    catalog,
    inspectSpriteEditorResult(bundle, result),
  );
  t.deepEqual([...plan.bodies[0].after], [1, 3, 0xc1, 0x80, 0x81]);
  t.is(plan.catalog.palettes.C00100.words[0], "8002");
  t.is(plan.catalog.palettes.C00100.words[1], "0001");
  t.is(plan.layout.tileSources, "native-strip");
  const before = encodeFrameAtlas(atlas.source, layout, "tiles", catalog);
  const after = encodeFrameAtlas(
    { bytes: plan.png, mediaType: "image/png" },
    plan.layout,
    "tiles",
    plan.catalog,
  );
  t.deepEqual(
    [...after],
    [...before].map((byte, i) => (i === 0 ? byte ^ 0x80 : byte)),
  );
  t.is(layout.frames![0].blocks![0].x, 0);
  t.throws(
    () =>
      planSomSpriteEditorChanges(atlas, catalog, {
        pixels: [],
        positions: [],
        colors: [{ index: 1, color: [9, 0, 0, 255] }],
      }),
    { message: /exactly BGR555/ },
  );
});
