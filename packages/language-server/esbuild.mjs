import { chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(here, "out/server.mjs");

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
