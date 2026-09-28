import { registerHooks } from "node:module";

import type { TextEditor, TextDocument, CancellationToken, Position } from "vscode";

import { test } from "../../../../tests/ava-helper.js";
import type { LineInformation } from "../../src/editor-info/format.js";
import type { EditorInformationProvider } from "../../src/editor-info/provider.js";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 110));
const host = {
  settings: {} as Record<string, unknown>,
  calls: [] as any[][],
  editor: undefined as any,
  writes: [] as string[],
  invalidations: 0,
  requests: 0,
  hold: undefined as Promise<void> | undefined,
  status: { text: "", tooltip: "", visible: false } as any,
  failure: undefined as Error | undefined,
  noFacts: false,
  reasons: [] as string[],
  documents: [] as any[],
  section: undefined as string | undefined,
  requirements: [] as unknown[],
};
(globalThis as any).__informationHost = host;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "information-test:vscode" };
    }
    if (
      context.parentURL?.includes("annotation-controller") &&
      ["./coverage-tree.js", "./debug-maps.js", "./worker-client.js"].includes(specifier)
    ) {
      return { shortCircuit: true, url: "information-test:dependencies" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "information-test:dependencies") {
      return {
        shortCircuit: true,
        format: "module",
        source:
          "export const findAnalysisProjectDirectories = async () => []; export const discoverAnalysisDebugMapFiles = async () => []; export const analysisWorker = () => ({ request: async () => [] });",
      };
    }
    if (url !== "information-test:vscode") {
      return nextLoad(url, context);
    }
    return {
      shortCircuit: true,
      format: "module",
      source: `
      const host = globalThis.__informationHost;
      const disposable = () => ({ dispose() {} });
      export const ConfigurationTarget = { WorkspaceFolder: 3, Global: 1 };
      export const StatusBarAlignment = { Right: 2 };
      export const DecorationRangeBehavior = { ClosedClosed: 1 };
      export class Range { constructor(line) { this.start = { line }; } }
      export class ThemeColor { constructor(id) { this.id = id; } }
      export class MarkdownString {
        value = "";
        appendMarkdown(value) { this.value += value; }
        appendText(value) { this.value += value; }
      }
      export class Hover { constructor(contents) { this.contents = contents; } }
      export const commands = { registerCommand: disposable, executeCommand: async () => {} };
      export const languages = { registerHoverProvider: disposable };
      export const debug = {};
      export const Uri = { file: (fsPath) => ({ fsPath }) };
      export const window = {
        get activeTextEditor() { return host.editor; },
        get visibleTextEditors() { return host.editor ? [host.editor] : []; },
        createTextEditorDecorationType: disposable, showWarningMessage() {},
        createStatusBarItem: () => Object.assign(host.status, { show() { this.visible = true; }, hide() { this.visible = false; }, dispose() {} }),
        showTextDocument: async () => {},
        showQuickPick: async (items) => items.find((item) => item.label === host.section),
      };
      export const workspace = {
        get textDocuments() { return host.editor ? [host.editor.document] : []; },
        openTextDocument: async (options) => { host.documents.push(options); return options; },
        getWorkspaceFolder: () => ({ name: "project" }),
        createFileSystemWatcher: () => ({ dispose() {}, onDidChange: disposable, onDidCreate: disposable, onDidDelete: disposable }),
        getConfiguration: () => ({
          get: (key, fallback) => host.settings[key] ?? fallback,
          inspect: (key) => ({ workspaceFolderValue: host.settings[key] }),
          update: async (key, value) => { host.settings[key] = value; host.writes.push(key); },
        }),
      };
    `,
    };
  },
});
const { AnalysisAnnotationController } =
  await import("../../src/analysis/annotation-controller.js");
const facts: LineInformation = {
  identity: "fixture",
  label: "fixture",
  ranges: [],
  instructions: [],
  locations: [
    { addressSpace: "rom.file", address: 0x20964, file: true, executionCount: 0 },
    { addressSpace: "snes.cpu", address: 0xc20964, file: false, executionCount: 19 },
  ],
};
const setup = (sourceLines = ["RTS"]) => {
  host.settings = {};
  host.calls = [];
  host.requests = 0;
  host.invalidations = 0;
  host.writes = [];
  host.hold = undefined;
  host.failure = undefined;
  host.noFacts = false;
  host.reasons = [];
  host.documents = [];
  host.section = undefined;
  host.requirements = [];
  host.status = { text: "", tooltip: "", visible: false };
  host.editor = {
    document: {
      uri: { scheme: "file", fsPath: "/project/main.asm" },
      languageId: "uttori-snes",
      version: 1,
      isDirty: false,
      lineCount: sourceLines.length,
      lineAt: (line: number) => ({ text: sourceLines[line], range: {} }),
    },
    selection: { active: { line: 0 } },
    visibleRanges: [{ start: { line: 0 }, end: { line: sourceLines.length - 1 } }],
    options: { tabSize: 4 },
    setDecorations: (_type: unknown, values: any[]) => host.calls.push(values),
  };
  const provider = {
    lines: async (_file: string, _ranges: unknown, requirements: unknown) => {
      host.requirements.push(requirements);
      host.requests++;
      await host.hold;
      if (host.failure) {
        throw host.failure;
      }
      if (host.noFacts) {
        return new Map();
      }
      return new Map(sourceLines.map((_, index) => [index + 1, [facts]]));
    },
    invalidate: () => {
      host.invalidations++;
    },
    tracks: () => true,
    diagnostics: async () => host.reasons,
  } as unknown as EditorInformationProvider;
  return new AnalysisAnnotationController(provider);
};
const hover = (controller: InstanceType<typeof AnalysisAnnotationController>) =>
  controller.provideHover(
    host.editor.document as TextDocument,
    { line: 0, character: 1 } as Position,
    { isCancellationRequested: false } as CancellationToken,
  );

test.serial(
  "compact source overlays have no eager hover dump; independent hover preserves qualified counts",
  async (t) => {
    const controller = setup();
    t.teardown(() => controller.dispose());
    controller.refresh(host.editor as TextEditor);
    await settle();
    const decoration = host.calls.at(-1)![0];
    t.is(decoration.renderOptions.after.contentText, "$20964 / $C20964 · exec 0 / 19");
    t.is(decoration.renderOptions.after.margin, "0 0 0 77ch");
    t.is(decoration.renderOptions.after.color.id, "editorCodeLens.foreground");
    t.false("hoverMessage" in decoration);
    await controller.toggle();
    t.is(host.writes.at(-1), "editorInfo.inline.enabled");
    t.deepEqual(host.calls.at(-1), []);
    const result = await hover(controller);
    t.is(
      (result?.contents as any)?.value,
      "**Uttori analysis**\n\nOutput Offsets: $20964 / $C20964\nExecution Observations: $20964: 0 / $C20964: 19",
    );
  },
);

test.serial(
  "late viewport work cannot resurrect disabled or dirty source information",
  async (t) => {
    const controller = setup();
    t.teardown(() => controller.dispose());
    let release!: () => void;
    host.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    controller.refresh();
    await settle();
    await controller.toggle();
    release();
    await settle();
    t.deepEqual(host.calls.at(-1), []);
    host.editor.document.isDirty = true;
    controller.documentChanged(host.editor.document);
    t.is(await hover(controller), undefined);
    t.true(host.invalidations > 0);
  },
);

test.serial(
  "legacy visibility, tab-aware alignment and color changes preserve independent display choices",
  async (t) => {
    const controller = setup(["\tRTS", "\tLDA.w RAM_EASTER_EGG_COUNTER & $FFFF,x"]);
    t.teardown(() => controller.dispose());
    host.settings = { "analysis.showAnnotations": false, "editorInfo.hover.enabled": false };
    controller.refresh();
    await settle();
    t.is(await hover(controller), undefined);
    t.is(host.requests, 0);
    host.settings = { "analysis.annotationColumn": 80, "editorInfo.inline.color": "#FFA65C" };
    controller.refresh();
    await settle();
    const aligned = host.calls.at(-1)!.map((entry) => entry.renderOptions.after);
    t.deepEqual(
      aligned.map((entry) => entry.margin),
      ["0 0 0 73ch", "0 0 0 38ch"],
    );
    t.true(aligned.every((entry) => entry.color === "#FFA65C"));
    host.settings["editorInfo.inline.column"] = 20;
    controller.refresh();
    await settle();
    t.deepEqual(
      host.calls.at(-1)!.map((entry) => entry.renderOptions.after.margin),
      ["0 0 0 13ch", "0 0 0 3ch"],
      "long lines keep their own gap without shifting the short instruction",
    );
    host.settings["editorInfo.inline.placement"] = "afterLine";
    host.settings["editorInfo.inline.color"] = "editorWarning.foreground";
    controller.refresh();
    await settle();
    const afterLine = host.calls.at(-1)!.map((entry) => entry.renderOptions.after);
    t.true(afterLine.every((entry) => entry.margin === "0 0 0 3ch"));
    t.true(afterLine.every((entry) => entry.color.id === "editorWarning.foreground"));
    t.is(host.invalidations, 0, "presentation changes do not invalidate cached facts");
  },
);

test.serial(
  "disabling hover discards a pending reply without touching instruction help",
  async (t) => {
    const controller = setup();
    t.teardown(() => controller.dispose());
    let release!: () => void;
    host.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = hover(controller);
    host.settings["editorInfo.hover.enabled"] = false;
    release();
    t.is(await pending, undefined);
  },
);

test.serial(
  "source status exposes dependency failures and provider errors without stale updates",
  async (t) => {
    const controller = setup();
    t.teardown(() => controller.dispose());
    host.noFacts = true;
    host.reasons = [
      "Source differs from build: /project/other.asm (SHA-256 mismatch). Run Build Binary.",
    ];
    controller.refresh();
    await settle();
    t.regex(host.status.text, /Unavailable/);
    t.regex(host.status.tooltip, /other\.asm/);
    await controller.showStatus();
    t.regex(host.documents.at(-1).content, /other\.asm/);
    host.failure = new Error("Analysis annotationSummary process exceeded 60 seconds.");
    controller.refresh();
    await settle();
    t.regex(host.status.text, /Error/);
    t.regex(host.status.tooltip, /exceeded 60 seconds/);
    host.editor.document.isDirty = true;
    controller.refresh();
    t.regex(host.status.text, /Unsaved/);
    await controller.toggle();
    t.regex(host.status.text, /Off/);
  },
);

test.serial(
  "long data declarations do not move other annotations offscreen and toggle migrates local legacy visibility",
  async (t) => {
    const controller = setup(["RTS", `dataStruct Example, { bytes = [${"$FF, ".repeat(500)}] }`]);
    t.teardown(() => controller.dispose());
    host.settings["analysis.showAnnotations"] = true;
    controller.refresh();
    await settle();
    const annotations = host.calls.at(-1)!;
    t.is(annotations[0].renderOptions.after.margin, "0 0 0 77ch");
    t.is(annotations[1].renderOptions.after.margin, "0 0 0 3ch");
    t.regex(host.status.text, /2 lines/);
    await controller.toggle();
    t.false(host.settings["editorInfo.inline.enabled"] as boolean);
    t.is(host.settings["analysis.showAnnotations"], undefined);
    t.deepEqual(host.writes, ["editorInfo.inline.enabled", "analysis.showAnnotations"]);
  },
);

test.serial(
  "inspector cancellation does no I/O and summary selection stays on shallow fields",
  async (t) => {
    const controller = setup();
    t.teardown(() => controller.dispose());
    await controller.inspectLine();
    t.is(host.requests, 0);
    host.section = "Summary";
    await controller.inspectLine();
    t.deepEqual(host.requirements, [{ counts: true, bytes: true, state: false }]);
    t.regex(host.documents.at(-1).content, /execution_counts: 0 \/ 19/);
    host.section = "Evidence and control flow";
    await controller.inspectLine();
    t.deepEqual(host.requirements.at(-1), { counts: true, bytes: false, state: true });
  },
);
