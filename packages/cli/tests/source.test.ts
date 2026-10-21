import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  RomImage,
  openAnalysisProjectStore,
  publishAnalysisProject,
  type AnalysisProject,
  readCaptureImportNotes,
  RUNTIME_INSTRUCTION_TRACE_FORMAT,
  RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
} from "@uttori/asm-disassembler";
import {
  sourceGit,
  sourceRepository,
  retainSourceGeneration,
  pinSourceCandidate,
  adoptSourceGeneration,
  finishSourceGeneration,
  type SourceMergePreview,
  type SourceMergeStatus,
  acceptedSourceGeneration,
  openSourceProject,
  sourceProjectLocalInputs,
  readSourceCaptureCatalog,
  sourceContentHash,
  readSourceInputSnapshot,
  SOURCE_INPUT_SNAPSHOT_FILE,
} from "@uttori/asm-disassembler/source-project";
import {
  exportSnes65816Source,
  type PreparedSnesGeneration,
  type SnesSourceBuild,
} from "@uttori/asm-plugin-snes/disassembler";

import { test } from "../../../tests/ava-helper.js";
import type { SourceCaptureImportBatchResult } from "../../workflows/src/source-capture-imports.js";
import { prepareSourceResearch } from "../../workflows/src/source-research.js";
import { executeSourceOperation } from "../../workflows/src/source.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSnesSourceBuild(value: unknown): value is SnesSourceBuild {
  return isRecord(value) && typeof value.outputFile === "string" && "verification" in value;
}

function isPreparedGeneration(value: unknown): value is PreparedSnesGeneration {
  return (
    isRecord(value) &&
    isRecord(value.verification) &&
    typeof value.verification.outputSha256 === "string" &&
    isRecord(value.generation) &&
    typeof value.generation.commit === "string"
  );
}

function isMergePreview(value: unknown): value is SourceMergePreview {
  return isRecord(value) && Array.isArray(value.conflicts);
}

function isMergeStatus(value: unknown): value is SourceMergeStatus {
  return isRecord(value) && typeof value.phase === "string";
}

function isImportResult(value: unknown): value is { sourceSha256: string; changed: boolean } {
  return (
    isRecord(value) && typeof value.sourceSha256 === "string" && typeof value.changed === "boolean"
  );
}

function isImportBatch(value: unknown): value is SourceCaptureImportBatchResult {
  return isRecord(value) && Array.isArray(value.imports) && value.imports.every(isImportResult);
}

function isChangedResult(value: unknown): value is { changed: boolean } {
  return isRecord(value) && typeof value.changed === "boolean";
}

function isCleanResult(value: unknown): value is { scratch: { retained: unknown[] } } {
  return isRecord(value) && isRecord(value.scratch) && Array.isArray(value.scratch.retained);
}

function isInitResult(
  value: unknown,
): value is { generation: string; verification: { outputSha256: string } } {
  return (
    isRecord(value) &&
    typeof value.generation === "string" &&
    isRecord(value.verification) &&
    typeof value.verification.outputSha256 === "string"
  );
}

type GenerationRecipeFile = {
  pristineAssets: { path: string; sha256: string; romRange: { start: number; end: number } }[];
};

function isGenerationRecipeFile(value: unknown): value is GenerationRecipeFile {
  return (
    isRecord(value) &&
    Array.isArray(value.pristineAssets) &&
    value.pristineAssets.every(
      (asset) =>
        isRecord(asset) &&
        typeof asset.path === "string" &&
        typeof asset.sha256 === "string" &&
        isRecord(asset.romRange) &&
        typeof asset.romRange.start === "number" &&
        typeof asset.romRange.end === "number",
    )
  );
}

async function expectOperation<T>(
  operation: Parameters<typeof executeSourceOperation>[0],
  accept: (value: unknown) => value is T,
): Promise<T> {
  const value = await executeSourceOperation(operation);
  if (!accept(value)) {
    throw new Error(`Unexpected ${operation.action} result.`);
  }
  return value;
}

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

test("prepare reports invalid struct recipes at the editable project path", async (t) => {
  const { directory } = await fixture(t.teardown);
  const file = path.join(directory, "source/struct-map.json");
  const recipeFile = path.join(directory, ".uttori/generation-inputs.json");
  const recipe = JSON.parse(fs.readFileSync(recipeFile, "utf8"));
  fs.writeFileSync(
    recipeFile,
    JSON.stringify({ ...recipe, recipes: [...recipe.recipes, "struct-map.json"] }),
  );
  fs.writeFileSync(
    file,
    JSON.stringify({
      format: "uttori-asm-snes-struct-map",
      schemaVersion: 1,
      structures: [],
      bindings: [],
      instructionUses: [
        { address: 0x808000, expectedBytes: [0xea], reason: "Missing operand declaration." },
      ],
    }),
  );
  const error = await t.throwsAsync(executeSourceOperation({ action: "prepare", directory }));
  t.true(error!.message.includes(file));
  t.regex(
    error!.message,
    /instructionUses\[0] at CPU \$808000:.*Set operand, memoryOperand, stackOperand/,
  );
  t.false(error!.message.includes("scratch"));
});

test("source operations and unsaved research share project resource ceilings", async (t) => {
  const { directory } = await fixture(t.teardown);
  const configurationFile = path.join(directory, ".uttori/project.json");
  const configuration = JSON.parse(fs.readFileSync(configurationFile, "utf8"));
  const documentFile = path.join(directory, ".uttori/research/names.json");
  const document = fs.readFileSync(documentFile, "utf8");
  fs.writeFileSync(
    configurationFile,
    JSON.stringify({
      ...configuration,
      limits: { researchDocumentBytes: Buffer.byteLength(document) },
    }),
  );
  const project = await openSourceProject(directory);
  t.throws(
    () =>
      prepareSourceResearch(project, {}, [
        {
          path: ".uttori/research/names.json",
          bytes: Buffer.from(document + " "),
        },
      ]),
    { message: /names\.json:.*limits\.researchDocumentBytes.*\.uttori\/project\.json/ },
  );
  fs.writeFileSync(documentFile, document + " ");
  await t.throwsAsync(executeSourceOperation({ action: "status", directory }), {
    message: /names\.json:.*limits\.researchDocumentBytes.*\.uttori\/project\.json/,
  });
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
      addressSpaces: [
        { id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 },
        { id: "rom.file", name: "ROM file offset", kind: "file", addressBits: 24 },
      ],
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
    { manifest: { ...project.manifest }, shards: project.shards },
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
      (await expectOperation({ directory, action: "build" }, isSnesSourceBuild)).verification,
  });
  return { directory, rom };
}

test("headless source commands preserve an edited raw byte through verified regeneration", async (t) => {
  const { directory, rom } = await fixture((cleanup) => t.teardown(cleanup));
  const repository = await sourceRepository(directory);
  const head = (await sourceGit(directory, ["rev-parse", "HEAD"])).stdout.toString().trim();
  const baseline = await acceptedSourceGeneration(repository, head);
  const tree = (await sourceGit(directory, ["rev-parse", `${baseline}^{tree}`])).stdout
    .toString()
    .trim();
  // Valid old proposals model a worktree opened after interrupted or superseded preparations.
  // A fresh verified preparation must migrate the backlog without manual CLI cleanup.
  let supersededCandidate = "";
  for (let index = 0; index < 17; index++) {
    const proposal = (
      await sourceGit(directory, ["commit-tree", tree, "-p", baseline], {
        input: `Old prepared proposal ${index}\n`,
      })
    ).stdout
      .toString()
      .trim();
    supersededCandidate = proposal;
    await pinSourceCandidate(repository, proposal);
  }
  const rawFile = path.join(directory, "source/assets/raw/000000.bin");
  const bytes = fs.readFileSync(rawFile);
  bytes[7] = 0xeb;
  fs.writeFileSync(rawFile, bytes);
  const generation = await expectOperation(
    {
      directory,
      action: "prepare",
    },
    isPreparedGeneration,
  );
  t.is(generation.verification.outputSha256, rom.identity.contentSha256);
  const candidate = generation.generation.commit;
  const pendingStatus = await executeSourceOperation({ directory, action: "status", candidate });
  t.true(isRecord(pendingStatus) && !pendingStatus.candidateStale);
  t.is(
    (
      await sourceGit(directory, ["for-each-ref", "--format=%(refname)", "refs/uttori/candidates/"])
    ).stdout
      .toString()
      .trim(),
    generation.generation.ref,
  );
  const previewFile = path.join(repository.stateDirectory, "preview.json");
  await t.throwsAsync(executeSourceOperation({ directory, action: "apply", candidate }), {
    message: /Preview this generation with current edits/,
  });
  const capturedRecipe = fs.readFileSync(path.join(directory, "source/ram-map.json"));
  const capturedResearch = fs.readFileSync(path.join(directory, ".uttori/research/names.json"));
  const preview = await expectOperation(
    {
      directory,
      action: "preview",
      candidate,
    },
    isMergePreview,
  );
  t.deepEqual(preview.conflicts, []);
  fs.unlinkSync(previewFile);
  await t.throwsAsync(executeSourceOperation({ directory, action: "apply", candidate }), {
    message: /Preview this generation with current edits/,
  });
  await executeSourceOperation({ directory, action: "preview", candidate });
  await t.throwsAsync(executeSourceOperation({ directory, action: "apply", candidate }), {
    message: /Commit or move/,
  });
  await sourceGit(directory, ["add", "--all"]);
  await sourceGit(directory, ["commit", "-m", "Edit raw byte"]);
  // A checkpoint or ignored-file cleanup can remove the disposable hint after preview. Apply
  // must validate the same database inputs and preserve the edited byte through the merge.
  fs.unlinkSync(path.join(directory, ".uttori-local/evidence/analysis.json"));
  await executeSourceOperation({ directory, action: "apply", candidate });
  t.true(fs.existsSync(path.join(directory, ".uttori-local/evidence/analysis.json")));
  t.is((await expectOperation({ directory, action: "finish" }, isMergeStatus)).phase, "verified");
  t.false(fs.existsSync(previewFile));
  const completedHead = (await sourceGit(directory, ["rev-parse", "HEAD"])).stdout.toString();
  const refs = (await sourceGit(directory, ["show-ref"])).stdout.toString();
  await executeSourceOperation({ directory, action: "apply", candidate });
  const completedStatus = await executeSourceOperation({ directory, action: "status", candidate });
  t.true(isRecord(completedStatus) && completedStatus.candidateAccepted);
  t.true(isRecord(completedStatus) && !completedStatus.candidateStale);
  const staleStatus = await executeSourceOperation({
    directory,
    action: "status",
    candidate: supersededCandidate,
  });
  t.true(isRecord(staleStatus) && !staleStatus.candidateAccepted);
  t.true(isRecord(staleStatus) && staleStatus.candidateStale);
  // Later staged and unstaged edits, including generation inputs, are independent of a finished
  // merge. A stale editor command must preserve both and must not recreate the released preview.
  const recipeFile = path.join(directory, "source/ram-map.json");
  fs.appendFileSync(recipeFile, "\n");
  await sourceGit(directory, ["add", "source/ram-map.json"]);
  fs.appendFileSync(recipeFile, "\n");
  const index = (await sourceGit(directory, ["write-tree"])).stdout.toString();
  const dirtyRecipe = fs.readFileSync(recipeFile);
  const journalFile = path.join(repository.stateDirectory, "merge.json");
  const journal = fs.readFileSync(journalFile);
  await executeSourceOperation({ directory, action: "apply", candidate });
  t.is((await sourceGit(directory, ["rev-parse", "HEAD"])).stdout.toString(), completedHead);
  t.is((await sourceGit(directory, ["show-ref"])).stdout.toString(), refs);
  t.is((await sourceGit(directory, ["write-tree"])).stdout.toString(), index);
  t.deepEqual(fs.readFileSync(recipeFile), dirtyRecipe);
  t.deepEqual(fs.readFileSync(journalFile), journal);
  t.false(fs.existsSync(previewFile));
  const built = await expectOperation({ directory, action: "build" }, isSnesSourceBuild);
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
  const recipeText: unknown = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
  if (!isGenerationRecipeFile(recipeText)) {
    throw new Error("Expected a generation recipe.");
  }
  const asset = {
    path: "source/assets/native/compression.bin",
    sha256: sourceContentHash(rom.read(11, 17)!),
    romRange: { start: 11, end: 28 },
  };
  recipeText.pristineAssets = [asset];
  const write = () => fs.writeFileSync(path.join(directory, file), JSON.stringify(recipeText));
  write();
  fs.mkdirSync(path.dirname(path.join(directory, asset.path)), { recursive: true });
  fs.writeFileSync(path.join(directory, asset.path), new Uint8Array(17).fill(0x42));
  const prepared = await expectOperation(
    {
      directory,
      action: "prepare",
    },
    isPreparedGeneration,
  );
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

test("reviewed original asset blobs ignore working edits and reject invalid identities", async (t) => {
  const { directory, rom } = await fixture((cleanup) => t.teardown(cleanup));
  const file = path.join(directory, ".uttori/generation-inputs.json");
  const recipe = JSON.parse(fs.readFileSync(file, "utf8"));
  const assetPath = "source/assets/native/reviewed.bin";
  fs.mkdirSync(path.dirname(path.join(directory, assetPath)), { recursive: true });
  const original = Buffer.from(rom.read(11, 17)!);
  fs.writeFileSync(path.join(directory, assetPath), original);
  await sourceGit(directory, ["add", "--", assetPath]);
  const originalBlob = (await sourceGit(directory, ["rev-parse", `:${assetPath}`])).stdout
    .toString()
    .trim();
  const asset = { path: assetPath, sha256: sourceContentHash(original), originalBlob };
  recipe.pristineAssets = [asset];
  const write = () => fs.writeFileSync(file, JSON.stringify(recipe));
  write();
  fs.writeFileSync(path.join(directory, assetPath), Buffer.alloc(17, 0x42));
  const result = await expectOperation({ directory, action: "prepare" }, isPreparedGeneration);
  t.deepEqual(
    (await sourceGit(directory, ["show", `${result.generation.commit}:${assetPath}`])).stdout,
    original,
  );
  t.deepEqual(fs.readFileSync(path.join(directory, assetPath)), Buffer.alloc(17, 0x42));
  t.is(result.verification.outputSha256, rom.identity.contentSha256);
  asset.sha256 = "0".repeat(64);
  write();
  await t.throwsAsync(executeSourceOperation({ directory, action: "prepare" }), {
    message: /Pristine asset content/,
  });
  asset.sha256 = sourceContentHash(original);
  asset.originalBlob = "HEAD";
  write();
  await t.throwsAsync(executeSourceOperation({ directory, action: "prepare" }), {
    message: /immutable original blob/,
  });
  asset.originalBlob = "0".repeat(40);
  write();
  await t.throwsAsync(executeSourceOperation({ directory, action: "prepare" }));
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
  const progress: string[] = [];
  const imported = await expectOperation(
    {
      directory,
      action: "import",
      capture: file,
      onProgress: (message) => progress.push(message),
    },
    isImportResult,
  );
  t.true(imported.changed);
  t.true(
    progress.some(
      (message) => message.includes(file) && message.includes("Starting capture import"),
    ),
  );
  t.true(
    progress.some((message) => message.includes(file) && message.includes("1/1 records (100.0%)")),
  );
  t.true(
    progress.some((message) => message.includes(file) && message.includes("Import completed")),
  );
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
  const retryProgress: string[] = [];
  const retried = await expectOperation(
    {
      directory,
      action: "import",
      capture: file,
      onProgress: (message) => retryProgress.push(message),
    },
    isChangedResult,
  );
  t.false(retried.changed);
  t.true(retryProgress.some((message) => message.includes("already validated and committed")));
  t.false(
    retryProgress.some(
      (message) => message.includes("Indexing") || message.includes("Merging runtime facts"),
    ),
  );
  t.is(
    readSourceCaptureCatalog(directory, ".uttori/captures.json", rom.identity.contentSha256)
      .fileSha256,
    saved.fileSha256,
  );
  const readyStatus = await executeSourceOperation({ directory, action: "status" });
  t.true(isRecord(readyStatus) && readyStatus.catalogReady);
  // Even a verified archive binding describes a past input, not a retained reconstruction source.
  t.deepEqual(await executeSourceOperation({ directory, action: "catalog" }), {
    captures: 1,
    retainedEvidenceRequired: 1,
  });
  // A branch can retain an older catalog while its local SQLite store contains newer imports.
  // Status must expose the repair without mutating the tracked catalog during a tree refresh.
  const staleCatalog = JSON.stringify({ ...saved.catalog, captures: [] });
  fs.writeFileSync(path.join(directory, ".uttori/captures.json"), staleCatalog);
  const staleStatus = await executeSourceOperation({ directory, action: "status" });
  t.true(isRecord(staleStatus) && !staleStatus.catalogReady);
  t.is(fs.readFileSync(path.join(directory, ".uttori/captures.json"), "utf8"), staleCatalog);
  t.deepEqual(await executeSourceOperation({ directory, action: "catalog" }), {
    captures: 1,
    // Reconciliation restores provenance from the database without discovering original files.
    retainedEvidenceRequired: 1,
  });
  const evidence = sourceProjectLocalInputs(await openSourceProject(directory)).evidence;
  const notes = readCaptureImportNotes(evidence, imported.sourceSha256);
  t.truthy(notes);
  t.is(notes?.analysis, undefined);
  // Capture archives are disposable. Analysis, generated notes and saved-code navigation use evidence.
  fs.unlinkSync(file);
  const configFile = path.join(directory, ".uttori/project.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  // This all-NOP fixture has no terminating instruction; bound exploration to exercise reporting.
  fs.writeFileSync(configFile, JSON.stringify({ ...config, limits: { analysisWorkItems: 64 } }));
  const analyzed = await executeSourceOperation({ directory, action: "analyze" });
  t.true(isRecord(analyzed) && Array.isArray(analyzed.addedCode));
  const completed = readCaptureImportNotes(evidence, imported.sourceSha256);
  t.is(completed?.analysis?.status, "incomplete");
  t.deepEqual(completed?.analysis?.sources, ["capture.json"]);
  t.false(fs.existsSync(file));
});

test("a retained recovered prefix still requires explicit recovery on every import", async (t) => {
  const { writeCaptureFixture } = await import("../../../tests/helpers/capture-archive.js");
  const { directory, rom } = await fixture(t.teardown);
  const capture = path.join(directory, ".uttori-local/prefix.act2");
  await writeCaptureFixture(capture, 3, 1, rom.identity.contentSha256);
  const bytes = fs.readFileSync(capture);
  fs.writeFileSync(capture, bytes.subarray(0, bytes.lastIndexOf(Buffer.from("END2"))));
  const imported = await expectOperation(
    { directory, action: "import", capture, recoverPartial: true },
    isImportResult,
  );
  t.true(imported.changed);
  t.false(fs.existsSync(path.join(directory, ".uttori-local/validated-traces")));
  await t.throwsAsync(executeSourceOperation({ directory, action: "import", capture }), {
    message: /incomplete/,
  });
});

test("bulk source imports preserve per-file commits, retry idempotently and accept CLI queues", async (t) => {
  const { directory, rom } = await fixture(t.teardown);
  const captures = ["first.json", "second.json", "third.json"].map((name, index) => {
    const file = path.join(directory, ".uttori-local", name);
    fs.writeFileSync(
      file,
      JSON.stringify({
        format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
        schemaVersion: RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        romContentSha256: rom.identity.contentSha256,
        producer: { id: "fixture", revision: `bulk-${index}` },
        chunks: [
          { sequenceStart: 1, addresses: [0x808000 + index], droppedEvents: 0, active: false },
        ],
      }),
    );
    return file;
  });
  const invalid = path.join(directory, ".uttori-local/invalid.json");
  fs.writeFileSync(invalid, "{bad-json}");
  await t.throwsAsync(
    executeSourceOperation({
      directory,
      action: "import",
      captures: [captures[0], invalid, captures[1]],
    }),
    { message: /invalid.json.*1 completed; 1 unattempted/ },
  );
  const readCatalog = () =>
    readSourceCaptureCatalog(directory, ".uttori/captures.json", rom.identity.contentSha256);
  t.is(readCatalog().catalog.captures.length, 1);
  const progress: string[] = [];
  const batch = await expectOperation(
    {
      directory,
      action: "import",
      captures: [...captures, captures[0]],
      onProgress: (message) => progress.push(message),
    },
    isImportBatch,
  );
  t.deepEqual(
    batch.imports.map((result) => result.capture),
    captures,
  );
  t.deepEqual(
    batch.imports.map((result) => result.changed),
    [false, true, true],
  );
  t.true(
    progress.some(
      (message) =>
        message.includes(`Capture 3/3 (${captures[2]})`) &&
        message.includes("Merging runtime facts"),
    ),
  );
  t.is(readCatalog().catalog.captures.length, 3);
  const beforeRetry = readCatalog().fileSha256;
  // Use the actual positional adapter in a child so stderr progress cannot corrupt JSON stdout.
  const child = spawnSync(
    process.execPath,
    [
      "--conditions=uttori-source",
      "--import=tsx",
      "--input-type=module",
      "-e",
      "import {runSourceCli} from './packages/cli/src/source.ts'; process.exitCode = await runSourceCli(process.argv.slice(1));",
      "import",
      directory,
      ...captures,
    ],
    { cwd: path.resolve("."), encoding: "utf8", timeout: 20000 },
  );
  t.is(child.status, 0, child.stderr);
  const retried: unknown = JSON.parse(child.stdout);
  t.true(isImportBatch(retried));
  if (isImportBatch(retried)) {
    t.true(retried.imports.every((result) => !result.changed));
  }
  t.true(child.stderr.includes(captures[2]));
  t.regex(child.stderr, /Capture 3\/3.*Import completed/);
  t.is(readCatalog().fileSha256, beforeRetry);
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
      const clean = await expectOperation({ directory, action: "clean" }, isCleanResult);
      t.deepEqual(clean.scratch.retained, []);
      t.deepEqual(fs.readdirSync(path.join(repository.stateDirectory, "scratch")), []);
      const retry = await expectOperation(
        {
          directory,
          action: "prepare",
        },
        isPreparedGeneration,
      );
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
    const retryProgress: string[] = [];
    const retry = await expectOperation(
      {
        directory,
        action: "import",
        capture,
        onProgress: (message) => retryProgress.push(message),
      },
      isChangedResult,
    );
    t.true(retryProgress.some((message) => message.includes("Reusing validated trace index")));
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
    const clean = await expectOperation({ directory, action: "clean" }, isCleanResult);
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
        const result = await expectOperation(
          {
            action: "init",
            directory,
            rom: file,
            mapper: "lorom",
            dizRawFile,
          },
          isInitResult,
        );
        const project = await openSourceProject(directory);
        t.is(
          (await sourceGit(directory, ["branch", "--show-current"])).stdout.toString().trim(),
          "main",
        );
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
          const prepared = await expectOperation(
            {
              directory,
              action: "prepare",
            },
            isPreparedGeneration,
          );
          t.is(prepared.verification.outputSha256, project.configuration.romSha256);
        }
        const head = (await sourceGit(directory, ["rev-parse", "HEAD"])).stdout.toString().trim();
        t.is(await acceptedSourceGeneration(project.repository, head), result.generation);
        const indexed = (await sourceGit(directory, ["ls-files", "-z"])).stdout
          .toString()
          .split("\0");
        t.false(indexed.some((name) => name.startsWith(".uttori-local/")));
        t.false(indexed.some((name) => /generated-files|source-ownership/.test(name)));
        const built = await expectOperation(
          {
            directory,
            action: "build",
          },
          isSnesSourceBuild,
        );
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
