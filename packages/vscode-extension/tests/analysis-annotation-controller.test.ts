import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

import { build } from "esbuild";

import { test } from "../../../tests/ava-helper.js";

const bundle = await build({
  entryPoints: ["packages/vscode-extension/src/analysis-annotation-controller.ts"],
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  write: false,
  plugins: [
    {
      name: "annotation-host",
      setup(builder) {
        builder.onResolve(
          {
            filter:
              /^(vscode|\.\/analysis-worker-client\.js|\.\/analysis-debug-maps\.js|\.\/coverage-tree\.js)$/,
          },
          ({ path }) => ({ path, namespace: "host" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "host" }, ({ path }) => ({
          contents: `module.exports = globalThis.host[${JSON.stringify(path)}];`,
        }));
      },
    },
  ],
});

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("source overlays align in the rendered editor and stay hidden when pending analysis finishes", async (t) => {
  let enabled = true;
  let hold = false;
  let release: (() => void) | undefined;
  const writes: { key: string; value: boolean; target: number }[] = [];
  const calls: Array<
    Array<{
      range: { start: { line: number } };
      renderOptions: { after: { margin: string; color: { id: string }; contentText: string } };
    }>
  > = [];
  const lines = ["nop", "\tlda\t#$10"];
  const editor = {
    document: {
      uri: { scheme: "file", fsPath: "/project/main.asm" },
      lineCount: 2,
      lineAt: (line: number) => ({ text: lines[line] }),
    },
    options: { tabSize: 4 },
    visibleRanges: [{ start: { line: 0 }, end: { line: 1 } }],
    setDecorations: (_type: unknown, decorations: (typeof calls)[number]) =>
      calls.push(decorations),
  };
  const rows = lines.map((_, index) => ({
    line: index + 1,
    annotation: {
      id: `instruction:${index}`,
      address: 0x808000 + index,
      addressSpace: "snes.cpu",
      architectures: ["snes.65816"],
      outputOffsets: [],
      nodeIds: [],
      evidence: [],
      effectiveAddresses: [],
      memoryAccesses: [],
      stateTransitions: [],
      stateObservations: [{ source: "project", state: { m: true }, recordIds: [], evidence: [] }],
      executionCount: 0,
      executionRecordIds: [],
      runtimeCoverage: [],
    },
  }));
  const host = {
    vscode: {
      ConfigurationTarget: { WorkspaceFolder: 3, Global: 1 },
      DecorationRangeBehavior: { ClosedClosed: 1 },
      Range: class {
        start: { line: number };
        constructor(line: number) {
          this.start = { line };
        }
      },
      ThemeColor: class {
        constructor(readonly id: string) {}
      },
      MarkdownString: class {
        appendMarkdown() {}
        appendText() {}
        appendCodeblock() {}
      },
      window: {
        activeTextEditor: editor,
        visibleTextEditors: [editor],
        createTextEditorDecorationType: () => ({ dispose() {} }),
      },
      workspace: {
        getWorkspaceFolder: () => ({ name: "project" }),
        getConfiguration: () => ({
          get: (key: string, fallback: unknown) =>
            key === "analysis.showAnnotations" ? enabled : fallback,
          update: async (key: string, value: boolean, target: number) => {
            enabled = value;
            writes.push({ key, value, target });
          },
        }),
      },
    },
    "./analysis-worker-client.js": {
      analysisWorker: () => ({
        request: async (_directory: string, operation: string) => {
          if (operation === "manifest")
            return { target: "snes.sfc", rom: { contentSha256: "fixture", contentSize: 2 } };
          if (hold)
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          return rows;
        },
      }),
    },
    "./analysis-debug-maps.js": {
      currentAnalysisSourcePath: () => "/project/main.asm",
      findAnalysisDebugMapCandidates: async () => [
        {
          map: {
            target: "snes.sfc",
            output: { sha256: "fixture", size: 2 },
            sources: [{ id: 0 }],
            ranges: [
              { sourceId: 0, line: 1 },
              { sourceId: 0, line: 2 },
            ],
          },
        },
      ],
    },
    "./coverage-tree.js": { findAnalysisProjectDirectories: async () => ["/project/analysis"] },
  };
  const module = {
    exports: {} as typeof import("../src/analysis-annotation-controller.js"),
  };
  vm.runInNewContext(bundle.outputFiles![0]!.text, {
    module,
    exports: module.exports,
    host,
    require: createRequire(import.meta.url),
  });
  const controller = new module.exports.AnalysisAnnotationController();
  t.teardown(() => controller.dispose());
  controller.refresh();
  await settle();
  const decorated = calls.at(-1)!;
  t.is(decorated.length, 2);
  t.is(decorated[0]!.renderOptions.after.margin, "0 0 0 77ch");
  t.is(decorated[1]!.renderOptions.after.margin, "0 0 0 68ch");
  t.true(
    decorated.every(({ renderOptions }) =>
      renderOptions.after.contentText.startsWith("│ project state"),
    ),
  );
  t.true(
    decorated.every(
      ({ renderOptions }) => renderOptions.after.color.id === "editorInfo.foreground",
    ),
  );

  hold = true;
  controller.refresh();
  await settle();
  t.truthy(release);
  await controller.toggle();
  t.false(enabled);
  t.is(calls.at(-1)!.length, 0);
  const hiddenCalls = calls.length;
  release!();
  await settle();
  t.true(calls.slice(hiddenCalls).every((decorations) => decorations.length === 0));
  hold = false;
  await controller.toggle();
  await settle();
  t.true(enabled);
  t.is(calls.at(-1)!.length, 2);
  t.deepEqual(writes, [
    { key: "analysis.showAnnotations", value: false, target: 3 },
    { key: "analysis.showAnnotations", value: true, target: 3 },
  ]);
});

test("overlay toggle is a direct editor toolbar button with project-scoped preferences", (t) => {
  const { contributes } = JSON.parse(
    fs.readFileSync("packages/vscode-extension/package.json", "utf8"),
  );
  const command = contributes.commands.find(
    ({ command }: { command: string }) => command === "asm.analysis.toggleAnnotations",
  );
  t.is(command.icon, "$(eye)");
  t.is(command.toggled, "config.asm.analysis.showAnnotations");
  t.true(
    contributes.menus["editor/title"].some(
      ({ command, group }: { command: string; group: string }) =>
        command === "asm.analysis.toggleAnnotations" && group.startsWith("navigation"),
    ),
  );
  t.is(contributes.configuration.properties["asm.analysis.showAnnotations"].scope, "resource");
});
