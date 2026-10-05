import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  commitAnalysisProjectTransaction,
  importRuntimeInstructionTrace,
  loadAnalysisProjectSnapshot,
  mergeRuntimeEvidence,
  openAnalysisProjectStore,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  initializeAnalysisFixture,
  renderAnalysisFixture,
  verifyRenderedFixture,
} from "../../../tests/helpers/source-render-fixture.js";
import {
  analyzeSnesProject,
  SnesProjectInitializationCancelledError,
  probeSnesProject,
} from "../src/index.js";

/** Small LoROM with a reset entry and no interrupt handlers outside the tested code. */
const fixtureRom = (): Uint8Array => {
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes.set([0xea, 0xea, 0xdb]);
  bytes.fill(0x20, 0x7fc0, 0x7fc0 + 0x15);
  bytes.set(new TextEncoder().encode("FIXTURE ROM"), 0x7fc0);
  bytes[0x7fc0 + 0x15] = 0x20;
  bytes[0x7fc0 + 0x17] = 0x05;
  bytes[0x7fc0 + 0x1c] = 0xcb;
  bytes[0x7fc0 + 0x1d] = 0xed;
  bytes[0x7fc0 + 0x1e] = 0x34;
  bytes[0x7fc0 + 0x1f] = 0x12;
  // NOP padding would turn unused vectors into $EAEA entry points and analyze unrelated padding.
  bytes.fill(0, 0x7fe0);
  bytes[0x7ffc] = 0x00;
  bytes[0x7ffd] = 0x80;
  return bytes;
};

test("reanalysis retires role comments while preserving adopted metadata and runtime provenance", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-role-retirement-"));
  t.teardown(() => fs.rm(temporary, { recursive: true, force: true }));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  await fs.writeFile(romFile, fixtureRom());
  await initializeAnalysisFixture({ romFile, outputDirectory, mapper: "lorom" });
  const projectDirectory = path.join(outputDirectory, "analysis");
  const before = loadAnalysisProjectSnapshot(projectDirectory);
  const roleIds = ["unused-role", "adopted-role", "runtime-role"];
  commitAnalysisProjectTransaction(projectDirectory, before.revision, {
    manifest: before.manifest,
    shards: {
      ...before.shards,
      evidence: [
        ...before.shards.evidence,
        ...roleIds.map((id) => ({
          id,
          source: "detector" as const,
          sourceId: "snes.function-roles.v1",
          confidence: "medium" as const,
        })),
      ],
      comments: [
        ...before.shards.comments,
        {
          id: "heuristic:snes:unused",
          addressSpace: "snes.cpu",
          address: 0x8000,
          text: "old generated role",
          evidence: ["unused-role"],
        },
        {
          id: "manual-role-comment",
          addressSpace: "snes.cpu",
          address: 0x8000,
          text: "[medium heuristic: graphics] user note",
          evidence: ["adopted-role"],
        },
      ],
      runtime: [
        ...before.shards.runtime,
        {
          id: "retained-runtime-role",
          kind: "runtime-execution",
          architecture: "snes.65816",
          addressSpace: "snes.cpu",
          address: 0x8000,
          count: 1,
          evidence: ["runtime-role"],
        },
      ],
    },
  });
  const config = path.join(projectDirectory, "heuristics.json");
  await fs.writeFile(config, "malformed inert configuration");
  const staged = loadAnalysisProjectSnapshot(projectDirectory);
  const cancelled = new AbortController();
  t.throws(
    () =>
      analyzeSnesProject({
        projectDirectory,
        romFile,
        signal: cancelled.signal,
        onProgress: ({ stage }) => {
          if (stage === "commit") {
            cancelled.abort();
          }
        },
      }),
    { instanceOf: SnesProjectInitializationCancelledError },
  );
  t.is(
    loadAnalysisProjectSnapshot(projectDirectory).revision.manifestSha256,
    staged.revision.manifestSha256,
  );

  const result = analyzeSnesProject({ projectDirectory, romFile });
  t.false("heuristicRoles" in result);
  const cleaned = loadAnalysisProjectSnapshot(projectDirectory);
  t.false(cleaned.shards.comments.some(({ id }) => id.startsWith("heuristic:snes:")));
  t.true(cleaned.shards.comments.some(({ id }) => id === "manual-role-comment"));
  t.false(cleaned.shards.evidence.some(({ id }) => id === "unused-role"));
  t.true(cleaned.shards.evidence.some(({ id }) => id === "adopted-role"));
  t.true(cleaned.shards.evidence.some(({ id }) => id === "runtime-role"));
  t.true(cleaned.shards.runtime.some(({ id }) => id === "retained-runtime-role"));
  t.is(await fs.readFile(config, "utf8"), "malformed inert configuration");
  analyzeSnesProject({ projectDirectory, romFile });
  t.deepEqual(
    loadAnalysisProjectSnapshot(projectDirectory).shards.comments,
    cleaned.shards.comments,
  );
  const store = openAnalysisProjectStore(projectDirectory);
  try {
    t.true(store.callGraph().functions.length > 0);
  } finally {
    store.close();
  }
  renderAnalysisFixture({ projectDirectory, sourceDirectory: outputDirectory, romFile });
  t.true(
    (await verifyRenderedFixture({ sourceDirectory: outputDirectory, romFile })).comparison.equal,
  );
});

test("probe reports ambiguous mapping without selecting a mapper", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-probe-"));
  t.teardown(() => fs.rm(temporary, { recursive: true, force: true }));
  const romFile = path.join(temporary, "fixture.sfc");
  await fs.writeFile(romFile, new Uint8Array(0x8000));
  t.true(probeSnesProject({ romFile }).mapperSelectionRequired);
});

test("incomplete reanalysis preserves known code and the saved project", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-analysis-preserve-"));
  t.teardown(() => fs.rm(temporary, { recursive: true, force: true }));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  const bytes = fixtureRom();
  await fs.writeFile(romFile, bytes);
  await initializeAnalysisFixture({ romFile, outputDirectory, mapper: "lorom" });
  const projectDirectory = path.join(outputDirectory, "analysis");
  const before = loadAnalysisProjectSnapshot(projectDirectory);

  t.throws(() => analyzeSnesProject({ projectDirectory, romFile, maxWorkItems: 1 }), {
    message: /Incomplete analysis would discard .*known code.*previous analysis was preserved/s,
  });
  const after = loadAnalysisProjectSnapshot(projectDirectory);
  t.deepEqual(after.revision, before.revision);
  t.deepEqual(after.shards, before.shards);
  const retry = analyzeSnesProject({ projectDirectory, romFile, maxWorkItems: 1_000_000 });
  t.is(retry.status, "complete");
  t.true(
    renderAnalysisFixture({ projectDirectory, romFile, sourceDirectory: outputDirectory })
      .codeBytes > 0,
  );
});

test("background reanalysis does not overwrite an edit published while it was running", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-analysis-race-"));
  t.teardown(() => fs.rm(temporary, { recursive: true, force: true }));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  const bytes = fixtureRom();
  await fs.writeFile(romFile, bytes);
  await initializeAnalysisFixture({ romFile, outputDirectory, mapper: "lorom" });
  const projectDirectory = path.join(outputDirectory, "analysis");
  const legacy = loadAnalysisProjectSnapshot(projectDirectory);
  commitAnalysisProjectTransaction(projectDirectory, legacy.revision, {
    manifest: legacy.manifest,
    shards: {
      ...legacy.shards,
      evidence: [
        ...legacy.shards.evidence,
        {
          id: "legacy-role",
          source: "detector",
          sourceId: "snes.function-roles.v1",
          confidence: "medium",
        },
      ],
      comments: [
        ...legacy.shards.comments,
        {
          id: "heuristic:snes:legacy",
          addressSpace: "snes.cpu",
          address: 0x8000,
          text: "legacy role",
          evidence: ["legacy-role"],
        },
      ],
    },
  });
  let publishedRevision: ReturnType<typeof loadAnalysisProjectSnapshot>["revision"] | undefined;
  t.throws(
    () =>
      analyzeSnesProject({
        projectDirectory,
        romFile,
        onProgress: ({ stage }) => {
          if (stage !== "commit") {
            return;
          }
          const snapshot = loadAnalysisProjectSnapshot(projectDirectory);
          const labels = [
            ...snapshot.shards.labels,
            {
              id: "concurrent-label",
              addressSpace: "snes.cpu",
              address: 0x8000,
              name: "KeepConcurrentEdit",
              evidence: [],
            },
          ];
          publishedRevision = commitAnalysisProjectTransaction(
            projectDirectory,
            snapshot.revision,
            {
              manifest: snapshot.manifest,
              shards: { ...snapshot.shards, labels },
            },
          ).revision;
        },
      }),
    { name: "AnalysisProjectStaleError" },
  );
  const saved = loadAnalysisProjectSnapshot(projectDirectory);
  t.deepEqual(saved.revision, publishedRevision);
  t.true(saved.shards.labels.some((label) => label.name === "KeepConcurrentEdit"));
  t.true(saved.shards.comments.some(({ id }) => id === "heuristic:snes:legacy"));
  t.true(saved.shards.evidence.some(({ id }) => id === "legacy-role"));
});

test("runtime-observed PCs seed analysis and increase measurable native-source coverage", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-trace-update-"));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  try {
    const bytes = fixtureRom();
    bytes.set([0xea, 0x8d, 0x00, 0x21, 0xdb], 0x10);
    await fs.writeFile(romFile, bytes);
    await fs.mkdir(outputDirectory);
    const initialized = await initializeAnalysisFixture({
      romFile,
      outputDirectory,
      mapper: "lorom",
    });
    const snapshot = loadAnalysisProjectSnapshot(path.join(outputDirectory, "analysis"));
    const imported = importRuntimeInstructionTrace(
      {
        format: "uttori-asm-instruction-trace",
        schemaVersion: 1,
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        romContentSha256: initialized.project.probe.rom.contentSha256,
        producer: { id: "test-emulator", revision: "1" },
        chunks: [
          {
            sequenceStart: 1,
            addresses: [0x808010, 0x808011, 0x808014],
            droppedEvents: 0,
            active: false,
          },
        ],
      },
      {
        projectRomContentSha256: initialized.project.probe.rom.contentSha256,
        sourceName: "observed.trace.json",
      },
    );
    const merged = mergeRuntimeEvidence(snapshot.shards, imported.batch);
    commitAnalysisProjectTransaction(path.join(outputDirectory, "analysis"), snapshot.revision, {
      manifest: snapshot.manifest,
      shards: merged.shards,
    });
    const analyzed = analyzeSnesProject({
      projectDirectory: path.join(outputDirectory, "analysis"),
      romFile,
      entryPoints: [
        {
          id: "runtime-808010",
          address: 0x808010,
          kind: "observation",
          evidence: imported.batch.evidence?.map(({ id }) => id),
        },
      ],
    });
    t.is(analyzed.runtimeSeeds, 3);
    t.true(analyzed.addedCode.some((range) => range.start <= 0x10 && range.end > 0x10));
    t.true(
      analyzed.addedCode.every(
        (range) => range.addressSpace === "snes.cpu" && range.recordIds.length > 0,
      ),
    );
    t.is(analyzed.omittedRuntimeSeeds, 0);
    const exported = renderAnalysisFixture({
      projectDirectory: path.join(outputDirectory, "analysis"),
      sourceDirectory: outputDirectory,
      romFile,
    });
    t.true(exported.codeBytes > initialized.source.codeBytes);
    const bank = await fs.readFile(path.join(outputDirectory, "banks", "bank-000.asm"), "utf8");
    t.regex(
      bank,
      /  NOP\n  STA\.w \$2100\n  STP/,
      "PC-only observations do not establish DBR or prove a hardware-register address",
    );
    t.notRegex(bank, /Fn_80801[014]/, "runtime PCs are not guessed function boundaries");
    const repeated = analyzeSnesProject({
      projectDirectory: path.join(outputDirectory, "analysis"),
      romFile,
    });
    t.is(repeated.runtimeSeeds, 3, "persisted runtime facts remain analysis seeds");
    t.deepEqual(
      repeated.addedCode,
      [],
      "reanalysis never recounts already decoded ROM bytes as import gains",
    );
    const repeatedExport = renderAnalysisFixture({
      projectDirectory: path.join(outputDirectory, "analysis"),
      sourceDirectory: outputDirectory,
      romFile,
    });
    t.is(repeatedExport.codeBytes, exported.codeBytes);
    const verified = await verifyRenderedFixture({
      sourceDirectory: outputDirectory,
      romFile,
    });
    t.true(verified.comparison.equal);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("separate captures accumulate code and compatible CPU-state changes do not remove prior source", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-trace-union-"));
  t.teardown(() => fs.rm(temporary, { recursive: true, force: true }));
  const romFile = path.join(temporary, "fixture.sfc");
  const sourceDirectory = path.join(temporary, "workspace");
  const bytes = fixtureRom();
  bytes.set([0xa9, 1, 0xdb], 0x10);
  bytes.set([0xa9, 2, 0xdb], 0x20);
  await fs.writeFile(romFile, bytes);
  await initializeAnalysisFixture({
    romFile,
    outputDirectory: sourceDirectory,
    mapper: "lorom",
  });
  const projectDirectory = path.join(sourceDirectory, "analysis");
  const traceIds: string[] = [];
  let previousCode = 0;
  for (const [index, [offset, p]] of [
    [0x10, 0x30],
    [0x20, 0x30],
    [0x10, 0x20],
  ].entries()) {
    const snapshot = loadAnalysisProjectSnapshot(projectDirectory);
    const imported = importRuntimeInstructionTrace(
      {
        format: "uttori-asm-instruction-trace",
        schemaVersion: 1,
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        romContentSha256: snapshot.manifest.rom.contentSha256,
        producer: { id: "test", revision: "1" },
        chunks: [
          {
            sequenceStart: 1,
            addresses: [0x808000 + offset, 0x808002 + offset],
            droppedEvents: 0,
            active: false,
            details: [Array.from(bytes.subarray(offset, offset + 2)), [0xdb]].map(
              (instructionBytes) => ({
                bytes: instructionBytes,
                state: { e: 0, p, db: 0, d: 0 },
              }),
            ),
          },
        ],
      },
      {
        projectRomContentSha256: snapshot.manifest.rom.contentSha256,
        sourceName: `capture-${index}.json`,
      },
    );
    traceIds.push(...(imported.batch.evidence ?? []).map(({ id }) => id));
    const merged = mergeRuntimeEvidence(snapshot.shards, imported.batch);
    commitAnalysisProjectTransaction(projectDirectory, snapshot.revision, {
      manifest: snapshot.manifest,
      shards: merged.shards,
    });
    analyzeSnesProject({ projectDirectory, romFile });
    const exported = renderAnalysisFixture({ projectDirectory, sourceDirectory, romFile });
    t.true(exported.codeBytes >= previousCode);
    previousCode = exported.codeBytes;
    t.true(exported.manifest.spans.some((span) => span.role === "code" && span.start === 0x10));
    if (index > 0) {
      t.true(exported.manifest.spans.some((span) => span.role === "code" && span.start === 0x20));
    }
    const saved = loadAnalysisProjectSnapshot(projectDirectory);
    t.true(traceIds.every((id) => saved.shards.evidence.some((record) => record.id === id)));
    t.false(
      saved.shards.analysis.some(
        (record) => record.kind === "conflict" && record.conflictKind === "runtime-code-variants",
      ),
    );
  }
  t.true((await verifyRenderedFixture({ sourceDirectory, romFile })).comparison.equal);
});

test("RAM-map edits regenerate documented definitions and symbolic disassembly operands", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-ram-map-"));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  try {
    const bytes = fixtureRom();
    bytes.set([0xaf, 0x47, 0x18, 0x7e, 0xdb]);
    await fs.writeFile(romFile, bytes);
    await fs.mkdir(outputDirectory);
    await initializeAnalysisFixture({
      romFile,
      outputDirectory,
      mapper: "lorom",
    });

    await fs.writeFile(
      path.join(outputDirectory, "ram-map.json"),
      `${JSON.stringify(
        {
          $schema: "./ram-map.schema.json",
          format: "uttori-asm-snes-ram-map",
          schemaVersion: 1,
          source: "Test fixture",
          variables: [
            {
              name: "RAM_RING_MENU_MODE",
              address: "$7E1847",
              category: "Menu",
              description: "Selects the active ring-menu mode.",
              notes: ["menu.txt:L12."],
              sources: ["Menu capture frame 42."],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    // Ordinary builds remain valid while a research recipe waits for regeneration.
    t.true(
      (await verifyRenderedFixture({ sourceDirectory: outputDirectory, romFile })).comparison.equal,
    );

    const exported = renderAnalysisFixture({
      projectDirectory: path.join(outputDirectory, "analysis"),
      sourceDirectory: outputDirectory,
      romFile,
    });
    t.is(exported.manifest.inputs?.find((input) => input.path === "ram-map.json")?.records, 1);
    const main = await fs.readFile(path.join(outputDirectory, "main.asm"), "utf8");
    t.regex(main, /incsrc "ram-defines\.asm"/);
    const defines = await fs.readFile(path.join(outputDirectory, "ram-defines.asm"), "utf8");
    t.regex(
      defines,
      /^RAM_RING_MENU_MODE = \$7E1847 ; Menu — Selects the active ring-menu mode\.$/m,
    );
    const bank = await fs.readFile(path.join(outputDirectory, "banks", "bank-000.asm"), "utf8");
    t.regex(bank, /LDA\.l RAM_RING_MENU_MODE/);
    await fs.stat(path.join(outputDirectory, "ram-map.schema.json"));

    const verified = await verifyRenderedFixture({
      sourceDirectory: outputDirectory,
      romFile,
    });
    t.true(verified.comparison.equal);
    // The persisted option must reach the renderer on later CLI/editor regenerations.
    const mapFile = path.join(outputDirectory, "ram-map.json");
    const ramMap = JSON.parse(await fs.readFile(mapFile, "utf8"));
    ramMap.includeSourceInformation = true;
    await fs.writeFile(mapFile, JSON.stringify(ramMap));
    renderAnalysisFixture({
      projectDirectory: path.join(outputDirectory, "analysis"),
      sourceDirectory: outputDirectory,
      romFile,
    });
    const withSources = await fs.readFile(path.join(outputDirectory, "ram-defines.asm"), "utf8");
    t.regex(
      withSources,
      /^; Menu — Selects the active ring-menu mode\. menu\.txt:L12\. Menu capture frame 42\.\nRAM_RING_MENU_MODE = \$7E1847$/m,
    );
    t.true(
      (await verifyRenderedFixture({ sourceDirectory: outputDirectory, romFile })).comparison.equal,
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("shared probe accepts the local Secret of Mana DizRaw fixture when available", async (t) => {
  const dizRawFile = path.resolve("secret-of-mana", "Secret of Mana (USA).dizraw");
  try {
    await fs.stat(dizRawFile);
  } catch {
    t.pass("local test-only fixture is not present");
    return;
  }
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-init-som-"));
  const romFile = path.join(temporary, "secret-of-mana-fixture.sfc");
  try {
    await fs.writeFile(romFile, new Uint8Array(0x200000));
    const probe = probeSnesProject({
      romFile,
      dizRawFile,
      mapper: "hirom",
      headerSize: 0,
    });
    t.is(probe.dizRaw?.mapping.mapper, "hirom");
    t.is(probe.dizRaw?.metadataBytes, 0x200000);
    t.false(probe.mapperSelectionRequired);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
