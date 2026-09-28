import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Assembler } from "@uttori/asm-core";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  loadAnalysisProject,
  publishAnalysisProject,
} from "@uttori/asm-disassembler";
import { create65xxAssemblerEnvironment, RAW_65XX_TARGET_ID } from "@uttori/asm-plugin-65xx";
import { loadProjectEnvironment } from "@uttori/asm-plugin-loader-node";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";

// Copied outside the repository and run by plain Node after installing real archives. Resolution
// must stay inside that installation, with no TypeScript hook or workspace symlink available.
const { imports, commonJsImports } = JSON.parse(fs.readFileSync("exports.json", "utf8"));
const installedRoot = path.join(process.cwd(), "node_modules") + path.sep;
for (const specifier of imports) {
  const resolved = fileURLToPath(import.meta.resolve(specifier));
  assert.ok(resolved.startsWith(installedRoot), `${specifier} escaped the consumer installation`);
  assert.equal(path.extname(resolved), ".js");
  assert.ok(Object.keys(await import(specifier)).length > 0, `${specifier} has no runtime exports`);
}
const require = createRequire(import.meta.url);
for (const specifier of commonJsImports) {
  assert.equal(path.extname(require.resolve(specifier)), ".js");
  assert.ok(Object.keys(require(specifier)).length > 0);
}
assert.throws(() => require.resolve("tsx"), /Cannot find module/);

const snes = new Assembler({
  environment: await createSnesAssemblerEnvironment(),
  target: SNES_TARGET_ID,
});
try {
  snes.assembleSource("lorom\norg $008000\nsei", "snes.asm");
  assert.equal(snes.getBinaryOutput()[0], 0x78);
} finally {
  snes.dispose();
}
const raw = new Assembler({
  environment: await create65xxAssemblerEnvironment(),
  target: RAW_65XX_TARGET_ID,
  architecture: "65xx.6502",
  targetOptions: { origin: 0x8000 },
});
try {
  raw.assembleSource("org $8000\nlda #$12\nsta $34", "raw.asm");
  assert.deepEqual([...raw.getBinaryOutput()], [0xa9, 0x12, 0x85, 0x34]);
} finally {
  raw.dispose();
}

const loaded = await loadProjectEnvironment({
  cwd: process.cwd(),
  pluginModules: [{ module: "@uttori/asm-plugin-snes" }],
  overrides: { target: SNES_TARGET_ID },
});
try {
  assert.equal(loaded.target, SNES_TARGET_ID);
} finally {
  await loaded.dispose();
}

const rom = new RomImage(Uint8Array.of(0xea, 0x60), { headerSize: 0 });
const project = {
  manifest: {
    format: ANALYSIS_PROJECT_FORMAT,
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture.target",
    rom: rom.identity,
    mapping: { mapper: "fixture", source: "override", candidates: [] },
    addressSpaces: [{ id: "rom.file", name: "ROM", addressBits: 24, kind: "file" }],
  },
  shards: {
    analysis: [],
    annotations: [],
    evidence: [],
    labels: [],
    comments: [],
    regions: [],
    runtime: [],
    imports: [],
  },
};
publishAnalysisProject("analysis", project);
assert.equal(
  loadAnalysisProject("analysis").manifest.rom.contentSha256,
  rom.identity.contentSha256,
);
assert.ok(fs.existsSync("analysis/analysis.sqlite"));
console.log("Installed-consumer assembly, plugin loading, and SQLite round trip passed.");
