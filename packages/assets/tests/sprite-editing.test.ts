import { test } from "../../../tests/ava-helper.js";
import { mutableSpriteResult } from "../../../tests/fixtures/sprite-source.js";
import {
  inspectSpriteEditorResult,
  validateSpriteEditorBundle,
  type SpriteEditorBundle,
} from "../src/sprite-editing.js";

/** Deliberately differs from SNES geometry, transparency and coordinate limits. */
function fixture(): SpriteEditorBundle {
  return {
    format: "uttori-sprite-editor",
    version: 1,
    session: "another-game",
    adapter: "synthetic:1",
    width: 40,
    height: 30,
    transparentIndex: 2,
    palette: [
      [0, 0, 0, 255],
      [0, 0, 0, 255],
      [0, 0, 0, 0],
      [255, 80, 0, 255],
    ],
    editablePaletteIndexes: [0, 1, 3],
    frames: ["tiles", "pose"],
    images: [
      {
        id: "pixels",
        owner: "resource:7",
        frame: "tiles",
        role: "pixels",
        width: 3,
        height: 5,
        x: 0,
        y: 0,
        indexes: Array(15).fill(2),
        allowedIndexes: [0, 1, 2, 3],
      },
      {
        id: "placement",
        owner: "record:9",
        frame: "pose",
        role: "placement",
        width: 3,
        height: 5,
        x: 11,
        y: 12,
        indexes: Array(15).fill(1),
        allowedIndexes: [0, 1, 2, 3],
        moveBounds: [10, 10, 25, 25],
      },
    ],
  };
}

test("portable editor contract accepts another game's geometry and preserves duplicate color identities", (t) => {
  const bundle = fixture();
  const result = mutableSpriteResult(bundle);
  t.deepEqual(inspectSpriteEditorResult(bundle, result), { pixels: [], positions: [], colors: [] });
  result.images[0].indexes[0] = 0;
  result.images[1].x = 25;
  result.palette[1][0] = 123;
  result.frames.reverse();
  result.images.reverse();
  t.deepEqual(inspectSpriteEditorResult(bundle, result), {
    pixels: [{ id: "pixels", indexes: [0, ...Array(14).fill(2)] }],
    positions: [{ id: "placement", x: 25, y: 12 }],
    colors: [{ index: 1, color: [123, 0, 0, 255] }],
  });
  t.is(bundle.images[0].indexes[0], 2);
});

test("untrusted inventory, identity, palette and derived artwork mutations reject", (t) => {
  const bundle = fixture();
  const mutations = [
    (r: any) => {
      r.session = "wrong";
    },
    (r: any) => {
      r.images.pop();
    },
    (r: any) => {
      r.images[1].id = r.images[0].id;
    },
    (r: any) => {
      r.images[0].id = "unknown";
    },
    (r: any) => {
      // An unknown identity must not resolve to the final image through a negative lookup index.
      r.images[1].id = "unknown";
    },
    (r: any) => {
      r.images[0].width++;
    },
    (r: any) => {
      r.images[1].indexes[0] = 0;
    },
    (r: any) => {
      r.images[1].x = 26;
    },
    (r: any) => {
      r.images[0].x++;
    },
    (r: any) => {
      r.images[0].indexes[0] = 4;
    },
    (r: any) => {
      r.images[0].opacity = 254;
    },
    (r: any) => {
      r.images[0].zIndex = 1;
    },
    (r: any) => {
      r.images[0].layerOrder = 1;
    },
    (r: any) => {
      r.images[0].frame = "pose";
    },
    (r: any) => {
      r.frames.push("inserted");
    },
    (r: any) => {
      r.frames[1] = r.frames[0];
    },
    (r: any) => {
      r.palette[2][0] = 1;
    },
    (r: any) => {
      r.palette[1][3] = 0;
    },
    (r: any) => {
      r.palette[1][0] = NaN;
    },
    (r: any) => {
      r.palette.push([0, 0, 0, 255]);
    },
  ];
  for (const mutate of mutations) {
    const result = mutableSpriteResult(bundle);
    mutate(result);
    t.throws(() => inspectSpriteEditorResult(bundle, result));
  }
});

test("unchanged aliases participate in shared native record agreement", (t) => {
  const initial = fixture();
  const bundle = {
    ...initial,
    images: [...initial.images, { ...initial.images[1], id: "alias", x: 13 }],
  };
  const result = mutableSpriteResult(bundle);
  result.images[1].x++;
  t.throws(() => inspectSpriteEditorResult(bundle, result), {
    message: /Conflicting shared-owner/,
  });
  result.images[2].x++;
  t.is(inspectSpriteEditorResult(bundle, result).positions.length, 2);
});

test("portable bundle bounds allocations and rejects invalid capabilities", (t) => {
  for (const mutate of [
    (b: any) => {
      b.width = 4097;
    },
    (b: any) => {
      b.width = b.height = 4096;
    },
    (b: any) => {
      b.images[0].moveBounds = [0, 0, 1, 1];
    },
    (b: any) => {
      b.images[1].moveBounds = [20, 0, 10, 25];
    },
    (b: any) => {
      b.images[0].allowedIndexes = [1, 1];
    },
    (b: any) => {
      b.editablePaletteIndexes = [0, 0];
    },
  ]) {
    const bundle = fixture();
    mutate(bundle);
    t.throws(() => validateSpriteEditorBundle(bundle));
  }
});
