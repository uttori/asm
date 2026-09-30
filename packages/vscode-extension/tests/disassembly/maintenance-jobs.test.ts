import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  SOURCE_EXPORT_FORMAT,
  SOURCE_EXPORT_SCHEMA_VERSION,
  publishAnalysisProject,
  sourceExportSha256,
  type AnalysisProject,
  type SourceExportManifest,
} from "@uttori/asm-disassembler";

import { test } from "../../../../tests/ava-helper.js";
import {
  captureFixtureHeader,
  writeCaptureFixture,
} from "../../../../tests/helpers/capture-archive.js";
import type {
  ResolvedProjectSource,
  ResolvedTarget,
} from "../../src/disassembly/maintenance-data.js";
import {
  runMaintenanceJob,
  type MaintenanceJob,
  type MaintenanceProgress,
} from "../../src/disassembly/maintenance-jobs.js";

const emptyShards = {
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  imports: [],
  evidence: [],
  runtime: [],
} as const;

const fixtureProject = (): AnalysisProject => ({
  manifest: {
    format: ANALYSIS_PROJECT_FORMAT,
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture",
    rom: new RomImage(new Uint8Array(256), { headerSize: 0 }).identity,
    mapping: { mapper: "fixture", source: "override", candidates: [] },
    addressSpaces: [{ id: "cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
  },
  shards: { ...emptyShards },
});

const sourceManifest = (rom: AnalysisProject["manifest"]["rom"]): SourceExportManifest => ({
  format: SOURCE_EXPORT_FORMAT,
  schemaVersion: SOURCE_EXPORT_SCHEMA_VERSION,
  target: "fixture",
  architecture: "fixture",
  mapper: "fixture",
  sourceProjectSha256: "a".repeat(64),
  rom,
  entrySource: "main.asm",
  buildConfiguration: "uttori-asm.config.json",
  contentOutput: "out.bin",
  finalOutput: "out.bin",
  checksumPolicy: "preserve",
  files: [],
  spans: [],
});

const tempTarget = (t: {
  teardown(callback: () => void): void;
}): { project: AnalysisProject; source: ResolvedProjectSource; target: ResolvedTarget } => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-maintenance-jobs-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = fixtureProject();
  publishAnalysisProject(directory, project);
  const sourceDirectory = path.join(directory, "source");
  fs.mkdirSync(sourceDirectory);
  const source: ResolvedProjectSource = {
    projectDirectory: directory,
    sourceDirectory,
    sourceManifest: sourceManifest(project.manifest.rom),
  };
  return {
    project,
    source,
    target: { ...source, romFile: path.join(directory, "rom.bin") },
  };
};

test("coverage snapshot and revision sha read SQL without generated source files", async (t) => {
  const { source } = tempTarget(t);
  const coverage = (await runMaintenanceJob(
    { operation: "coverage", input: source },
    new AbortController().signal,
    () => {},
  )) as {
    manifestSha256: string;
    instructions: number;
    contentBytes: number;
    codeBytes: number;
  };
  t.is(coverage.instructions, 0);
  t.is(coverage.contentBytes, 256);
  t.is(coverage.codeBytes, 0);
  t.is(typeof coverage.manifestSha256, "string");
  t.is(coverage.manifestSha256.length, 64);
  const revision = await runMaintenanceJob(
    { operation: "revision", input: { projectDirectory: source.projectDirectory } },
    new AbortController().signal,
    () => {},
  );
  t.is(revision, coverage.manifestSha256);
});

test("stale annotation refresh returns undefined without exporting", async (t) => {
  const { target } = tempTarget(t);
  t.is(
    await runMaintenanceJob(
      { operation: "refresh", input: { target, receipt: { after: "stale" } } },
      new AbortController().signal,
      () => {},
    ),
    undefined,
  );
});

test("aborted maintenance records cancelled timing and throws AbortError", async (t) => {
  const { source } = tempTarget(t);
  const controller = new AbortController();
  controller.abort();
  const timings: MaintenanceProgress[] = [];
  const error = await t.throwsAsync(
    runMaintenanceJob({ operation: "coverage", input: source }, controller.signal, (progress) => {
      timings.push(progress);
    }),
  );
  t.is(error.name, "AbortError");
  t.true(timings.some((progress) => progress.timing?.status === "cancelled"));
});

test("progress callback receives completed timing for coverage", async (t) => {
  const { source } = tempTarget(t);
  const timings: MaintenanceProgress[] = [];
  await runMaintenanceJob(
    { operation: "coverage", input: source },
    new AbortController().signal,
    (progress) => {
      timings.push(progress);
    },
  );
  t.true(
    timings.some(
      (progress) => progress.timing?.status === "completed" && progress.timing.durationMs >= 0,
    ),
  );
});

test("prepare reports coverage and empty entry points for a fixture project", async (t) => {
  const { target } = tempTarget(t);
  fs.writeFileSync(
    path.join(target.sourceDirectory, "generated-files.json"),
    JSON.stringify(target.sourceManifest),
  );
  const result = (await runMaintenanceJob(
    { operation: "prepare", input: { target } },
    new AbortController().signal,
    () => {},
  )) as { before: { instructions: number; contentBytes: number }; entryPoints: unknown[] };
  t.is(result.before.instructions, 0);
  t.is(result.before.contentBytes, 256);
  t.deepEqual(result.entryPoints, []);
});

test("identity discovery returns only metadata and reports progress before scanning JSON", async (t) => {
  const { target } = tempTarget(t);
  const archive = path.join(target.sourceDirectory, "capture.act2");
  await writeCaptureFixture(archive, 0);
  const progress: MaintenanceProgress[] = [];
  const identity = await runMaintenanceJob(
    { operation: "traceIdentity", input: { traceFile: archive } },
    new AbortController().signal,
    (value) => progress.push(value),
  );
  t.like(identity, { romContentSha256: captureFixtureHeader.romContentSha256 });
  t.false(Object.hasOwn(identity as object, "read"));
  const json = path.join(target.sourceDirectory, "capture.json");
  fs.writeFileSync(
    json,
    JSON.stringify({
      chunks: Array.from({ length: 2000 }, (_, index) => ({
        sequenceStart: index + 1,
        addresses: [index],
      })),
      ...(identity as object),
    }),
  );
  progress.length = 0;
  t.deepEqual(
    await runMaintenanceJob(
      { operation: "traceIdentity", input: { traceFile: json } },
      new AbortController().signal,
      (value) => progress.push(value),
    ),
    identity,
  );
  t.is(progress.find((value) => value.message)?.message, "Reading capture identity…");
  t.true(progress.some((value) => (value.bytesRead ?? 0) > 0));
});

test("import worker rejects generated source drift before reading or mutating trace evidence", async (t) => {
  const { target } = tempTarget(t);
  const original = "db $42\n";
  const guarded = {
    ...target,
    sourceManifest: {
      ...target.sourceManifest,
      files: [
        {
          path: "main.asm",
          kind: "source" as const,
          size: original.length,
          sha256: sourceExportSha256(original),
        },
      ],
    },
  };
  fs.writeFileSync(path.join(target.sourceDirectory, "main.asm"), "edited source");
  fs.writeFileSync(
    path.join(target.sourceDirectory, "generated-files.json"),
    JSON.stringify(guarded.sourceManifest),
  );
  const progress: MaintenanceProgress[] = [];
  await t.throwsAsync(
    runMaintenanceJob(
      {
        operation: "import",
        input: {
          target: guarded,
          traceFile: path.join(target.sourceDirectory, "missing.act2"),
          maxBytes: 1024,
          architecture: "snes.65816",
          addressSpace: "snes.cpu",
        },
      },
      new AbortController().signal,
      (value) => progress.push(value),
    ),
    { message: /main.asm.*Regeneration stopped/s },
  );
  t.is(
    progress.find((value) => value.message)?.message,
    "Validating generated source before import…",
  );
  t.false(progress.some((value) => value.message === "Opening and validating trace metadata"));
});

const loadProcess = (instance: string) =>
  import(`../../src/disassembly/maintenance-process.js?test=${instance}`);

test.serial(
  "maintenance process cancel aborts, ignores a second run, and reports payloads",
  async (t) => {
    const { source } = tempTarget(t);
    const job: MaintenanceJob = { operation: "coverage", input: source };
    const waitFor = async (payloads: unknown[], type: string): Promise<Record<string, unknown>> => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const match = payloads.find(
          (payload) =>
            payload !== null &&
            typeof payload === "object" &&
            (payload as { type?: string }).type === type,
        );
        if (match) {
          return match as Record<string, unknown>;
        }
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });
      }
      throw new Error(`Timed out waiting for ${type}`);
    };

    const cancelled = await loadProcess("cancel");
    const cancelPayloads: unknown[] = [];
    cancelled.handleMaintenanceProcessMessage({ type: "cancel" }, (payload: unknown) => {
      cancelPayloads.push(payload);
    });
    cancelled.handleMaintenanceProcessMessage({ type: "run", job }, (payload: unknown) => {
      cancelPayloads.push(payload);
    });
    const error = await waitFor(cancelPayloads, "error");
    t.is((error.error as { name?: string }).name, "AbortError");

    const success = await loadProcess("success");
    const successPayloads: unknown[] = [];
    success.handleMaintenanceProcessMessage({ type: "run", job }, (payload: unknown) => {
      successPayloads.push(payload);
    });
    success.handleMaintenanceProcessMessage({ type: "run", job }, (payload: unknown) => {
      successPayloads.push(payload);
    });
    const result = await waitFor(successPayloads, "result");
    t.is(typeof (result.value as { manifestSha256?: string }).manifestSha256, "string");
    t.is(
      successPayloads.filter((payload) => (payload as { type?: string }).type === "result").length,
      1,
    );
  },
);
