import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  canonicalJson,
  loadAnalysisProject,
  migrateManifest,
  validateAnalysisProject,
  writeAnalysisProject,
  type AnalysisProject,
} from "../src/index.js";

const projectFor = (rom: RomImage): AnalysisProject => ({
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
    annotations: [
      {
        id: "annotation-1",
        addressSpace: "rom.file",
        start: 0,
        end: 2,
        classification: "data16",
        architecture: "fixture.architecture",
        evidence: ["manual-1"],
      },
    ],
    labels: [],
    comments: [],
    regions: [
      {
        id: "region-parent",
        addressSpace: "rom.file",
        start: 0,
        end: 2,
        name: "Parent",
        evidence: ["manual-1"],
      },
      {
        id: "region-child",
        parentRegion: "region-parent",
        addressSpace: "rom.file",
        start: 0,
        end: 1,
        name: "Child",
        evidence: ["manual-1"],
      },
    ],
    evidence: [
      {
        id: "manual-1",
        source: "manual",
        sourceId: "test",
        confidence: "certain",
      },
    ],
    imports: [],
  },
});

const schemaFixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));

const readTree = async (directory: string): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  const visit = async (current: string): Promise<void> => {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else result[path.relative(directory, absolute)] = await fs.readFile(absolute, "utf8");
    }
  };
  await visit(directory);
  return result;
};

test("analysis projects are deterministic shards without ROM bytes", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-store-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000).fill(0xa5));
    const input = projectFor(rom);
    writeAnalysisProject(temporary, input);
    const first = await readTree(temporary);
    const loaded = loadAnalysisProject(temporary);
    const { shards: ignored, ...manifest } = loaded.manifest;
    void ignored;
    writeAnalysisProject(temporary, { manifest, shards: loaded.shards });
    const second = await readTree(temporary);

    t.deepEqual(second, first);
    t.false(Object.values(first).some((text) => text.includes("romBytes")));
    t.true(Object.values(first).every((text) => !text.includes("a5a5a5a5")));
    t.notThrows(() => validateAnalysisProject(temporary, rom));
    t.is(
      loaded.shards.regions.find((region) => region.id === "region-child")?.parentRegion,
      "region-parent",
    );
    t.throws(() => validateAnalysisProject(temporary, new RomImage(new Uint8Array(0x8000))), {
      message: /ROM identity mismatch/,
    });
    const forbiddenInput = projectFor(rom);
    const forbidden = {
      ...forbiddenInput,
      shards: {
        ...forbiddenInput.shards,
        evidence: [{ ...forbiddenInput.shards.evidence[0], romBytes: [0xa5] }],
      },
    } as unknown as AnalysisProject;
    t.throws(() => writeAnalysisProject(temporary, forbidden), {
      message: /ROM byte payload/,
    });
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("analysis projects reject missing, cyclic, and non-containing region parents", (t) => {
  const rom = new RomImage(new Uint8Array(0x8000));
  const base = projectFor(rom);
  const withRegions = (regions: AnalysisProject["shards"]["regions"]): AnalysisProject => ({
    ...base,
    shards: { ...base.shards, regions },
  });
  t.throws(
    () =>
      writeAnalysisProject(
        "/tmp/uttori-analysis-invalid-parent",
        withRegions([{ ...base.shards.regions[1], parentRegion: "missing" }]),
      ),
    { message: /missing parent region/ },
  );
  t.throws(
    () =>
      writeAnalysisProject(
        "/tmp/uttori-analysis-cyclic-parent",
        withRegions([
          { ...base.shards.regions[0], parentRegion: "region-child" },
          base.shards.regions[1],
        ]),
      ),
    { message: /cyclic parent relationship/ },
  );
  t.throws(
    () =>
      writeAnalysisProject(
        "/tmp/uttori-analysis-outside-parent",
        withRegions([base.shards.regions[0], { ...base.shards.regions[1], start: 1, end: 3 }]),
      ),
    { message: /not contained/ },
  );
});

test("manifest migrations are explicit and never downgrade newer schemas", async (t) => {
  const legacy = JSON.parse(await fs.readFile(path.join(schemaFixtures, "schema-v0.json"), "utf8"));
  const versionOne = JSON.parse(
    await fs.readFile(path.join(schemaFixtures, "schema-v1.json"), "utf8"),
  );
  const current = JSON.parse(
    await fs.readFile(path.join(schemaFixtures, "schema-v2.json"), "utf8"),
  );
  const future = JSON.parse(await fs.readFile(path.join(schemaFixtures, "schema-v3.json"), "utf8"));
  const migrated = migrateManifest(legacy);
  t.is(migrated.schemaVersion, ANALYSIS_PROJECT_SCHEMA_VERSION);
  t.is(migrated.rom.sha256, "1".repeat(64));
  t.is(migrateManifest(versionOne).schemaVersion, ANALYSIS_PROJECT_SCHEMA_VERSION);
  t.is(migrateManifest(current).schemaVersion, ANALYSIS_PROJECT_SCHEMA_VERSION);
  t.throws(() => migrateManifest(future), { message: /refusing to downgrade/ });
  t.is(canonicalJson({ z: 1, a: 2 }), '{\n  "a": 2,\n  "z": 1\n}\n');
});
