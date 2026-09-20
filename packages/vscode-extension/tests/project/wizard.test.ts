import * as fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import type { ExtensionContext } from "vscode";

import { test } from "../../../../tests/ava-helper.js";

type ProbeCall = { romFile: string; dizRawFile?: string; mapper?: string };
type InitCall = {
  romFile: string;
  dizRawFile?: string;
  mapper: string;
  outputDirectory: string;
  workspaceFiles: readonly { path: string; contents: string }[];
  signal: AbortSignal;
  onProgress?: (event: { stage: string; message: string }) => void;
};

const host = {
  trusted: true,
  dialogs: [] as ({ fsPath: string }[] | undefined)[],
  dialogTitles: [] as string[],
  quickPick: undefined as { mapper: string } | undefined,
  quickPickItems: [] as { mapper: string; label: string; description?: string; detail?: string }[],
  createChoice: "Create Project" as string | undefined,
  messages: [] as { kind: "info" | "error"; message: string; detail?: string }[],
  commands: [] as unknown[][],
  handlers: new Map<string, () => Promise<void>>(),
  progress: [] as { title: string; message?: string; increment?: number }[],
  cancel: undefined as (() => void) | undefined,
  probes: [] as ProbeCall[],
  inits: [] as InitCall[],
  probeResult: (_options: ProbeCall): Record<string, unknown> => ({}),
  initialize: async (_options: InitCall): Promise<Record<string, unknown>> => ({}),
  CancelledError: Error,
};

(globalThis as { __uttoriWizardTest?: typeof host }).__uttoriWizardTest = host;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "project-wizard-test:vscode" };
    }
    if (specifier === "@uttori/asm-plugin-snes") {
      return { shortCircuit: true, url: "project-wizard-test:snes" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "project-wizard-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriWizardTest;
          const uri = (file) => ({ fsPath: file, toString: () => "file://" + file });
          export const ProgressLocation = { Notification: 15 };
          export const Uri = { file: uri };
          export const workspace = { get isTrusted() { return host.trusted; } };
          export const window = {
            showOpenDialog: async (options) => {
              host.dialogTitles.push(options.title);
              return host.dialogs.shift();
            },
            showQuickPick: async (items) => {
              host.quickPickItems = items;
              return host.quickPick;
            },
            showErrorMessage: async (message) => {
              host.messages.push({ kind: "error", message });
            },
            showInformationMessage: async (message, second, ...rest) => {
              const options = second && typeof second === "object" ? second : {};
              const items = second && typeof second === "object" ? rest : [second, ...rest].filter(Boolean);
              host.messages.push({ kind: "info", message, detail: options.detail });
              return items.includes("Create Project") ? host.createChoice : undefined;
            },
            withProgress: async (options, task) => {
              host.cancel = undefined;
              const token = {
                isCancellationRequested: false,
                onCancellationRequested: (callback) => {
                  host.cancel = callback;
                  return { dispose() {} };
                },
              };
              return task(
                {
                  report: (value) => {
                    host.progress.push({ title: options.title, ...value });
                  },
                },
                token,
              );
            },
          };
          export const commands = {
            registerCommand: (id, callback) => {
              host.handlers.set(id, callback);
              return { dispose() { host.handlers.delete(id); } };
            },
            executeCommand: async (...args) => {
              host.commands.push(args);
            },
          };
        `,
      };
    }
    if (url === "project-wizard-test:snes") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriWizardTest;
          export const SNES_MAPPERS = ["lorom", "hirom", "exlorom", "exhirom", "sfxrom", "sa1rom", "bigsa1rom", "norom"];
          export class SnesProjectInitializationCancelledError extends Error {
            constructor() {
              super("SNES project initialization was cancelled.");
              this.name = "SnesProjectInitializationCancelledError";
            }
          }
          host.CancelledError = SnesProjectInitializationCancelledError;
          export const probeSnesProject = (options) => {
            host.probes.push(options);
            return host.probeResult(options);
          };
          export const initializeSnesDisassemblyWorkspace = (options) => {
            host.inits.push(options);
            return host.initialize(options);
          };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { CREATE_DISASSEMBLY_PROJECT_COMMAND, IMPORT_DIZ_PROJECT_COMMAND, registerProjectWizards } =
  await import("../../src/project/wizard.js");
const { rememberedSnesRom } = await import("../../src/project/snes-rom-bindings.js");

const romIdentity = {
  sha256: "file-hash",
  contentSha256: "content-hash",
  fileSize: 0x8000,
  contentSize: 2048,
  headerSize: 0 as const,
};

const candidate = (mapper: string, score: number, detail = `${mapper} evidence`) => ({
  mapper,
  score,
  evidence: [{ kind: "header", detail }],
});

const probe = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  target: "snes.sfc",
  architecture: "snes.65816",
  rom: romIdentity,
  detection: {
    status: "detected",
    mapper: "lorom",
    candidates: [candidate("lorom", 12), candidate("hirom", 3), candidate("sa1rom", 1)],
  },
  mapperSelectionRequired: false,
  ...overrides,
});

const initResult = (
  probeResult: Record<string, unknown>,
  importReport?: Record<string, unknown>,
) => ({
  outputDirectory: "/out",
  probe: probeResult,
  project: { importReport },
  analysis: { instructions: 12, functions: 3, conflicts: 1 },
  roundTrip: { comparison: { actualLength: 2048, actualSha256: "abc123" } },
});

const fakeContext = (): ExtensionContext => {
  const store = new Map<string, unknown>();
  return {
    globalState: {
      get: (key: string, defaultValue?: unknown) =>
        store.has(key) ? store.get(key) : defaultValue,
      update: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    },
  } as unknown as ExtensionContext;
};

const emptyDirectory = (t: { teardown(callback: () => void): void }): string => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-wizard-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
};

const reset = () => {
  host.trusted = true;
  host.dialogs = [];
  host.dialogTitles = [];
  host.quickPick = undefined;
  host.quickPickItems = [];
  host.createChoice = "Create Project";
  host.messages = [];
  host.commands = [];
  host.progress = [];
  host.cancel = undefined;
  host.probes = [];
  host.inits = [];
  const detected = probe();
  host.probeResult = () => detected;
  host.initialize = async (options) => {
    options.onProgress?.({ stage: "probe", message: "Inspecting" });
    options.onProgress?.({ stage: "analyze", message: "Analyzing" });
    options.onProgress?.({ stage: "analyze", message: "Still analyzing" });
    options.onProgress?.({ stage: "commit", message: "Committing" });
    return initResult(detected);
  };
};

const logs = { info: [] as string[], error: [] as string[] };
const channel = {
  info: (message: string) => logs.info.push(message),
  error: (message: string) => logs.error.push(message),
};

const run = async (command = CREATE_DISASSEMBLY_PROJECT_COMMAND, context = fakeContext()) => {
  logs.info = [];
  logs.error = [];
  const registrations = registerProjectWizards(context, channel as never);
  await host.handlers.get(command)?.();
  for (const registration of registrations) {
    registration.dispose();
  }
  return context;
};

test.beforeEach(reset);

test.serial("untrusted workspaces and cancelled picks abort before probing", async (t) => {
  host.trusted = false;
  await run();
  t.true(host.messages[0]?.message.includes("trust this workspace"));
  t.deepEqual(host.dialogTitles, []);
  t.deepEqual(host.probes, []);

  reset();
  host.dialogs = [undefined];
  await run();
  t.deepEqual(host.dialogTitles, ["Select an SNES ROM"]);
  t.deepEqual(host.probes, []);

  reset();
  host.dialogs = [[{ fsPath: "/game.sfc" }], undefined];
  await run(IMPORT_DIZ_PROJECT_COMMAND);
  t.deepEqual(host.dialogTitles, ["Select an SNES ROM", "Select a DiztinGUIsh project"]);
  t.deepEqual(host.probes, []);
});

test.serial(
  "ROM-only creation remembers the ROM, writes editor files and opens the folder",
  async (t) => {
    const output = emptyDirectory(t);
    const context = fakeContext();
    host.dialogs = [[{ fsPath: "/games/secret.sfc" }], [{ fsPath: output }]];
    await run(CREATE_DISASSEMBLY_PROJECT_COMMAND, context);
    t.deepEqual(host.dialogTitles, ["Select an SNES ROM", "Select an empty output directory"]);
    t.is(host.probes.length, 1);
    t.falsy(host.probes[0].mapper);
    t.is(host.inits.length, 1);
    t.like(host.inits[0], {
      romFile: "/games/secret.sfc",
      mapper: "lorom",
      outputDirectory: output,
    });
    t.deepEqual(
      host.inits[0].workspaceFiles.map((file) => file.path),
      [".vscode/settings.json", ".vscode/launch.json"],
    );
    t.true(host.inits[0].workspaceFiles[0].contents.includes('"asm.target": "snes.sfc"'));
    t.is(rememberedSnesRom(context, romIdentity.contentSha256), path.resolve("/games/secret.sfc"));
    t.true(logs.info[0]?.includes(output));
    t.true(logs.info[1]?.includes("2.0 KiB"));
    t.true(logs.info[1]?.includes("abc123"));
    t.true(host.messages.some((message) => message.message.includes("created successfully")));
    t.true(host.messages.some((message) => message.detail?.includes("copier header: none")));
    const opened = host.commands.at(-1);
    t.is(opened?.[0], "vscode.openFolder");
    t.is((opened?.[1] as { fsPath: string } | undefined)?.fsPath, output);
    t.is(opened?.[2], false);
    t.true(host.progress.some((event) => event.increment && event.increment > 0));
    t.true(host.progress.some((event) => event.message === "Still analyzing" && !event.increment));
  },
);

test.serial("Diz import asks for a mapper, re-probes, and reports import warnings", async (t) => {
  const output = emptyDirectory(t);
  const candidates = [
    candidate("lorom", 9, "title checksum"),
    candidate("hirom", 8),
    candidate("sa1rom", 1),
  ];
  const selected = probe({
    mapperSelectionRequired: true,
    mapperSelectionReason: "ambiguous headers",
    dizRaw: { mapping: { mapper: "lorom" } },
    detection: {
      status: "ambiguous",
      mapper: "hirom",
      candidates,
    },
  });
  const applied = probe({
    mapperSelectionRequired: false,
    rom: { ...romIdentity, contentSize: 2 * 1024 * 1024, headerSize: 512 },
    detection: { status: "override", mapper: "lorom", candidates },
  });
  host.probeResult = (options) => (options.mapper ? applied : selected);
  host.quickPick = { mapper: "lorom" };
  host.dialogs = [[{ fsPath: "/game.sfc" }], [{ fsPath: "/game.dizraw" }], [{ fsPath: output }]];
  host.initialize = async () =>
    initResult(applied, {
      imported: { metadataBytes: 44 },
      unsupported: [{ count: 2 }, { count: 3 }],
      warnings: ["one", "two"],
    });
  await run(IMPORT_DIZ_PROJECT_COMMAND);
  t.is(host.probes.length, 2);
  t.like(host.probes[1], { romFile: "/game.sfc", dizRawFile: "/game.dizraw", mapper: "lorom" });
  t.deepEqual(
    host.quickPickItems.map((item) => item.mapper),
    ["lorom", "hirom", "sa1rom", "bigsa1rom", "exhirom", "exlorom", "norom", "sfxrom"],
  );
  t.true(host.quickPickItems[0].description?.includes("DizRaw metadata"));
  t.true(host.quickPickItems[1].description?.includes("ROM detection"));
  t.true(host.quickPickItems[0].detail?.includes("title checksum"));
  t.true(host.messages.some((message) => message.detail?.includes("2.00 MiB")));
  t.true(host.messages.some((message) => message.detail?.includes("copier header: 512 bytes")));
  t.true(logs.info[1]?.includes("DizRaw: 44 metadata bytes, 5 unsupported item(s), 2 warning(s)."));
  t.like(host.inits[0], { dizRawFile: "/game.dizraw", mapper: "lorom" });
});

test.serial("output directory and confirmation guards fail closed", async (t) => {
  const occupied = emptyDirectory(t);
  fs.writeFileSync(path.join(occupied, "keep.txt"), "x");
  host.dialogs = [[{ fsPath: "/game.sfc" }], [{ fsPath: occupied }]];
  await run();
  t.true(host.messages.some((message) => message.message.includes("must be empty")));
  t.deepEqual(host.inits, []);

  reset();
  const file = path.join(emptyDirectory(t), "not-a-dir");
  fs.writeFileSync(file, "x");
  host.dialogs = [[{ fsPath: "/game.sfc" }], [{ fsPath: file }]];
  await run();
  t.true(host.messages.some((message) => message.message.includes("cannot read")));

  reset();
  host.dialogs = [[{ fsPath: "/game.sfc" }], undefined];
  await run();
  t.deepEqual(host.inits, []);

  reset();
  const output = emptyDirectory(t);
  host.dialogs = [[{ fsPath: "/game.sfc" }], [{ fsPath: output }]];
  host.createChoice = undefined;
  await run();
  t.deepEqual(host.inits, []);

  reset();
  host.dialogs = [[{ fsPath: "/game.sfc" }]];
  host.probeResult = () =>
    probe({ mapperSelectionRequired: true, detection: { status: "ambiguous", candidates: [] } });
  host.quickPick = undefined;
  await run();
  t.deepEqual(host.inits, []);
});

test.serial("initialization errors surface through the output channel", async (t) => {
  const output = emptyDirectory(t);
  host.dialogs = [[{ fsPath: "/game.sfc" }], [{ fsPath: output }]];
  host.initialize = async (options) => {
    host.cancel?.();
    t.true(options.signal.aborted);
    throw new host.CancelledError();
  };
  await run();
  t.true(host.messages.some((message) => message.message.includes("cancelled")));
  t.deepEqual(logs.error, []);

  reset();
  host.dialogs = [[{ fsPath: "/game.sfc" }], [{ fsPath: output }]];
  host.initialize = async () => {
    throw new Error("disk full");
  };
  await run();
  t.true(logs.error[0]?.includes("disk full"));
  t.true(host.messages.some((message) => message.message.includes("disk full")));

  reset();
  host.dialogs = [[{ fsPath: "/game.sfc" }], [{ fsPath: emptyDirectory(t) }]];
  host.quickPick = { mapper: "norom" };
  host.probeResult = () =>
    probe({
      mapperSelectionRequired: true,
      rom: { ...romIdentity, contentSize: 100 },
      detection: { status: "ambiguous", candidates: [] },
    });
  registerProjectWizards(fakeContext());
  await host.handlers.get(CREATE_DISASSEMBLY_PROJECT_COMMAND)?.();
  t.true(host.messages.some((message) => message.detail?.includes("100 bytes")));
  t.true(host.messages.some((message) => message.detail?.includes("needs selection")));
});
