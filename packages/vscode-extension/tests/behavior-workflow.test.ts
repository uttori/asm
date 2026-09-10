import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import * as vm from "node:vm";

import {
  RomImage,
  writeAnalysisProject,
  loadAnalysisProjectSnapshot,
  type AnalysisProject,
} from "@uttori/asm-disassembler";
import { build } from "esbuild";

import { test } from "../../../tests/ava-helper.js";

const bundled = await build({
  entryPoints: [path.resolve("packages/vscode-extension/src/behavior-capture.ts")],
  write: false,
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["vscode"],
});
const code = bundled.outputFiles[0]!.text;
const nativeRequire = createRequire(import.meta.url);
const disposable = { dispose() {} };
const uri = (file: string) => ({ scheme: "file", fsPath: file });

const harness = (directory: string, nativeProject = false) => {
  const binarySha256 = new RomImage(new Uint8Array(0x8000)).identity.contentSha256;
  const callbacks = new Map<string, () => Promise<void>>();
  const errors: string[] = [];
  const messages: string[] = [];
  const requests: string[] = [];
  const reports: string[] = [];
  let refreshes = 0;
  let inputs: Array<string | undefined> = [];
  let openFiles: Array<ReturnType<typeof uri>[] | undefined> = [];
  let destination: string | undefined;
  let events = [1, 2, 1, 2];
  let offset = 0;
  let chooseAddresses: number[] | undefined;
  let confirm = true;
  let hasTrace = true;
  let resumeChoice: "Start and Continue" | "Start Paused" | undefined;
  let sendDebugEvent: (event: unknown) => void = () => {};
  const continuedThreads: number[] = [];
  const map = {
    target: "snes",
    output: { sha256: binarySha256, size: 0x8000 },
    fingerprint: { value: "b".repeat(64) },
    sources: [{ id: 0, path: "main.asm" }],
    ranges: [
      {
        sourceId: 0,
        line: 2,
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        start: 4,
        end: 5,
      },
    ],
  };
  if (nativeProject) {
    const project: AnalysisProject = {
      manifest: {
        format: "uttori-asm-analysis",
        schemaVersion: 3,
        target: "snes",
        rom: new RomImage(new Uint8Array(0x8000)).identity,
        mapping: { mapper: "test", source: "override", candidates: [] },
        addressSpaces: [{ id: "snes.cpu", name: "CPU", addressBits: 24, kind: "cpu" }],
      },
      shards: {
        analysis: [],
        annotations: [],
        labels: [],
        comments: [],
        regions: [],
        runtime: [],
        evidence: [],
        imports: [],
      },
    };
    writeAnalysisProject(directory, project);
  }
  const session = {
    id: "test-session",
    type: "uttori-asm",
    workspaceFolder: { uri: uri(directory) },
    customRequest: async (command: string, args?: { maxEvents?: number; threadId?: number }) => {
      requests.push(command);
      if (command === "continue") {
        continuedThreads.push(args!.threadId!);
        return {};
      }
      if (command === "uttori/traceCapabilities")
        return {
          traces: hasTrace
            ? [{ architecture: "snes.65816", addressSpace: "snes.cpu", maxBatchEvents: 10 }]
            : [],
        };
      if (command === "uttori/startTrace") {
        offset = 0;
        return {};
      }
      if (command === "uttori/stopTrace") return {};
      if (command === "uttori/readTrace") {
        const addresses = events.slice(offset, offset + (args?.maxEvents ?? 10));
        const sequenceStart = offset + 1;
        offset += addresses.length;
        return {
          architecture: "snes.65816",
          addressSpace: "snes.cpu",
          addresses,
          sequenceStart,
          droppedEvents: 0,
          active: true,
        };
      }
      throw new Error(`Unexpected ${command}`);
    },
  };
  const mock = {
    Uri: { file: uri },
    commands: {
      registerCommand: (name: string, callback: () => Promise<void>) => {
        callbacks.set(name, callback);
        return disposable;
      },
    },
    window: {
      showInputBox: async () => inputs.shift(),
      showOpenDialog: async () => openFiles.shift(),
      showSaveDialog: async () => (destination ? uri(destination) : undefined),
      showQuickPick: async (
        choices: Array<{ address?: number; stopKind?: string }> | string[],
        options?: { canPickMany?: boolean },
      ) => {
        if (typeof choices[0] === "string") return resumeChoice;
        const items = choices as Array<{ address?: number; stopKind?: string }>;
        return options?.canPickMany
          ? items.filter(({ address }) => chooseAddresses?.includes(address!))
          : items.find(({ stopKind }) => stopKind === "instruction-limit");
      },
      showTextDocument: async (document: { content: string }) => {
        reports.push(document.content);
      },
      showErrorMessage: async (message: string) => {
        errors.push(message);
      },
      showInformationMessage: async (message: string) => {
        messages.push(message);
      },
      showWarningMessage: async (message: string, options?: unknown, button?: string) => {
        messages.push(message);
        return options && confirm ? button : undefined;
      },
    },
    workspace: {
      isTrusted: true,
      workspaceFolders: [{ uri: uri(directory) }],
      getConfiguration: () => ({ get: () => (nativeProject ? directory : "") }),
      findFiles: async () => [],
      openTextDocument: async (document: unknown) => document,
    },
    debug: {
      activeDebugSession: session,
      onDidTerminateDebugSession: () => disposable,
      registerDebugAdapterTrackerFactory: (
        _type: string,
        factory: {
          createDebugAdapterTracker: (value: unknown) => {
            onDidSendMessage: (event: unknown) => void;
          };
        },
      ) => {
        sendDebugEvent = factory.createDebugAdapterTracker(session).onDidSendMessage;
        return disposable;
      },
    },
  };
  const module = {
    exports: {} as {
      registerBehaviorCaptures: (host: unknown) => unknown;
      renderBehaviorReview: (...args: unknown[]) => string;
    },
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
  });
  module.exports.registerBehaviorCaptures({
    context: () => ({ map, sourceRoot: directory, producer: { id: "ares", revision: "fixture" } }),
    refresh: () => {
      refreshes++;
    },
  });
  return {
    errors,
    requests,
    messages,
    reports,
    continuedThreads,
    stopped: (threadId: number) =>
      sendDebugEvent({ type: "event", event: "stopped", body: { threadId } }),
    mock,
    run: async (command: string) => {
      await callbacks.get(command)!();
    },
    setup: (values: {
      inputs?: Array<string | undefined>;
      files?: Array<ReturnType<typeof uri>[] | undefined>;
      destination?: string;
      events?: number[];
      addresses?: number[];
      confirm?: boolean;
      hasTrace?: boolean;
      resumeChoice?: "Start and Continue" | "Start Paused";
    }) => {
      inputs = values.inputs ?? [];
      openFiles = values.files ?? [];
      destination = values.destination;
      events = values.events ?? events;
      chooseAddresses = values.addresses;
      confirm = values.confirm ?? true;
      hasTrace = values.hasTrace ?? true;
      resumeChoice = values.resumeChoice;
    },
    refreshes: () => refreshes,
  };
};

test("VS Code idle → behavior → review → selected transaction works through registered commands", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-behavior-workflow-"));
  try {
    const host = harness(directory, true);
    const baseline = path.join(directory, "idle.json");
    const action = path.join(directory, "menu.json");
    host.setup({ inputs: ["Standing idle", "5000", "4"], destination: baseline });
    await host.run("asm.capture.idle");
    host.setup({
      inputs: ["Open Menu", "5000", "4"],
      files: [[uri(baseline)]],
      destination: action,
      events: [1, 3, 4, 4],
    });
    await host.run("asm.capture.behavior");
    t.deepEqual(host.errors, []);
    t.true(fs.existsSync(action));
    host.setup({ files: [[uri(action)]], addresses: [4], confirm: false });
    await host.run("asm.capture.review");
    t.is(
      loadAnalysisProjectSnapshot(directory).shards.comments.length,
      0,
      "cancelled confirmation leaves project untouched",
    );
    host.setup({ files: [[uri(action)]], addresses: [4] });
    await host.run("asm.capture.review");
    t.deepEqual(host.errors, []);
    t.is(loadAnalysisProjectSnapshot(directory).shards.comments.length, 1);
    t.regex(host.reports[0]!, /main.asm:2/);
    t.regex(host.reports[0]!, /Ordered action trace/);
    t.is(host.refreshes(), 1);
    host.setup({ files: [[uri(action)]], addresses: [4] });
    await host.run("asm.capture.review");
    t.deepEqual(host.errors, []);
    t.is(loadAnalysisProjectSnapshot(directory).shards.comments.length, 1);
    t.true(host.messages.some((message) => message.includes("already applied")));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("paused capture can cancel before file creation or arm tracing before resuming the stopped thread", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-behavior-paused-"));
  try {
    const host = harness(directory);
    const destination = path.join(directory, "idle.json");
    host.stopped(7);
    host.setup({ inputs: ["Idle", "5000", "4"], destination });
    await host.run("asm.capture.idle");
    t.false(fs.existsSync(destination));
    t.false(host.requests.includes("uttori/startTrace"));
    host.setup({ inputs: ["Idle", "5000", "4"], destination, resumeChoice: "Start and Continue" });
    await host.run("asm.capture.idle");
    t.deepEqual(host.errors, []);
    t.deepEqual(host.continuedThreads, [7]);
    t.true(host.requests.indexOf("uttori/startTrace") < host.requests.indexOf("continue"));
    t.true(fs.existsSync(destination));
    t.is(host.requests.filter((request) => request === "uttori/stopTrace").length, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("Start Paused preserves execution state and warns when no instructions were captured", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-behavior-empty-"));
  try {
    const host = harness(directory);
    host.stopped(1);
    const destination = path.join(directory, "empty.json");
    host.setup({
      inputs: ["Idle", "1", "4"],
      destination,
      events: [],
      resumeChoice: "Start Paused",
    });
    await host.run("asm.capture.idle");
    t.deepEqual(host.errors, []);
    t.deepEqual(host.continuedThreads, []);
    t.true(
      host.messages.some((message) => message.includes("A paused CPU is not an idle baseline")),
    );
    t.is(JSON.parse(fs.readFileSync(destination, "utf8")).windows[0].stopReason, "elapsed");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("idle demo and guide open through registered commands without writing project files", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-behavior-help-"));
  try {
    const host = harness(directory);
    await host.run("asm.capture.demo");
    await host.run("asm.capture.guide");
    t.deepEqual(host.errors, []);
    t.regex(host.reports[0]!, /Second identical apply changed anything: false/);
    t.regex(host.reports[1]!, /ares desktop/);
    t.deepEqual(host.requests, []);
    t.deepEqual(fs.readdirSync(directory), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("VS Code capture cancels safely, gates unsupported backends, refuses clobbering and releases its lease", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-behavior-cancel-"));
  try {
    const host = harness(directory);
    host.setup({ hasTrace: false });
    await host.run("asm.capture.idle");
    t.true(host.errors[0]!.includes("MesenCE"));
    host.setup({ inputs: [undefined] });
    await host.run("asm.capture.idle");
    t.false(host.requests.includes("uttori/startTrace"));
    const file = path.join(directory, "preserve.json");
    fs.writeFileSync(file, "preserve");
    host.setup({ inputs: ["Idle", "5000", "4"], destination: file });
    await host.run("asm.capture.idle");
    t.is(fs.readFileSync(file, "utf8"), "preserve");
    t.false(host.requests.includes("uttori/startTrace"));
    host.setup({ inputs: ["Idle", "5000", "4"], destination: path.join(directory, "new.json") });
    await host.run("asm.capture.idle");
    t.is(host.requests.filter((request) => request === "uttori/startTrace").length, 1);
    t.is(host.requests.filter((request) => request === "uttori/stopTrace").length, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
