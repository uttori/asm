import { chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(here, "out/cli.mjs");

await build({
  entryPoints: [path.join(here, "src/index.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "info",
});

chmodSync(outfile, 0o755);
