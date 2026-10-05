/** Full-project build through the new editable-source validator, with exact local tool inputs. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { loadProjectEnvironment } from "@uttori/asm-plugin-loader-node";

import { sourceContentHash } from "../../packages/disassembler/src/source-project/generation.ts";
import { buildSnesSource } from "../../packages/plugin-snes/src/disassembler/source-build.ts";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const root = path.join(application, "experiments/secret-of-mana-git-workflow-full");
const configFile = path.join(root, "disassembly/uttori-asm.config.json");
/** @type {Array<{path:string,sha256:string}>} Source identities included in the toolchain hash. */
const inputs = [];
/** Collect regular source files in stable order so toolchain identities are reproducible.
 * @param {string} directory Source directory to traverse recursively.
 * @returns {void} Appends file hashes to inputs.
 */
function collect(directory) {
  for (const item of fs
    .readdirSync(directory, { withFileTypes: true })
    .toSorted((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) {
      collect(file);
    } else if (item.isFile()) {
      inputs.push({
        path: path.relative(application, file),
        sha256: sourceContentHash(fs.readFileSync(file)),
      });
    }
  }
}
for (const name of ["core", "plugin-snes", "assets", "disassembler", "plugin-loader-node"]) {
  collect(path.join(application, "packages", name, "src"));
}
inputs.push({
  path: "package-lock.json",
  sha256: sourceContentHash(fs.readFileSync(path.join(application, "package-lock.json"))),
});
const toolchainSha256 = sourceContentHash(canonicalJson({ inputs, node: process.version }));
const loaded = await loadProjectEnvironment({ cwd: path.dirname(configFile), configFile });
try {
  const originalContent = fs.readFileSync(path.join(root, "Secret of Mana (USA).sfc"));
  const start = performance.now();
  const result = buildSnesSource({
    root,
    entrySource: "disassembly/main.asm",
    environment: loaded.environment,
    includePaths: loaded.includePaths,
    targetOptions: loaded.targetOptions,
    expectedSize: originalContent.length,
    originalContent,
    outputDirectory: path.join(root, ".uttori-local/builds"),
    toolchainSha256,
    configurationSha256: sourceContentHash(fs.readFileSync(configFile)),
  });
  const report = { ...result, elapsedMs: performance.now() - start, toolInputs: inputs.length };
  fs.writeFileSync(path.join(root, ".verification/new-source-build.json"), canonicalJson(report));
  console.log(JSON.stringify(report));
} finally {
  await loaded.dispose();
}
