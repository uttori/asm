import { test } from "../../../tests/ava-helper.js";
import {
  AssetCodecRegistry,
  AssetPreviewRegistry,
  planAssets,
  renderVerifiedAssetPreview,
  verifyAssetPlan,
  type AssetByteSource,
  type AssetCodec,
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

const raw: AssetCodec = {
  id: "fixture.preview.raw",
  version: "1",
  sizeBounds: { minimum: 1 },
  inspect: ({ request }) => ({ size: request.length! }),
  decode: ({ source, request, inspection }) => ({
    value: [...source.read(request.sourceOffset, inspection.size)!],
  }),
  encode: ({ decoded }) => Uint8Array.from(decoded.value as readonly number[]),
};

test("asset previews require and preserve the binary verification gate", (t) => {
  const source = new Bytes(Uint8Array.from([1, 2, 3]));
  const codecs = new AssetCodecRegistry().register(raw);
  const asset = planAssets(codecs, source, [
    {
      id: "preview",
      codecId: raw.id,
      sourceOffset: 0,
      addressSpace: "rom.file",
      address: 0,
      length: 3,
    },
  ]).assets[0];
  const verification = verifyAssetPlan(codecs, source, { assets: [asset], conflicts: [] })
    .assets[0];
  const previews = new AssetPreviewRegistry().register({
    id: "fixture.preview.text",
    version: "1",
    codecIds: [raw.id],
    render: ({ decoded }) => [
      {
        path: "preview.txt",
        mediaType: "text/plain",
        bytes: new TextEncoder().encode((decoded.value as readonly number[]).join(",")),
      },
    ],
  });
  const files = renderVerifiedAssetPreview(
    previews,
    codecs,
    source,
    asset,
    verification,
    "fixture.preview.text",
  );
  t.is(new TextDecoder().decode(files[0].bytes), "1,2,3");
  t.throws(
    () =>
      renderVerifiedAssetPreview(
        previews,
        codecs,
        source,
        asset,
        { ...verification, sourceSha256: "0".repeat(64) },
        "fixture.preview.text",
      ),
    { message: /matching successful verification/ },
  );

  let renderCalls = 0;
  const unstable = new AssetPreviewRegistry().register({
    id: "fixture.preview.unstable",
    version: "1",
    codecIds: [raw.id],
    render: () => [
      {
        path: "unstable.bin",
        mediaType: "application/octet-stream",
        bytes: Uint8Array.of(renderCalls++),
      },
    ],
  });
  t.throws(
    () =>
      renderVerifiedAssetPreview(
        unstable,
        codecs,
        source,
        asset,
        verification,
        "fixture.preview.unstable",
      ),
    { message: /not deterministic/ },
  );
});
