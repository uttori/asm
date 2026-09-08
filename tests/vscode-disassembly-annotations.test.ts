import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import vm from "node:vm";
import { build } from "esbuild";
import { canonicalDebugMapJson } from "@uttori/asm-core/debug-map";
import type { DebugMap } from "@uttori/asm-core/debug-map";
import {
  RomImage,
  writeAnalysisProject,
  loadAnalysisProjectSnapshot,
  commitAnalysisProjectTransaction,
  type AnalysisProject,
} from "@uttori/asm-disassembler";
import { test } from "./ava-helper.js";

const bundled = await build({
  entryPoints: [path.resolve("packages/vscode-extension/src/analysis-project-editor.ts")],
  write: false,
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["vscode"],
});
const code = bundled.outputFiles[0].text;
const locationBundle = await build({
  entryPoints: [path.resolve("packages/vscode-extension/src/disassembly-annotation-location.ts")],
  write: false,
  bundle: true,
  platform: "node",
  format: "esm",
});
const { annotationLocationsForSource } = (await import(
  `data:text/javascript;base64,${Buffer.from(locationBundle.outputFiles[0].text).toString("base64")}`
)) as typeof import("../packages/vscode-extension/src/disassembly-annotation-location.js");

const nativeRequire = createRequire(import.meta.url);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const uri = (file: string) => ({ scheme: "file", fsPath: file });

const harness = (t: { teardown(callback: () => void): void }) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-ui-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, "bank.asm");
  const text = "; Generated bank\norg $C3002C\n\nFn_C3002C:\n.a16\n  PHB\n";
  fs.writeFileSync(source, text);
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 2,
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
          specificationId: "test",
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
    messages: Array<{ type: string; message: string }>;
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
    Uri: { file: uri },
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
            set html(value: string) {
              panel.html = value;
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
    exports: {} as typeof import("../packages/vscode-extension/src/analysis-project-editor.js"),
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
  const editor = new module.exports.AnalysisProjectEditor(() => {});
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
  const script = h.panels[0].html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
  t.truthy(script);
  t.notThrows(() => new vm.Script(script!));
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
  const before = loadAnalysisProjectSnapshot(h.directory);
  await h.editor.editAnnotation();
  t.deepEqual(h.errors, []);
  const panel = h.panels[0];
  t.regex(panel.html, /value="Fn_C3002C"/);
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
  t.is(saved.shards.labels[0].sourceName, fields.name);
  t.is(saved.shards.labels[0].comment, fields.comment);
  t.is(saved.shards.comments[0].text, fields.instructionComment);
  t.is(fs.readFileSync(h.source, "utf8").includes("APU_IPL_Bootstrap"), false);
  await h.editor.undo();
  t.deepEqual(loadAnalysisProjectSnapshot(h.directory).shards, before.shards);
  await h.editor.redo();
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
  t.is(h.panels.length, 0);
  t.true(h.errors.some((error) => error.includes("current ROM/source mapping")));
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
  t.is(h.panels.length, 0);
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
