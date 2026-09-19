import fs from "node:fs";
import { registerHooks } from "node:module";

import { test } from "../../../tests/ava-helper.js";

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

const host = {
  enabled: true,
  hold: false,
  release: undefined as (() => void) | undefined,
  writes: [] as { key: string; value: boolean; target: number }[],
  calls: [] as Array<
    Array<{
      range: { start: { line: number } };
      renderOptions: { after: { margin: string; color: { id: string }; contentText: string } };
    }>
  >,
  editor: undefined as
    | {
        document: {
          uri: { scheme: string; fsPath: string };
          lineCount: number;
          lineAt: (line: number) => { text: string };
        };
        options: { tabSize: number };
        visibleRanges: { start: { line: number }; end: { line: number } }[];
        setDecorations: (type: unknown, decorations: unknown) => void;
      }
    | undefined,
  rows: [] as unknown[],
};

(
  globalThis as { __uttoriAnnotationControllerTest?: typeof host }
).__uttoriAnnotationControllerTest = host;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "annotation-controller-test:vscode" };
    }
    if (
      typeof context.parentURL === "string" &&
      /[/\\]analysis-annotation-controller\.(ts|js|mts|mjs)/.test(context.parentURL)
    ) {
      if (specifier === "./analysis-worker-client.js") {
        return { shortCircuit: true, url: "annotation-controller-test:worker-client" };
      }
      if (specifier === "./analysis-debug-maps.js") {
        return { shortCircuit: true, url: "annotation-controller-test:debug-maps" };
      }
      if (specifier === "./coverage-tree.js") {
        return { shortCircuit: true, url: "annotation-controller-test:coverage-tree" };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "annotation-controller-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriAnnotationControllerTest;
          export const ConfigurationTarget = { WorkspaceFolder: 3, Global: 1 };
          export const DecorationRangeBehavior = { ClosedClosed: 1 };
          export class Range {
            constructor(line) { this.start = { line }; }
          }
          export class ThemeColor {
            constructor(id) { this.id = id; }
          }
          export class MarkdownString {
            appendMarkdown() {}
            appendText() {}
            appendCodeblock() {}
          }
          export const window = {
            get activeTextEditor() { return host.editor; },
            get visibleTextEditors() { return host.editor ? [host.editor] : []; },
            createTextEditorDecorationType: () => ({ dispose() {} }),
          };
          export const workspace = {
            getWorkspaceFolder: () => ({ name: "project" }),
            getConfiguration: () => ({
              get: (key, fallback) =>
                key === "analysis.showAnnotations" ? host.enabled : fallback,
              update: async (key, value, target) => {
                host.enabled = value;
                host.writes.push({ key, value, target });
              },
            }),
          };
        `,
      };
    }
    if (url === "annotation-controller-test:worker-client") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriAnnotationControllerTest;
          export const analysisWorker = () => ({
            request: async (_directory, operation) => {
              if (operation === "manifest") {
                return { target: "snes.sfc", rom: { contentSha256: "fixture", contentSize: 2 } };
              }
              if (host.hold) {
                await new Promise((resolve) => {
                  host.release = resolve;
                });
              }
              return host.rows;
            },
          });
        `,
      };
    }
    if (url === "annotation-controller-test:debug-maps") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          export const currentAnalysisSourcePath = () => "/project/main.asm";
          export const findAnalysisDebugMapCandidates = async () => [
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
          ];
        `,
      };
    }
    if (url === "annotation-controller-test:coverage-tree") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          export const findAnalysisProjectDirectories = async () => ["/project/analysis"];
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { AnalysisAnnotationController } = await import("../src/analysis-annotation-controller.js");

test("source overlays align in the rendered editor and stay hidden when pending analysis finishes", async (t) => {
  host.enabled = true;
  host.hold = false;
  host.release = undefined;
  host.writes = [];
  host.calls = [];
  const lines = ["nop", "\tlda\t#$10"];
  host.editor = {
    document: {
      uri: { scheme: "file", fsPath: "/project/main.asm" },
      lineCount: 2,
      lineAt: (line: number) => ({ text: lines[line] ?? "" }),
    },
    options: { tabSize: 4 },
    visibleRanges: [{ start: { line: 0 }, end: { line: 1 } }],
    setDecorations: (_type: unknown, decorations: unknown) => {
      host.calls.push(decorations as (typeof host.calls)[number]);
    },
  };
  host.rows = lines.map((_, index) => ({
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
  const controller = new AnalysisAnnotationController();
  t.teardown(() => controller.dispose());
  controller.refresh();
  await settle();
  const decorated = host.calls.at(-1)!;
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

  host.hold = true;
  controller.refresh();
  await settle();
  t.truthy(host.release);
  await controller.toggle();
  t.false(host.enabled);
  t.is(host.calls.at(-1)!.length, 0);
  const hiddenCalls = host.calls.length;
  host.release!();
  await settle();
  t.true(host.calls.slice(hiddenCalls).every((decorations) => decorations.length === 0));
  host.hold = false;
  await controller.toggle();
  await settle();
  t.true(host.enabled);
  t.is(host.calls.at(-1)!.length, 2);
  t.deepEqual(host.writes, [
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
