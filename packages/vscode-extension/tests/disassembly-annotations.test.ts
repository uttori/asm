import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import vm from "node:vm";

import { canonicalDebugMapJson } from "@uttori/asm-core/debug-map";
import type { DebugMap } from "@uttori/asm-core/debug-map";
import {
  RomImage,
  writeAnalysisProject,
  loadAnalysisProjectSnapshot,
  commitAnalysisProjectTransaction,
  type AnalysisProject,
} from "@uttori/asm-disassembler";
import { build } from "esbuild";

import { test } from "../../../tests/ava-helper.js";

const bundled = await build({
  stdin: {
    contents:
      'export { AnalysisProjectEditor } from "./analysis-project-editor.ts"; export { initializeAnalysisWorker } from "./analysis-worker-client.ts";',
    resolveDir: path.resolve("packages/vscode-extension/src"),
  },
  write: false,
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  external: ["vscode"],
});
const workerRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-worker-"));
await build({
  entryPoints: [path.resolve("packages/vscode-extension/src/analysis-worker.ts")],
  outfile: path.join(workerRoot, "out/analysis-worker.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  logLevel: "silent",
});
const code = bundled.outputFiles[0].text;
const locationBundle = await build({
  entryPoints: [path.resolve("packages/vscode-extension/src/disassembly-annotation-location.ts")],
  write: false,
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "esm",
});
const { annotationLocationsForSource } = (await import(
  `data:text/javascript;base64,${Buffer.from(locationBundle.outputFiles[0].text).toString("base64")}`
)) as typeof import("../src/disassembly-annotation-location.js");

test.after.always(() => fs.rmSync(workerRoot, { recursive: true, force: true }));
const nativeRequire = createRequire(import.meta.url);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const uri = (file: string) => ({ scheme: "file", fsPath: file, toString: () => `file://${file}` });

const harness = (t: { teardown(callback: () => void): void }) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-ui-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, "bank.asm");
  const text = "; Generated bank\norg $C3002C\n\nFn_C3002C:\n.a16\n  PHB\n";
  fs.writeFileSync(source, text);
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "snes.sfc",
      rom: new RomImage(new Uint8Array(0x40000)).identity,
      mapping: { mapper: "hirom", source: "override", candidates: [] },
      addressSpaces: [{ id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
    },
    shards: {
      labels: [],
      comments: [],
      annotations: [],
      evidence: [],
      regions: [],
      runtime: [],
      imports: [],
      analysis: [
        {
          kind: "function",
          id: "function",
          addressSpace: "snes.cpu",
          address: 0xc3002c,
          source: "call",
          evidence: [],
          evidencePath: [],
        },
        {
          kind: "cfg-node",
          id: "node",
          addressSpace: "snes.cpu",
          address: 0xc3002c,
          fileOffset: 0x3002c,
          size: 1,
          opcode: 0x8b,
          specificationId: "snes.65816.phb.implied",
          mnemonic: "PHB",
          mode: "implied",
          context: [],
          incomingState: {},
          outgoingState: {},
          effectiveAddresses: [],
          entryPoint: "entry",
          evidencePath: [],
          evidence: [],
        },
      ],
    },
  };
  writeAnalysisProject(directory, project);
  const mapFile = path.join(directory, "main.debug.json");
  const payload = {
    format: "uttori-asm-debug-map",
    schemaVersion: 1,
    target: project.manifest.target,
    output: { size: project.manifest.rom.contentSize, sha256: project.manifest.rom.contentSha256 },
    sources: [{ id: 0, path: "bank.asm", size: text.length, crc32: 0, sha256: hash(text) }],
    ranges: [
      {
        sourceId: 0,
        line: 6,
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        start: 0xc3002c,
        end: 0xc3002d,
        outputStart: 0x3002c,
        outputEnd: 0x3002d,
      },
    ],
  };
  fs.writeFileSync(
    mapFile,
    JSON.stringify({
      ...payload,
      fingerprint: { algorithm: "sha256", value: hash(canonicalDebugMapJson(payload)) },
    }),
  );
  const errors: string[] = [];
  const commands: string[] = [];
  const panels: Array<{
    html: string;
    disposed: boolean;
    messages: Array<{ type: string; message: string; fields?: typeof fields }>;
    receive(message: unknown): Promise<void>;
  }> = [];
  const editorDocument = {
    uri: uri(source),
    languageId: "uttori-snes",
    isDirty: false,
    getText: () => fs.readFileSync(source, "utf8"),
  };
  const workspace = {
    isTrusted: true,
    workspaceFolders: [{ uri: uri(directory) }],
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) => (key === "analysisProject" ? directory : fallback),
    }),
    getWorkspaceFolder: () => ({ uri: uri(directory) }),
    findFiles: async (pattern: string) => (pattern.includes("debug.json") ? [uri(mapFile)] : []),
  };
  const mock = {
    workspace,
    Uri: {
      file: uri,
      joinPath: (root: { fsPath: string }, ...parts: string[]) =>
        uri(path.join(root.fsPath, ...parts)),
    },
    debug: {},
    ViewColumn: { Beside: 2 },
    commands: {
      executeCommand: async (command: string) => {
        commands.push(command);
      },
    },
    window: {
      activeTextEditor: {
        document: editorDocument,
        selection: { active: { line: 3, character: 4 } },
      },
      showErrorMessage: async (message: string) => {
        errors.push(message);
      },
      showInformationMessage: async () => undefined,
      showQuickPick: async (items: unknown[]) => items[0],
      createWebviewPanel: () => {
        const onDispose: Array<() => void> = [];
        const panel = {
          html: "",
          disposed: false,
          messages: [] as Array<{ type: string; message: string }>,
          receive: async (_message: unknown) => {},
        };
        panels.push(panel);
        return {
          webview: {
            cspSource: "https://webview.example",
            asWebviewUri: (value: unknown) => value,
            set html(value: string) {
              panel.html = value;
              queueMicrotask(() => {
                void panel.receive({ type: "ready" });
              });
            },
            onDidReceiveMessage: (callback: typeof panel.receive) => {
              panel.receive = callback;
              return { dispose() {} };
            },
            postMessage: async (message: { type: string; message: string }) => {
              panel.messages.push(message);
            },
          },
          onDidDispose: (callback: () => void) => {
            onDispose.push(callback);
            return { dispose() {} };
          },
          dispose: () => {
            panel.disposed = true;
            onDispose.forEach((callback) => callback());
          },
        };
      },
    },
  };
  const module = {
    exports: {} as typeof import("../src/analysis-project-editor.js") &
      typeof import("../src/analysis-worker-client.js"),
  };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (id: string) => (id === "vscode" ? mock : nativeRequire(id)),
    Buffer,
    process,
    setTimeout,
    clearTimeout,
    performance,
    TextEncoder,
    TextDecoder,
  });
  const worker = module.exports.initializeAnalysisWorker(workerRoot);
  t.teardown(() => worker.dispose());
  const editor = new module.exports.AnalysisProjectEditor(
    () => {},
    uri(path.resolve("packages/vscode-extension")) as never,
  );
  t.teardown(() => editor.dispose());
  return {
    directory,
    source,
    mapFile,
    errors,
    commands,
    panels,
    editorDocument,
    workspace,
    editor,
    worker,
  };
};
const fields = {
  name: "APU_IPL_Bootstrap",
  comment: "Initialize APU.\nKeep state.",
  inlineComment: "Bootstrap entry",
  instructionComment: "Save data bank",
};

test("symbol references resolve through mapped definitions after names change or are reused", (t) => {
  const h = harness(t);
  const project = loadAnalysisProjectSnapshot(h.directory);
  const map = JSON.parse(fs.readFileSync(h.mapFile, "utf8")) as DebugMap;
  const reference = "  JSL.l Fn_C3002C\n";
  const shards = {
    ...project.shards,
    labels: [
      {
        id: "original",
        addressSpace: "snes.cpu",
        address: 0xc3002c,
        name: "APU_IPL_Bootstrap",
        sourceName: "APU_IPL_Bootstrap",
        evidence: [],
      },
      {
        id: "reused",
        addressSpace: "snes.cpu",
        address: 0xc31000,
        name: "Fn_C3002C",
        sourceName: "Fn_C3002C",
        evidence: [],
      },
    ],
  };
  const sources = new Map([
    [0, fs.readFileSync(h.source, "utf8")],
    [1, reference],
  ]);
  const locations = annotationLocationsForSource(map, 1, reference, 1, 10, shards, sources);
  t.deepEqual(
    locations.map(({ address, labelId }) => ({ address, labelId })),
    [{ address: 0xc3002c, labelId: "original" }],
  );
  t.deepEqual(annotationLocationsForSource(map, 1, reference, 1, 10, shards), []);
  const relocated = "Fn_C3002C:\norg $C31000\n  PHB\n";
  const movedMap = {
    ...map,
    ranges: map.ranges.map((range) => ({ ...range, line: 3, start: 0xc31000, end: 0xc31001 })),
  };
  t.deepEqual(annotationLocationsForSource(movedMap, 0, relocated, 1, 0, shards), []);
});

test("source selection preserves native file-space label identities", (t) => {
  const h = harness(t);
  const project = loadAnalysisProjectSnapshot(h.directory);
  const map = JSON.parse(fs.readFileSync(h.mapFile, "utf8")) as DebugMap;
  const source = fs.readFileSync(h.source, "utf8");
  const shards = {
    ...project.shards,
    labels: [
      { id: "file-label", addressSpace: "rom.file", address: 0x3002c, name: "Entry", evidence: [] },
    ],
  };
  t.deepEqual(
    annotationLocationsForSource(map, 0, source, 4, 0, shards, new Map([[0, source]]), [
      "rom.file",
    ]),
    [{ labelId: "file-label", addressSpace: "rom.file", address: 0x3002c, name: "L_Entry" }],
  );
});

test("annotation cancellation and unmodified Save and Regenerate do not create metadata", async (t) => {
  const h = harness(t);
  const before = loadAnalysisProjectSnapshot(h.directory).revision.manifestSha256;
  await h.editor.editAnnotation();
  t.regex(h.panels[0].html, /src="[^"]+annotation.js"/);
  t.false(h.panels[0].html.includes("acquireVsCodeApi"));
  await h.panels[0].receive({ type: "cancel" });
  t.true(h.panels[0].disposed);
  t.is(loadAnalysisProjectSnapshot(h.directory).revision.manifestSha256, before);
  await h.editor.editAnnotation();
  await h.panels[1].receive({
    type: "save",
    fields: { name: "Fn_C3002C", comment: "", inlineComment: "", instructionComment: "" },
    regenerate: true,
  });
  t.true(h.commands.includes("asm.disassembly.regenerate"));
  t.is(loadAnalysisProjectSnapshot(h.directory).revision.manifestSha256, before);
});

test("VS Code resolves generated functions, validates the form, saves transactionally, regenerates, and undoes/redoes", async (t) => {
  const h = harness(t);
  const initial = loadAnalysisProjectSnapshot(h.directory);
  // Metadata views omit this fact; save and both history directions must preserve it in SQLite.
  commitAnalysisProjectTransaction(h.directory, initial.revision, {
    ...initial,
    shards: {
      ...initial.shards,
      runtime: [
        {
          id: "retained-runtime",
          kind: "runtime-execution",
          architecture: "snes.65816",
          addressSpace: "snes.cpu",
          address: 0xc3002c,
          count: 7,
          evidence: [],
        },
      ],
    },
  });
  const before = loadAnalysisProjectSnapshot(h.directory);
  await h.editor.editAnnotation();
  t.deepEqual(h.errors, []);
  const panel = h.panels[0];
  t.is(panel.messages.find(({ type }) => type === "initialize")?.fields?.name, "Fn_C3002C");
  await panel.receive({ type: "save", fields: { ...fields, name: "APUIO0" }, regenerate: false });
  t.regex(panel.messages.at(-1)!.message, /conflicts/);
  t.is(
    loadAnalysisProjectSnapshot(h.directory).revision.manifestSha256,
    before.revision.manifestSha256,
  );
  await panel.receive({ type: "save", fields, regenerate: true });
  t.true(panel.disposed);
  t.true(h.commands.includes("asm.disassembly.regenerate"));
  const saved = loadAnalysisProjectSnapshot(h.directory);
  t.deepEqual(saved.shards.runtime, before.shards.runtime);
  t.is(saved.shards.labels[0].sourceName, fields.name);
  t.is(saved.shards.labels[0].comment, fields.comment);
  t.is(saved.shards.comments[0].text, fields.instructionComment);
  t.is(fs.readFileSync(h.source, "utf8").includes("APU_IPL_Bootstrap"), false);
  h.worker.invalidate();
  await h.editor.editAnnotation();
  t.is(
    h.panels.at(-1)!.messages.find(({ type }) => type === "initialize")?.fields?.name,
    fields.name,
    "refresh keeps the committed annotation visible through the existing generated source map",
  );
  await h.panels.at(-1)!.receive({ type: "cancel" });
  await h.editor.undo();
  t.deepEqual(h.errors, [], "undo must not hide a storage failure behind an unchanged view");
  t.deepEqual(loadAnalysisProjectSnapshot(h.directory).shards, before.shards);
  await h.editor.redo();
  t.deepEqual(h.errors, []);
  t.deepEqual(loadAnalysisProjectSnapshot(h.directory).shards, saved.shards);
});

test("VS Code annotation editing fails closed on untrusted, dirty, changed, and foreign mappings", async (t) => {
  const h = harness(t);
  h.workspace.isTrusted = false;
  await h.editor.editAnnotation();
  t.is(h.panels.length, 0);
  h.workspace.isTrusted = true;
  h.editorDocument.isDirty = true;
  await h.editor.editAnnotation();
  t.is(h.panels.length, 0);
  h.editorDocument.isDirty = false;
  fs.appendFileSync(h.source, "; changed\n");
  await h.editor.editAnnotation();
  t.is(h.panels.length, 1);
  t.regex(h.panels[0].messages.at(-1)!.message, /current ROM\/source mapping/);
  const map = JSON.parse(fs.readFileSync(h.mapFile, "utf8"));
  map.output.sha256 = "f".repeat(64);
  const { fingerprint: ignored, ...payload } = map;
  void ignored;
  fs.writeFileSync(
    h.mapFile,
    JSON.stringify({
      ...payload,
      fingerprint: { algorithm: "sha256", value: hash(canonicalDebugMapJson(payload)) },
    }),
  );
  await h.editor.editAnnotation();
  t.is(h.panels.length, 2);
  t.regex(h.panels[1].messages.at(-1)!.message, /current ROM\/source mapping/);
});

test("open annotation forms preserve concurrent changes and reject changed source at save", async (t) => {
  const h = harness(t);
  await h.editor.editAnnotation();
  const snapshot = loadAnalysisProjectSnapshot(h.directory);
  commitAnalysisProjectTransaction(h.directory, snapshot.revision, {
    manifest: snapshot.manifest,
    shards: {
      ...snapshot.shards,
      comments: [
        {
          id: "concurrent",
          addressSpace: "snes.cpu",
          address: 0xc3002c,
          text: "Keep this",
          evidence: [],
        },
      ],
    },
  });
  await h.panels[0].receive({ type: "save", fields, regenerate: true });
  t.regex(h.panels[0].messages.at(-1)!.message, /changed|stale/i);
  t.false(h.commands.includes("asm.disassembly.regenerate"));
  t.is(loadAnalysisProjectSnapshot(h.directory).shards.comments[0].text, "Keep this");
  await h.editor.editAnnotation();
  fs.appendFileSync(h.source, "; changed while form open\n");
  await h.panels[1].receive({ type: "save", fields, regenerate: false });
  t.regex(h.panels[1].messages.at(-1)!.message, /source changed/);
  t.is(loadAnalysisProjectSnapshot(h.directory).shards.labels.length, 0);
});

test("annotation shell appears before discovery and safely ignores completion after cancellation", async (t) => {
  const h = harness(t);
  const opening = h.editor.editAnnotation();
  t.is(
    h.panels.length,
    1,
    "the form is created synchronously before project discovery or worker loading",
  );
  t.regex(h.panels[0].html, /Loading analysis/);
  await h.panels[0].receive({ type: "cancel" });
  await opening;
  t.true(h.panels[0].disposed);
  t.false(h.panels[0].messages.some(({ type }) => type === "initialize"));
  t.deepEqual(h.errors, []);
});

test("editable webview script previews real newlines and displays annotation text literally", (t) => {
  const nodes = new Map<
    string,
    {
      value: string;
      textContent: string;
      hidden: boolean;
      disabled: boolean;
      focus(): void;
      setAttribute(): void;
      addEventListener(): void;
    }
  >();
  const get = (id: string) => {
    if (!nodes.has(id))
      nodes.set(id, {
        value: "",
        textContent: "",
        hidden: false,
        disabled: false,
        focus() {},
        setAttribute() {},
        addEventListener() {},
      });
    return nodes.get(id)!;
  };
  let receive: (event: unknown) => void = () => {};
  const messages: unknown[] = [];
  vm.runInNewContext(fs.readFileSync("packages/vscode-extension/media/annotation.js", "utf8"), {
    acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }),
    document: { getElementById: get },
    window: {
      addEventListener: (_type: string, callback: typeof receive) => {
        receive = callback;
      },
    },
  });
  receive({
    data: {
      type: "initialize",
      fields: { ...fields, comment: "First line\n<script>alert(1)</script>" },
      location: "CPU $C3002C",
      hasInstruction: true,
    },
  });
  t.is(
    get("preview").textContent,
    "; First line\n; <script>alert(1)</script>\nAPU_IPL_Bootstrap: ; Bootstrap entry\n  <instruction> ; Save data bank",
  );
  t.false(get("annotation").hidden);
  t.is((messages[0] as { type: string }).type, "ready");
});

test("cached annotation data detects same-manifest SQLite edits and replaced debug maps", async (t) => {
  const h = harness(t);
  await h.editor.editAnnotation();
  const database = new DatabaseSync(path.join(h.directory, "analysis.sqlite"));
  database.exec("INSERT INTO labels VALUES ('invalid', 'snes.cpu', 0, 'Invalid', 'invalid json')");
  await h.editor.editAnnotation();
  t.regex(h.panels[1].messages.at(-1)!.message, /json|unexpected token/i);
  t.false(h.panels[1].messages.some(({ type }) => type === "initialize"));
  database.exec("DELETE FROM labels WHERE id='invalid'");
  database.close();
  const map = JSON.parse(fs.readFileSync(h.mapFile, "utf8"));
  map.ranges[0].start++;
  fs.writeFileSync(h.mapFile, JSON.stringify(map));
  await h.editor.editAnnotation();
  t.regex(h.panels[2].messages.at(-1)!.message, /current ROM\/source mapping/);
});

test("heuristic previews read saved rules, reject malformed options, and never publish project changes", async (t) => {
  const h = harness(t);
  const snapshot = loadAnalysisProjectSnapshot(h.directory);
  commitAnalysisProjectTransaction(h.directory, snapshot.revision, {
    manifest: snapshot.manifest,
    shards: {
      ...snapshot.shards,
      runtime: [
        {
          id: "observed-vram-write",
          kind: "runtime-memory-access",
          architecture: "snes.65816",
          instructionAddressSpace: "snes.cpu",
          instructionAddress: 0xc3002c,
          accessedAddressSpace: "snes.cpu",
          accessedAddress: 0x2118,
          width: 1,
          access: "write",
          value: 42,
          actor: "cpu",
          count: 1,
          evidence: [],
        },
      ],
    },
  });
  const before = loadAnalysisProjectSnapshot(h.directory).revision.manifestSha256;
  const first = await h.worker.request<{ total: number; roles: { role: string }[] }>(
    h.directory,
    "heuristics",
  );
  t.true(first.total > 0);
  t.true(first.roles.some(({ role }) => role === "graphics.vram-write"));
  fs.writeFileSync(path.join(h.directory, "heuristics.json"), JSON.stringify({ enabled: false }));
  const disabled = await h.worker.request<{ total: number; enabled: boolean }>(
    h.directory,
    "heuristics",
  );
  t.false(disabled.enabled);
  t.is(disabled.total, 0);
  fs.writeFileSync(
    path.join(h.directory, "heuristics.json"),
    JSON.stringify({ minimumConfidence: "certain" }),
  );
  await t.throwsAsync(h.worker.request(h.directory, "heuristics"), { message: /confidence/ });
  t.is(loadAnalysisProjectSnapshot(h.directory).revision.manifestSha256, before);
});
