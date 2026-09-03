import {
  AssetCodecRegistry,
  AssetPreviewRegistry,
  planAssets,
  renderVerifiedAssetPreview,
  verifyAssetPlan,
  type AssetByteSource,
  type AssetRequest,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  SNES_BG_TILEMAP_ASSET_CODEC_ID,
  SNES_BRR_ASSET_CODEC_ID,
  SNES_MODE7_TILEMAP_ASSET_CODEC_ID,
  SNES_MODE7_TILE_ASSET_CODEC_ID,
  SNES_PALETTE_ASSET_CODEC_ID,
  SNES_SVG_ASSET_PREVIEW_ID,
  SNES_TILE_2BPP_ASSET_CODEC_ID,
  SNES_TILE_3BPP_ASSET_CODEC_ID,
  SNES_TILE_4BPP_ASSET_CODEC_ID,
  SNES_TILE_8BPP_ASSET_CODEC_ID,
  registerSnesAssetCodecs,
  registerSnesAssetPreviewRenderers,
} from "../src/index.js";

class Bytes implements AssetByteSource {
  constructor(readonly bytes: Uint8Array) {}
  get length(): number {
    return this.bytes.length;
  }
  read(offset: number, length: number): Uint8Array | undefined {
    return offset >= 0 && offset + length <= this.length
      ? this.bytes.slice(offset, offset + length)
      : undefined;
  }
}

const cases: readonly {
  readonly codecId: string;
  readonly bytes: Uint8Array;
  readonly options?: AssetRequest["options"];
}[] = [
  { codecId: SNES_TILE_2BPP_ASSET_CODEC_ID, bytes: new Uint8Array(16).fill(0xaa) },
  { codecId: SNES_TILE_3BPP_ASSET_CODEC_ID, bytes: new Uint8Array(24).fill(0x55) },
  { codecId: SNES_TILE_4BPP_ASSET_CODEC_ID, bytes: new Uint8Array(32).fill(0x33) },
  { codecId: SNES_TILE_8BPP_ASSET_CODEC_ID, bytes: new Uint8Array(64).fill(0x0f) },
  { codecId: SNES_MODE7_TILE_ASSET_CODEC_ID, bytes: Uint8Array.from({ length: 64 }, (_, i) => i) },
  { codecId: SNES_PALETTE_ASSET_CODEC_ID, bytes: Uint8Array.from([0x1f, 0, 0, 0x7c]) },
  {
    codecId: SNES_BG_TILEMAP_ASSET_CODEC_ID,
    bytes: Uint8Array.from([1, 0, 2, 0]),
    options: { width: 2, height: 1 },
  },
  {
    codecId: SNES_MODE7_TILEMAP_ASSET_CODEC_ID,
    bytes: Uint8Array.from([1, 2, 3, 4]),
    options: { width: 2, height: 2 },
  },
  {
    codecId: SNES_BRR_ASSET_CODEC_ID,
    bytes: Uint8Array.from([1, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]),
  },
];

test("SNES SVG previews are deterministic and available only after codec verification", (t) => {
  const codecs = registerSnesAssetCodecs(new AssetCodecRegistry());
  const previews = registerSnesAssetPreviewRenderers(new AssetPreviewRegistry());
  t.deepEqual(
    previews.list().map((renderer) => renderer.id),
    [SNES_SVG_ASSET_PREVIEW_ID],
  );
  for (const [index, fixture] of cases.entries()) {
    const source = new Bytes(fixture.bytes);
    const plan = planAssets(codecs, source, [
      {
        id: `fixture-${index}`,
        codecId: fixture.codecId,
        sourceOffset: 0,
        addressSpace: "rom.file",
        address: 0,
        length: fixture.bytes.length,
        ...(fixture.options ? { options: fixture.options } : {}),
      },
    ]);
    const verification = verifyAssetPlan(codecs, source, plan).assets[0];
    const [first] = renderVerifiedAssetPreview(
      previews,
      codecs,
      source,
      plan.assets[0],
      verification,
      SNES_SVG_ASSET_PREVIEW_ID,
    );
    const [second] = renderVerifiedAssetPreview(
      previews,
      codecs,
      source,
      plan.assets[0],
      verification,
      SNES_SVG_ASSET_PREVIEW_ID,
    );
    t.is(first.mediaType, "image/svg+xml");
    t.true(new TextDecoder().decode(first.bytes).startsWith("<svg "));
    t.deepEqual(first.bytes, second.bytes);
  }
});
