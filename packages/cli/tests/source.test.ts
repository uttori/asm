import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  RomImage,
  openAnalysisProjectStore,
  publishAnalysisProject,
  sourceGit,
  sourceRepository,
  retainSourceGeneration,
  adoptSourceGeneration,
  finishSourceGeneration,
  type AnalysisProject,
  type SourceMergePreview,
  type SourceMergeStatus,
  acceptedSourceGeneration,
  openSourceProject,
  readSourceCaptureCatalog,
  sourceContentHash,
  readSourceInputSnapshot,
  SOURCE_INPUT_SNAPSHOT_FILE,
  RUNTIME_INSTRUCTION_TRACE_FORMAT,
  RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
} from "@uttori/asm-disassembler";
import {
  exportSnes65816Source,
  type PreparedSnesGeneration,
  type SnesSourceBuild,
} from "@uttori/asm-plugin-snes";

import { test } from "../../../tests/ava-helper.js";
import { prepareSourceResearch } from "../src/source-research.js";
import { executeSourceOperation } from "../src/source.js";

test("headless analysis research composes over unsaved documents and rejects stale selections", async (t) => {
  const { directory } = await fixture(t.teardown);
  const project = await openSourceProject(directory);
  const selection = prepareSourceResearch(project, { kind: "analysis" });
  if (selection.kind !== "analysis") {
    t.fail("missing analysis selection");
    return;
  }
  const file = selection.documents[0];
  const change = {
    kind: "put" as const,
    collection: "annotations" as const,
    path: file.path,
    expectedDocumentSha256: file.sha256,
    reason: "Trace proves an 8-bit accumulator at this entry.",
    value: {
      id: "manual.state",
      addressSpace: "snes.cpu",
      start: 0x808000,
      end: 0x808001,
      architecture: "snes.65816",
      classification: "opcode" as const,
      state: { e: false, m: true, x: false },
      evidence: [],
    },
  };
  const first = prepareSourceResearch(project, { kind: "analysis", change });
  if (first.kind !== "edit") {
    t.fail("missing research edit");
    return;
  }
  const buffers = [{ path: first.path, bytes: Buffer.from(first.after) }];
  t.is(sourceContentHash(fs.readFileSync(path.join(directory, file.path))), file.sha256);
  t.throws(() => prepareSourceResearch(project, { kind: "analysis", change }, buffers), {
    message: /changed since selection/,
  });
  const second = prepareSourceResearch(
    project,
    {
      kind: "analysis",
      change: {
        ...change,
        expectedDocumentSha256: sourceContentHash(first.after),
        value: { ...change.value, state: { ...change.value.state, carry: true } },
        reason: "Carry set at this call site.",
      },
    },
    buffers,
  );
  if (second.kind !== "edit") {
    t.fail("missing composed research edit");
    return;
  }
  const annotation = JSON.parse(second.after).decisions.find(
    (item: { id: string }) => item.id === change.value.id,
  ).value;
  t.deepEqual(annotation.state, { e: false, m: true, x: false, carry: true });
  t.is(annotation.evidence.length, 2);
  t.is(sourceContentHash(fs.readFileSync(path.join(directory, file.path))), file.sha256);
});

/** A real standalone project proves the commands use neither extension internals nor legacy manifests. */
async function fixture(teardown: (cleanup: () => void) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-cli-"));
  teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.symlinkSync(path.resolve("node_modules"), path.join(directory, "node_modules"), "dir");
  await sourceGit(directory, ["init", "-b", "main"]);
  await sourceGit(directory, ["config", "user.name", "Fixture"]);
  await sourceGit(directory, ["config", "user.email", "fixture@localhost"]);
  const rom = new RomImage(new Uint8Array(0x8000).fill(0xea), { headerSize: 0 });
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "snes.sfc",
      rom: rom.identity,
      mapping: { mapper: "lorom", source: "override", candidates: [] },
      addressSpaces: [{ id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      runtime: [],
      evidence: [],
      imports: [],
    },
  };
  for (const name of [".uttori/research", ".uttori-local", "source"]) {
    fs.mkdirSync(path.join(directory, name), { recursive: true });
  }
  fs.writeFileSync(path.join(directory, ".gitignore"), "/.uttori-local/\n/node_modules/\n");
  fs.writeFileSync(path.join(directory, ".uttori-local/original.sfc"), rom.read(0, rom.length)!);
  publishAnalysisProject(path.join(directory, ".uttori-local/evidence"), project);
  const write = (name: string, value: unknown) =>
    fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + "\n");
  write(".uttori/project.json", {
    format: "uttori-source-project",
    version: 1,
    id: "fixture",
    target: "snes.sfc",
    romSha256: rom.identity.contentSha256,
    sourceRoots: ["source"],
    researchRoots: [".uttori/research"],
    buildConfig: "source/uttori-asm.config.json",
    layout: ".uttori/layout.json",
    captures: ".uttori/captures.json",
  });
  write(".uttori-local/project.json", {
    format: "uttori-source-local",
    version: 1,
    rom: ".uttori-local/original.sfc",
    evidence: ".uttori-local/evidence",
  });
  write(".uttori/research/names.json", {
    format: "uttori-research",
    version: 1,
    project: "fixture",
    romSha256: rom.identity.contentSha256,
    decisions: [],
  });
  write(".uttori/layout.json", {
    format: "uttori-snes-layout",
    version: 1,
    romSha256: rom.identity.contentSha256,
    size: rom.length,
    states: [],
    extents: [],
  });
  write(".uttori/captures.json", {
    format: "uttori-capture-catalog",
    version: 1,
    romSha256: rom.identity.contentSha256,
    captures: [],
  });
  write(".uttori/generation-inputs.json", {
    format: "uttori-snes-generation-inputs",
    version: 1,
    sourceRoot: "source",
    recipes: ["ram-map.json", "uttori-asm.config.json"],
    pristineAssets: [],
    codeWithdrawals: [],
  });
  write("source/ram-map.json", {
    format: "uttori-asm-snes-ram-map",
    schemaVersion: 1,
    variables: [],
  });
  write("source/uttori-asm.config.json", {
    plugins: [{ module: "@uttori/asm-plugin-snes", options: { checksumEnabled: false } }],
    target: "snes.sfc",
    architecture: "snes.65816",
    entryPoints: ["main.asm"],
    includePaths: ["./"],
  });
  const files: { path: string; bytes: Uint8Array }[] = [];
  exportSnes65816Source(
    { manifest: { ...project.manifest, shards: [] }, shards: project.shards },
    rom,
    path.join(directory, "source"),
    {
      sourceProjectSha256: "a".repeat(64),
      emitFile: (file) => {
        if (file.path === "annotation-report.json") {
          return;
        }
        const relative = `source/${file.path}`;
        fs.mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
        fs.writeFileSync(path.join(directory, relative), file.bytes);
        files.push({ ...file, path: relative });
      },
    },
  );
  files.push({
    path: "source/uttori-asm.config.json",
    bytes: fs.readFileSync(path.join(directory, "source/uttori-asm.config.json")),
  });
  await sourceGit(directory, ["add", "--all"]);
  await sourceGit(directory, ["commit", "-m", "Initial source"]);
  const repository = await sourceRepository(directory);
  const baseline = await retainSourceGeneration(repository, {
    files,
    inputs: {
      project: "fixture",
      romSha256: rom.identity.contentSha256,
      evidenceSha256: "a".repeat(64),
      researchSha256: "b".repeat(64),
      toolchainSha256: "c".repeat(64),
      optionsSha256: "d".repeat(64),
    },
  });
  await adoptSourceGeneration(repository, baseline);
  await finishSourceGeneration(repository, {
    message: "Adopt source baseline",
    validate: async () =>
      ((await executeSourceOperation({ directory, action: "build" })) as SnesSourceBuild)
        .verification,
  });
  return { directory, rom };
}

test("headless source commands preserve an edited raw byte through verified regeneration", async (t) => {
  const { directory, rom } = await fixture((cleanup) => t.teardown(cleanup));
  const rawFile = path.join(directory, "source/assets/raw/000000.bin");
  const bytes = fs.readFileSync(rawFile);
  bytes[7] = 0xeb;
  fs.writeFileSync(rawFile, bytes);
  const generation = (await executeSourceOperation({
    directory,
    action: "prepare",
  })) as PreparedSnesGeneration;
  t.is(generation.verification.outputSha256, rom.identity.contentSha256);
  const candidate = generation.generation.commit;
  const capturedRecipe = fs.readFileSync(path.join(directory, "source/ram-map.json"));
  const capturedResearch = fs.readFileSync(path.join(directory, ".uttori/research/names.json"));
  const preview = (await executeSourceOperation({
    directory,
    action: "preview",
    candidate,
  })) as SourceMergePreview;
  t.deepEqual(preview.conflicts, []);
  await t.throwsAsync(executeSourceOperation({ directory, action: "apply", candidate }), {
    message: /Commit or move/,
  });
  await sourceGit(directory, ["add", "--all"]);
  await sourceGit(directory, ["commit", "-m", "Edit raw byte"]);
  await executeSourceOperation({ directory, action: "apply", candidate });
  t.is(
    ((await executeSourceOperation({ directory, action: "finish" })) as SourceMergeStatus).phase,
    "verified",
  );
  const built = (await executeSourceOperation({ directory, action: "build" })) as SnesSourceBuild;
  const expected = rom.read(0, rom.length)!.slice();
  expected[7] = 0xeb;
  t.deepEqual([...fs.readFileSync(built.outputFile)], [...expected]);
  t.false(fs.existsSync(path.join(directory, "source/generated-files.json")));
  t.false(fs.existsSync(path.join(directory, "source/source-ownership.json")));
  const cloned = directory + "-clone";
  t.teardown(() => fs.rmSync(cloned, { recursive: true, force: true }));
  await sourceGit(directory, ["clone", "--no-local", directory, cloned]);
  const recovered = readSourceInputSnapshot(
    (await sourceGit(cloned, ["show", `${candidate}:${SOURCE_INPUT_SNAPSHOT_FILE}`])).stdout,
  );
  t.deepEqual(recovered.find((file) => file.path === "source/ram-map.json")?.bytes, capturedRecipe);
  t.deepEqual(
    recovered.find((file) => file.path === ".uttori/research/names.json")?.bytes,
    capturedResearch,
  );
  t.true(recovered.some((file) => file.path === ".uttori/evidence-snapshot.json"));
  t.false(fs.existsSync(path.join(cloned, ".uttori-local/evidence")));
});

test("new pristine native resources are extracted from pinned ROM ranges, never edited working files", async (t) => {
  const { directory, rom } = await fixture((cleanup) => t.teardown(cleanup));
  const file = ".uttori/generation-inputs.json";
  const recipe = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")) as {
    pristineAssets: { path: string; sha256: string; romRange: { start: number; end: number } }[];
  };
  const asset = {
    path: "source/assets/native/compression.bin",
    sha256: sourceContentHash(rom.read(11, 17)!),
    romRange: { start: 11, end: 28 },
  };
  recipe.pristineAssets = [asset];
  const write = () => fs.writeFileSync(path.join(directory, file), JSON.stringify(recipe));
  write();
  fs.mkdirSync(path.dirname(path.join(directory, asset.path)), { recursive: true });
  fs.writeFileSync(path.join(directory, asset.path), new Uint8Array(17).fill(0x42));
  const prepared = (await executeSourceOperation({
    directory,
    action: "prepare",
  })) as PreparedSnesGeneration;
  t.is(prepared.verification.outputSha256, rom.identity.contentSha256);
  const pristine = (
    await sourceGit(directory, ["show", `${prepared.generation.commit}:${asset.path}`])
  ).stdout;
  t.deepEqual(pristine, Buffer.from(rom.read(11, 17)!));
  t.deepEqual(fs.readFileSync(path.join(directory, asset.path)), Buffer.alloc(17, 0x42));
  asset.sha256 = "0".repeat(64);
  write();
  await t.throwsAsync(executeSourceOperation({ directory, action: "prepare" }), {
    message: /Pristine asset content/,
  });
  asset.romRange.end = rom.length + 1;
  write();
  await t.throwsAsync(executeSourceOperation({ directory, action: "prepare" }), {
    message: /Invalid original ROM extraction/,
  });
});

test("capture import records portable archive identity and survives idempotent retry", async (t) => {
  const { directory, rom } = await fixture((cleanup) => t.teardown(cleanup));
  const file = path.join(directory, ".uttori-local/capture.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
      schemaVersion: RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      romContentSha256: rom.identity.contentSha256,
      producer: { id: "fixture", revision: "catalog-test" },
      chunks: [{ sequenceStart: 1, addresses: [0x808000], droppedEvents: 0, active: false }],
    }),
  );
  const imported = (await executeSourceOperation({
    directory,
    action: "import",
    capture: file,
  })) as { sourceSha256: string; changed: boolean };
  t.true(imported.changed);
  const saved = readSourceCaptureCatalog(
    directory,
    ".uttori/captures.json",
    rom.identity.contentSha256,
  );
  t.is(saved.catalog.captures.length, 1);
  t.is(saved.catalog.captures[0]!.sha256, imported.sourceSha256);
  t.deepEqual(saved.catalog.captures[0]!.archives, [
    {
      name: "capture.json",
      sha256: sourceContentHash(fs.readFileSync(file)),
      bytes: fs.statSync(file).size,
    },
  ]);
  const retried = (await executeSourceOperation({
    directory,
    action: "import",
    capture: file,
  })) as { changed: boolean };
  t.false(retried.changed);
  t.is(
    readSourceCaptureCatalog(directory, ".uttori/captures.json", rom.identity.contentSha256)
      .fileSha256,
    saved.fileSha256,
  );
  t.deepEqual(await executeSourceOperation({ directory, action: "catalog" }), {
    captures: 1,
    retainedEvidenceRequired: 0,
  });
});

for (const phase of ["export", "verification"] as const) {
  for (const mode of ["cancel", "kill"] as const) {
    test(`pure generation ${mode} during ${phase} preserves source and retries without a partial candidate`, async (t) => {
      const { directory, rom } = await fixture((cleanup) => t.teardown(cleanup));
      await executeSourceOperation({ directory, action: "index" });
      const repository = await sourceRepository(directory);
      const inspect = async () => ({
        head: (await sourceGit(directory, ["rev-parse", "HEAD"])).stdout,
        status: (await sourceGit(directory, ["status", "--porcelain=v1", "-z"])).stdout,
        index: (await sourceGit(directory, ["ls-files", "--stage", "-z"])).stdout,
        refs: (await sourceGit(directory, ["for-each-ref", "--format=%(refname) %(objectname)"]))
          .stdout,
      });
      const before = await inspect();
      const child = spawnSync(
        process.execPath,
        [
          "--conditions=uttori-source",
          "--import=tsx",
          path.resolve("packages/cli/tests/fixtures/source-generation-fault.mjs"),
          directory,
          phase,
          mode,
        ],
        { encoding: "utf8", timeout: 30000 },
      );
      if (mode === "kill") {
        t.is(child.signal, "SIGKILL", child.stderr);
      } else {
        t.is(child.status, 0, child.stderr);
      }
      t.deepEqual(await inspect(), before);
      // Killed workers cannot run finally blocks. The ordinary owned-scratch cleaner must reclaim
      // their partial files; cooperative cancellation has already removed them before returning.
      const clean = (await executeSourceOperation({ directory, action: "clean" })) as {
        scratch: { retained: unknown[] };
      };
      t.deepEqual(clean.scratch.retained, []);
      t.deepEqual(fs.readdirSync(path.join(repository.stateDirectory, "scratch")), []);
      const retry = (await executeSourceOperation({
        directory,
        action: "prepare",
      })) as PreparedSnesGeneration;
      t.is(retry.verification.outputSha256, rom.identity.contentSha256);
      t.deepEqual((await inspect()).head, before.head);
      t.deepEqual((await inspect()).status, before.status);
      t.deepEqual((await inspect()).index, before.index);
    });
  }
}

for (const boundary of ["before", "after"] as const) {
  test(`capture import killed ${boundary} SQLite commit recovers without partial evidence or duplicate observations`, async (t) => {
    const { directory, rom } = await fixture((cleanup) => t.teardown(cleanup));
    await executeSourceOperation({ directory, action: "index" });
    const evidence = path.join(directory, ".uttori-local/evidence");
    const inspect = () => {
      const store = openAnalysisProjectStore(evidence);
      try {
        return {
          revision: store.revision(),
          imports: store.loadTable("imports"),
          runtime: [...store.runtimeRecords()],
        };
      } finally {
        store.close();
      }
    };
    const before = inspect();
    const capture = path.join(directory, ".uttori-local/capture.json");
    fs.writeFileSync(
      capture,
      JSON.stringify({
        format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
        schemaVersion: RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        romContentSha256: rom.identity.contentSha256,
        producer: { id: "fixture", revision: "crash-test" },
        chunks: [{ sequenceStart: 1, addresses: [0x808000], droppedEvents: 0, active: false }],
      }),
    );
    const child = spawnSync(
      process.execPath,
      [
        "--conditions=uttori-source",
        "--import=tsx",
        path.resolve("packages/cli/tests/fixtures/source-import-fault.mjs"),
        directory,
        capture,
        String(before.revision),
        boundary,
      ],
      { encoding: "utf8", timeout: 20000 },
    );
    t.is(child.signal, "SIGKILL", child.stderr);
    const interrupted = inspect();
    if (boundary === "before") {
      t.deepEqual(interrupted, before);
    } else {
      t.is(interrupted.imports.length, 1);
      t.true(interrupted.runtime.length > 0);
      t.true(interrupted.revision > before.revision);
    }
    const retry = (await executeSourceOperation({ directory, action: "import", capture })) as {
      changed: boolean;
    };
    t.is(retry.changed, boundary === "before");
    const recovered = inspect();
    t.is(recovered.imports.length, 1);
    t.true(recovered.runtime.length > 0);
    if (boundary === "after") {
      t.deepEqual(recovered, interrupted);
    }
    t.is(
      readSourceCaptureCatalog(directory, ".uttori/captures.json", rom.identity.contentSha256)
        .catalog.captures.length,
      1,
    );
    const clean = (await executeSourceOperation({ directory, action: "clean" })) as {
      scratch: { retained: unknown[] };
    };
    t.deepEqual(clean.scratch.retained, []);
  });
}

for (const importDiz of [false, true]) {
  test.serial(
    `initialization creates verified Git ancestry with Diz research: ${importDiz}`,
    async (t) => {
      const parent = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-init-"));
      t.teardown(() => fs.rmSync(parent, { recursive: true, force: true }));
      const rom = Buffer.alloc(0x8000);
      rom[0] = 0xdb;
      for (let offset = 0x7fe0; offset < rom.length; offset += 2) {
        rom.writeUInt16LE(0x8000, offset);
      }
      const file = path.join(parent, "original.sfc");
      fs.writeFileSync(file, rom);
      // The fixture supplies its own Git identity without changing the developer's global settings.
      const prior = { ...process.env };
      Object.assign(process.env, {
        GIT_AUTHOR_NAME: "Fixture",
        GIT_AUTHOR_EMAIL: "fixture@localhost",
        GIT_COMMITTER_NAME: "Fixture",
        GIT_COMMITTER_EMAIL: "fixture@localhost",
      });
      const directory = path.join(parent, "project");
      const dizRawFile = importDiz ? path.join(parent, "research.dizraw") : undefined;
      if (dizRawFile) {
        fs.writeFileSync(
          dizRawFile,
          `<ProjectXmlSerializer-Root SaveVersion="104" Watermark="DiztinGUIsh">
        <Project><Data RomMapMode="LoRom" RomSpeed="SlowRom">
        <Labels><sys:Item Key="8421376"><Value Name="Entry" Comment="Imported research" /></sys:Item></Labels>
        <Comments><sys:Item Key="8421376"><Value>Keep this annotation</Value></sys:Item></Comments>
        <RomBytes>version:201,compress_groupblocks
r 32768 U
</RomBytes></Data></Project></ProjectXmlSerializer-Root>`,
        );
      }
      try {
        const result = (await executeSourceOperation({
          action: "init",
          directory,
          rom: file,
          mapper: "lorom",
          dizRawFile,
        })) as { generation: string; verification: { outputSha256: string } };
        const project = await openSourceProject(directory);
        if (dizRawFile) {
          t.true(
            project.research.decisions.some(
              (decision) =>
                decision.collection === "labels" &&
                decision.value &&
                "name" in decision.value &&
                decision.value.name === "Entry",
            ),
          );
          t.true(project.research.decisions.some((decision) => decision.collection === "comments"));
          fs.unlinkSync(dizRawFile);
          // Regeneration reads portable Git decisions after the private XML has disappeared.
          const prepared = (await executeSourceOperation({
            directory,
            action: "prepare",
          })) as PreparedSnesGeneration;
          t.is(prepared.verification.outputSha256, project.configuration.romSha256);
        }
        const head = (await sourceGit(directory, ["rev-parse", "HEAD"])).stdout.toString().trim();
        t.is(await acceptedSourceGeneration(project.repository, head), result.generation);
        const indexed = (await sourceGit(directory, ["ls-files", "-z"])).stdout
          .toString()
          .split("\0");
        t.false(indexed.some((name) => name.startsWith(".uttori-local/")));
        t.false(indexed.some((name) => /generated-files|source-ownership/.test(name)));
        const built = (await executeSourceOperation({
          directory,
          action: "build",
        })) as SnesSourceBuild;
        t.deepEqual(fs.readFileSync(built.outputFile), rom);
        await t.throwsAsync(
          executeSourceOperation({ action: "init", directory, rom: file, mapper: "lorom" }),
          { message: /never replaces/ },
        );
      } finally {
        for (const name of [
          "GIT_AUTHOR_NAME",
          "GIT_AUTHOR_EMAIL",
          "GIT_COMMITTER_NAME",
          "GIT_COMMITTER_EMAIL",
        ]) {
          if (prior[name] === undefined) {
            delete process.env[name];
          } else {
            process.env[name] = prior[name];
          }
        }
      }
    },
  );
}
