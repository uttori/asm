import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, "src/server.ts")],
  outfile: path.join(here, "out/server.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // `debug` is an optional dependency loaded via dynamic import inside the core;
  // keep it external so the bundle works whether or not it is installed.
  external: ["debug"],
  // ESM output needs a shim so bundled CJS deps (vscode-languageserver) can use
  // require/__dirname.
  banner: {
    js: [
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
