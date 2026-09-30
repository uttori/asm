import * as fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  publishAnalysisProject,
  type AnalysisProject,
  type AnalysisStorageSnapshot,
} from "@uttori/asm-disassembler";
import type { AnalyzeSnesProjectResult } from "@uttori/asm-plugin-snes";

import { test } from "../../../../tests/ava-helper.js";
import type { DisassemblyRegenerationSummary } from "../../src/disassembly/maintenance-data.js";

const host = {
  trusted: true,
  folders: [] as { uri: { scheme: string; fsPath: string } }[],
  projects: [] as string[],
  quickPick: undefined as { choice: { directory: string } } | undefined,
  quickPickItems: [] as unknown[],
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  errors: [] as string[],
  shown: [] as string[],
  outputShown: 0,
};

(globalThis as { __uttoriMaintenanceTest?: typeof host }).__uttoriMaintenanceTest = host;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "maintenance-test:vscode" };
    }
    if (
      specifier === "../analysis/coverage-tree.js" &&
      typeof context.parentURL === "string" &&
      /[/\\]disassembly[/\\]maintenance\.(ts|js|mts|mjs)/.test(context.parentURL)
    ) {
      return { shortCircuit: true, url: "maintenance-test:coverage-tree" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "maintenance-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriMaintenanceTest;
          const uri = (file) => ({ scheme: "file", fsPath: file, toString: () => "file://" + file });
          export const ProgressLocation = { Notification: 15 };
          export const Uri = { file: uri, joinPath: (root, ...parts) => uri([root.fsPath, ...parts].join("/")) };
          export const workspace = {
            get isTrusted() { return host.trusted; },
            get workspaceFolders() { return host.folders; },
            getConfiguration: () => ({
              get: (_key, fallback) => fallback,
            }),
            textDocuments: [],
          };
          export const window = {
            showQuickPick: async (items) => {
              host.quickPickItems = items;
              return host.quickPick;
            },
            showTextDocument: async (document) => {
              host.shown.push(document?.uri?.fsPath ?? document?.fsPath ?? String(document));
            },
            showErrorMessage: async (message) => { host.errors.push(message); },
            showInformationMessage: async (message) => { host.errors.push(message); },
          };
          export const commands = {
            registerCommand: (id, callback) => {
              host.commands.set(id, callback);
              return { dispose() { host.commands.delete(id); } };
            },
            executeCommand: async () => {},
          };
        `,
      };
    }
    if (url === "maintenance-test:coverage-tree") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriMaintenanceTest;
          export const findAnalysisProjectDirectories = async () => host.projects;
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const {
  renderDisassemblyRegenerationReport,
  chooseLiveBusProject,
  registerDisassemblyMaintenance,
} = await import("../../src/disassembly/maintenance.js");

const storage = (overrides: Partial<AnalysisStorageSnapshot> = {}): AnalysisStorageSnapshot => ({
  databaseBytes: 2 * 1024 ** 2,
  walBytes: 512 * 1024,
  livePageBytes: 1024 ** 2,
  freePageBytes: 256 * 1024,
  facts: 10,
  observations: 4,
  pairedStates: 2,
  captures: 1,
  ...overrides,
});

const coverage = (codeBytes: number) => ({
  manifestSha256: "a".repeat(64),
  instructions: 8,
  runtimeRecords: 1,
  runtimeEvents: 2,
  traceImports: 0,
  codeBytes,
  contentBytes: 1024,
});

const analysis = {
  projectDirectory: "/project/analysis",
  status: "complete",
  instructions: 8,
  capturedInstructions: 1,
  runtimePcsWithoutCode: 0,
  functions: 1,
  conflicts: 0,
  unresolved: 0,
  processedWorkItems: 1,
  runtimeSeeds: 2,
  omittedRuntimeSeeds: 0,
  incompleteReasons: [],
  manifest: {} as AnalyzeSnesProjectResult["manifest"],
} satisfies AnalyzeSnesProjectResult;

const summary = (
  overrides: Partial<DisassemblyRegenerationSummary> = {},
): DisassemblyRegenerationSummary => ({
  projectDirectory: "/project/analysis",
  sourceDirectory: "/project/source",
  before: coverage(16),
  after: coverage(32),
  analysis,
  entrySeeds: 1,
  ramVariables: 3,
  addedFiles: [],
  changedFiles: [],
  removedFiles: [],
  roundTripSha256: "b".repeat(64),
  timings: {
    totalMs: 12,
    steps: [{ step: "Analyze | export", durationMs: 12, status: "completed", details: [] }],
  },
  ...overrides,
});

test("regeneration report covers storage, file deltas and markdown cell escaping", (t) => {
  const withoutStorage = renderDisassemblyRegenerationReport(summary());
  t.true(withoutStorage.includes("# Disassembly update report"));
  t.true(withoutStorage.includes("- No generated file bytes changed."));
  t.false(withoutStorage.includes("## Storage"));
  t.true(withoutStorage.includes("Analyze \\| export"));
  const withChanges = renderDisassemblyRegenerationReport(
    summary({
      before: { ...coverage(16), storage: storage() },
      after: { ...coverage(32), storage: storage({ facts: 12 }) },
      addedFiles: ["bank|new.asm"],
      changedFiles: ["main.asm"],
      removedFiles: ["gone.asm"],
    }),
  );
  t.true(withChanges.includes("## Storage"));
  t.true(withChanges.includes("- Added: bank|new.asm"));
  t.true(withChanges.includes("- Changed: main.asm"));
  t.true(withChanges.includes("- Removed: gone.asm"));
  t.false(withChanges.includes("- No generated file bytes changed."));
});

const writeProject = (directory: string, target = "fixture"): AnalysisProject => {
  const project: AnalysisProject = {
    manifest: {
      format: ANALYSIS_PROJECT_FORMAT,
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target,
      rom: new RomImage(new Uint8Array(64), { headerSize: 0 }).identity,
      mapping: { mapper: "fixture", source: "override", candidates: [] },
      addressSpaces: [{ id: "cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      imports: [],
      evidence: [],
      runtime: [],
    },
  };
  publishAnalysisProject(directory, project);
  return project;
};

test.serial("chooseLiveBusProject requires trust and matches ROM identity", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-live-bus-project-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = path.join(root, "one");
  const second = path.join(root, "two");
  fs.mkdirSync(first);
  fs.mkdirSync(second);
  const project = writeProject(first);
  writeProject(second);
  host.trusted = false;
  host.folders = [{ uri: { scheme: "file", fsPath: root } }];
  host.projects = [first];
  await t.throwsAsync(chooseLiveBusProject(project.manifest.rom.contentSha256), {
    message: /trusted workspace/,
  });
  host.trusted = true;
  host.projects = [];
  t.is(await chooseLiveBusProject(project.manifest.rom.contentSha256), undefined);
  host.projects = [first];
  t.is(await chooseLiveBusProject(project.manifest.rom.contentSha256), first);
  host.projects = [first, second];
  host.quickPick = undefined;
  t.is(await chooseLiveBusProject(project.manifest.rom.contentSha256), undefined);
  t.is(host.quickPickItems.length, 2);
  host.quickPick = { choice: { directory: second } };
  t.is(await chooseLiveBusProject(project.manifest.rom.contentSha256), second);
});

test.serial(
  "registerDisassemblyMaintenance rejects untrusted regenerate and exposes analysis output",
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-maintenance-register-"));
    t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
    const directory = path.join(root, "analysis");
    fs.mkdirSync(directory);
    writeProject(directory, "snes.sfc");
    host.trusted = false;
    host.folders = [{ uri: { scheme: "file", fsPath: root } }];
    host.projects = [directory];
    host.commands.clear();
    host.errors = [];
    host.shown = [];
    host.outputShown = 0;
    const channel = {
      show: () => {
        host.outputShown += 1;
      },
      error() {},
      info() {},
      warn() {},
    };
    const registrations = registerDisassemblyMaintenance(
      { extensionUri: { fsPath: root } } as never,
      () => {},
      channel as never,
    );
    t.teardown(() => {
      for (const registration of registrations) {
        registration.dispose();
      }
    });
    t.true(host.commands.has("asm.disassembly.regenerate"));
    t.false(host.commands.has("asm.heuristics.configure"));
    t.false(host.commands.has("asm.heuristics.preview"));
    t.true(host.commands.has("asm.analysis.showOutput"));
    await host.commands.get("asm.disassembly.regenerate")?.();
    t.true(host.errors.some((message) => /trusted workspace/.test(message)));
    host.trusted = true;
    await host.commands.get("asm.analysis.showOutput")?.();
    t.is(host.outputShown, 1);
  },
);
