import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, "src/extension.ts")],
  outfile: path.join(here, "out/extension.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  // `vscode` is provided by the host at runtime and must not be bundled.
  external: ["vscode"],
  logLevel: "info",
});

// Ship the language-server bundle alongside the extension so it can be launched
// over stdio. Run `npm run lsp:build` first to produce this file.
const serverBundle = path.resolve(here, "../../language-server/out/server.mjs");
const serverDestination = path.join(here, "server", "server.mjs");
if (existsSync(serverBundle)) {
  mkdirSync(path.dirname(serverDestination), { recursive: true });
  cpSync(serverBundle, serverDestination);
  console.log(`Copied language server bundle to ${serverDestination}`);
} else {
  console.warn(`Language server bundle missing at ${serverBundle}; run "npm run lsp:build" first.`);
}
