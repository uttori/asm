import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  sourceGit,
  sourceContentHash,
  type SourceTargetDescriptor,
} from "@uttori/asm-disassembler/source-project";

import { test } from "../../../tests/ava-helper.js";
import {
  executeSourceOperation,
  createSourceWorkflowHost,
  readSourceOperation,
} from "../src/source.js";

test("independent target initialization and unsupported capabilities do not need a dispatcher branch", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-target-contract-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const rom = path.join(directory, "tiny.bin");
  fs.writeFileSync(rom, Uint8Array.of(1, 2, 3, 4));
  const project = path.join(directory, "project"),
    hash = sourceContentHash(fs.readFileSync(rom));
  let initialized = 0,
    analyses = 0;
  const target: SourceTargetDescriptor = {
    id: "tiny.raw",
    recipeFormat: "tiny.recipe",
    matchesRom: (prefix) => prefix[0] === 1,
    initialize: async (options) => {
      initialized++;
      fs.mkdirSync(path.join(options.directory, ".uttori/research"), { recursive: true });
      await sourceGit(options.directory, ["init", "--quiet"]);
      fs.writeFileSync(
        path.join(options.directory, ".uttori/project.json"),
        JSON.stringify({
          format: "uttori-source-project",
          version: 1,
          id: "tiny",
          target: "tiny.raw",
          romSha256: hash,
          sourceRoots: ["source"],
          researchRoots: [".uttori/research"],
          buildConfig: "source/config.json",
          layout: ".uttori/layout.json",
          captures: ".uttori/captures.json",
        }),
      );
      return {
        directory: options.directory,
        generation: "0".repeat(40),
        verification: {
          outputSha256: hash,
          debugMapSha256: hash,
          toolchainSha256: hash,
          checks: ["original-equal"],
        },
        analysis: { status: "complete", instructions: 0, incompleteReasons: [] },
      };
    },
    build: async (selected, _host, signal) => {
      signal?.throwIfAborted();
      const outputFile = path.join(selected.repository.root, "tiny.bin");
      const debugMapFile = path.join(selected.repository.root, "tiny.map.json");
      fs.writeFileSync(outputFile, fs.readFileSync(rom));
      fs.writeFileSync(debugMapFile, JSON.stringify({ format: "tiny-map", version: 1 }));
      return {
        outputFile,
        debugMapFile,
        inputSha256: hash,
        verification: {
          outputSha256: hash,
          debugMapSha256: sourceContentHash(fs.readFileSync(debugMapFile)),
          toolchainSha256: hash,
          checks: ["tiny-equal"],
        },
      };
    },
    inspect: async () => {
      throw new Error("No inspection requested");
    },
    generationOptionsHash: () => hash,
    prepare: async () => {
      throw new Error("No generation requested");
    },
    analyze: () => {
      analyses++;
      return { status: "complete", addedCode: [] };
    },
  };
  const host = createSourceWorkflowHost([], [target]);
  const result = await executeSourceOperation({ action: "init", directory: project, rom }, host);
  t.is(result.directory, project);
  t.is(initialized, 1);
  const built = await executeSourceOperation({ action: "build", directory: project }, host);
  t.deepEqual(fs.readFileSync(built.outputFile), fs.readFileSync(rom));
  await t.throwsAsync(
    executeSourceOperation({ action: "expand", directory: project, expansionSize: 32 }, host),
    { message: /does not support expand/ },
  );
  t.is(analyses, 0);
  t.throws(() => readSourceOperation({ action: "build", directory: project, candidate: "bad" }), {
    message: /does not accept candidate/,
  });
  t.true(
    readSourceOperation({
      action: "import",
      directory: project,
      capture: rom,
      recoverPartial: true,
    }).recoverPartial,
  );
  t.throws(
    () =>
      readSourceOperation({
        action: "import",
        directory: project,
        capture: rom,
        recoverPartial: "yes",
      }),
    { message: /partial capture recovery/ },
  );
  t.throws(
    () => readSourceOperation({ action: "build", directory: project, recoverPartial: true }),
    { message: /does not accept recoverPartial/ },
  );
  t.throws(
    () =>
      readSourceOperation({ action: "import", directory: project, capture: rom, captures: [rom] }),
    { message: /exclusively/ },
  );
  t.throws(
    () =>
      readSourceOperation({
        action: "research",
        directory: project,
        research: { kind: "symbols", change: { kind: "entry-point", enabled: "yes" } },
      }),
    { message: /Invalid research symbol/ },
  );
});
