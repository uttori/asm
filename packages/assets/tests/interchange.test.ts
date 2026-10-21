import { test } from "../../../tests/ava-helper.js";
import { validateAsepriteDocument, resolveAsepriteCels } from "../src/aseprite-document.js";
import {
  decodeAsepriteDocument,
  encodeAsepriteDocument,
  type AsepriteDocument,
} from "../src/aseprite.js";
import {
  inspectTilemapInterchange,
  interchangeIdentity,
  interchangeCapabilities,
  type TilemapInterchangeBaseline,
} from "../src/interchange.js";

/** Independent second-game authority: rectangular tiles, nonzero transparency, two palette views and an unused owner. */
function baseline(): TilemapInterchangeBaseline {
  const indexes = Uint8Array.from({ length: 15 }, (_, i) => i % 3);
  const ownership = {
    owners: [
      { id: "native-zero", width: 3, height: 5, indexes, allowedIndexes: [0, 1, 2] },
      {
        id: "unused",
        width: 3,
        height: 5,
        indexes: new Uint8Array(15).fill(2),
        allowedIndexes: [0, 1, 2],
      },
    ],
    views: [
      {
        id: "view-a",
        owner: "native-zero",
        width: 3,
        height: 5,
        indexes: indexes.slice(),
        indexMap: [0, 1, 2],
      },
      {
        id: "view-b",
        owner: "native-zero",
        width: 3,
        height: 5,
        indexes: Uint8Array.from(indexes, (i) => i + 3),
        indexMap: [null, null, null, 0, 1, 2],
      },
      {
        id: "unused-view",
        owner: "unused",
        width: 3,
        height: 5,
        indexes: new Uint8Array(15).fill(2),
        indexMap: [0, 1, 2],
      },
    ],
  };
  const strip = new Uint8Array(60).fill(2);
  ownership.views.forEach((view, index) => strip.set(view.indexes, (index + 1) * 15));
  const document: AsepriteDocument = {
    width: 9,
    height: 5,
    transparentIndex: 2,
    exportId: "a0000000-0000-0000-0000-000000000000",
    palette: [
      [8, 0, 0, 255],
      [0, 8, 0, 255],
      [0, 0, 0, 0],
      [0, 0, 8, 255],
      [8, 8, 0, 255],
      [1, 2, 3, 0],
    ],
    layers: [
      {
        kind: "tilemap",
        flags: 3,
        name: "Tiles",
        tileset: 17,
        userData: interchangeIdentity.role("inventory"),
      },
    ],
    tilesets: [
      {
        id: 17,
        flags: 6,
        name: "Owners",
        baseIndex: 1,
        tileWidth: 3,
        tileHeight: 5,
        tileCount: 4,
        indexes: strip,
        userData: interchangeIdentity.tileset("native-pixels"),
        tileData: [undefined, ...ownership.views.map((view) => interchangeIdentity.view(view.id))],
      },
    ],
    frames: [
      {
        durationMs: 100,
        cels: [
          {
            kind: "tilemap",
            layer: 0,
            x: 0,
            y: 0,
            zIndex: 0,
            columns: 3,
            rows: 1,
            bits: 32,
            idMask: 0x1fffffff,
            flipXMask: 0x80000000,
            flipYMask: 0x40000000,
            diagonalMask: 0x20000000,
            cells: Uint32Array.of(1, 2, 3),
          },
        ],
      },
    ],
    tags: [],
  };
  return {
    kind: "tilemap",
    document,
    ownership,
    editablePaletteSlots: [0, 1, 3, 4],
    capabilities: {
      pixelEdits: true,
      paletteEdits: true,
      tileReferences: true,
      previewTimeline: true,
    },
    nativeTransforms: ["flipX", "flipY"],
  };
}

/** Product encode/decode is used only to obtain owned editable copies; assertions exercise native contracts. */
async function copy(document: AsepriteDocument): Promise<AsepriteDocument> {
  return decodeAsepriteDocument(await encodeAsepriteDocument(document));
}

test("file normalization accepts an edit through one palette variant without repainting unchanged aliases", async (t) => {
  const before = baseline(),
    after = await copy(before.document);
  after.tilesets[0].indexes[30] = 4;
  const changes = inspectTilemapInterchange(before, after);
  t.is(changes.pixels.length, 1);
  t.is(changes.pixels[0].owner, "native-zero");
  t.is(changes.pixels[0].indexes[0], 1);
  t.deepEqual(inspectTilemapInterchange(before, await copy(before.document)), {
    pixels: [],
    colors: [],
  });
});

test("complete identified storage reorder is harmless only when all references normalize consistently", async (t) => {
  const before = baseline(),
    decoded = await copy(before.document),
    set = decoded.tilesets[0];
  const indexes = set.indexes.slice();
  indexes.set(set.indexes.subarray(30, 45), 15);
  indexes.set(set.indexes.subarray(15, 30), 30);
  const data = [...set.tileData];
  [data[1], data[2]] = [data[2], data[1]];
  const cel = decoded.frames[0].cels[0];
  if (cel.kind !== "tilemap") {
    throw new Error("Expected tilemap.");
  }
  const after = {
    ...decoded,
    tilesets: [{ ...set, indexes, tileData: data }],
    frames: [{ ...decoded.frames[0], cels: [{ ...cel, cells: Uint32Array.of(2, 1, 3) }] }],
  };
  t.deepEqual(inspectTilemapInterchange(before, after), { pixels: [], colors: [] });
  t.throws(() => inspectTilemapInterchange(before, { ...after, frames: decoded.frames }), {
    message: /references/,
  });
});

test("inventory, native transforms, timing and derived preview edits reject before planning sources", async (t) => {
  const before = baseline(),
    after = await copy(before.document);
  const cel = after.frames[0].cels[0];
  if (cel.kind !== "tilemap") {
    throw new Error("Expected tilemap.");
  }
  cel.cells[0] = 0x20000001;
  t.throws(() => inspectTilemapInterchange(before, after), {
    message: /unsupported native transform diagonal/,
  });
  cel.cells[0] = 1;
  t.throws(
    () =>
      inspectTilemapInterchange(before, {
        ...after,
        frames: [{ ...after.frames[0], durationMs: 101 }],
      }),
    { message: /timing/ },
  );
  const duplicate = [...after.tilesets[0].tileData];
  duplicate[3] = duplicate[1];
  t.throws(
    () =>
      inspectTilemapInterchange(before, {
        ...after,
        tilesets: [{ ...after.tilesets[0], tileData: duplicate }],
      }),
    { message: /Duplicate view/ },
  );
  const preview = {
    kind: "raster" as const,
    layer: 1,
    x: 0,
    y: 0,
    zIndex: 0,
    width: 1,
    height: 1,
    indexes: Uint8Array.of(0),
  };
  const document = {
    ...before.document,
    layers: [
      ...before.document.layers,
      {
        kind: "raster" as const,
        flags: 3,
        name: "Preview",
        userData: interchangeIdentity.role("preview"),
      },
    ],
    frames: [{ ...before.document.frames[0], cels: [...before.document.frames[0].cels, preview] }],
  };
  const snapshot = { ...before, document };
  const changed = await copy(document);
  const image = changed.frames[0].cels[1];
  if (image.kind !== "raster") {
    throw new Error("Expected raster.");
  }
  image.indexes[0] = 1;
  t.throws(() => inspectTilemapInterchange(snapshot, changed), { message: /derived raster/ });
});

test("renaming, hiding and locking do not grant or remove authority", async (t) => {
  const before = baseline(),
    after = await copy(before.document);
  const renamed = {
    ...after,
    layers: [{ ...after.layers[0], name: "My renamed layer", flags: 4 }],
  };
  t.deepEqual(inspectTilemapInterchange(before, renamed), { pixels: [], colors: [] });
});

test("interchange rejects stripped identities, altered inventories and capability escalation", (t) => {
  const before = baseline();
  const original = before.document;
  t.throws(() => interchangeCapabilities(), { message: /explicit capability/ });
  for (const [changes, message] of [
    [{ width: 10 }, /canvas/],
    [{ exportId: undefined }, /identity/],
    [
      { tilesets: [...original.tilesets, { ...original.tilesets[0], id: 18 }] },
      /Duplicate tileset identity/,
    ],
    [{ layers: [...original.layers, { ...original.layers[0] }] }, /Duplicate role/],
    [
      { layers: [{ ...original.layers[0], userData: interchangeIdentity.role("other") }] },
      /Missing interchange role/,
    ],
    [
      { tilesets: [{ ...original.tilesets[0], userData: interchangeIdentity.tileset("other") }] },
      /binding changed/,
    ],
    [
      {
        tilesets: [
          {
            ...original.tilesets[0],
            tileData: [
              interchangeIdentity.view("sentinel"),
              ...original.tilesets[0].tileData.slice(1),
            ],
          },
        ],
      },
      /empty tile acquired/,
    ],
    [
      {
        tilesets: [
          {
            ...original.tilesets[0],
            tileData: [
              undefined,
              interchangeIdentity.view("unknown"),
              ...original.tilesets[0].tileData.slice(2),
            ],
          },
        ],
      },
      /missing view/,
    ],
    [
      {
        tags: [
          {
            name: "Track",
            from: 0,
            to: 0,
            direction: 0,
            repeat: 0,
            userData: interchangeIdentity.timeline("new"),
          },
        ],
      },
      /timeline membership/,
    ],
  ] as const) {
    t.throws(() => inspectTilemapInterchange(before, Object.assign({ ...original }, changes)), {
      message,
    });
  }
  for (const userData of [
    undefined,
    "stripped",
    "uttori-role:",
    `uttori-role:${"a".repeat(1025)}`,
  ]) {
    t.throws(
      () =>
        inspectTilemapInterchange(before, {
          ...original,
          layers: [{ ...original.layers[0], userData }],
        }),
      { message: /interchange identity/ },
    );
  }
  const changed = structuredClone(original);
  changed.tilesets[0].indexes[15] = 1;
  t.throws(
    () =>
      inspectTilemapInterchange(
        { ...before, capabilities: { ...before.capabilities, pixelEdits: false } },
        changed,
      ),
    { message: /exceeds exported capabilities/ },
  );
  const colors = {
    ...original,
    palette: original.palette.map((color, index) =>
      index === 0 ? ([16, 0, 0, 255] as const) : color,
    ),
  };
  t.throws(
    () =>
      inspectTilemapInterchange(
        { ...before, capabilities: { ...before.capabilities, paletteEdits: false } },
        colors,
      ),
    { message: /exceeds exported capabilities/ },
  );
  const badBaseline = {
    ...before,
    ownership: { ...before.ownership, views: before.ownership.views.slice(1) },
  };
  t.throws(() => inspectTilemapInterchange(badBaseline, original), {
    message: /inventory changed/,
  });
});

test("read-only occurrences allow empty frames while rejecting removed or shifted artwork", (t) => {
  const before = baseline();
  const original = before.document;
  const empty = { ...original, frames: [{ durationMs: 100, cels: [] }] };
  t.deepEqual(inspectTilemapInterchange({ ...before, document: empty }, empty), {
    pixels: [],
    colors: [],
  });
  t.throws(() => inspectTilemapInterchange(before, empty), { message: /references/ });
  t.throws(() => inspectTilemapInterchange({ ...before, document: empty }, original), {
    message: /references/,
  });
  for (const [x, y] of [
    [-3, 0],
    [1, 0],
    [0, -5],
    [0, 1],
    [9, 0],
    [0, 5],
  ]) {
    const shifted = {
      ...original,
      frames: [{ durationMs: 100, cels: [{ ...original.frames[0].cels[0], x, y }] }],
    };
    t.throws(() => inspectTilemapInterchange(before, shifted), { message: /references/ });
  }
  const raster = {
    kind: "raster" as const,
    layer: 1,
    x: 0,
    y: 0,
    zIndex: 0,
    width: 1,
    height: 1,
    indexes: Uint8Array.of(0),
  };
  const withRaster = {
    ...original,
    layers: [
      ...original.layers,
      {
        kind: "raster" as const,
        name: "Preview",
        flags: 3,
        userData: interchangeIdentity.role("preview"),
      },
    ],
    frames: [{ durationMs: 100, cels: [...original.frames[0].cels, raster] }],
  };
  for (const [x, y] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const shifted = {
      ...withRaster,
      frames: [{ durationMs: 100, cels: [...original.frames[0].cels, { ...raster, x, y }] }],
    };
    t.throws(() => inspectTilemapInterchange({ ...before, document: withRaster }, shifted), {
      message: /derived raster/,
    });
  }
  const withoutRaster = { ...withRaster, frames: original.frames };
  t.throws(() => inspectTilemapInterchange({ ...before, document: withRaster }, withoutRaster), {
    message: /derived raster/,
  });
  t.throws(() => inspectTilemapInterchange({ ...before, document: withoutRaster }, withRaster), {
    message: /derived raster/,
  });
  t.deepEqual(inspectTilemapInterchange({ ...before, document: withoutRaster }, withoutRaster), {
    pixels: [],
    colors: [],
  });
});

test("Aseprite models validate metadata, inventories, layer ownership and tile masks", (t) => {
  const original = baseline().document;
  for (const [change, message] of [
    [{ exportId: "bad" }, /export identity/],
    [{ userData: 1 }, /metadata must be text/],
    [{ tilesets: [{ ...original.tilesets[0], flags: 0 }] }, /external or unsupported/],
    [{ tilesets: [{ ...original.tilesets[0], indexes: new Uint8Array(1) }] }, /inventory mismatch/],
    [
      { tilesets: [{ ...original.tilesets[0], indexes: new Uint8Array(60).fill(255) }] },
      /missing palette/,
    ],
    [{ layers: [{ ...original.layers[0], flags: 8 }] }, /Unsupported/],
    [{ layers: [{ ...original.layers[0], kind: "group" }] }, /Unsupported/],
    [{ layers: [{ ...original.layers[0], uuid: "bad" }] }, /UUID/],
    [{ layers: [{ ...original.layers[0], tileset: 99 }] }, /missing embedded/],
    [
      {
        frames: [
          { durationMs: 100, cels: [original.frames[0].cels[0], original.frames[0].cels[0]] },
        ],
      },
      /Duplicate/,
    ],
  ] as const) {
    t.throws(() => validateAsepriteDocument(Object.assign({ ...original }, change)), { message });
  }
  const cel = original.frames[0].cels[0];
  for (const [change, message] of [
    [{ bits: 24 }, /word width/],
    [{ idMask: 5 }, /contiguous low bits/],
    [{ flipXMask: 3 }, /overlap|multiple/],
    [{ cells: new Uint32Array(1) }, /inventory/],
    [{ kind: "unknown" }, /Unsupported/],
    [{ kind: "raster", width: 1, height: 1, indexes: Uint8Array.of(0) }, /layer or palette/],
    [{ cells: Uint32Array.of(99, 1, 1) }, /absent tile/],
  ] as const) {
    const doc = {
      ...original,
      frames: [{ durationMs: 100, cels: [Object.assign({ ...cel }, change)] }],
    };
    t.throws(() => validateAsepriteDocument(doc), { message });
  }
  const duplicate = { ...original, frames: [{ durationMs: 100, cels: [cel, cel] }] };
  t.throws(() => resolveAsepriteCels(duplicate), { message: /Duplicate/ });
  const unsupported = {
    ...original,
    frames: [{ durationMs: 100, cels: [Object.assign({ ...cel }, { kind: "unknown" })] }],
  };
  t.throws(() => resolveAsepriteCels(unsupported), { message: /Unsupported/ });
});

test("Aseprite wire parser rejects damaged headers and frame extents before decoding pixels", async (t) => {
  const encoded = await encodeAsepriteDocument(baseline().document);
  // These offsets are the fixed public Aseprite file/frame headers, independent of encoder chunk order.
  const mutations: readonly [number, number, 1 | 2 | 4, RegExp][] = [
    [0, 1, 4, /header\/length/],
    [4, 0, 2, /header\/length/],
    [12, 32, 2, /indexed color/],
    [14, 8, 4, /header flags/],
    [35, 2, 1, /aspect ratio/],
    [132, 0, 2, /frame header/],
    [140, 65535, 4, /chunk count/],
    [128, 15, 4, /Frame extent/],
    [144, 5, 4, /Chunk extent/],
  ];
  for (const [offset, value, width, message] of mutations) {
    const bytes = Buffer.from(encoded);
    if (width === 1) {
      bytes.writeUInt8(value, offset);
    } else if (width === 2) {
      bytes.writeUInt16LE(value, offset);
    } else {
      bytes.writeUInt32LE(value, offset);
    }
    await t.throwsAsync(decodeAsepriteDocument(bytes), { message });
  }
});

test("Aseprite chunk contracts reject unsupported rendering semantics and retain narrow tile words", async (t) => {
  const document = baseline().document;
  const encoded = Buffer.from(await encodeAsepriteDocument(document));
  const offsets = new Map<number, number>();
  // Locate public chunk IDs rather than assuming the encoder's order or user-data count.
  for (let start = 144; start < encoded.length; start += encoded.readUInt32LE(start)) {
    const type = encoded.readUInt16LE(start + 4);
    if (!offsets.has(type)) {
      offsets.set(type, start + 6);
    }
  }
  for (const [type, offset, value, width, message] of [
    [0x2019, 4, 255, 4, /palette range/],
    [0x2019, 20, 2, 2, /palette entry flags/],
    [0x2004, 2, 1, 2, /layer hierarchy/],
    [0x2004, 4, 1, 2, /layer hierarchy/],
    [0x2004, 10, 1, 2, /layer hierarchy/],
    [0x2004, 12, 128, 1, /layer hierarchy/],
    [0x2005, 6, 128, 1, /cel opacity/],
    [0x2005, 7, 9, 2, /cel type/],
    [0x2005, 20, 24, 2, /tile word width/],
    [0x2020, 0, 8, 4, /user data flags/],
    [0x2023, 4, 1, 4, /external|unsupported/i],
  ] as const) {
    const base = offsets.get(type);
    if (base === undefined) {
      throw new Error(`Missing chunk ${type.toString(16)}.`);
    }
    const bytes = Buffer.from(encoded);
    if (width === 1) {
      bytes.writeUInt8(value, base + offset);
    } else if (width === 2) {
      bytes.writeUInt16LE(value, base + offset);
    } else {
      bytes.writeUInt32LE(value, base + offset);
    }
    await t.throwsAsync(decodeAsepriteDocument(bytes), { message });
  }
  const unknown = Buffer.from(encoded);
  unknown.writeUInt16LE(0xffff, 148);
  await t.throwsAsync(decodeAsepriteDocument(unknown), { message: /Unsupported Aseprite chunk/ });
  const cel = document.frames[0].cels[0];
  if (cel.kind !== "tilemap") {
    throw new Error("Expected tilemap fixture.");
  }
  for (const bits of [8, 16] as const) {
    const mask = 2 ** bits - 1;
    const narrow = {
      ...document,
      frames: [
        {
          durationMs: 100,
          cels: [{ ...cel, bits, idMask: mask, flipXMask: 0, flipYMask: 0, diagonalMask: 0 }],
        },
      ],
    };
    const decoded = await decodeAsepriteDocument(await encodeAsepriteDocument(narrow));
    const restored = decoded.frames[0].cels[0];
    t.is(restored.kind, "tilemap");
    if (restored.kind === "tilemap") {
      t.deepEqual(restored.cells, cel.cells);
      t.is(restored.bits, bits);
    }
  }
});
