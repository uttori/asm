import { registerHooks } from "node:module";

import { test } from "../../../tests/ava-helper.js";

const host = {
  analysisProject: "",
  folders: undefined as { uri: { fsPath: string } }[] | undefined,
  files: [] as { fsPath: string; scheme: string }[],
  request: async (
    _directory: string,
    _operation: string,
    _options?: { offset?: number },
  ): Promise<unknown> => {
    throw new Error("unhandled");
  },
};

(globalThis as { __uttoriCoverageTreeTest?: typeof host }).__uttoriCoverageTreeTest = host;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "coverage-tree-test:vscode" };
    }
    if (
      specifier === "./analysis-worker-client.js" &&
      (context.parentURL?.includes("coverage-tree.ts") ||
        context.parentURL?.includes("coverage-tree.js"))
    ) {
      return { shortCircuit: true, url: "coverage-tree-test:worker" };
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
    if (url === "coverage-tree-test:worker") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriCoverageTreeTest;
          export const analysisWorker = () => ({
            request: (...args) => host.request(...args),
          });
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { AnalysisCoverageProvider, findAnalysisProjectDirectories } =
  await import("../src/coverage-tree.js");

const SHA = "ab".repeat(32);
const manifest = {
  target: "snes.sfc",
  mapping: { mapper: "lorom" },
  rom: { contentSha256: SHA, contentSize: 1024 },
};

const summary = (overrides: Record<string, unknown> = {}) => ({
  totalBytes: 0,
  classifiedBytes: 0,
  unknownBytes: 0,
  conflictBytes: 0,
  segmentCount: 0,
  bytesByClassification: { opcode: 0, operand: 0, data: 0, asset: 0, unknown: 0 },
  bytesByRuntimeCoverage: { executed: 0, operand: 0, read: 0, written: 0 },
  ...overrides,
});

const segment = (overrides: Record<string, unknown> = {}) => ({
  start: 0,
  end: 1,
  status: "classified",
  classifications: ["opcode"],
  runtime: [] as string[],
  annotationIds: ["ann"],
  analysisIds: ["node"],
  runtimeIds: ["run"],
  conflictIds: [] as string[],
  regionIds: ["reg"],
  ...overrides,
});

test.beforeEach(() => {
  host.analysisProject = "";
  host.folders = undefined;
  host.files = [];
  host.request = async () => {
    throw new Error("unhandled");
  };
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
  "AnalysisCoverageProvider loads roots, errors, summaries and paged segments",
  async (t) => {
    const provider = new AnalysisCoverageProvider();
    host.analysisProject = "/fixture/zero";
    host.request = async (_directory, operation) => {
      if (operation === "manifest") {
        return { ...manifest, rom: { ...manifest.rom, contentSize: 0 } };
      }
      if (operation === "coverage") {
        return {
          contentSize: 0,
          summary: summary({ totalBytes: 0, classifiedBytes: 4 }),
          detailCount: 0,
        };
      }
      throw new Error(operation);
    };
    const [zeroRoot] = await provider.getChildren();
    const zeroChildren = await provider.getChildren(zeroRoot);
    const classified = (await provider.getChildren(zeroChildren[0])).find(
      (node) => node.label === "Classified",
    );
    t.true(classified?.description?.includes("0.00%"));
    t.is(provider.getTreeItem(zeroRoot).command?.command, "vscode.open");

    host.analysisProject = "/fixture/bad";
    host.request = async () => {
      // oxlint-disable-next-line typescript/only-throw-error
      throw "busy";
    };
    const [errorRoot] = await provider.getChildren();
    t.is(errorRoot.icon, "error");
    t.is(errorRoot.description, "could not load analysis project");
    t.true(errorRoot.tooltip?.includes("busy"));

    host.analysisProject = "/fixture/ok";
    const segments = [
      segment({ status: "conflict", conflictIds: ["c1"], runtime: ["executed"] }),
      segment({ start: 1, end: 2, status: "unknown", classifications: ["unknown"] }),
      segment({ start: 2, end: 3, runtime: ["executed"] }),
      segment({ start: 3, end: 5, status: "classified", classifications: ["data"] }),
    ];
    host.request = async (_directory, operation, options) => {
      if (operation === "manifest") {
        return manifest;
      }
      if (operation === "coverage") {
        return {
          contentSize: 16,
          summary: summary({
            totalBytes: 1,
            classifiedBytes: 1,
            segmentCount: 201,
            bytesByRuntimeCoverage: { executed: 1, operand: 0, read: 0, written: 0 },
          }),
          detailCount: 2,
        };
      }
      if (operation === "segments") {
        return options?.offset === 0 ? segments : [];
      }
      if (operation === "details") {
        return [{ id: "d0", label: "gap", description: "missing file offset", icon: "warning" }];
      }
      throw new Error(operation);
    };
    const [root] = await provider.getChildren();
    t.is(root.description, `snes.sfc · lorom · ${SHA.slice(0, 12)}`);
    const groups = await provider.getChildren(root);
    t.deepEqual(
      groups.map((node) => node.label),
      [
        "Summary",
        "Classifications",
        "Runtime coverage",
        "ROM map segments",
        "Projection diagnostics",
      ],
    );
    const romContent = (await provider.getChildren(groups[0])).find(
      (node) => node.label === "ROM content",
    );
    t.is(romContent?.description, "1 byte");
    const executed = (await provider.getChildren(groups[2])).find(
      (node) => node.label === "executed",
    );
    t.true(executed?.description?.includes("1 byte"));
    const pages = await provider.getChildren(groups[3]);
    t.is(pages[0]?.label, "Items 1–200");
    t.is(pages[1]?.label, "Items 201–201");
    const loaded = await provider.getChildren(pages[0]);
    t.deepEqual(
      loaded.map((node) => (provider.getTreeItem(node).iconPath as { id: string }).id),
      ["warning", "question", "debug-alt", "symbol-color"],
    );
    t.is(provider.getTreeItem(loaded[0]).contextValue, "analysisCoverageSegment");
    t.deepEqual(provider.editTarget(loaded[0]), {
      projectDirectory: "/fixture/ok",
      start: 0,
      end: 1,
      annotationIds: ["ann"],
      analysisIds: ["node"],
      runtimeIds: ["run"],
      conflictIds: ["c1"],
      regionIds: ["reg"],
    });
    t.is(provider.editTarget(undefined), undefined);
    t.is(provider.editTarget({}), undefined);
    const details = await provider.getChildren(groups[4]);
    t.is(details[0]?.id, `${groups[4].id}:d0`);
    t.is(details[0]?.label, "gap");

    host.analysisProject = "/fixture/huge";
    host.request = async (_directory, operation) => {
      if (operation === "manifest") {
        return manifest;
      }
      if (operation === "coverage") {
        return { contentSize: 1, summary: summary({ segmentCount: 40001 }), detailCount: 0 };
      }
      throw new Error(operation);
    };
    const hugePages = await provider.getChildren(
      (await provider.getChildren((await provider.getChildren())[0]))[3],
    );
    t.is(hugePages[0]?.label, "Items 1–40000");
    t.is(hugePages[1]?.label, "Items 40001–40001");

    host.analysisProject = "/fixture/fail-expand";
    host.request = async (_directory, operation) => {
      if (operation === "manifest") {
        return manifest;
      }
      throw new Error("coverage failed");
    };
    const failed = await provider.getChildren((await provider.getChildren())[0]);
    t.is(failed[0]?.label, "Could not load coverage");
    t.is(failed[0]?.icon, "error");
  },
);

test.serial("segment pages surface worker errors", async (t) => {
  const provider = new AnalysisCoverageProvider();
  host.analysisProject = "/fixture/page";
  host.request = async (_directory, operation) => {
    if (operation === "manifest") {
      return manifest;
    }
    if (operation === "coverage") {
      return { contentSize: 8, summary: summary({ segmentCount: 2 }), detailCount: 1 };
    }
    throw new Error("page failed");
  };
  const groups = await provider.getChildren((await provider.getChildren())[0]);
  t.is((await provider.getChildren(groups[3]))[0]?.label, "Could not load page");
  provider.refresh();
});
