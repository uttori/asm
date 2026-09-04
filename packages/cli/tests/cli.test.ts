import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CRC32, validateDebugMap, type DebugMap } from "@uttori/asm-core";
import { loadAnalysisProject, writeAnalysisProject } from "@uttori/asm-disassembler";
import { test } from "../../../tests/ava-helper.js";
import { parseCliArguments, runCli, usage } from "../src/index.js";

const loaderFixtures = fileURLToPath(
  new URL("../../plugin-loader-node/tests/fixtures/", import.meta.url),
);

test("CLI options parse repeatable plugins, includes, and namespaced values", (t) => {
  const parsed = parseCliArguments([
    "input.asm",
    "--config=project.json",
    "--plugin",
    "first-plugin",
    "--plugin=second-plugin",
    "--target",
    "fixture.target",
    "--architecture=fixture.architecture",
    "--base-image",
    "base.bin",
    "--debug-map",
    "maps/input.debug.json",
    "--include-path=one",
    "--include-path",
    "two",
    "--plugin-option",
    "fixture.plugin:byte=126",
    "--verbose",
  ]);

  t.is(parsed.input, "input.asm");
  t.deepEqual(parsed.plugins, ["first-plugin", "second-plugin"]);
  t.deepEqual(parsed.includePaths, ["one", "two"]);
  t.is(parsed.target, "fixture.target");
  t.is(parsed.architecture, "fixture.architecture");
  t.is(parsed.baseImage, "base.bin");
  t.true(parsed.debug);
  t.is(parsed.debugMap, "maps/input.debug.json");
  t.deepEqual(parsed.pluginOptions, { "fixture.plugin": { byte: 126 } });
  t.true(parsed.verbose);
});

test("CLI parsing rejects malformed or incomplete arguments", (t) => {
  t.throws(() => parseCliArguments(["main.asm", "--target"]), {
    message: "--target requires a value.",
  });
  t.throws(() => parseCliArguments(["main.asm", "--unknown=value"]), {
    message: "Unknown option '--unknown'.",
  });
  t.throws(() => parseCliArguments(["main.asm", "--plugin-option", "broken"]), {
    message: "--plugin-option must use <plugin:key=value> syntax.",
  });
  t.throws(() => parseCliArguments(["one.asm", "one.bin", "extra"]), {
    message: "Unexpected positional argument 'extra'.",
  });
});

test("CLI usage identifies the installed executable", (t) => {
  t.true(usage.startsWith("Usage: uttori-asm "));
  t.true(parseCliArguments(["--help"]).help);
  t.true(parseCliArguments(["main.asm", "--debug"]).debug);
});

test("CLI debug builds emit a fingerprinted map for the assembled binary", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-cli-debug-"));
  const source = path.join(temporary, "main.asm");
  const output = path.join(temporary, "main.bin");
  const mapFile = path.join(temporary, "main.debug.json");
  try {
    await fs.writeFile(source, "norom\norg $000000\ndb $01, $02\n");
    t.is(await runCli(["assemble", source, output, "--debug-map", mapFile]), 0);
    const outputBytes = new Uint8Array(await fs.readFile(output));
    const map = JSON.parse(await fs.readFile(mapFile, "utf8")) as DebugMap;
    t.deepEqual(validateDebugMap(map, outputBytes), []);
    t.is(map.target, "snes.sfc");
    t.is(map.sources[0]?.path, "main.asm");
    t.deepEqual(
      map.ranges.map(({ line, start, end }) => ({ line, start, end })),
      [{ line: 3, start: 0, end: 2 }],
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("CLI parses analysis project commands and validates mapper/header options", (t) => {
  const create = parseCliArguments([
    "disassemble",
    "game.sfc",
    "game.analysis",
    "--mapper=hirom",
    "--header-size",
    "512",
    "--dizraw",
    "game.dizraw",
  ]);
  t.is(create.command, "disassemble");
  t.is(create.mapper, "hirom");
  t.is(create.headerSize, 512);
  t.is(create.dizraw, "game.dizraw");
  const validate = parseCliArguments(["project-validate", "game.analysis", "--rom=game.sfc"]);
  t.is(validate.command, "project-validate");
  t.is(validate.rom, "game.sfc");
  const analyze = parseCliArguments([
    "analyze",
    "game.analysis",
    "--rom=game.sfc",
    "--entry=$808000",
    "--entry=0x818000",
    "--max-work-items=123",
    "--max-call-depth=4",
  ]);
  t.is(analyze.command, "analyze");
  t.deepEqual(analyze.entryPoints, [0x808000, 0x818000]);
  t.is(analyze.maxWorkItems, 123);
  t.is(analyze.maxCallDepth, 4);
  const exportArguments = parseCliArguments([
    "export",
    "game.analysis",
    "game.source",
    "--rom=game.sfc",
    "--force",
  ]);
  t.is(exportArguments.command, "export");
  t.true(exportArguments.force);
  t.is(
    parseCliArguments(["verify-roundtrip", "game.source", "--rom", "game.sfc"]).command,
    "verify-roundtrip",
  );
  const evidence = parseCliArguments([
    "evidence-import",
    "game.analysis",
    "--rom=game.sfc",
    "--mesen-cdl=game.cdl",
    "--mesen-trace=game.trace",
    "--trace-metadata=game.trace.json",
    "--mesen-labels=game.mlb",
    "--instruction-trace=game.uttori-trace.json",
  ]);
  t.is(evidence.command, "evidence-import");
  t.is(evidence.mesenCdl, "game.cdl");
  t.is(evidence.mesenTrace, "game.trace");
  t.is(evidence.traceMetadata, "game.trace.json");
  t.is(evidence.mesenLabels, "game.mlb");
  t.is(evidence.instructionTrace, "game.uttori-trace.json");
  t.is(parseCliArguments(["evidence-report", "game.analysis"]).command, "evidence-report");
  t.is(
    parseCliArguments(["mesen-labels-export", "game.analysis", "game.mlb"]).command,
    "mesen-labels-export",
  );
  t.throws(() => parseCliArguments(["disassemble", "game.sfc", "--header-size=1"]), {
    message: "--header-size must be 0 or 512.",
  });
  t.throws(() => parseCliArguments(["analyze", "game.analysis", "--entry=0x1000000"]), {
    message: /24-bit/,
  });
});

test("CLI imports, reports, reimports, and exports MesenCE offline evidence", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-cli-evidence-"));
  const romFile = path.join(temporary, "fixture.sfc");
  const project = path.join(temporary, "fixture.analysis");
  const cdlFile = path.join(temporary, "fixture.cdl");
  const traceFile = path.join(temporary, "fixture.trace");
  const metadataFile = path.join(temporary, "fixture.trace.json");
  const labelsFile = path.join(temporary, "fixture.mlb");
  const instructionTraceFile = path.join(temporary, "fixture.uttori-trace.json");
  const exportedLabels = path.join(temporary, "exported.mlb");
  const reportFile = path.join(temporary, "evidence.json");
  try {
    const bytes = new Uint8Array(0x8000);
    bytes.set([0xa9, 0x34, 0x12, 0xdb], 0);
    await fs.writeFile(romFile, bytes);
    t.is(await runCli(["disassemble", romFile, project, "--mapper=lorom"]), 0);
    const created = loadAnalysisProject(project);
    const cdl = new Uint8Array(9 + bytes.length);
    cdl.set(new TextEncoder().encode("CDLv2"));
    const crc = CRC32.compute(bytes);
    cdl.set([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, crc >>> 24], 5);
    cdl.set([0x01, 0x01, 0x01, 0x01], 9);
    await fs.writeFile(cdlFile, cdl);
    await fs.writeFile(
      traceFile,
      [
        "808000  LDA #$1234 A:0000 X:0000 Y:0000 S:01FF D:0000 DB:00 P:00 ",
        "808003  STP A:1234 X:0000 Y:0000 S:01FF D:0000 DB:00 P:00 ",
        "",
      ].join("\n"),
    );
    await fs.writeFile(
      metadataFile,
      JSON.stringify({
        schemaVersion: 1,
        architecture: "snes.65816",
        romContentSha256: created.manifest.rom.contentSha256,
        mapper: "lorom",
      }),
    );
    await fs.writeFile(labelsFile, "SnesPrgRom:0000:TraceEntry:Imported\\nlabel\n");
    await fs.writeFile(
      instructionTraceFile,
      JSON.stringify({
        format: "uttori-asm-instruction-trace",
        schemaVersion: 1,
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        romContentSha256: created.manifest.rom.contentSha256,
        producer: { id: "cli-test", revision: "fixture" },
        chunks: [
          {
            sequenceStart: 1,
            addresses: [0x808000, 0x808003],
            droppedEvents: 0,
            active: false,
          },
        ],
      }),
    );

    const importArguments = [
      "evidence-import",
      project,
      "--rom",
      romFile,
      "--mesen-cdl",
      cdlFile,
      "--mesen-trace",
      traceFile,
      "--trace-metadata",
      metadataFile,
      "--mesen-labels",
      labelsFile,
      "--instruction-trace",
      instructionTraceFile,
    ];
    t.is(await runCli(importArguments), 0);
    const imported = loadAnalysisProject(project);
    t.true(imported.shards.runtime.length > 0);
    t.true(imported.shards.annotations.some((annotation) => annotation.state?.m === false));
    t.true(imported.shards.labels.some((label) => label.name === "TraceEntry"));
    const manifestBefore = await fs.readFile(path.join(project, "analysis.json"), "utf8");
    const runtimeBefore = await fs.readFile(path.join(project, "analysis/runtime.json"), "utf8");
    t.is(await runCli(importArguments), 0);
    t.is(await fs.readFile(path.join(project, "analysis.json"), "utf8"), manifestBefore);
    t.is(await fs.readFile(path.join(project, "analysis/runtime.json"), "utf8"), runtimeBefore);

    t.is(await runCli(["evidence-report", project, reportFile]), 0);
    const report = JSON.parse(await fs.readFile(reportFile, "utf8")) as {
      readonly runtimeRecords: number;
      readonly explanations: readonly unknown[];
    };
    t.true(report.runtimeRecords > 0);
    t.true(report.explanations.length > 0);
    t.is(await runCli(["mesen-labels-export", project, exportedLabels, "--rom", romFile]), 0);
    t.regex(await fs.readFile(exportedLabels, "utf8"), /SnesPrgRom:0000:TraceEntry/);

    t.is(await runCli(["analyze", project, "--rom", romFile]), 0);
    const analyzed = loadAnalysisProject(project);
    const wide = analyzed.shards.analysis.find(
      (record) => record.kind === "cfg-node" && record.address === 0x808000,
    );
    t.like(wide, { kind: "cfg-node", size: 3, mnemonic: "LDA" });
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("CLI creates and validates a hash-gated analysis project", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-cli-analysis-"));
  const rom = path.join(temporary, "fixture.sfc");
  const project = path.join(temporary, "fixture.analysis");
  try {
    await fs.writeFile(rom, new Uint8Array(0x8000).fill(0xea));
    t.is(await runCli(["disassemble", rom, project, "--mapper=lorom"]), 0);
    const manifest = JSON.parse(await fs.readFile(path.join(project, "analysis.json"), "utf8")) as {
      readonly addressSpaces: readonly { readonly id: string; readonly addressBits: number }[];
    };
    t.true(
      manifest.addressSpaces.some(
        (addressSpace) => addressSpace.id === "snes.spc700.aram" && addressSpace.addressBits === 16,
      ),
    );
    t.is(await runCli(["project-validate", project, "--rom", rom]), 0);
    await fs.writeFile(rom, new Uint8Array(0x8000));
    t.is(await runCli(["project-validate", project, "--rom", rom]), 1);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("CLI persists conservative 65816 analysis without embedding ROM bytes", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-cli-static-"));
  const rom = path.join(temporary, "fixture.sfc");
  const project = path.join(temporary, "fixture.analysis");
  try {
    const bytes = new Uint8Array(0x8000);
    bytes[0] = 0xdb;
    bytes[0x7ffc] = 0x00;
    bytes[0x7ffd] = 0x80;
    await fs.writeFile(rom, bytes);
    t.is(await runCli(["disassemble", rom, project, "--mapper=lorom"]), 0);
    t.is(await runCli(["analyze", project, "--rom", rom]), 0);
    const records = JSON.parse(
      await fs.readFile(path.join(project, "analysis/control-flow.json"), "utf8"),
    ) as Array<{ readonly kind: string; readonly mnemonic?: string }>;
    t.true(records.some((record) => record.kind === "cfg-node" && record.mnemonic === "STP"));
    t.true(records.some((record) => record.kind === "summary"));
    t.false(JSON.stringify(records).includes("romBytes"));
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("CLI exports deterministic native source and verifies a complete copier-header round trip", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-cli-export-"));
  const rom = path.join(temporary, "fixture.smc");
  const project = path.join(temporary, "fixture.analysis");
  const source = path.join(temporary, "fixture.source");
  const secondSource = path.join(temporary, "fixture-second.source");
  try {
    const bytes = new Uint8Array(0x8000 + 512).fill(0xff);
    bytes.fill(0x5a, 0, 512);
    bytes[512] = 0xa9;
    bytes[513] = 0x42;
    bytes[514] = 0xdb;
    bytes[512 + 0x7ffc] = 0x00;
    bytes[512 + 0x7ffd] = 0x80;
    await fs.writeFile(rom, bytes);
    t.is(await runCli(["disassemble", rom, project, "--mapper=lorom", "--header-size=512"]), 0);
    t.is(await runCli(["analyze", project, "--rom", rom]), 0);
    const analyzed = loadAnalysisProject(project);
    const { shards: ignoredShards, ...projectManifest } = analyzed.manifest;
    void ignoredShards;
    writeAnalysisProject(project, {
      manifest: projectManifest,
      shards: {
        ...analyzed.shards,
        labels: [
          {
            id: "test:entry-label",
            addressSpace: "snes.cpu",
            address: 0x008000,
            name: "Entry Point!",
            comment: "Synthetic reset entry",
            evidence: [],
          },
        ],
        comments: [
          {
            id: "test:stop-comment",
            addressSpace: "rom.file",
            address: 2,
            text: "Stop after loading the fixture value.",
            evidence: [],
          },
        ],
      },
    });
    t.is(await runCli(["export", project, source, "--rom", rom]), 0);
    t.is(await runCli(["export", project, secondSource, "--rom", rom]), 0);
    t.is(
      await fs.readFile(path.join(source, "generated-files.json"), "utf8"),
      await fs.readFile(path.join(secondSource, "generated-files.json"), "utf8"),
    );
    const manifest = JSON.parse(
      await fs.readFile(path.join(source, "generated-files.json"), "utf8"),
    ) as {
      readonly spans: ReadonlyArray<{
        readonly start: number;
        readonly end: number;
        readonly role: string;
      }>;
    };
    t.is(
      manifest.spans
        .filter((span) => span.role !== "copier-header")
        .reduce((total, span) => total + span.end - span.start, 0),
      0x8000,
    );
    t.true(manifest.spans.some((span) => span.role === "code"));
    t.true(manifest.spans.some((span) => span.role === "snes-header"));
    t.true(manifest.spans.some((span) => span.role === "vectors"));
    const contentSpans = manifest.spans.filter((span) => span.role !== "copier-header");
    for (let index = 0; index < contentSpans.length; index++) {
      t.is(contentSpans[index].start, index === 0 ? 0 : contentSpans[index - 1].end);
    }
    const main = await fs.readFile(path.join(source, "main.asm"), "utf8");
    const bank = await fs.readFile(path.join(source, "banks/bank-000.asm"), "utf8");
    t.regex(main, /lorom\narch 65816\n\.smart off/);
    t.regex(bank, /; Synthetic reset entry\nL_Entry_Point_:/);
    t.regex(bank, /\.a8\n\.i8\nLDA\.b #\$42/);
    t.regex(bank, /; Stop after loading the fixture value\./);
    t.is(await runCli(["verify-roundtrip", source, "--rom", rom]), 0);
    const rebuilt = await fs.readFile(path.join(source, "build/rebuilt.sfc"));
    t.deepEqual(rebuilt, Buffer.from(bytes));

    await fs.appendFile(path.join(source, "main.asm"), "; local edit\n");
    t.is(await runCli(["export", project, source, "--rom", rom]), 1);
    t.is(await runCli(["export", project, source, "--rom", rom, "--force"]), 0);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("CLI round trips the redistributable SNES dummy-ROM fixture", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-cli-fixture-export-"));
  const rom = path.resolve("fixtures/asar/dummy_rom.sfc");
  const project = path.join(temporary, "dummy.analysis");
  const source = path.join(temporary, "dummy.source");
  try {
    t.is(await runCli(["disassemble", rom, project, "--mapper=lorom"]), 0);
    t.is(await runCli(["analyze", project, "--rom", rom]), 0);
    t.is(await runCli(["export", project, source, "--rom", rom]), 0);
    t.is(await runCli(["verify-roundtrip", source, "--rom", rom]), 0);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("a configured SNES project builds through the CLI package", async (t) => {
  const project = path.join(loaderFixtures, "snes-project");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-cli-configured-"));
  const output = path.join(temporary, "main.sfc");
  try {
    const exitCode = await runCli([
      path.join(project, "main.asm"),
      output,
      "--config",
      path.join(project, "uttori-asm.config.json"),
      "--verbose",
    ]);
    t.is(exitCode, 0);
    const bytes = await fs.readFile(output);
    t.is(bytes[0], 0x42);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("the CLI host default uses the target output extension when output is omitted", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-asm-cli-default-"));
  const input = path.join(temporary, "default.asm");
  const output = path.join(temporary, "default.sfc");
  try {
    await fs.writeFile(input, "lorom\norg $008000\ndb $73\n");
    const exitCode = await runCli([input]);
    t.is(exitCode, 0);
    const bytes = await fs.readFile(output);
    t.is(bytes[0], 0x73);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
