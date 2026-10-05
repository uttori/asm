import { test } from "../../../tests/ava-helper.js";
import { spriteFixture } from "../../../tests/fixtures/sprite-source.js";
import { renderAsepriteFrame } from "../src/aseprite-render.js";
import { createIndexedPng } from "../src/image.js";
import { inspectTilemapInterchange } from "../src/interchange.js";
import { deriveFramePlacements } from "../src/secret-of-mana/som-frame-composition.js";
import {
  layoutStableFrameAtlas,
  renderStableFrameAtlas,
} from "../src/secret-of-mana/som-frame-edit.js";
import { createSomSpriteInterchange } from "../src/secret-of-mana/som-sprite-interchange.js";
import { spritePaletteColors } from "../src/secret-of-mana/som-sprite-palettes.js";

test("measured sprite frames share a native pivot despite different source-atlas pose origins", (t) => {
  const { layout, tiles, catalog } = spriteFixture(),
    frame = structuredClone(layout.frames![0]),
    copy = structuredClone(frame);
  copy.id = "copy";
  const initial = { ...layout, frames: [frame, copy] },
    packed = layoutStableFrameAtlas(initial);
  for (const pose of packed.frames!) {
    pose.placements = deriveFramePlacements(packed, pose);
  }
  t.notDeepEqual(packed.frames![0].origin, packed.frames![1].origin);
  const pixels = renderStableFrameAtlas(tiles, packed),
    png = createIndexedPng({
      ...pixels,
      palette: [...spritePaletteColors(catalog, "C00100"), [255, 0, 255, 255]],
    });
  const { baseline } = createSomSpriteInterchange(
    { id: "sprite", source: { bytes: png, mediaType: "image/png" }, layout: packed },
    catalog,
    "12345678-1234-1234-1234-123456789012",
    [
      {
        id: "run",
        sequence: "observation",
        provenance: { id: "proof", source: "capture", kind: "observation" },
        pivot: { x: 0, y: 0 },
        frames: [
          { pose: "body", durationMs: 33 },
          { pose: "copy", durationMs: 34 },
        ],
      },
    ],
  );
  const first = renderAsepriteFrame(baseline.document, 3),
    second = renderAsepriteFrame(baseline.document, 4);
  t.deepEqual(first.indexes, second.indexes);
  t.deepEqual(
    renderAsepriteFrame(baseline.document, 1).indexes,
    renderAsepriteFrame(baseline.document, 2).indexes,
  );
  const edited = {
    ...baseline.document,
    frames: baseline.document.frames.map((entry, index) => ({
      ...entry,
      durationMs: index === 3 ? 34 : entry.durationMs,
    })),
  };
  t.throws(() => inspectTilemapInterchange(baseline, edited), { message: /timing|timeline/ });
});
