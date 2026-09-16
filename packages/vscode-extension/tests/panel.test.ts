import * as fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import test from "ava";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: [path.resolve("packages/vscode-extension/src/panel.ts")],
  write: false,
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["vscode"],
});
const nativeRequire = createRequire(import.meta.url);

const harness = () => {
  const sent: Array<{ type: string; command?: string; error?: string; trusted?: boolean }> = [];
  const calls: string[] = [];
  let execute: () => Promise<void> = async () => {};
  const uri = (file: string) => ({ fsPath: file, toString: () => `file://${file}` });
  const mock = {
    Uri: {
      file: uri,
      joinPath: (root: { fsPath: string }, ...parts: string[]) =>
        uri(path.join(root.fsPath, ...parts)),
    },
    ConfigurationTarget: { Workspace: 2 },
    workspace: {
      name: "Example",
      isTrusted: true,
      getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
    },
    window: {},
    commands: {
      executeCommand: async (command: string) => {
        calls.push(command);
        await execute();
      },
    },
  };
  const module = { exports: {} as typeof import("../src/panel.js") };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module,
    exports: module.exports,
    Error,
    require: (name: string) => (name === "vscode" ? mock : nativeRequire(name)),
  });
  const provider = new module.exports.ProjectPanelProvider(
    uri(path.resolve("packages/vscode-extension")) as never,
    () => undefined,
    async () => {},
  );
  const webview = {
    html: "",
    options: {},
    cspSource: "https://webview.example",
    asWebviewUri: (value: unknown) => value,
    onDidReceiveMessage() {},
    postMessage: async (message: (typeof sent)[number]) => {
      sent.push(message);
    },
  };
  provider.resolveWebviewView({ webview, onDidChangeVisibility() {} } as never);
  return {
    provider,
    sent,
    calls,
    webview,
    setExecute: (callback: typeof execute) => {
      execute = callback;
    },
  };
};

test("Project loads external CSP-scoped assets and routes disassembly, heuristics and capture actions", async (t) => {
  const h = harness();
  const routes = {
    editAnnotation: "asm.disassembly.editAnnotation",
    regenerateDisassembly: "asm.disassembly.regenerate",
    configureHeuristics: "asm.heuristics.configure",
    previewHeuristics: "asm.heuristics.preview",
    startExecutionCapture: "asm.trace.start",
    stopExecutionCapture: "asm.trace.stopAnalyze",
  };
  for (const [type, command] of Object.entries(routes)) {
    await h.provider.onMessage({ type });
    t.is(h.calls.at(-1), command);
    t.true(h.sent.some((message) => message.type === "actionComplete" && message.command === type));
  }
  t.regex(h.webview.html, /script nonce="[^"]+" src="[^"]+panel.js"/);
  t.regex(h.webview.html, /href="[^"]+panel.css"/);
  t.false(h.webview.html.includes("{{"));
  t.true(h.sent.some((message) => message.type === "snapshot" && message.trusted));
  const js = fs.readFileSync("packages/vscode-extension/media/panel.js", "utf8");
  t.notThrows(() => new vm.Script(js));
  t.false(js.includes("innerHTML"), "project names, paths and status are rendered as text");
});

test("Project prevents duplicate pending actions and returns actionable errors to the panel", async (t) => {
  const h = harness();
  let finish: () => void = () => {};
  h.setExecute(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = h.provider.onMessage({ type: "previewHeuristics" });
  await h.provider.onMessage({ type: "previewHeuristics" });
  t.is(h.calls.length, 1);
  finish();
  await pending;
  h.setExecute(async () => {
    throw new Error("Save the rules before running.");
  });
  await h.provider.onMessage({ type: "previewHeuristics" });
  t.is(h.sent.at(-1)?.error, "Save the rules before running.");
  t.is(h.calls.length, 2, "a completed or failed action can be retried");
});
