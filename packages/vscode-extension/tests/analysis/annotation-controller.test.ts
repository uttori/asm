import { registerHooks } from "node:module";

import type { CancellationToken, Position, TextDocument, TextEditor } from "vscode";

import { test } from "../../../../tests/ava-helper.js";
import type { LineInformation } from "../../src/editor-info/format.js";
import type { EditorInformationService } from "../../src/editor-info/provider.js";

function isTextDocument(value: object): value is TextDocument {
  return (
    "uri" in value &&
    typeof value.uri === "object" &&
    value.uri !== null &&
    "languageId" in value &&
    typeof value.languageId === "string" &&
    "lineCount" in value &&
    typeof value.lineCount === "number"
  );
}

function isPosition(value: object): value is Position {
  return (
    "line" in value &&
    typeof value.line === "number" &&
    "character" in value &&
    typeof value.character === "number"
  );
}

function isCancellationToken(value: object): value is CancellationToken {
  return "isCancellationRequested" in value && typeof value.isCancellationRequested === "boolean";
}

function isTextEditor(value: object): value is TextEditor {
  return (
    "document" in value &&
    typeof value.document === "object" &&
    value.document !== null &&
    isTextDocument(value.document)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOverlay(value: unknown): value is {
  renderOptions: {
    after: {
      contentText?: string;
      margin: string;
      color: string | { id: string };
    };
  };
} {
  if (!isRecord(value) || !isRecord(value.renderOptions) || !isRecord(value.renderOptions.after)) {
    return false;
  }
  const after = value.renderOptions.after;
  const margin = after.margin;
  const color = after.color;
  return (
    typeof margin === "string" &&
    (typeof color === "string" || (isRecord(color) && typeof color.id === "string"))
  );
}

function overlay(value: unknown): {
  renderOptions: {
    after: { contentText?: string; margin: string; color: string | { id: string } };
  };
} {
  if (!isOverlay(value)) {
    throw new Error("expected an overlay decoration");
  }
  return value;
}

function documentContent(value: unknown): string {
  const content = isRecord(value) ? value.content : undefined;
  if (typeof content !== "string") {
    throw new Error("expected an opened document");
  }
  return content;
}

function markdownText(value: unknown): string | undefined {
  const text = isRecord(value) ? value.value : undefined;
  return typeof text === "string" ? text : undefined;
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 110));
const host: {
  settings: Record<string, unknown>;
  calls: unknown[][];
  editor:
    | {
        document: {
          uri: { scheme: string; fsPath: string };
          languageId: string;
          version: number;
          isDirty: boolean;
          lineCount: number;
          lineAt: (line: number) => { text: string; range: object };
        };
        selection: { active: { line: number } };
        visibleRanges: { start: { line: number }; end: { line: number } }[];
        options: { tabSize: number };
        setDecorations: (type: unknown, values: unknown[]) => void;
      }
    | undefined;
  writes: string[];
  invalidations: number;
  requests: number;
  hold: Promise<void> | undefined;
  status: { text: string; tooltip: string; visible: boolean };
  failure: Error | undefined;
  noFacts: boolean;
  reasons: string[];
  documents: unknown[];
  section: string | undefined;
  requirements: unknown[];
} = {
  settings: {},
  calls: [],
  editor: undefined,
  writes: [],
  invalidations: 0,
  requests: 0,
  hold: undefined,
  status: { text: "", tooltip: "", visible: false },
  failure: undefined,
  noFacts: false,
  reasons: [],
  documents: [],
  section: undefined,
  requirements: [],
};
Object.assign(globalThis, { __informationHost: host });
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "information-test:vscode" };
    }
    if (
      context.parentURL?.includes("annotation-controller") &&
      ["./project-discovery.js", "./debug-maps.js", "./worker-client.js"].includes(specifier)
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
    setDecorations: (_type: unknown, values: unknown[]) => host.calls.push(values),
  };
  const provider: EditorInformationService = {
    buildCompleted: () => {},
    configurationChanged: () => {},
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
  };
  return new AnalysisAnnotationController(provider);
};
const hover = (controller: InstanceType<typeof AnalysisAnnotationController>) => {
  const editor = host.editor;
  const position = { line: 0, character: 1 };
  const token = { isCancellationRequested: false };
  if (!editor || !isTextEditor(editor) || !isPosition(position) || !isCancellationToken(token)) {
    throw new Error("editor stub");
  }
  return controller.provideHover(editor.document, position, token);
};

test.serial(
  "compact source overlays have no eager hover dump; independent hover preserves qualified counts",
  async (t) => {
    const controller = setup();
    t.teardown(() => controller.dispose());
    if (!host.editor || !isTextEditor(host.editor)) {
      throw new Error("editor stub");
    }
    controller.refresh(host.editor);
    await settle();
    const decoration = overlay(host.calls.at(-1)![0]);
    const contentText = decoration.renderOptions.after.contentText;
    if (typeof contentText !== "string") {
      throw new Error("expected overlay text");
    }
    t.is(contentText, "$20964 / $C20964 · exec 0 / 19");
    t.is(decoration.renderOptions.after.margin, "0 0 0 77ch");
    if (!isRecord(decoration.renderOptions.after.color)) {
      throw new Error("expected overlay color");
    }
    t.is(decoration.renderOptions.after.color.id, "editorCodeLens.foreground");
    t.false("hoverMessage" in decoration);
    await controller.toggle();
    t.is(host.writes.at(-1), "editorInfo.inline.enabled");
    t.deepEqual(host.calls.at(-1), []);
    const result = await hover(controller);
    t.is(
      markdownText(result?.contents),
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
    if (!host.editor) {
      throw new Error("editor stub");
    }
    host.editor.document.isDirty = true;
    if (!isTextDocument(host.editor.document)) {
      throw new Error("document stub");
    }
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
    const aligned = host.calls.at(-1)!.map((entry) => overlay(entry).renderOptions.after);
    t.deepEqual(
      aligned.map((entry) => entry.margin),
      ["0 0 0 73ch", "0 0 0 38ch"],
    );
    t.true(aligned.every((entry) => entry.color === "#FFA65C"));
    host.settings["editorInfo.inline.column"] = 20;
    controller.refresh();
    await settle();
    t.deepEqual(
      host.calls.at(-1)!.map((entry) => overlay(entry).renderOptions.after.margin),
      ["0 0 0 13ch", "0 0 0 3ch"],
      "long lines keep their own gap without shifting the short instruction",
    );
    host.settings["editorInfo.inline.placement"] = "afterLine";
    host.settings["editorInfo.inline.color"] = "editorWarning.foreground";
    controller.refresh();
    await settle();
    const afterLine = host.calls.at(-1)!.map((entry) => overlay(entry).renderOptions.after);
    t.true(afterLine.every((entry) => entry.margin === "0 0 0 3ch"));
    t.true(
      afterLine.every(
        (entry) => isRecord(entry.color) && entry.color.id === "editorWarning.foreground",
      ),
    );
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
    t.regex(documentContent(host.documents.at(-1)), /other\.asm/);
    host.failure = new Error("Analysis annotationSummary process exceeded 60 seconds.");
    controller.refresh();
    await settle();
    t.regex(host.status.text, /Error/);
    t.regex(host.status.tooltip, /exceeded 60 seconds/);
    if (!host.editor) {
      throw new Error("editor stub");
    }
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
    t.is(overlay(annotations[0]).renderOptions.after.margin, "0 0 0 77ch");
    t.is(overlay(annotations[1]).renderOptions.after.margin, "0 0 0 3ch");
    t.regex(host.status.text, /2 lines/);
    await controller.toggle();
    if (typeof host.settings["editorInfo.inline.enabled"] !== "boolean") {
      throw new Error("expected a boolean inline setting");
    }
    t.false(host.settings["editorInfo.inline.enabled"]);
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
    t.regex(documentContent(host.documents.at(-1)), /execution_counts: 0 \/ 19/);
    host.section = "Evidence and control flow";
    await controller.inspectLine();
    t.deepEqual(host.requirements.at(-1), { counts: true, bytes: false, state: true });
  },
);
