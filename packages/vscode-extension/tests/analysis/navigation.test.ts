import { registerHooks } from "node:module";

import { test } from "../../../../tests/ava-helper.js";

const SHA = "ab".repeat(32);

const host = {
  errors: [] as string[],
  warnings: [] as string[],
  documents: [] as Array<{ fsPath?: string; language?: string; content?: string }>,
  picks: [] as unknown[],
  quickPick: undefined as unknown,
  revealed: undefined as { line: number; type: number } | undefined,
  disassembled: false,
  session: undefined as
    | { type: string; customRequest: (command: string, args: unknown) => Promise<unknown> }
    | undefined,
  request: async (_directory: string, _operation: string, _options?: unknown): Promise<unknown> => {
    throw new Error("unhandled");
  },
  candidates: [] as unknown[],
  ranges: [] as Array<{
    sourceId: number;
    line: number;
    architecture: string;
    addressSpace: string;
    start: number;
  }>,
  sourcePath: (_source: { id: number }): string | undefined => undefined,
};

Object.assign(globalThis, { __uttoriAnalysisNavigationUiTest: host });

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "analysis-navigation-ui-test:vscode" };
    }
    const parent = context.parentURL ?? "";
    const fromNav =
      parent.includes("analysis/navigation.ts") || parent.includes("analysis/navigation.js");
    if (fromNav && specifier === "./worker-client.js") {
      return { shortCircuit: true, url: "analysis-navigation-ui-test:worker" };
    }
    if (fromNav && specifier === "./debug-maps.js") {
      return { shortCircuit: true, url: "analysis-navigation-ui-test:maps" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "analysis-navigation-ui-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriAnalysisNavigationUiTest;
          export class Position {
            constructor(line, character) { this.line = line; this.character = character; }
          }
          export class Selection {
            constructor(anchor, active) { this.anchor = anchor; this.active = active; }
          }
          export const TextEditorRevealType = { InCenterIfOutsideViewport: 2 };
          export const Uri = {
            file: (file) => ({ fsPath: file, scheme: "file", toString: () => "file://" + file }),
          };
          export const debug = {
            get activeDebugSession() { return host.session; },
          };
          export const workspace = {
            openTextDocument: async (input) => {
              if (input && input.fsPath) {
                host.documents.push({ fsPath: input.fsPath });
                return { uri: input };
              }
              host.documents.push(input);
              return input;
            },
          };
          const editor = {
            selection: undefined,
            revealRange(selection, type) {
              host.revealed = { line: selection.anchor.line, type };
            },
          };
          export const window = {
            showErrorMessage: async (message) => { host.errors.push(message); },
            showWarningMessage: async (message) => { host.warnings.push(message); },
            showQuickPick: async (items) => {
              host.picks.push(items);
              return host.quickPick;
            },
            showTextDocument: async () => editor,
          };
        `,
      };
    }
    if (url === "analysis-navigation-ui-test:worker") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriAnalysisNavigationUiTest;
          export const analysisWorker = () => ({
            request: (...args) => host.request(...args),
          });
        `,
      };
    }
    if (url === "analysis-navigation-ui-test:maps") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriAnalysisNavigationUiTest;
          export const findAnalysisDebugMapCandidates = async () => host.candidates;
          export const analysisDebugMapRanges = () => host.ranges;
          export const currentAnalysisSourcePath = (source) => host.sourcePath(source);
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { navigateToAnalysisLocation } = await import("../../src/analysis/navigation.js");

const target = {
  projectDirectory: "/fixture/analysis",
  target: "snes.sfc",
  romContentSha256: SHA,
  romContentSize: 1024,
  addressSpace: "snes.cpu",
  address: 0x80_8000,
  outputOffsets: [0],
  architectureHints: ["snes.65816"],
  recordIds: ["fn:main"],
};

const matchingManifest = {
  target: "snes.sfc",
  rom: { contentSha256: SHA, contentSize: 1024 },
};

test.beforeEach(() => {
  host.errors = [];
  host.warnings = [];
  host.documents = [];
  host.picks = [];
  host.quickPick = undefined;
  host.revealed = undefined;
  host.disassembled = false;
  host.session = undefined;
  host.candidates = [];
  host.ranges = [];
  host.sourcePath = () => undefined;
  host.request = async () => {
    throw new Error("unhandled");
  };
});

test.serial("identity mismatch reports an error", async (t) => {
  host.request = async () => ({
    target: "other",
    rom: { contentSha256: SHA, contentSize: 1024 },
  });
  await navigateToAnalysisLocation(target);
  t.deepEqual(host.errors, [
    "Could not open analysis location: Navigation target no longer matches the current native analysis project.",
  ]);
  t.deepEqual(host.documents, []);
});

test.serial("opens an exact current source location", async (t) => {
  host.request = async (_directory, operation) => {
    if (operation === "manifest") {
      return matchingManifest;
    }
    throw new Error(operation);
  };
  host.candidates = [
    { file: "/maps/game.debug.json", map: { sources: [{ id: 0 }] }, sourceRoots: [] },
  ];
  host.ranges = [
    {
      sourceId: 0,
      line: 4,
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      start: 0x80_8000,
    },
  ];
  host.sourcePath = () => "/project/main.asm";
  await navigateToAnalysisLocation(target);
  t.deepEqual(host.documents, [{ fsPath: "/project/main.asm" }]);
  t.deepEqual(host.revealed, { line: 3, type: 2 });
  t.deepEqual(host.errors, []);
});

test.serial(
  "cancelling a multi-location quick pick still succeeds without disassembly",
  async (t) => {
    const operations: string[] = [];
    host.request = async (_directory, operation) => {
      operations.push(operation);
      if (operation === "manifest") {
        return matchingManifest;
      }
      throw new Error(operation);
    };
    host.candidates = [
      { file: "a.debug.json", map: { sources: [{ id: 0 }, { id: 1 }] }, sourceRoots: [] },
    ];
    host.ranges = [
      { sourceId: 0, line: 1, architecture: "snes.65816", addressSpace: "snes.cpu", start: 1 },
      { sourceId: 1, line: 2, architecture: "snes.65816", addressSpace: "snes.cpu", start: 1 },
    ];
    host.sourcePath = (source) => (source.id === 0 ? "/a.asm" : "/b.asm");
    await navigateToAnalysisLocation(target);
    t.is(host.picks.length, 1);
    t.deepEqual(operations, ["manifest"]);
    t.deepEqual(host.documents, []);
  },
);

test.serial("captured RAM prefers persisted disassembly over a live session", async (t) => {
  host.session = {
    type: "uttori-asm",
    customRequest: async () => {
      host.disassembled = true;
      return { instructions: [{ address: "x", instructionBytes: "EA", instruction: "NOP" }] };
    },
  };
  host.request = async (_directory, operation) => {
    if (operation === "manifest") {
      return matchingManifest;
    }
    if (operation === "navigation") {
      return {
        capturedRam: true,
        lines: ["snes.cpu|0x808000  EA              NOP"],
      };
    }
    throw new Error(operation);
  };
  await navigateToAnalysisLocation(target);
  t.false(host.disassembled);
  t.true(host.documents[0]?.content?.includes("Persisted analysis disassembly"));
  t.deepEqual(host.revealed, { line: 4, type: 2 });
});

test.serial("opens live virtual disassembly from an uttori-asm session", async (t) => {
  host.session = {
    type: "uttori-asm",
    customRequest: async () => {
      host.disassembled = true;
      return {
        instructions: [
          {
            address: "snes.65816|snes.cpu|0x808000",
            instructionBytes: "EA",
            instruction: "NOP",
            symbol: "Main",
          },
          { address: 1, instructionBytes: 2, instruction: 3 },
        ],
      };
    },
  };
  host.request = async (_directory, operation) => {
    if (operation === "manifest") {
      return matchingManifest;
    }
    if (operation === "navigation") {
      return { capturedRam: false, lines: [] };
    }
    throw new Error(operation);
  };
  await navigateToAnalysisLocation(target);
  t.true(host.disassembled);
  t.true(host.documents[0]?.content?.includes("Live virtual disassembly"));
  t.true(host.documents[0]?.content?.includes("; Main"));
});

test.serial("stale source mappings warn before opening the persisted view", async (t) => {
  host.candidates = [{ file: "stale.debug.json", map: { sources: [{ id: 0 }] }, sourceRoots: [] }];
  host.ranges = [
    { sourceId: 0, line: 1, architecture: "snes.65816", addressSpace: "snes.cpu", start: 0 },
  ];
  host.sourcePath = () => undefined;
  host.request = async (_directory, operation) => {
    if (operation === "manifest") {
      return matchingManifest;
    }
    if (operation === "navigation") {
      return { capturedRam: false, lines: ["; empty"] };
    }
    throw new Error(operation);
  };
  await navigateToAnalysisLocation(target);
  t.deepEqual(host.warnings, [
    "Found 1 stale source mapping(s). Opening persisted analysis disassembly instead.",
  ]);
  t.true(host.documents[0]?.content?.includes("Persisted analysis disassembly"));
});

test.serial("generic errors surface through showErrorMessage", async (t) => {
  host.request = async () => {
    // oxlint-disable-next-line typescript/only-throw-error
    throw "offline";
  };
  await navigateToAnalysisLocation(target);
  t.deepEqual(host.errors, ["Could not open analysis location: offline"]);
});
