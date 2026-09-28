import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  RomImage,
  publishAnalysisProject,
  loadAnalysisProjectSnapshot,
  analysisProjectRevision,
} from "@uttori/asm-disassembler";
import { exportSnes65816Source } from "@uttori/asm-plugin-snes";

/** Redistributable data-only ROM, with a mirrored imported label and no instruction/debug map. */
export const ownershipFixture = (parentDirectory = os.tmpdir()) => {
  const directory = fs.mkdtempSync(path.join(parentDirectory, "uttori-ownership-"));
  const sourceDirectory = path.join(directory, "source");
  const projectDirectory = path.join(sourceDirectory, "analysis");
  const rom = new RomImage(new Uint8Array(0x10000).fill(0x12), { headerSize: 0 });
  fs.mkdirSync(sourceDirectory, { recursive: true });
  const romFile = path.join(directory, "original.sfc");
  fs.writeFileSync(romFile, rom.read(0, rom.length)!);
  fs.writeFileSync(
    path.join(sourceDirectory, "struct-map.json"),
    JSON.stringify({
      format: "uttori-asm-snes-struct-map",
      schemaVersion: 1,
      structures: [
        {
          id: "PriceLayout",
          size: 2,
          fields: [{ name: "value", offset: 0, size: 2, description: "Verified fixture field" }],
        },
      ],
      bindings: [
        { name: "Prices", structure: "PriceLayout", address: 0xc00040, fileOffset: 0x40, count: 2 },
      ],
      constants: [{ name: "FixtureLimit", value: 10, description: "Fixture count" }],
    }),
  );
  const stagedProject = path.join(directory, "analysis");
  publishAnalysisProject(stagedProject, {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "snes.sfc",
      rom: rom.identity,
      mapping: { mapper: "hirom", source: "override", candidates: [] },
      addressSpaces: [
        { id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 },
        { id: "rom.file", name: "ROM", kind: "file", addressBits: 24 },
      ],
    },
    shards: {
      analysis: [],
      annotations: [],
      runtime: [],
      imports: [],
      regions: [],
      labels: [
        {
          id: "imported.candy",
          addressSpace: "snes.cpu",
          address: 0x400020,
          name: "Item_Price_Candy",
          comment:
            "A wrapped imported description whose actual bytes still require separate interpretation.",
          evidence: ["guide"],
        },
      ],
      comments: [
        {
          id: "note",
          addressSpace: "rom.file",
          address: 0x30,
          text: "Standalone data comment",
          evidence: ["guide"],
        },
      ],
      evidence: [{ id: "guide", source: "import", sourceId: "fixture", confidence: "unknown" }],
    },
  });
  const snapshot = loadAnalysisProjectSnapshot(stagedProject);
  const manifest = exportSnes65816Source(snapshot, rom, sourceDirectory, {
    sourceProjectSha256: analysisProjectRevision(snapshot.manifest).manifestSha256,
    commentLineWidth: 40,
  });
  fs.renameSync(stagedProject, projectDirectory);
  const file = path.join(sourceDirectory, "banks/bank-000.asm");
  const text = fs.readFileSync(file, "utf8");
  const line = text.split("\n").findIndex((value) => value === "L_Item_Price_Candy:") + 1;
  return {
    directory,
    sourceDirectory,
    projectDirectory,
    rom,
    romFile,
    snapshot,
    manifest,
    file,
    text,
    line,
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
};
