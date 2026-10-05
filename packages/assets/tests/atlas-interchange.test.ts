import { test } from "../../../tests/ava-helper.js";
import { asepriteAtlasCodec } from "../src/aseprite.js";
import {
  inspectAtlasChanges,
  indexedAtlasDocument,
  type AtlasDocument,
  type AtlasEditPolicy,
} from "../src/atlas-interchange.js";
import { indexedPngAtlasCodec } from "../src/atlas-png.js";

/** A different game profile: 3×5 pixels, slot two transparency, and native index remapping. */
function fixture() {
  const document: AtlasDocument = {
    width: 4,
    height: 5,
    indexes: new Uint8Array(20).fill(2),
    transparentIndex: 2,
    palette: [
      [11, 21, 31, 255],
      [11, 21, 31, 255],
      [0, 0, 0, 0],
    ],
    exportId: "a0000000-0000-0000-0000-000000000000",
  };
  const policy: AtlasEditPolicy = {
    owners: [
      { id: "native-art", x: 0, y: 0, width: 3, height: 5, flipX: true, indexMap: [7, 5, 0] },
    ],
    editablePaletteSlots: [0, 1],
  };
  return { document, policy };
}

test("two real file codecs share a different game's geometry, slot policy and native orientation", async (t) => {
  for (const codec of [asepriteAtlasCodec, indexedPngAtlasCodec(2)]) {
    const { document, policy } = fixture();
    const decoded = await codec.decode(await codec.encode(document));
    t.deepEqual(inspectAtlasChanges(document, decoded, policy), { pixels: [], colors: [] });
    const indexes = document.indexes.slice();
    indexes[0] = 1;
    const palette = document.palette.map((color): [number, number, number, number] => [...color]);
    palette[0][0] = 12;
    const changed = await codec.decode(await codec.encode({ ...document, indexes, palette }));
    const deltas = inspectAtlasChanges(document, changed, policy);
    t.is(deltas.pixels[0].indexes[2], 5);
    t.deepEqual(deltas.colors, [{ index: 0, color: [12, 21, 31, 255] }]);
  }
});

test("changed displayed aliases cannot silently collapse to the same native index", (t) => {
  const { document, policy } = fixture();
  const indexes = document.indexes.slice();
  indexes[0] = 0;
  t.throws(
    () =>
      inspectAtlasChanges(
        document,
        { ...document, indexes },
        {
          ...policy,
          owners: [{ ...policy.owners[0], indexMap: [0, 5, 0] }],
        },
      ),
    { message: /canonical mapping/ },
  );
});

test("padding, wrong slots, duplicate authorities, changed geometry/alpha and identity reject", (t) => {
  const { document, policy } = fixture();
  t.throws(
    () =>
      indexedAtlasDocument(
        { kind: "rgba-image", width: 4, height: 5, rgba: new Uint8Array(80) },
        2,
      ),
    { message: /RGB mapping/ },
  );
  const padding = document.indexes.slice();
  padding[3] = 1;
  t.throws(() => inspectAtlasChanges(document, { ...document, indexes: padding }, policy), {
    message: /padding/,
  });
  t.throws(
    () =>
      inspectAtlasChanges(document, document, {
        ...policy,
        owners: [...policy.owners, { ...policy.owners[0], id: "other" }],
      }),
    { message: /Overlapping/ },
  );
  t.throws(
    () =>
      inspectAtlasChanges(document, document, {
        ...policy,
        owners: [...policy.owners, policy.owners[0]],
      }),
    { message: /duplicate/ },
  );
  t.throws(() => inspectAtlasChanges(document, { ...document, transparentIndex: 1 }, policy), {
    message: /transparency/,
  });
  t.throws(
    () =>
      inspectAtlasChanges(
        document,
        { ...document, exportId: "b0000000-0000-0000-0000-000000000000" },
        policy,
      ),
    { message: /different export/ },
  );
  t.throws(
    () =>
      inspectAtlasChanges(
        document,
        { ...document, palette: [[11, 21, 31, 0], ...document.palette.slice(1)] },
        policy,
      ),
    { message: /alpha/ },
  );
  const wrong = document.indexes.slice();
  wrong[0] = 1;
  t.throws(
    () =>
      inspectAtlasChanges(
        document,
        { ...document, indexes: wrong },
        { ...policy, owners: [{ ...policy.owners[0], indexMap: [7, null, 0] }] },
      ),
    { message: /Unmapped/ },
  );
});
