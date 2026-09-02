import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  t.throws(() => parseCliArguments(["disassemble", "game.sfc", "--header-size=1"]), {
    message: "--header-size must be 0 or 512.",
  });
  t.throws(() => parseCliArguments(["analyze", "game.analysis", "--entry=0x1000000"]), {
    message: /24-bit/,
  });
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
