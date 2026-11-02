import fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";

const host = {
  analysisProject: "",
  folders: undefined as { uri: { fsPath: string } }[] | undefined,
  files: [] as { fsPath: string; scheme: string }[],
};

Object.assign(globalThis, { __uttoriCoverageTreeTest: host });

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "coverage-tree-test:vscode" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "coverage-tree-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriCoverageTreeTest;
          export class EventEmitter {
            event = () => {};
            fire() {}
            dispose() {}
          }
          export class ThemeIcon {
            constructor(id) { this.id = id; }
          }
          export class TreeItem {
            constructor(label, collapsibleState) {
              this.label = label;
              this.collapsibleState = collapsibleState;
            }
          }
          export const TreeItemCollapsibleState = { None: 0, Collapsed: 1 };
          export const Uri = {
            file: (file) => ({ fsPath: file, scheme: "file", toString: () => "file://" + file }),
          };
          export const workspace = {
            get workspaceFolders() { return host.folders; },
            getConfiguration: () => ({
              get: (_key, fallback) => (host.analysisProject === "" ? fallback : host.analysisProject),
            }),
            findFiles: async () => host.files,
          };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { AnalysisCoverageProvider } = await import("../../src/analysis/coverage-tree.js");
const { findAnalysisProjectDirectories, initializeAnalysisProjectDiscovery } =
  await import("../../src/analysis/project-discovery.js");

const SHA = "ab".repeat(32);

test.beforeEach(() => {
  host.analysisProject = "";
  host.folders = undefined;
  host.files = [];
});

test.serial("findAnalysisProjectDirectories uses configured paths and discovery", async (t) => {
  host.analysisProject = "/abs/project";
  t.deepEqual(await findAnalysisProjectDirectories(), ["/abs/project"]);
  host.analysisProject = "/abs/project/analysis.json";
  t.deepEqual(await findAnalysisProjectDirectories(), ["/abs/project"]);
  host.analysisProject = "nested";
  host.folders = [{ uri: { fsPath: "/ws" } }, { uri: { fsPath: "/other" } }];
  t.deepEqual(await findAnalysisProjectDirectories(), ["/other/nested", "/ws/nested"]);
  host.analysisProject = "";
  host.files = [
    { fsPath: "/ws/game/analysis.json", scheme: "file" },
    { fsPath: "/ws/game/analysis.json", scheme: "file" },
    { fsPath: "/ws/zilch/analysis.json", scheme: "untitled" },
    { fsPath: "/ws/alpha/analysis.json", scheme: "file" },
  ];
  t.deepEqual(await findAnalysisProjectDirectories(), ["/ws/alpha", "/ws/game"]);
});

test.serial(
  "selected source binding wins over copied analysis settings and follows target changes",
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-evidence-discovery-"));
    let selected: string | undefined = root;
    const discovery = initializeAnalysisProjectDiscovery(() => selected);
    t.teardown(() => {
      discovery.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    });
    fs.mkdirSync(path.join(root, ".uttori-local"));
    const binding = path.join(root, ".uttori-local/project.json");
    fs.writeFileSync(
      binding,
      JSON.stringify({
        format: "uttori-source-local",
        version: 1,
        rom: "/private/game.sfc",
        evidence: "/shared/evidence",
      }),
    );
    host.analysisProject = "/copied/absent/database";
    t.deepEqual(await findAnalysisProjectDirectories(), ["/shared/evidence"]);
    fs.unlinkSync(binding);
    await t.throwsAsync(findAnalysisProjectDirectories());
    selected = undefined;
    t.deepEqual(await findAnalysisProjectDirectories(), [host.analysisProject]);
  },
);

test.serial("legacy analysis stores do not create build-progress or evidence rows", async (t) => {
  const provider = new AnalysisCoverageProvider();
  t.teardown(() => provider.dispose());
  host.analysisProject = "/fixture/legacy";
  t.deepEqual(await provider.getChildren(), []);
});

test.serial(
  "source coverage renders compact totals and draft staleness without an evidence database",
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-coverage-tree-"));
    const discovery = initializeAnalysisProjectDiscovery(() => root);
    let stale = false;
    const provider = new AnalysisCoverageProvider(() => stale);
    t.teardown(() => {
      provider.dispose();
      discovery.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    });
    fs.mkdirSync(path.join(root, ".uttori"));
    fs.mkdirSync(path.join(root, ".uttori-local/builds"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".uttori/project.json"),
      JSON.stringify({
        format: "uttori-source-project",
        version: 1,
        id: "coverage",
        target: "snes.sfc",
        romSha256: SHA,
        sourceRoots: ["source"],
        researchRoots: ["research"],
        buildConfig: "source/config.json",
        layout: ".uttori/layout.json",
        captures: ".uttori/captures.json",
      }),
    );
    const summaryFile = path.join(root, ".uttori-local/builds/summary.json");
    fs.writeFileSync(
      summaryFile,
      JSON.stringify({
        version: 1,
        inputSha256: "a".repeat(64),
        coverage: { romSha256: SHA, totalBytes: 1024, remainingBytes: 256, convertedBytes: 768 },
      }),
    );
    const [freshRoot] = await provider.getChildren();
    t.true(freshRoot.description?.includes("256 bytes remaining · 25.00% · current"));
    const rows = await provider.getChildren(freshRoot);
    t.deepEqual(
      rows.map((row) => row.label),
      [
        "Bytes remaining",
        "Converted",
        "Original ROM",
        "Last successful build",
        "Build Current Source",
      ],
    );
    t.is(rows[0].description, "256 bytes · 25.00%");
    stale = true;
    provider.refresh();
    t.true((await provider.getChildren())[0].description?.endsWith("stale"));
    fs.unlinkSync(summaryFile);
    const [missing] = await provider.getChildren();
    t.true(missing.description?.includes("Build Current Source"));
    t.is(
      provider.getTreeItem((await provider.getChildren(missing))[0]).command?.command,
      "asm.source.buildProject",
    );
    fs.writeFileSync(summaryFile, '{"version":1,"coverage":{}}');
    t.is((await provider.getChildren())[0].description, "Build summary unavailable");
  },
);
