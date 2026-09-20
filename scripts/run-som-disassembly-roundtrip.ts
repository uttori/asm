import { createHash } from "node:crypto";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runCli } from "../packages/cli/src/index.js";
import { SECRET_OF_MANA_ANALYSIS_FIXTURE } from "../fixtures/fixture-manifest.js";

const root = path.resolve(import.meta.dirname, "..");
const requestedRom = process.argv[2];
const rom = requestedRom
  ? path.resolve(process.cwd(), requestedRom)
  : path.join(root, "Local Only", SECRET_OF_MANA_ANALYSIS_FIXTURE.filename);
const dizraw = path.join(root, SECRET_OF_MANA_ANALYSIS_FIXTURE.dizraw);

if (!fs.existsSync(rom)) {
  throw new Error(
    `Place ${SECRET_OF_MANA_ANALYSIS_FIXTURE.filename} at '${rom}' or pass its path as the first argument. The ROM is never copied into the repository or analysis project.`,
  );
}
const bytes = fs.readFileSync(rom);
const digest = createHash("sha256").update(bytes).digest("hex");
if (
  bytes.length !== SECRET_OF_MANA_ANALYSIS_FIXTURE.bytes ||
  digest !== SECRET_OF_MANA_ANALYSIS_FIXTURE.sha256
) {
  throw new Error(
    `Wrong ROM identity: received ${bytes.length} byte(s) / ${digest}. Expected ${SECRET_OF_MANA_ANALYSIS_FIXTURE.bytes} / ${SECRET_OF_MANA_ANALYSIS_FIXTURE.sha256}.`,
  );
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-som-roundtrip-"));
const project = path.join(temporary, "Secret-of-Mana.analysis");
const source = path.join(temporary, "Secret-of-Mana.source");
try {
  const commands: readonly (readonly string[])[] = [
    [
      "disassemble",
      rom,
      project,
      `--mapper=${SECRET_OF_MANA_ANALYSIS_FIXTURE.mapper}`,
      "--dizraw",
      dizraw,
    ],
    ["analyze", project, "--rom", rom],
    ["export", project, source, "--rom", rom],
    ["verify-roundtrip", source, "--rom", rom],
  ];
  for (const command of commands) {
    const exitCode = await runCli(command);
    if (exitCode !== 0) throw new Error(`Command failed: uttori-asm ${command.join(" ")}`);
  }
  console.log(
    `Success: ${SECRET_OF_MANA_ANALYSIS_FIXTURE.displayName} passed the native-source round-trip gate.`,
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
