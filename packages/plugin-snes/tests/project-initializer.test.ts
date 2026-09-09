import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import {
  commitAnalysisProjectTransaction,
  importRuntimeInstructionTrace,
  loadAnalysisProjectSnapshot,
  mergeRuntimeEvidence,
  RomImage,
  validateSourceExportFiles,
} from "@uttori/asm-disassembler";
import {
  SnesProjectInitializationCancelledError,
  analyzeSnesProject,
  exportSnesProject,
  exportSnes65816Source,
  analyzeSnes65816,
  initializeSnesDisassemblyWorkspace,
  probeSnesProject,
  snesHardwareDefineRecords,
  verifySnesProjectRoundTrip,
} from "../src/index.js";

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
  bytes[0x7ffc] = 0x00;
  bytes[0x7ffd] = 0x80;
  return bytes;
};

test("shared initializer commits a verified workspace with analysis and editor files", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-init-"));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  const stages: string[] = [];
  try {
    await fs.writeFile(romFile, fixtureRom());
    await fs.mkdir(outputDirectory);
    const result = await initializeSnesDisassemblyWorkspace({
      romFile,
      outputDirectory,
      mapper: "lorom",
      workspaceFiles: [
        { path: ".vscode/settings.json", contents: '{"asm.entryPoints":["main.asm"]}\n' },
      ],
      onProgress: ({ stage }) => stages.push(stage),
    });
    t.true(result.roundTrip.comparison.equal);
    t.is(result.project.manifest.mapping.mapper, "lorom");
    t.true(result.analysis.instructions > 0);
    t.true(stages.includes("commit"));
    await fs.stat(path.join(outputDirectory, "main.asm"));
    const main = await fs.readFile(path.join(outputDirectory, "main.asm"), "utf8");
    t.regex(main, /incsrc "snes-defines\.asm"/);
    const defines = await fs.readFile(path.join(outputDirectory, "snes-defines.asm"), "utf8");
    t.regex(defines, /^INIDISP = \$2100 ; Display control:/m);
    t.regex(defines, /^DMAP7 = \$4370 ; DMA\/HDMA channel 7:/m);
    t.regex(defines, /^OBJSEL = \$2101 ; Object size/m);
    t.regex(defines, /^OBSEL = \$2101 ; Legacy alias for OBJSEL/m);
    t.regex(defines, /^M7HOFS = \$210D ; Mode 7 horizontal scroll/m);
    t.regex(defines, /^JOYOUT = \$4016 ; Joypad latch output/m);
    t.regex(defines, /^A1T0L = \$4302 ; DMA\/HDMA channel 0:/m);
    t.regex(defines, /^A1TL0 = \$4302 ; Legacy alias for A1T0L/m);
    t.regex(defines, /^NLTR7 = \$437A ; DMA\/HDMA channel 7:/m);
    t.regex(defines, /^UNUSED7_MIRROR = \$437F ; DMA\/HDMA channel 7:/m);
    t.regex(defines, /^JOY_START = \$1000 ; Controller Start-button bit\.$/m);
    const assignments = defines.split("\n").filter((line) => /^[A-Z][A-Z0-9_]+ = \$/.test(line));
    t.true(assignments.length > snesHardwareDefineRecords().length);
    t.true(
      assignments.every((line) => / ; \S/.test(line)),
      "every generated register and mask has its own hover comment",
    );
    const config = JSON.parse(
      await fs.readFile(path.join(outputDirectory, "uttori-asm.config.json"), "utf8"),
    );
    t.deepEqual(config.entryPoints, ["main.asm"]);
    const bankFiles = await fs.readdir(path.join(outputDirectory, "banks"));
    const bank = await fs.readFile(path.join(outputDirectory, "banks", bankFiles[0]), "utf8");
    t.is((bank.match(/^org /gm) ?? []).length, 1, "contiguous spans share one origin");
    t.regex(bank, /  NOP\n  NOP\n  STP/);
    t.regex(
      bank,
      /SNES_HEADER_TITLE:\n  db "FIXTURE ROM          " ; Cartridge title "FIXTURE ROM"\./,
    );
    t.regex(bank, /SNES_HEADER_MAP_MODE:\n  db \$20 ; SlowROM, LoROM map mode\./);
    t.regex(bank, /SNES_HEADER_CHECKSUM:\n  dw \$1234 ; ROM checksum \(valid pair\)\./);
    t.regex(bank, /SNES_VECTOR_NATIVE_NMI:\n  dw /);
    t.regex(bank, /SNES_VECTOR_EMULATION_RESET:\n  dw \$8000 ; Emulation-mode RESET handler;/);
    t.notRegex(bank, /incbin "\.\.\/assets\/(?:snes-header|vectors)-/);
    await fs.stat(path.join(outputDirectory, "analysis", "analysis.json"));
    await fs.stat(path.join(outputDirectory, "generated-files.json"));
    await fs.stat(path.join(outputDirectory, "build", "rebuilt-content.sfc.debug.json"));
    t.is(
      await fs.readFile(path.join(outputDirectory, ".vscode", "settings.json"), "utf8"),
      '{"asm.entryPoints":["main.asm"]}\n',
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("probe reports ambiguity and initialization never merges into non-empty output", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-init-guard-"));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  try {
    await fs.writeFile(romFile, new Uint8Array(0x8000));
    const probe = probeSnesProject({ romFile });
    t.true(probe.mapperSelectionRequired);
    await fs.mkdir(outputDirectory);
    await fs.writeFile(path.join(outputDirectory, "keep.txt"), "keep\n");
    await t.throwsAsync(
      initializeSnesDisassemblyWorkspace({
        romFile,
        outputDirectory,
        mapper: "lorom",
      }),
      { message: /must be empty/ },
    );
    t.is(await fs.readFile(path.join(outputDirectory, "keep.txt"), "utf8"), "keep\n");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("incomplete reanalysis preserves known code and the saved project", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-analysis-preserve-"));
  t.teardown(() => fs.rm(temporary, { recursive: true, force: true }));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  const bytes = fixtureRom();
  bytes.fill(0, 0x7fe0);
  bytes.set([0x00, 0x80], 0x7ffc);
  await fs.writeFile(romFile, bytes);
  await initializeSnesDisassemblyWorkspace({ romFile, outputDirectory, mapper: "lorom" });
  const projectDirectory = path.join(outputDirectory, "analysis");
  const before = loadAnalysisProjectSnapshot(projectDirectory);

  t.throws(() => analyzeSnesProject({ projectDirectory, romFile, maxWorkItems: 1 }), {
    message: /Incomplete analysis would discard .*known code.*previous analysis was preserved/s,
  });
  const after = loadAnalysisProjectSnapshot(projectDirectory);
  t.deepEqual(after.revision, before.revision);
  t.deepEqual(after.shards, before.shards);
  t.notThrows(() => validateSourceExportFiles(outputDirectory));
  const retry = analyzeSnesProject({ projectDirectory, romFile, maxWorkItems: 100_000 });
  t.is(retry.status, "complete");
  t.true(
    exportSnesProject({ projectDirectory, romFile, sourceDirectory: outputDirectory }).codeBytes >
      0,
  );
});

test("background reanalysis does not overwrite an edit published while it was running", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-analysis-race-"));
  t.teardown(() => fs.rm(temporary, { recursive: true, force: true }));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  const bytes = fixtureRom();
  bytes.fill(0, 0x7fe0);
  bytes.set([0, 0x80], 0x7ffc);
  await fs.writeFile(romFile, bytes);
  await initializeSnesDisassemblyWorkspace({ romFile, outputDirectory, mapper: "lorom" });
  const projectDirectory = path.join(outputDirectory, "analysis");
  let publishedRevision: ReturnType<typeof loadAnalysisProjectSnapshot>["revision"] | undefined;
  t.throws(
    () =>
      analyzeSnesProject({
        projectDirectory,
        romFile,
        onProgress: ({ stage }) => {
          if (stage !== "commit") return;
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
});

test("source export rejects code loss even with net gains or force, unless explicitly allowed", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-export-preserve-"));
  t.teardown(() => fs.rm(temporary, { recursive: true, force: true }));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  const bytes = fixtureRom();
  bytes.fill(0, 0x7fe0);
  bytes.set([0x00, 0x80], 0x7ffc);
  bytes.set([0xea, 0xea, 0xea, 0xea, 0xdb], 0x10);
  await fs.writeFile(romFile, bytes);
  await initializeSnesDisassemblyWorkspace({ romFile, outputDirectory, mapper: "lorom" });
  const before = loadAnalysisProjectSnapshot(path.join(outputDirectory, "analysis"));
  const rom = RomImage.load(romFile);
  const expanded = analyzeSnes65816(rom, "lorom", {
    entryPoints: [{ id: "new-code", address: 0x808010 }],
  });
  const candidate = {
    ...before,
    shards: {
      ...before.shards,
      analysis: expanded.records.filter(
        (record) => record.kind !== "cfg-node" || record.fileOffset !== 1,
      ),
      annotations: expanded.annotations,
    },
  };
  const manifestBefore = await fs.readFile(
    path.join(outputDirectory, "generated-files.json"),
    "utf8",
  );
  for (const force of [false, true]) {
    t.throws(
      () =>
        exportSnes65816Source(candidate, rom, outputDirectory, {
          sourceProjectSha256: "0".repeat(64),
          force,
        }),
      {
        message:
          /replace 1 previously emitted code byte.*\$000001.*adds 5 new code byte.*net change of \+4 byte/s,
      },
    );
    t.is(
      await fs.readFile(path.join(outputDirectory, "generated-files.json"), "utf8"),
      manifestBefore,
    );
    t.notThrows(() => validateSourceExportFiles(outputDirectory));
  }
  const permitted = exportSnes65816Source(candidate, rom, outputDirectory, {
    sourceProjectSha256: "0".repeat(64),
    allowCodeRegression: true,
  });
  t.is(permitted.spans.find((span) => span.start <= 1 && span.end > 1)?.role, "raw");
  t.true(permitted.spans.some((span) => span.start === 0x10 && span.role === "code"));
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
    const initialized = await initializeSnesDisassemblyWorkspace({
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
    t.is(analyzed.omittedRuntimeSeeds, 0);
    const exported = exportSnesProject({
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
    const repeatedExport = exportSnesProject({
      projectDirectory: path.join(outputDirectory, "analysis"),
      sourceDirectory: outputDirectory,
      romFile,
    });
    t.is(repeatedExport.codeBytes, exported.codeBytes);
    const verified = await verifySnesProjectRoundTrip({
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
  bytes.fill(0, 0x7fe0);
  bytes.set([0, 0x80], 0x7ffc);
  bytes.set([0xa9, 1, 0xdb], 0x10);
  bytes.set([0xa9, 2, 0xdb], 0x20);
  await fs.writeFile(romFile, bytes);
  await initializeSnesDisassemblyWorkspace({
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
            details: [Array.from(bytes.subarray(offset, offset + 2)), [0xdb]].map((bytes) => ({
              bytes,
              state: { e: 0, p, db: 0, d: 0 },
            })),
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
    const exported = exportSnesProject({ projectDirectory, sourceDirectory, romFile });
    t.true(exported.codeBytes >= previousCode);
    previousCode = exported.codeBytes;
    t.true(exported.manifest.spans.some((span) => span.role === "code" && span.start === 0x10));
    if (index > 0)
      t.true(exported.manifest.spans.some((span) => span.role === "code" && span.start === 0x20));
    const saved = loadAnalysisProjectSnapshot(projectDirectory);
    t.true(traceIds.every((id) => saved.shards.evidence.some((record) => record.id === id)));
    t.false(
      saved.shards.analysis.some(
        (record) => record.kind === "conflict" && record.conflictKind === "runtime-code-variants",
      ),
    );
  }
  t.true((await verifySnesProjectRoundTrip({ sourceDirectory, romFile })).comparison.equal);
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
    await initializeSnesDisassemblyWorkspace({
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
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    await t.throwsAsync(verifySnesProjectRoundTrip({ sourceDirectory: outputDirectory, romFile }), {
      message: /ram-map\.json.*changed/,
    });

    const exported = exportSnesProject({
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

    const verified = await verifySnesProjectRoundTrip({
      sourceDirectory: outputDirectory,
      romFile,
    });
    t.true(verified.comparison.equal);
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

test("an already-cancelled initialization leaves its selected destination empty", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-snes-init-cancel-"));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  const cancellation = new AbortController();
  try {
    await fs.writeFile(romFile, fixtureRom());
    await fs.mkdir(outputDirectory);
    cancellation.abort();
    const error = await t.throwsAsync(
      initializeSnesDisassemblyWorkspace({
        romFile,
        outputDirectory,
        mapper: "lorom",
        signal: cancellation.signal,
      }),
    );
    t.true(error instanceof SnesProjectInitializationCancelledError);
    t.deepEqual(await fs.readdir(outputDirectory), []);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
