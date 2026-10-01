import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCliArguments, type CliArguments } from "@uttori/asm-cli";
import { loadAnalysisProjectSnapshot, sourceGit } from "@uttori/asm-disassembler";

const consumer = process.cwd();
const executable = path.resolve(
  path.dirname(fileURLToPath(import.meta.resolve("@uttori/asm-cli"))),
  "../out/cli.mjs",
);
// Stay beneath the external consumer installation so fixture plugins resolve its real npm packages.
const scratch = fs.mkdtempSync(path.join(consumer, "cli paths with spaces "));
const parsed: CliArguments = parseCliArguments(["assemble", "--", "--literal.asm", "output.sfc"]);
assert.equal(parsed.input, "--literal.asm");

/** Launch the shipped executable with literal argv, never shell interpolation. */
const invoke = (args: string[], expected = 0): ReturnType<typeof spawnSync> => {
  const result = spawnSync(process.execPath, [executable, ...args], {
    cwd: scratch,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(
    result.status,
    expected,
    `${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
  );
  if (expected === 1) {
    assert.ok(String(result.stderr).trim(), "Failures need stderr diagnostics.");
  }
  return result;
};

/** Three reset instructions. Unused vectors are zero to avoid accidental unbounded fixture paths. */
const fixtureRom = (headerSize: number): Uint8Array => {
  const content = new Uint8Array(0x8000).fill(0xdb);
  content.set([0xea, 0xea, 0xdb]);
  content.fill(0x20, 0x7fc0, 0x7fd5);
  content.set(new TextEncoder().encode("CLI FIXTURE"), 0x7fc0);
  content[0x7fd5] = 0x20;
  content[0x7fd7] = 5;
  content.set([0xcb, 0xed, 0x34, 0x12], 0x7fdc);
  content.fill(0, 0x7fe0);
  content.set([0, 0x80], 0x7ffc);
  const image = new Uint8Array(content.length + headerSize).fill(0x5a);
  image.set(content, headerSize);
  return image;
};

/** Interrupt only after the loader enters a waiting plugin, before any artifact can be published. */
const interruptAssembly = async (source: string, output: string, plugin: string): Promise<void> => {
  const child = spawn(process.execPath, [executable, source, output, "--plugin", plugin], {
    cwd: scratch,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let ready = false;
  let stdout = "";
  let stderr = "";
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI did not reach its interruptible fixture: ${stderr}`));
    }, 15_000);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (!ready && stdout.includes("CLI_TEST_READY")) {
        ready = true;
        child.kill("SIGINT");
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      try {
        assert.equal(ready, true, stderr);
        assert.notEqual(code, 0);
        // Windows implements kill through termination rather than POSIX signal delivery.
        if (process.platform !== "win32") {
          assert.equal(signal, "SIGINT");
        }
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
};

try {
  assert.equal(String(invoke(["--help"]).stderr), "");
  for (const args of [
    [],
    ["--unknown"],
    ["assemble", "missing.asm"],
    ["assemble", "missing.asm", "--debug=false"],
    ["analyze", "missing", "extra", "--rom", "missing.sfc"],
    ["export", "missing", "--debug"],
    ["assemble", "main.asm", "--target"],
    ["analyze", "missing", "--entry=0x1000000"],
    ["analyze", "missing", "--max-work-items=0"],
  ]) {
    assert.equal(String(invoke(args, 1).stdout), "");
  }
  for (const command of ["analyze"]) {
    assert.match(String(invoke([command, "missing"], 1).stderr), /--rom is required/);
  }

  const source = path.join(scratch, "main file.asm");
  const sourceText = "norom\norg $000000\ndb $42\n";
  fs.writeFileSync(source, sourceText);
  invoke([source]);
  assert.deepEqual([...fs.readFileSync(path.join(scratch, "main file.sfc"))], [0x42]);
  const output = path.join(scratch, "new build", "image.sfc");
  const map = path.join(scratch, "new maps", "image.json");
  const npm = process.env.npm_execpath;
  assert.ok(npm, "This consumer runs through npm run pack:check.");
  const npmResult = spawnSync(
    process.execPath,
    [npm, "exec", "--offline", "--", "uttori-asm", source, output, "--debug-map", map],
    {
      cwd: consumer,
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  assert.equal(npmResult.status, 0, `${npmResult.stderr}\n${npmResult.stdout}`);
  assert.deepEqual([...fs.readFileSync(output)], [0x42]);
  assert.ok(fs.readFileSync(map, "utf8").includes("main file.asm"));
  invoke([source, output]); // Successful explicit replacement is the assembly contract.
  fs.writeFileSync(output, "previous output");
  invoke([source, output, "--debug-map", source], 1);
  invoke([source, output, "--debug-map", path.dirname(output)], 1);
  invoke([source, output, "--debug-map", output], 1);
  invoke([source, source], 1);
  assert.equal(fs.readFileSync(output, "utf8"), "previous output");
  assert.equal(fs.readFileSync(source, "utf8"), sourceText);
  fs.writeFileSync(source, "this_is_not_an_instruction\n");
  invoke([source, output], 1);
  assert.equal(fs.readFileSync(output, "utf8"), "previous output");
  fs.writeFileSync(source, sourceText);
  invoke([source, output, "--config", "missing-config.json"], 1);
  const config = path.join(scratch, "bad-config.json");
  fs.writeFileSync(config, "{");
  invoke([source, output, "--config", config], 1);
  assert.equal(fs.readFileSync(output, "utf8"), "previous output");

  const base = path.join(scratch, "base image.sfc");
  fs.writeFileSync(base, Buffer.from([1, 2, 3]));
  invoke([source, output, "--base-image", base]);
  assert.deepEqual([...fs.readFileSync(output)], [0x42, 2, 3]);
  assert.deepEqual([...fs.readFileSync(base)], [1, 2, 3]);
  fs.writeFileSync(path.join(scratch, "--literal.asm"), sourceText);
  invoke(["assemble", "--", "--literal.asm", "literal.sfc"]);

  for (const headerSize of [0, 512]) {
    const rom = path.join(scratch, `game ${headerSize}.sfc`);
    const project = path.join(scratch, `game ${headerSize}.analysis`);
    const exported = path.join(scratch, `game ${headerSize}.source`);
    fs.writeFileSync(rom, fixtureRom(headerSize));
    invoke(["disassemble", rom, "--mapper=lorom", `--header-size=${headerSize}`]);
    const created = loadAnalysisProjectSnapshot(project);
    invoke(["disassemble", rom, project, "--mapper=lorom"], 1);
    assert.deepEqual(loadAnalysisProjectSnapshot(project), created);
    invoke(["project-validate", project, "--rom", rom]);
    const bounded = invoke(["analyze", project, "--rom", rom, "--max-work-items=1"]);
    assert.match(String(bounded.stdout), /Incomplete:/);
    invoke([
      "analyze",
      project,
      "--rom",
      rom,
      "--entry=$008000",
      "--max-work-items=100",
      "--max-call-depth=8",
    ]);
    const analyzed = loadAnalysisProjectSnapshot(project);
    invoke(["source", "init", exported, rom, "--mapper", "lorom"]);
    const build = JSON.parse(String(invoke(["source", "build", exported]).stdout));
    assert.deepEqual(fs.readFileSync(build.outputFile), fs.readFileSync(rom).subarray(headerSize));
    const entry = path.join(exported, "source/main.asm");
    fs.appendFileSync(entry, "; keep my local edit\n");
    const prepared = JSON.parse(String(invoke(["source", "prepare", exported]).stdout));
    invoke(["source", "preview", exported, prepared.generation.commit]);
    invoke(["source", "apply", exported, prepared.generation.commit], 1);
    assert.ok(fs.readFileSync(entry, "utf8").endsWith("; keep my local edit\n"));
    await sourceGit(exported, ["add", "source/main.asm"]);
    await sourceGit(exported, ["commit", "-m", "Checkpoint direct source edit"]);
    invoke(["source", "apply", exported, prepared.generation.commit]);
    invoke(["source", "finish", exported]);
    assert.ok(fs.readFileSync(entry, "utf8").endsWith("; keep my local edit\n"));
    const rebuilt = JSON.parse(String(invoke(["source", "build", exported]).stdout));
    assert.deepEqual(
      fs.readFileSync(rebuilt.outputFile),
      fs.readFileSync(rom).subarray(headerSize),
    );
    const privateRom = path.join(exported, ".uttori-local/original.sfc");
    const original = fs.readFileSync(privateRom);
    const wrong = Buffer.from(original);
    wrong[headerSize] ^= 1;
    fs.writeFileSync(privateRom, wrong);
    assert.match(
      String(invoke(["source", "prepare", exported], 1).stderr),
      /rom.*(identity|mismatch)|identity.*rom/i,
    );
    fs.writeFileSync(privateRom, original);
    assert.deepEqual(loadAnalysisProjectSnapshot(project), analyzed);
  }

  const corrupt = path.join(scratch, "corrupt project");
  fs.mkdirSync(corrupt);
  fs.writeFileSync(path.join(corrupt, "analysis.json"), "{");
  invoke(["project-validate", corrupt], 1);
  assert.deepEqual(fs.readdirSync(corrupt), ["analysis.json"]);
  const occupied = path.join(scratch, "occupied project");
  fs.mkdirSync(occupied);
  fs.writeFileSync(path.join(occupied, "user.txt"), "keep");
  invoke(["disassemble", path.join(scratch, "game 0.sfc"), occupied, "--mapper=lorom"], 1);
  assert.deepEqual(fs.readdirSync(occupied), ["user.txt"]);

  // Both session and plugin disposal fail. runCli must still attempt plugin cleanup and return 1.
  const cleanupSource = path.join(scratch, "cleanup.asm");
  fs.writeFileSync(cleanupSource, "org 0\nemit\n");
  const failingPlugin = path.join(scratch, "cleanup-plugin.mjs");
  fs.writeFileSync(
    failingPlugin,
    `
    import base from ${JSON.stringify(new URL("./contract-plugin.mjs", import.meta.url).href)};
    export default { ...base, async activate(context) {
      const owned = await base.activate({ ...context, registerLifecycle(contribution) {
        context.registerLifecycle({ ...contribution, create(host) {
          return { ...contribution.create(host), onSessionDispose() {
            console.error("SESSION_CLEANUP_ATTEMPTED"); throw new Error("session cleanup failed");
          } };
        }});
      }});
      return { async dispose() { await owned?.dispose(); console.error("PLUGIN_CLEANUP_ATTEMPTED"); throw new Error("plugin cleanup failed"); } };
    }};
  `,
  );
  const api = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from "node:assert/strict";
    import { runCli } from "@uttori/asm-cli";
    const previous = process.exitCode;
    const result = await runCli(process.argv.slice(1));
    assert.equal(result, 1);
    assert.equal(process.exitCode, previous);
    console.log("API_RETURNED_FAILURE");
  `,
      cleanupSource,
      output,
      "--plugin",
      failingPlugin,
      "--target",
      "consumer.target",
    ],
    { cwd: scratch, encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(api.status, 0, `${api.stderr}\n${api.stdout}`);
  assert.match(api.stderr, /SESSION_CLEANUP_ATTEMPTED/);
  assert.match(api.stderr, /PLUGIN_CLEANUP_ATTEMPTED/);
  assert.match(api.stdout, /Success: Output written/);
  assert.match(api.stdout, /API_RETURNED_FAILURE/);
  assert.deepEqual([...fs.readFileSync(output)], [1]);

  const waitingPlugin = path.join(scratch, "waiting-plugin.mjs");
  fs.writeFileSync(
    waitingPlugin,
    `
    import plugin from "@uttori/asm-plugin-snes";
    console.log("CLI_TEST_READY");
    setInterval(() => {}, 1000);
    await new Promise(() => {});
    export default plugin;
  `,
  );
  fs.writeFileSync(output, "before interruption");
  await interruptAssembly(source, output, waitingPlugin);
  assert.equal(fs.readFileSync(output, "utf8"), "before interruption");
  assert.equal(fs.readFileSync(source, "utf8"), sourceText);
  console.log(
    "Installed CLI: core workflows, npm exec, spaced paths, overwrite guards, stale inputs, errors, cleanup, and interruption passed",
  );
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
