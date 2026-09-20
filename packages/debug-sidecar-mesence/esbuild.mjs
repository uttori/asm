import { chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build as esbuild } from "esbuild";

import { withBundleNotices } from "../../scripts/bundle-notices.mjs";

const build = withBundleNotices(esbuild);

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(here, "out/sidecar.mjs");

await build({
  entryPoints: [path.join(here, "src/sidecar.ts")],
  outfile,
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "esm",
  target: "node26",
  external: [],
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "info",
});

chmodSync(outfile, 0o755);
