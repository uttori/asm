import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateDebugMap, type DebugMap } from "@uttori/asm-core";
import {
  loadAnalysisProject,
  openAnalysisProjectStore,
  RomImage,
  publishAnalysisProject,
  type AnalysisProject,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { parseCliArguments, runCli } from "../src/index.js";
import { publishOutputFiles } from "../src/output-files.js";

const loaderFixtures = fileURLToPath(
  new URL("../../plugin-loader-node/tests/fixtures/", import.meta.url),
);
const fixturePlugin = path.join(loaderFixtures, "relative-plugin.mjs");
const invalidPlugin = path.join(loaderFixtures, "invalid-export.mjs");

const temporaryDirectory = async (
  t: { teardown: (fn: () => void | Promise<void>) => void },
  prefix: string,
): Promise<string> => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.teardown(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
};

const captureConsole = (t: { teardown: (fn: () => void) => void }) => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const { log, error, warn } = console;
  console.log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  };
  console.warn = (...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  };
  t.teardown(() => {
    console.log = log;
    console.error = error;
    console.warn = warn;
  });
  return { stdout, stderr };
};

const loromRom = (mutate?: (bytes: Uint8Array) => void): Uint8Array => {
  const bytes = new Uint8Array(0x8000);
  bytes.set([0xea, 0xea, 0xdb]);
  bytes[0x7ffc] = 0x00;
  bytes[0x7ffd] = 0x80;
  mutate?.(bytes);
  return bytes;
};

const emptyShards = (): AnalysisProject["shards"] => ({
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  evidence: [],
  imports: [],
  runtime: [],
});

const instructionTrace = (romContentSha256: string, revision = "fixture"): string =>
  JSON.stringify({
    format: "uttori-asm-instruction-trace",
    schemaVersion: 1,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256,
    producer: { id: "cli-test", revision },
    chunks: [
      {
        sequenceStart: 1,
        addresses: [0x808000, 0x808001, 0x808002],
        droppedEvents: 0,
        active: false,
      },
    ],
  });

test("parseCliArguments: parses repeatable plugins, includes, and namespaced values", (t) => {
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
    "--plugin-option",
    "fixture.plugin:flag=true",
    "--plugin-option",
    "fixture.plugin:name=plain",
    "--plugin-option",
    "fixture.plugin:byte=127",
    "--verbose",
    "--debug",
  ]);

  t.is(parsed.command, "assemble");
  t.is(parsed.input, "input.asm");
  t.deepEqual(parsed.plugins, ["first-plugin", "second-plugin"]);
  t.deepEqual(parsed.includePaths, ["one", "two"]);
  t.is(parsed.target, "fixture.target");
  t.is(parsed.architecture, "fixture.architecture");
  t.is(parsed.baseImage, "base.bin");
  t.true(parsed.debug);
  t.is(parsed.debugMap, "maps/input.debug.json");
  t.deepEqual(parsed.pluginOptions, {
    "fixture.plugin": { byte: 127, flag: true, name: "plain" },
  });
  t.true(parsed.verbose);
  t.true(Object.isFrozen(parsed.plugins));
  t.true(Object.isFrozen(parsed.includePaths));
  t.true(Object.isFrozen(parsed.pluginOptions));
  t.true(Object.isFrozen(parsed.entryPoints));
});

test("parseCliArguments: treats -- as the start of positional paths", (t) => {
  const literal = parseCliArguments(["assemble", "--", "--source.asm", "result.sfc"]);
  t.is(literal.command, "assemble");
  t.is(literal.input, "--source.asm");
  t.is(literal.output, "result.sfc");
  t.true(parseCliArguments(["--help"]).help);
  t.true(parseCliArguments(["main.asm", "--debug"]).debug);
  t.is(parseCliArguments(["main.asm", "--debug"]).debugMap, undefined);
});

test("parseCliArguments: rejects malformed, incomplete, and inapplicable arguments", (t) => {
  t.throws(() => parseCliArguments(["main.asm", "--target"]), {
    message: "--target requires a value.",
  });
  t.throws(() => parseCliArguments(["main.asm", "--target="]), {
    message: "--target requires a value.",
  });
  t.throws(() => parseCliArguments(["main.asm", "--target", "--verbose"]), {
    message: "--target requires a value.",
  });
  t.throws(() => parseCliArguments(["main.asm", "--unknown=value"]), {
    message: "Unknown option '--unknown'.",
  });
  t.throws(() => parseCliArguments(["--unknown"]), { message: "Unknown option '--unknown'." });
  t.throws(() => parseCliArguments(["main.asm", "--plugin-option", "broken"]), {
    message: "--plugin-option must use <plugin:key=value> syntax.",
  });
  t.throws(() => parseCliArguments(["main.asm", "--plugin-option", ":k=v"]), {
    message: "--plugin-option must use <plugin:key=value> syntax.",
  });
  t.throws(() => parseCliArguments(["main.asm", "--plugin-option", "p:=v"]), {
    message: "--plugin-option must use <plugin:key=value> syntax.",
  });
  t.throws(() => parseCliArguments(["one.asm", "one.bin", "extra"]), {
    message: "Unexpected positional argument 'extra'.",
  });
  t.throws(() => parseCliArguments(["analyze", "project", "ignored", "--rom", "rom.sfc"]), {
    message: /Unexpected positional argument 'ignored'/,
  });
  t.throws(() => parseCliArguments(["analyze", "project", "--debug"]), {
    message: /--debug.*not supported.*analyze/,
  });
  t.throws(() => parseCliArguments(["disassemble", "game.sfc", "--verbose"]), {
    message: /--verbose.*not supported.*disassemble/,
  });
  for (const flag of ["--debug", "--verbose", "--help"]) {
    t.throws(() => parseCliArguments(["main.asm", `${flag}=false`]), { message: /takes no value/ });
  }
});

test("parseCliArguments: parses analysis project commands and validates mapper/header options", (t) => {
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
  t.is(parseCliArguments(["disassemble", "game.sfc", "--header-size=0"]).headerSize, 0);
  t.is(parseCliArguments(["disassemble", "game.sfc", "--mapper=norom"]).mapper, "norom");
  const validate = parseCliArguments(["project-validate", "game.analysis", "--rom=game.sfc"]);
  t.is(validate.command, "project-validate");
  t.is(validate.rom, "game.sfc");
  t.is(parseCliArguments(["project-compact", "game.analysis"]).command, "project-compact");
  const analyze = parseCliArguments([
    "analyze",
    "game.analysis",
    "--rom=game.sfc",
    "--entry=$808000",
    "--entry=0x818000",
    "--entry=16711680",
    "--max-work-items=123",
    "--max-call-depth=0",
  ]);
  t.is(analyze.command, "analyze");
  t.deepEqual(analyze.entryPoints, [0x808000, 0x818000, 16_711_680]);
  t.is(analyze.maxWorkItems, 123);
  t.is(analyze.maxCallDepth, 0);
  t.throws(() => parseCliArguments(["disassemble", "game.sfc", "--header-size=1"]), {
    message: "--header-size must be 0 or 512.",
  });
  t.throws(() => parseCliArguments(["disassemble", "game.sfc", "--mapper=fastrom"]), {
    message: /--mapper must be one of/,
  });
  t.throws(() => parseCliArguments(["analyze", "game.analysis", "--entry=0x1000000"]), {
    message: /24-bit/,
  });
  t.throws(() => parseCliArguments(["analyze", "game.analysis", "--entry=nope"]), {
    message: /24-bit/,
  });
  t.throws(() => parseCliArguments(["analyze", "game.analysis", "--max-work-items=0"]), {
    message: "--max-work-items must be a positive integer.",
  });
  t.throws(() => parseCliArguments(["analyze", "game.analysis", "--max-work-items=1.5"]), {
    message: "--max-work-items must be a positive integer.",
  });
  t.throws(() => parseCliArguments(["analyze", "game.analysis", "--max-call-depth=-1"]), {
    message: "--max-call-depth must be a non-negative integer.",
  });
});

test("parseCliArguments: parses evidence and storage flags", (t) => {
  const evidence = parseCliArguments([
    "evidence-import",
    "game.analysis",
    "--rom=game.sfc",
    "--instruction-trace=game.uttori-trace.json",
    "--trace-max-mib=4096",
    "--trace-index=full",
    "--cache-max-mib=1",
    "--storage-max-mib=8",
  ]);
  t.is(evidence.command, "evidence-import");
  t.is(evidence.instructionTrace, "game.uttori-trace.json");
  t.is(evidence.traceMaxMiB, 4096);
  t.is(evidence.traceIndex, "full");
  t.deepEqual(evidence.storagePolicy, {
    cacheMaxBytes: 1024 ** 2,
    databaseMaxBytes: 8 * 1024 ** 2,
  });
  t.is(parseCliArguments(["evidence-import", "p", "--trace-index=full"]).traceIndex, "full");
  for (const mode of ["65816-analysis", "65816-disassembly", "sample"]) {
    t.throws(
      () => parseCliArguments(["evidence-import", "game.analysis", `--trace-index=${mode}`]),
      {
        message: "--trace-index must be full.",
      },
    );
  }
  t.throws(() => parseCliArguments(["evidence-import", "game.analysis", "--trace-max-mib=0"]), {
    message: /positive integer/,
  });
  t.throws(() => parseCliArguments(["evidence-import", "game.analysis", "--trace-max-mib=1.5"]), {
    message: /positive integer/,
  });
  t.throws(
    () => parseCliArguments(["evidence-import", "game.analysis", "--trace-max-mib=8589934592"]),
    { message: /positive integer/ },
  );
  t.is(
    parseCliArguments(["evidence-report", "game.analysis", "report.json"]).output,
    "report.json",
  );
  const storage = parseCliArguments([
    "project-storage",
    "game.analysis",
    "--cache-max-mib=7",
    "--storage-max-mib=3",
  ]);
  t.is(storage.command, "project-storage");
  t.deepEqual(storage.storagePolicy, {
    cacheMaxBytes: 7 * 1024 ** 2,
    databaseMaxBytes: 3 * 1024 ** 2,
  });
  t.throws(() => parseCliArguments(["project-storage", "p", "--cache-max-mib=-1"]), {
    message: /nonnegative safe integer/,
  });
  t.throws(() => parseCliArguments(["project-storage", "p", "--storage-max-mib=invalid"]), {
    message: /nonnegative safe integer/,
  });
});

test("publishOutputFiles: stages artifacts, creates parents, and replaces regular files", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-cli-publish-");
  const nested = path.join(temporary, "new build", "out.bin");
  const text = path.join(temporary, "note.txt");
  publishOutputFiles(
    [
      { file: nested, contents: new Uint8Array([1, 2, 3]) },
      { file: text, contents: "hello" },
    ],
    [],
  );
  t.deepEqual([...(await fs.readFile(nested))], [1, 2, 3]);
  t.is(await fs.readFile(text, "utf8"), "hello");
  await fs.chmod(nested, 0o640);
  publishOutputFiles([{ file: nested, contents: new Uint8Array([9]) }], []);
  t.deepEqual([...(await fs.readFile(nested))], [9]);
  t.is((await fs.stat(nested)).mode & 0o777, 0o640);
});

test("publishOutputFiles: refuses to overwrite inputs, aliases, or non-files", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-cli-publish-guard-");
  const source = path.join(temporary, "source.asm");
  const output = path.join(temporary, "out.bin");
  const directory = path.join(temporary, "dir");
  await fs.writeFile(source, "keep");
  await fs.writeFile(output, "previous");
  await fs.mkdir(directory);
  t.throws(() => publishOutputFiles([{ file: source, contents: "x" }], [source]), {
    message: /overwrite an input file/,
  });
  t.throws(
    () =>
      publishOutputFiles(
        [
          { file: output, contents: "a" },
          { file: output, contents: "b" },
        ],
        [],
      ),
    { message: /must be distinct/ },
  );
  t.throws(() => publishOutputFiles([{ file: directory, contents: "x" }], []), {
    message: /is not a regular file/,
  });
  const alias = path.join(temporary, "alias.asm");
  await fs.link(source, alias);
  t.throws(() => publishOutputFiles([{ file: alias, contents: "x" }], [source]), {
    message: /overwrite an input file/,
  });
  t.is(await fs.readFile(source, "utf8"), "keep");
  t.is(await fs.readFile(output, "utf8"), "previous");
});

test.serial("E2E: runCli reports usage, parse errors, and missing inputs", async (t) => {
  const logs = captureConsole(t);
  t.is(await runCli(["--help"]), 0);
  t.true(logs.stdout.join("\n").includes("Usage: uttori-asm "));
  t.is(await runCli([]), 1);
  t.true(logs.stderr.join("\n").includes("Usage: uttori-asm "));
  t.is(await runCli(["assemble"]), 1);
  t.is(await runCli(["--unknown"]), 1);
  t.true(logs.stderr.join("\n").includes("Unknown option '--unknown'."));
});

test.serial(
  "E2E: runCli assemble reports missing files, plugin errors, and syntax failures",
  async (t) => {
    const temporary = await temporaryDirectory(t, "uttori-cli-assemble-errors-");
    const logs = captureConsole(t);
    const source = path.join(temporary, "main.asm");
    const output = path.join(temporary, "main.sfc");
    t.is(await runCli([source, output]), 1);
    t.true(logs.stderr.join("\n").includes("Input file"));
    await fs.writeFile(source, "norom\norg $000000\ndb $42\n");
    t.is(await runCli([source, output, "--plugin", path.join(temporary, "missing-plugin.mjs")]), 1);
    t.true(logs.stderr.join("\n").includes("PLUGIN_MODULE_NOT_FOUND"));
    t.is(await runCli([source, output, "--plugin", invalidPlugin]), 1);
    t.true(logs.stderr.join("\n").includes("PLUGIN_INVALID_EXPORT"));
    t.is(await runCli([source, output, "--target", "nope.sfc"]), 1);
    t.regex(logs.stderr.join("\n"), /PLUGIN_TARGET_INVALID|Unknown configured target/);
    await fs.writeFile(source, "this_is_not_an_instruction\n");
    t.is(await runCli([source, output]), 1);
    t.true(logs.stderr.join("\n").includes("Compilation failed:"));
    t.is(await runCli([source, output, "--config", path.join(temporary, "missing.json")]), 1);
  },
);

test("E2E: runCli assemble validates every destination before replacing existing files", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-cli-output-safety-");
  const source = path.join(temporary, "main.asm");
  const output = path.join(temporary, "result.sfc");
  const mapDirectory = path.join(temporary, "map-directory");
  const text = "norom\norg $000000\ndb $42\n";
  await fs.writeFile(source, text);
  await fs.writeFile(output, "previous output");
  await fs.mkdir(mapDirectory);
  t.is(await runCli([source, output, "--debug-map", mapDirectory]), 1);
  t.is(await fs.readFile(output, "utf8"), "previous output");
  t.is(await runCli([source, output, "--debug-map", source]), 1);
  t.is(await fs.readFile(source, "utf8"), text);
  t.is(await fs.readFile(output, "utf8"), "previous output");
  t.is(await runCli([source, source]), 1);
  t.is(await fs.readFile(source, "utf8"), text);
  t.is(await runCli([source, output, "--debug-map", output]), 1);
  t.is(await fs.readFile(output, "utf8"), "previous output");
  const sourceAlias = path.join(temporary, "source-alias.asm");
  await fs.link(source, sourceAlias);
  t.is(await runCli([source, sourceAlias]), 1);
  t.is(await fs.readFile(source, "utf8"), text);
  const config = path.join(temporary, "project.json");
  const configText = JSON.stringify({
    plugins: [{ module: "@uttori/asm-plugin-snes" }],
    target: "snes.sfc",
  });
  await fs.writeFile(config, configText);
  t.is(await runCli([source, config, "--config", config]), 1);
  t.is(await fs.readFile(config, "utf8"), configText);
  const nested = path.join(temporary, "new build", "result.sfc");
  t.is(await runCli([source, nested, "--debug"]), 0);
  t.deepEqual([...(await fs.readFile(nested))], [0x42]);
  t.true((await fs.stat(`${nested}.debug.json`)).isFile());
});

test("E2E: CLI includeAsset rebuilds changed PNG inputs", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-cli-asset-");
  const source = path.join(temporary, "main.asm");
  const image = path.join(temporary, "title.png");
  const output = path.join(temporary, "main.sfc");
  await fs.copyFile(
    new URL("../../assets/tests/fixtures/colored-4bpp.png", import.meta.url),
    image,
  );
  await fs.writeFile(source, 'norom\norg 0\nincludeAsset("title.png", "4bpp")\nEnd:\ndb $42\n');
  t.is(await runCli([source, output]), 0);
  const first = await fs.readFile(output);
  t.is(first.length, 129);
  t.is(first.at(-1), 0x42);
  await fs.copyFile(
    new URL("../../assets/tests/fixtures/indexed-2bpp.png", import.meta.url),
    image,
  );
  t.is(await runCli([source, output]), 0);
  const second = await fs.readFile(output);
  t.is(second.length, 129);
  t.not(first.toString("hex"), second.toString("hex"));
});

test("E2E: documented PNG, palette, tilemap and WAVE source assembles", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-cli-asset-guide-");
  const source = new URL("../../plugin-snes/examples/include-assets.asm", import.meta.url).pathname;
  const output = path.join(temporary, "example.sfc");
  t.is(await runCli([source, output, "--debug"]), 0);
  const bytes = await fs.readFile(output);
  t.is(bytes.length, 354);
  const map = JSON.parse(await fs.readFile(`${output}.debug.json`, "utf8")) as DebugMap;
  t.deepEqual(validateDebugMap(map, bytes), []);
  t.deepEqual(map.sources.filter((entry) => entry.kind === "binary").length, 2);
  t.deepEqual(map.sources.filter((entry) => entry.kind === "resource").length, 1);
});

test("E2E: CLI plugin adds a lossless asset transform to the standard SNES target", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-cli-transform-");
  const source = path.join(temporary, "main.asm");
  const plugin = path.join(temporary, "transform.mjs");
  const output = path.join(temporary, "main.sfc");
  await fs.writeFile(path.join(temporary, "payload.bin"), Uint8Array.from([0, 1, 255]));
  await fs.writeFile(
    source,
    'norom\norg 0\nincludeAsset("payload.bin", "raw", compress: "example.xor")\n',
  );
  await fs.writeFile(
    plugin,
    `export default {
  manifest: { id: "example.cli-transform", name: "CLI transform", version: "1.0.0", apiVersion: 1 },
  activate(context) {
    context.registerAssetTransform({
      id: "example.xor", version: "1.0.0", targets: ["snes.sfc"],
      encode: (bytes) => bytes.map((byte) => byte ^ 255),
      decode: (bytes) => bytes.map((byte) => byte ^ 255),
    });
  },
};`,
  );
  t.is(
    await runCli([
      source,
      output,
      "--plugin",
      "@uttori/asm-plugin-snes",
      "--plugin",
      plugin,
      "--target",
      "snes.sfc",
    ]),
    0,
  );
  t.deepEqual([...(await fs.readFile(output))], [255, 254, 0]);
});

test("E2E: runCli assemble debug builds emit a fingerprinted map for the assembled binary", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-asm-cli-debug-");
  const source = path.join(temporary, "main.asm");
  const output = path.join(temporary, "main.bin");
  const mapFile = path.join(temporary, "main.debug.json");
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
});

test("E2E: debug snapshots include definitions and binary dependencies without emitted source ranges", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-cli-editor-dependencies-");
  const source = path.join(temporary, "main.asm");
  const output = path.join(temporary, "main.bin");
  await fs.writeFile(path.join(temporary, "defines.asm"), "COUNTER = $7E002B\n");
  await fs.writeFile(path.join(temporary, "payload.bin"), new Uint8Array([0xaa]));
  await fs.writeFile(
    source,
    'norom\norg 0\nincsrc "defines.asm"\nLDA.w COUNTER & $FFFF,x\nincbin "payload.bin"\n',
  );
  t.is(await runCli([source, output, "--debug"]), 0);
  const outputBytes = new Uint8Array(await fs.readFile(output));
  const map = JSON.parse(await fs.readFile(`${output}.debug.json`, "utf8")) as DebugMap;
  t.deepEqual([...outputBytes], [0xbd, 0x2b, 0, 0xaa]);
  t.deepEqual(validateDebugMap(map, outputBytes), []);
  t.deepEqual(map.sources.map((entry) => entry.path).sort(), [
    "defines.asm",
    "main.asm",
    "payload.bin",
  ]);
  t.is(map.instructions?.[0].operands[0].value, 0x2b);
});

test("E2E: runCli assemble base-image patches preserve untouched bytes and can extend the image", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-cli-patch-");
  const source = path.join(temporary, "patch.asm");
  const baseFile = path.join(temporary, "base.sfc");
  const output = path.join(temporary, "patched.sfc");
  // Cross the legacy fixture bootstrap's 512 KiB boundary and leave gaps around both writes.
  const base = Buffer.alloc(0x80003, 0xa5);
  await fs.writeFile(baseFile, base);
  await fs.writeFile(source, "norom\norg $000001\ndb $42\norg $080005\ndb $43\n");
  t.is(await runCli([source, output, "--base-image", baseFile]), 0);
  const expected = Buffer.alloc(0x80006);
  base.copy(expected);
  expected[1] = 0x42;
  expected[0x80005] = 0x43;
  t.true((await fs.readFile(output)).equals(expected));
  t.true((await fs.readFile(baseFile)).equals(base));
  t.is(await runCli([source, baseFile, "--base-image", baseFile]), 0);
  t.true((await fs.readFile(baseFile)).equals(expected));
});

test("E2E: runCli assemble uses a configured SNES project and the host default extension", async (t) => {
  const project = path.join(loaderFixtures, "snes-project");
  const temporary = await temporaryDirectory(t, "uttori-asm-cli-configured-");
  const output = path.join(temporary, "main.sfc");
  t.is(
    await runCli([
      path.join(project, "main.asm"),
      output,
      "--config",
      path.join(project, "uttori-asm.config.json"),
      "--verbose",
    ]),
    0,
  );
  t.is((await fs.readFile(output))[0], 0x42);
  const input = path.join(temporary, "default.asm");
  await fs.writeFile(input, "lorom\norg $008000\ndb $73\n");
  t.is(await runCli([input]), 0);
  t.is((await fs.readFile(path.join(temporary, "default.sfc")))[0], 0x73);
});

test.serial(
  "E2E: runCli assemble loads an explicit plugin, architecture, include path, and option",
  async (t) => {
    const temporary = await temporaryDirectory(t, "uttori-cli-plugin-assemble-");
    const logs = captureConsole(t);
    const includes = path.join(temporary, "inc");
    await fs.mkdir(includes);
    await fs.writeFile(path.join(includes, "payload.asm"), "fix\n");
    const source = path.join(temporary, "main.asm");
    const output = path.join(temporary, "out.bin");
    await fs.writeFile(source, 'org 0\nincsrc "payload.asm"\n');
    t.is(
      await runCli([
        source,
        output,
        "--plugin",
        fixturePlugin,
        "--target",
        "loader.fixture-target",
        "--architecture",
        "loader.fixture-architecture",
        "--include-path",
        includes,
        "--plugin-option",
        "loader.fixture-plugin:byte=126",
        "--verbose",
      ]),
      0,
    );
    t.deepEqual([...(await fs.readFile(output))], [126]);
    t.true(logs.stdout.join("\n").includes("loader.fixture-plugin"));
    t.true(logs.stdout.join("\n").includes("loader.fixture-target"));
  },
);

test.serial(
  "E2E: runCli assemble still returns 1 when session disposal fails after a successful write",
  async (t) => {
    const temporary = await temporaryDirectory(t, "uttori-cli-dispose-");
    const logs = captureConsole(t);
    const plugin = path.join(temporary, "dispose-plugin.mjs");
    await fs.writeFile(
      plugin,
      `const plugin = {
  manifest: { id: "cli.dispose-plugin", name: "CLI dispose plugin", version: "1.0.0", apiVersion: 1 },
  activate(context) {
    context.registerArchitecture({
      id: "cli.dispose-architecture",
      displayName: "CLI dispose architecture",
      unknownInstructionBehavior: "throw",
      splitOperands: (text) => (text ? [text] : []),
      classifyOperand: ({ operands }, operand) => operands.lowerOperand(operand),
      createEncoder: ({ emission }) => ({
        estimateSize: () => 1,
        encode: () => {
          emission.writeByte(1);
          return true;
        },
      }),
      instructions: [{ mnemonic: "EMIT", summary: "Emit 1.", modes: [{ mode: "implied", syntax: "", size: 1 }] }],
    });
    context.registerAddressSpace({
      id: "cli.dispose-address-space",
      create: () => ({
        addressWidth: 16,
        defaultOrigin: 0,
        normalizeForWrite: (address) => address,
        advance: (address, amount) => address + amount,
        toOutputOffset: (address) => address,
        fromOutputOffset: (offset) => offset,
      }),
    });
    context.registerOutputFormat({
      id: "cli.dispose-output",
      create: () => ({
        finalize: () => undefined,
        getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
      }),
    });
    context.registerLifecycle({
      id: "cli.dispose-lifecycle",
      create: () => ({
        onSessionDispose() {
          throw new Error("session cleanup failed");
        },
      }),
    });
    context.registerTarget({
      id: "cli.dispose-target",
      displayName: "CLI dispose target",
      defaultArchitecture: "cli.dispose-architecture",
      architectures: ["cli.dispose-architecture"],
      addressSpace: "cli.dispose-address-space",
      outputFormat: "cli.dispose-output",
      directiveSets: [],
      expressionSets: [],
      lifecycle: ["cli.dispose-lifecycle"],
      defaultOutputExtension: ".bin",
    });
  },
};
export default plugin;
`,
    );
    const source = path.join(temporary, "main.asm");
    const output = path.join(temporary, "out.bin");
    await fs.writeFile(source, "org 0\nemit\n");
    t.is(await runCli([source, output, "--plugin", plugin, "--target", "cli.dispose-target"]), 1);
    t.deepEqual([...(await fs.readFile(output))], [1]);
    t.true(logs.stdout.join("\n").includes("Success: Output written"));
    t.true(logs.stderr.join("\n").includes("Command failed:"));
    t.true(logs.stderr.join("\n").includes("failed to dispose"));
  },
);

test.serial(
  "E2E: runCli disassemble creates projects, defaults the output path, and reports collisions",
  async (t) => {
    const temporary = await temporaryDirectory(t, "uttori-cli-disassemble-");
    const logs = captureConsole(t);
    const rom = path.join(temporary, "fixture.sfc");
    const project = path.join(temporary, "custom.analysis");
    await fs.writeFile(rom, loromRom());
    t.is(await runCli(["disassemble", path.join(temporary, "missing.sfc")]), 1);
    t.true(logs.stderr.join("\n").includes("ROM file"));
    t.is(await runCli(["disassemble", rom, "--mapper=lorom"]), 0);
    t.true((await fs.stat(path.join(temporary, "fixture.analysis", "analysis.json"))).isFile());
    t.is(await runCli(["disassemble", rom, project, "--mapper=lorom", "--header-size=0"]), 0);
    t.is(await runCli(["disassemble", rom, project, "--mapper=lorom"]), 1);
    t.true(logs.stderr.join("\n").includes("already contains an analysis project"));
    const occupied = path.join(temporary, "occupied");
    await fs.mkdir(occupied);
    await fs.writeFile(path.join(occupied, "keep.txt"), "keep");
    t.is(await runCli(["disassemble", rom, occupied, "--mapper=lorom"]), 1);
    t.deepEqual(await fs.readdir(occupied), ["keep.txt"]);
  },
);

test.serial("E2E: runCli disassemble imports .dizraw metadata into a new project", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-cli-dizraw-");
  const logs = captureConsole(t);
  const rom = path.join(temporary, "fixture.sfc");
  const dizraw = path.join(temporary, "fixture.dizraw");
  const project = path.join(temporary, "fixture.analysis");
  await fs.writeFile(rom, loromRom());
  await fs.writeFile(
    dizraw,
    `<?xml version="1.0" encoding="utf-8"?>
<ProjectXmlSerializer-Root SaveVersion="104" Watermark="DiztinGUIsh">
  <Project InternalRomGameName="Fixture" InternalCheckSum="1">
    <LogWriterSettings Format="fixture" />
    <ProjectSettings />
    <Data RomMapMode="LoRom" RomSpeed="SlowRom">
      <Labels>
        <sys:Item Key="8421376"><Value Name="Reset" Comment="entry" /></sys:Item>
      </Labels>
      <Comments></Comments>
      <RomBytes>
version:201,compress_groupblocks
r 32768 U
      </RomBytes>
    </Data>
  </Project>
</ProjectXmlSerializer-Root>`,
  );
  t.is(await runCli(["disassemble", rom, project, "--mapper=lorom", "--dizraw", dizraw]), 0);
  t.true(logs.stdout.join("\n").includes("unsupported field group"));
  t.true(loadAnalysisProject(project).shards.labels.some((label) => label.name === "Reset"));
});

test("E2E: runCli project-validate accepts matching ROMs and rejects identity drift", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-asm-cli-analysis-");
  const rom = path.join(temporary, "fixture.sfc");
  const project = path.join(temporary, "fixture.analysis");
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
  t.is(await runCli(["project-validate", project]), 0);
  t.is(await runCli(["project-validate", project, "--rom", rom]), 0);
  t.deepEqual(JSON.parse(await fs.readFile(path.join(project, "analysis.json"), "utf8")), manifest);
  await fs.writeFile(rom, new Uint8Array(0x8000));
  t.is(await runCli(["project-validate", project, "--rom", rom]), 1);
  const corrupt = path.join(temporary, "corrupt");
  await fs.mkdir(corrupt);
  await fs.writeFile(path.join(corrupt, "analysis.json"), "{");
  t.is(await runCli(["project-validate", corrupt]), 1);
});

test.serial(
  "E2E: runCli project-compact and project-storage inspect, pin, and expire captures",
  async (t) => {
    const temporary = await temporaryDirectory(t, "uttori-cli-storage-");
    const logs = captureConsole(t);
    const rom = path.join(temporary, "fixture.sfc");
    const project = path.join(temporary, "fixture.analysis");
    const traceFile = path.join(temporary, "capture.json");
    const bytes = loromRom();
    await fs.writeFile(rom, bytes);
    t.is(await runCli(["disassemble", rom, project, "--mapper=lorom"]), 0);
    t.is(await runCli(["project-compact", project]), 0);
    t.true(logs.stdout.join("\n").includes("compacted analysis storage"));
    t.is(await runCli(["project-compact", path.join(temporary, "missing")]), 1);
    const created = loadAnalysisProject(project);
    await fs.writeFile(traceFile, instructionTrace(created.manifest.rom.contentSha256));
    t.is(
      await runCli([
        "evidence-import",
        project,
        "--rom",
        rom,
        "--instruction-trace",
        traceFile,
        "--cache-max-mib=1",
      ]),
      0,
    );
    const store = openAnalysisProjectStore(project);
    const captures = store.captureCatalog() as Array<{ sha256: string }>;
    store.close();
    t.true(captures.length > 0);
    t.is(await runCli(["project-storage", project, "--cache-max-mib=2"]), 0);
    t.true(logs.stdout.join("\n").includes('"cacheMaxBytes": 2097152'));
    t.true(logs.stdout.join("\n").includes('"maintenance"'));
    t.is(await runCli(["project-storage", project, "--cache-max-mib=0"]), 0);
    t.is(await runCli(["project-storage", path.join(temporary, "missing")]), 1);
    t.true(logs.stderr.join("\n").includes("Storage maintenance failed"));
  },
);

test.serial(
  "E2E: runCli evidence-import rejects incomplete requests and unsupported mappers",
  async (t) => {
    const temporary = await temporaryDirectory(t, "uttori-cli-evidence-errors-");
    const logs = captureConsole(t);
    const rom = path.join(temporary, "fixture.sfc");
    const project = path.join(temporary, "fixture.analysis");
    const bytes = new Uint8Array(0x8000);
    await fs.writeFile(rom, bytes);
    publishAnalysisProject(project, {
      manifest: {
        format: "uttori-asm-analysis",
        schemaVersion: 3,
        target: "fixture",
        rom: new RomImage(bytes).identity,
        mapping: { mapper: "fixture", source: "override", candidates: [] },
        addressSpaces: [{ id: "snes.cpu", name: "CPU", addressBits: 24, kind: "cpu" }],
      },
      shards: emptyShards(),
    });
    t.is(await runCli(["evidence-import", project]), 1);
    t.true(logs.stderr.join("\n").includes("--rom is required"));
    t.is(await runCli(["evidence-import", project, "--rom", rom]), 1);
    t.true(logs.stderr.join("\n").includes("provide --instruction-trace"));
    const traceFile = path.join(temporary, "capture.json");
    await fs.writeFile(traceFile, instructionTrace(new RomImage(bytes).identity.contentSha256));
    t.is(
      await runCli(["evidence-import", project, "--rom", rom, "--instruction-trace", traceFile]),
      1,
    );
    t.true(logs.stderr.join("\n").includes("Unsupported SNES mapper"));
    t.is(await runCli(["analyze", project]), 1);
    t.true(logs.stderr.join("\n").includes("Analysis failed: --rom is required"));
    t.is(await runCli(["evidence-report", path.join(temporary, "missing")]), 1);
  },
);

test("E2E: runCli imports, reports, and reimports a native instruction trace", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-asm-cli-evidence-");
  const romFile = path.join(temporary, "fixture.sfc");
  const project = path.join(temporary, "fixture.analysis");
  const instructionTraceFile = path.join(temporary, "fixture.uttori-trace.json");
  const reportFile = path.join(temporary, "evidence.json");
  const bytes = new Uint8Array(0x8000);
  bytes.set([0xa9, 0x34, 0x12, 0xdb], 0);
  await fs.writeFile(romFile, bytes);
  t.is(await runCli(["disassemble", romFile, project, "--mapper=lorom"]), 0);
  const created = loadAnalysisProject(project);
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
    "--instruction-trace",
    instructionTraceFile,
    "--trace-index=full",
  ];
  t.is(await runCli(importArguments), 0);
  const imported = loadAnalysisProject(project);
  t.true(imported.shards.imports.every((report) => report.indexProfile === undefined));
  t.true(imported.shards.runtime.length > 0);
  const manifestBefore = await fs.readFile(path.join(project, "analysis.json"), "utf8");
  const runtimeBefore = imported.shards.runtime;
  t.is(await runCli(importArguments), 0);
  t.is(await fs.readFile(path.join(project, "analysis.json"), "utf8"), manifestBefore);
  t.deepEqual(loadAnalysisProject(project).shards.runtime, runtimeBefore);
  t.is(await runCli([...importArguments.slice(0, -1), "--trace-index=full"]), 0);
  t.deepEqual(loadAnalysisProject(project), imported);

  t.is(await runCli(["evidence-report", project, reportFile]), 0);
  const report = JSON.parse(await fs.readFile(reportFile, "utf8")) as {
    readonly runtimeRecords: number;
  };
  t.true(report.runtimeRecords > 0);
});

test.serial(
  "E2E: runCli evidence-report writes JSON to stdout when no output path is given",
  async (t) => {
    const temporary = await temporaryDirectory(t, "uttori-cli-evidence-report-");
    const logs = captureConsole(t);
    const rom = path.join(temporary, "fixture.sfc");
    const project = path.join(temporary, "fixture.analysis");
    await fs.writeFile(rom, loromRom());
    t.is(await runCli(["disassemble", rom, project, "--mapper=lorom"]), 0);
    t.is(await runCli(["evidence-report", project]), 0);
    t.true(logs.stdout.join("\n").includes("runtimeRecords"));
  },
);

test("E2E: runCli analyze persists conservative 65816 analysis without embedding ROM bytes", async (t) => {
  const temporary = await temporaryDirectory(t, "uttori-asm-cli-static-");
  const rom = path.join(temporary, "fixture.sfc");
  const project = path.join(temporary, "fixture.analysis");
  const bytes = new Uint8Array(0x8000);
  bytes[0] = 0xdb;
  bytes[0x7ffc] = 0x00;
  bytes[0x7ffd] = 0x80;
  await fs.writeFile(rom, bytes);
  t.is(await runCli(["disassemble", rom, project, "--mapper=lorom"]), 0);
  t.is(await runCli(["analyze", project, "--rom", rom]), 0);
  // Transactions publish analysis rows in SQLite.
  // the original conventional path is no longer the current snapshot.
  const records = loadAnalysisProject(project).shards.analysis;
  t.true(records.some((record) => record.kind === "cfg-node" && record.mnemonic === "STP"));
  t.true(records.some((record) => record.kind === "summary"));
  t.false(JSON.stringify(records).includes("romBytes"));
});

test.serial(
  "E2E: runCli analyze reports incomplete work when the item budget is exhausted",
  async (t) => {
    const temporary = await temporaryDirectory(t, "uttori-cli-incomplete-");
    const logs = captureConsole(t);
    const rom = path.join(temporary, "fixture.sfc");
    const project = path.join(temporary, "fixture.analysis");
    await fs.writeFile(rom, loromRom());
    t.is(await runCli(["disassemble", rom, project, "--mapper=lorom"]), 0);
    t.is(
      await runCli([
        "analyze",
        project,
        "--rom",
        rom,
        "--entry=$008000",
        "--max-work-items=1",
        "--max-call-depth=0",
      ]),
      0,
    );
    t.true(logs.stdout.join("\n").includes("Incomplete:"));
    t.is(await runCli(["analyze", project, "--rom", path.join(temporary, "missing.sfc")]), 1);
  },
);
