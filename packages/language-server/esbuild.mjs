import { chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build as esbuild } from "esbuild";

import { withBundleNotices, pruneRuntimeOutputs } from "../../scripts/bundle-notices.mjs";

const build = withBundleNotices(esbuild);

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(here, "out/server.mjs");
const previewWorker = path.join(here, "out/asset-preview-worker.mjs");

await build({
  entryPoints: [path.join(here, "src/server.ts")],
  outfile,
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "esm",
  target: "node26",
  // Never emit a runnable bundle with plugin imports replaced by `undefined`.
  logOverride: { "import-is-undefined": "error" },
  external: [],
  // ESM output needs a shim so bundled CJS deps (vscode-languageserver) can use
  // require/__dirname.
  banner: {
    js: [
      "#!/usr/bin/env node",
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __dirname_fn } from 'node:path';",
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __dirname_fn(__filename);",
    ].join("\n"),
  },
  logLevel: "info",
});

chmodSync(outfile, 0o755);

await build({
  entryPoints: [path.join(here, "src/asset-preview-worker.ts")],
  outfile: previewWorker,
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "esm",
  target: "node26",
  external: [],
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "info",
});

// Analysis runs in a sibling worker so protocol requests can use the last complete snapshot.
await build({
  entryPoints: [path.resolve(here, "src/index-worker.ts")],
  outfile: path.join(here, "out/index-worker.mjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "esm",
  target: "node26",
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});

pruneRuntimeOutputs(path.join(here, "out"));
