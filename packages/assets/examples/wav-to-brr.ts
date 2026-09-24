import { readFileSync } from "node:fs";

import { AssetRegistry, convertAsset } from "@uttori/asm-assets";
import { waveImporter, withAudioEncoder } from "@uttori/asm-assets/audio";
import { snesNativeEncoders } from "@uttori/asm-assets/snes";

const registry = new AssetRegistry().registerImporter(waveImporter);
for (const encoder of withAudioEncoder(snesNativeEncoders)) {
  registry.registerEncoder(encoder);
}

const source = readFileSync(new URL("./data/pcm16-loop.wav", import.meta.url));
const result = convertAsset(registry, {
  source: { bytes: source, mediaType: "audio/wav" },
  format: "snes.brr",
  options: { loop: "source", padding: "reject" },
});

// BRR bytes have no rate or loop address; consumers read those from metadata.
console.log({
  brrBytes: result.outputs.brr.bytes.length,
  metadata: result.outputs.brr.metadata,
  fidelity: result.fidelity,
});
