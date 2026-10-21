import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  decodeAsepriteDocument,
  encodeAsepriteDocument,
  type AsepriteDocument,
} from "@uttori/asm-assets/aseprite";
import { readIndexedOwnership } from "@uttori/asm-assets/indexed-ownership";
import {
  interchangeIdentity,
  inspectTilemapInterchange,
  type TilemapInterchangeBaseline,
} from "@uttori/asm-assets/interchange";

import { test } from "../../../tests/ava-helper.js";
import { AssetRecordStore } from "../../workflows/src/asset-interchange/record-store.js";

test("a complete four-megapixel tile inventory fits identity, binary storage and normalization budgets", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-full-inventory-"));
  try {
    const pixels = new Uint8Array(4194304),
      slots = Array.from({ length: 16 }, (_, index) => index);
    const owners = Array.from({ length: 65536 }, (_, tile) => ({
      id: `tile-${tile}`,
      width: 8,
      height: 8,
      indexes: pixels.subarray(tile * 64, tile * 64 + 64),
      allowedIndexes: slots,
    }));
    const views = owners.map((owner) => ({
      id: `view-${owner.id}`,
      owner: owner.id,
      width: 8,
      height: 8,
      indexes: owner.indexes,
      indexMap: slots,
    }));
    const strip = new Uint8Array(pixels.length + 64),
      cells = Uint32Array.from({ length: 65536 }, (_, index) => index + 1),
      id = randomUUID();
    const document: AsepriteDocument = {
      width: 2048,
      height: 2048,
      transparentIndex: 0,
      exportId: id,
      palette: slots.map((slot) => [slot, slot, slot, slot === 0 ? 0 : 255]),
      layers: [
        {
          kind: "tilemap",
          flags: 3,
          name: "Tiles",
          tileset: 0,
          userData: interchangeIdentity.role("inventory"),
        },
      ],
      tilesets: [
        {
          id: 0,
          flags: 6,
          name: "Complete native inventory",
          baseIndex: 0,
          tileWidth: 8,
          tileHeight: 8,
          tileCount: 65537,
          indexes: strip,
          userData: interchangeIdentity.tileset("native"),
          tileData: [undefined, ...views.map((view) => interchangeIdentity.view(view.id))],
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
              columns: 256,
              rows: 256,
              bits: 32,
              idMask: 0x1fffffff,
              flipXMask: 0x80000000,
              flipYMask: 0x40000000,
              diagonalMask: 0x20000000,
              cells,
            },
          ],
        },
      ],
      tags: [],
    };
    const encoded = await encodeAsepriteDocument(document),
      decoded = await decodeAsepriteDocument(encoded);
    t.true(encoded.length < 16 * 1024 * 1024);
    t.is(decoded.tilesets[0].tileCount, 65537);
    const store = new AssetRecordStore(root);
    store.publish(id, { owners, views });
    const loaded = store.read(id, readIndexedOwnership).value;
    t.is(loaded.views[0].indexMap, loaded.views[65535].indexMap);
    t.is(loaded.owners.length, 65536);
    const baseline: TilemapInterchangeBaseline = {
      kind: "tilemap",
      document: decoded,
      ownership: loaded,
      editablePaletteSlots: [],
      nativeTransforms: ["flipX", "flipY"],
      capabilities: {
        pixelEdits: true,
        paletteEdits: false,
        tileReferences: true,
        previewTimeline: false,
      },
    };
    t.deepEqual(inspectTilemapInterchange(baseline, decoded), { pixels: [], colors: [] });
    // The last unused-looking owner retains independent identity despite sharing identical blank blob bytes.
    const edited = structuredClone(decoded);
    edited.tilesets[0].indexes[65536 * 64] = 1;
    const changed = inspectTilemapInterchange(
      baseline,
      await decodeAsepriteDocument(await encodeAsepriteDocument(edited)),
    );
    t.is(changed.pixels.length, 1);
    t.is(changed.pixels[0].owner, "tile-65535");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
