import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { test } from "../../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  loadAnalysisProject,
  parseAnalysisProjectManifest,
  validateAnalysisProject,
  publishAnalysisProject,
  type AnalysisProject,
} from "../../src/index.js";

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
        classification: "asset",
        architecture: "fixture.architecture",
        asset: {
          codecId: "fixture.game.asset",
          codecVersion: "2.1.0",
          provider: { pluginId: "fixture.game-plugin", pluginVersion: "3.0.0" },
          options: { count: 1 },
          compression: {
            codecId: "fixture.game.rle",
            codecVersion: "1.0.0",
            provider: { pluginId: "fixture.game-plugin", pluginVersion: "3.0.0" },
            maximumSize: 2,
            bankStart: 0,
            bankEnd: 0x8000,
            fillByte: 0xff,
          },
        },
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
    runtime: [],
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

const schemaFixtures = fileURLToPath(new URL("../fixtures", import.meta.url));

test("large SQLite payloads round trip without changing validation", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-large-shard-"));
  try {
    const project = projectFor(new RomImage(new Uint8Array(0x8000)));
    const evidence = [{ ...project.shards.evidence[0], note: "x".repeat(9 * 1024 * 1024) }];
    publishAnalysisProject(temporary, { ...project, shards: { ...project.shards, evidence } });
    const loaded = loadAnalysisProject(temporary);
    t.deepEqual(loaded.shards.evidence, evidence);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("analysis projects preserve deterministic records without ROM bytes", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-store-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000).fill(0xa5));
    const input = projectFor(rom);
    publishAnalysisProject(temporary, input);
    const first = loadAnalysisProject(temporary).shards;
    const loaded = loadAnalysisProject(temporary);
    const { shards: ignored, ...manifest } = loaded.manifest;
    void ignored;
    publishAnalysisProject(temporary, { manifest, shards: loaded.shards });
    const second = loadAnalysisProject(temporary).shards;

    t.deepEqual(second, first);
    t.false(JSON.stringify(first).includes("romBytes"));
    t.false(JSON.stringify(first).includes("a5a5a5a5"));
    t.notThrows(() => validateAnalysisProject(temporary, rom));
    t.is(
      loaded.shards.regions.find((region) => region.id === "region-child")?.parentRegion,
      "region-parent",
    );
    t.is(loaded.shards.annotations[0].asset?.codecId, "fixture.game.asset");
    t.throws(() => validateAnalysisProject(temporary, new RomImage(new Uint8Array(0x8000))), {
      message: /ROM identity mismatch/,
    });
    const forbiddenInput = projectFor(rom);
    const evidence = { ...forbiddenInput.shards.evidence[0]! };
    Object.assign(evidence, { romBytes: [0xa5] });
    const forbidden = {
      ...forbiddenInput,
      shards: {
        ...forbiddenInput.shards,
        evidence: [evidence],
      },
    };
    t.throws(() => publishAnalysisProject(temporary, forbidden), {
      message: /ROM byte payload/,
    });
    const nestedEvidence = { ...forbiddenInput.shards.evidence[0]! };
    Object.assign(nestedEvidence, { extra: [0, null, { nested: { byteData: [] } }] });
    const nested = {
      ...forbiddenInput,
      shards: {
        ...forbiddenInput.shards,
        evidence: [nestedEvidence],
      },
    };
    t.throws(() => publishAnalysisProject(temporary, nested), {
      message: /shards\.evidence\[0]\.extra\[2]\.nested\.byteData/,
    });
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("analysis projects validate versioned plugin codec annotations", (t) => {
  const rom = new RomImage(new Uint8Array(0x8000));
  const base = projectFor(rom);
  const withAnnotation = (annotation: AnalysisProject["shards"]["annotations"][number]) => ({
    ...base,
    shards: { ...base.shards, annotations: [annotation] },
  });
  t.throws(
    () =>
      publishAnalysisProject(
        "/tmp/uttori-analysis-invalid-codec-id",
        withAnnotation({
          ...base.shards.annotations[0],
          asset: { codecId: "bad id", codecVersion: "1" },
        }),
      ),
    { message: /invalid codec id/ },
  );
  t.throws(
    () =>
      publishAnalysisProject(
        "/tmp/uttori-analysis-invalid-codec-classification",
        withAnnotation({ ...base.shards.annotations[0], classification: "data16" }),
      ),
    { message: /cannot attach an asset codec/ },
  );
  t.throws(
    () =>
      publishAnalysisProject(
        "/tmp/uttori-analysis-invalid-compression-capacity",
        withAnnotation({
          ...base.shards.annotations[0],
          asset: {
            ...base.shards.annotations[0].asset!,
            compression: {
              codecId: "fixture.game.rle",
              codecVersion: "1",
              maximumSize: 3,
            },
          },
        }),
      ),
    { message: /maximumSize must be within its range/ },
  );
  t.throws(
    () =>
      publishAnalysisProject(
        "/tmp/uttori-analysis-invalid-codec-options",
        withAnnotation({
          ...base.shards.annotations[0],
          asset: { ...base.shards.annotations[0].asset!, options: { invalid: Number.NaN } },
        }),
      ),
    { message: /not a JSON-safe codec option/ },
  );
});

test("analysis projects validate normalized runtime records and artifact identity", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-runtime-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000));
    const base = projectFor(rom);
    const evidence = {
      id: "runtime-fixture",
      source: "runtime" as const,
      sourceId: "fixture",
      confidence: "certain" as const,
      artifact: {
        format: "fixture",
        sha256: "a".repeat(64),
        romContentSha256: rom.identity.contentSha256,
        mapper: "fixture",
      },
    };
    const runtime = {
      id: "runtime-execution",
      kind: "runtime-execution" as const,
      architecture: "fixture.architecture",
      addressSpace: "rom.file",
      address: 0,
      fileOffset: 0,
      size: 1,
      opcode: 0xea,
      count: 1,
      evidence: [evidence.id],
    };
    const valid: AnalysisProject = {
      ...base,
      shards: {
        ...base.shards,
        runtime: [runtime],
        evidence: [...base.shards.evidence, evidence],
      },
    };
    publishAnalysisProject(temporary, valid);
    t.is(loadAnalysisProject(temporary).shards.runtime.length, 1);
    t.throws(
      () =>
        publishAnalysisProject(temporary, {
          ...valid,
          shards: { ...valid.shards, runtime: [{ ...runtime, count: 0 }] },
        }),
      { message: /observation count/ },
    );
    t.throws(
      () =>
        publishAnalysisProject(temporary, {
          ...valid,
          shards: { ...valid.shards, runtime: [{ ...runtime, fileOffset: rom.length }] },
        }),
      { message: /ROM file offset/ },
    );
    t.throws(
      () =>
        publishAnalysisProject(temporary, {
          ...valid,
          shards: {
            ...valid.shards,
            evidence: [
              ...base.shards.evidence,
              {
                ...evidence,
                artifact: { ...evidence.artifact, romContentSha256: "b".repeat(64) },
              },
            ],
          },
        }),
      { message: /different ROM/ },
    );
    t.throws(
      () =>
        publishAnalysisProject(temporary, {
          ...valid,
          shards: {
            ...valid.shards,
            evidence: [
              ...base.shards.evidence,
              { ...evidence, artifact: { ...evidence.artifact, mapper: "other-mapper" } },
            ],
          },
        }),
      { message: /different mapper/ },
    );
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
      publishAnalysisProject(
        "/tmp/uttori-analysis-invalid-parent",
        withRegions([{ ...base.shards.regions[1], parentRegion: "missing" }]),
      ),
    { message: /missing parent region/ },
  );
  t.throws(
    () =>
      publishAnalysisProject(
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
      publishAnalysisProject(
        "/tmp/uttori-analysis-outside-parent",
        withRegions([base.shards.regions[0], { ...base.shards.regions[1], start: 1, end: 3 }]),
      ),
    { message: /not contained/ },
  );
});

test("mixed-architecture records retain distinct validated address-space identities", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-analysis-address-spaces-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000));
    const base = projectFor(rom);
    const mixed: AnalysisProject = {
      ...base,
      manifest: {
        ...base.manifest,
        addressSpaces: [
          ...base.manifest.addressSpaces,
          { id: "snes.cpu", name: "SNES CPU", addressBits: 24, kind: "cpu" },
          { id: "snes.spc700.aram", name: "SPC700 ARAM", addressBits: 16, kind: "memory" },
          { id: "snes.superfx.rom", name: "SuperFX ROM", addressBits: 24, kind: "memory" },
        ],
      },
      shards: {
        ...base.shards,
        labels: [
          {
            id: "label-cpu",
            addressSpace: "snes.cpu",
            address: 0x8000,
            name: "CpuCode",
            evidence: ["manual-1"],
          },
          {
            id: "label-spc",
            addressSpace: "snes.spc700.aram",
            address: 0x8000,
            name: "SpcCode",
            evidence: ["manual-1"],
          },
          {
            id: "label-superfx",
            addressSpace: "snes.superfx.rom",
            address: 0x8000,
            name: "SuperFxCode",
            evidence: ["manual-1"],
          },
        ],
      },
    };
    publishAnalysisProject(temporary, mixed);
    const loaded = loadAnalysisProject(temporary);
    t.deepEqual(
      loaded.shards.labels.map((label) => `${label.addressSpace}:${label.address}`),
      ["snes.cpu:32768", "snes.spc700.aram:32768", "snes.superfx.rom:32768"],
    );

    t.throws(
      () =>
        publishAnalysisProject(temporary, {
          ...mixed,
          shards: {
            ...mixed.shards,
            labels: [{ ...mixed.shards.labels[0], addressSpace: "missing.space" }],
          },
        }),
      { message: /unknown address space/ },
    );
    t.throws(
      () =>
        publishAnalysisProject(temporary, {
          ...mixed,
          manifest: {
            ...mixed.manifest,
            addressSpaces: [...mixed.manifest.addressSpaces, mixed.manifest.addressSpaces[0]],
          },
        }),
      { message: /Duplicate analysis address-space/ },
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("manifest validation rejects obsolete storage and never downgrades newer schemas", async (t) => {
  const legacy = JSON.parse(await fs.readFile(path.join(schemaFixtures, "schema-v0.json"), "utf8"));
  const versionOne = JSON.parse(
    await fs.readFile(path.join(schemaFixtures, "schema-v1.json"), "utf8"),
  );
  const current = JSON.parse(
    await fs.readFile(path.join(schemaFixtures, "schema-v2.json"), "utf8"),
  );
  const future = JSON.parse(await fs.readFile(path.join(schemaFixtures, "schema-v3.json"), "utf8"));
  for (const obsolete of [legacy, versionOne, current, future]) {
    t.throws(() => parseAnalysisProjectManifest(obsolete));
  }
  t.throws(
    () =>
      parseAnalysisProjectManifest({
        ...future,
        schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION + 1,
      }),
    { message: /Refusing to downgrade/ },
  );
  t.is(canonicalJson({ z: 1, a: 2 }), '{\n  "a": 2,\n  "z": 1\n}\n');
  t.is(
    canonicalJson({
      z: 1,
      skipped: undefined,
      n: Number.NaN,
      a: [true, undefined, { z: "x", a: null }],
    }),
    '{\n  "a": [\n    true,\n    null,\n    {\n      "a": null,\n      "z": "x"\n    }\n  ],\n  "n": null,\n  "z": 1\n}\n',
  );
});
