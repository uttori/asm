import { readFileSync } from "node:fs";

import { AssetRegistry, convertAsset } from "@uttori/asm-assets";
import { pngImporter, withImageEncoders } from "@uttori/asm-assets/image";
import { snesNativeEncoders } from "@uttori/asm-assets/snes";

const registry = new AssetRegistry().registerImporter(pngImporter);
for (const encoder of withImageEncoders(snesNativeEncoders)) {
  registry.registerEncoder(encoder);
}

const source = readFileSync(new URL("./data/colored-4bpp.png", import.meta.url));
const result = convertAsset(registry, {
  source: { bytes: source, mediaType: "image/png" },
  format: "snes.tile.4bpp",
  options: { palette: "embedded", layout: { tileOrder: "row-major" } },
});

// Every output comes from the same index and palette decision.
console.log({
  tiles: result.outputs.tiles.bytes.length,
  palette: result.outputs.palette.bytes.length,
  tilemap: result.outputs.tilemap.bytes.length,
  fidelity: result.fidelity.kind,
});
