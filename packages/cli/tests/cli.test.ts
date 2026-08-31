import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
