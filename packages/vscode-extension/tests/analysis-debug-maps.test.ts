import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import { AddressToLineMapping, createDebugMap } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";

const host = {
  folders: undefined as { uri: { fsPath: string } }[] | undefined,
  files: [] as { fsPath: string; scheme: string }[],
  session: undefined as
    | {
        type: string;
        configuration: Record<string, unknown>;
        workspaceFolder?: { uri: { fsPath: string } };
      }
    | undefined,
};

(globalThis as { __uttoriAnalysisDebugMapsTest?: typeof host }).__uttoriAnalysisDebugMapsTest =
  host;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "analysis-debug-maps-test:vscode" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "analysis-debug-maps-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriAnalysisDebugMapsTest;
          export const Uri = {
            file: (file) => ({ fsPath: file, scheme: "file", toString: () => "file://" + file }),
          };
          export const debug = {
            get activeDebugSession() { return host.session; },
          };
          export const workspace = {
            get workspaceFolders() { return host.folders; },
            getWorkspaceFolder: (uri) =>
              (host.folders ?? []).find((folder) => uri.fsPath.startsWith(folder.uri.fsPath + "/") || uri.fsPath === folder.uri.fsPath),
            findFiles: async () => host.files,
          };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const {
  analysisSourceSha256,
  currentAnalysisSourcePath,
  analysisDebugMapRanges,
  findAnalysisDebugMapCandidates,
  discoverAnalysisDebugMapFiles,
} = await import("../src/analysis-debug-maps.js");

const writeSource = (file: string, contents = "nop\n") => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
};

test.beforeEach(() => {
  host.folders = undefined;
  host.files = [];
  host.session = undefined;
});

test.serial("analysisSourceSha256 hashes the current file bytes", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-sha-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "main.asm");
  writeSource(file, "lda #$01\n");
  t.is(analysisSourceSha256(file), createHash("sha256").update("lda #$01\n").digest("hex"));
});

test.serial(
  "currentAnalysisSourcePath resolves absolute, relative, mismatched and missing files",
  (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-source-"));
    t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
    const absoluteSource = path.join(root, "abs", "main.asm");
    writeSource(absoluteSource);
    const mapping = new AddressToLineMapping();
    mapping.includeByte(absoluteSource, 1, "snes.65816", "snes.cpu", 0x80_8000, 0);
    const absoluteMap = createDebugMap({
      target: "snes.sfc",
      output: Uint8Array.of(0xea),
      mapping,
      sourceRoot: path.join(root, "elsewhere"),
    });
    t.true(path.isAbsolute(absoluteMap.sources[0].path));
    const absoluteCandidate = {
      file: path.join(root, "game.debug.json"),
      map: absoluteMap,
      sourceRoots: [root],
    };
    t.is(currentAnalysisSourcePath(absoluteMap.sources[0], absoluteCandidate), absoluteSource);
    t.is(
      currentAnalysisSourcePath(
        absoluteMap.sources[0],
        absoluteCandidate,
        path.join(root, "other.asm"),
      ),
      undefined,
    );

    const relativeSource = path.join(root, "main.asm");
    writeSource(relativeSource, "nop\n");
    const relativeMapping = new AddressToLineMapping();
    relativeMapping.includeByte(relativeSource, 1, "snes.65816", "snes.cpu", 0x80_8000, 0);
    const relativeMap = createDebugMap({
      target: "snes.sfc",
      output: Uint8Array.of(0xea),
      mapping: relativeMapping,
      sourceRoot: root,
    });
    t.is(relativeMap.sources[0].path, "main.asm");
    host.folders = [{ uri: { fsPath: root } }];
    t.is(
      currentAnalysisSourcePath(relativeMap.sources[0], {
        file: path.join(root, "maps", "game.debug.json"),
        map: relativeMap,
        sourceRoots: [root],
      }),
      relativeSource,
    );
    t.is(
      currentAnalysisSourcePath(
        relativeMap.sources[0],
        {
          file: path.join(root, "maps", "game.debug.json"),
          map: relativeMap,
          sourceRoots: [root],
        },
        relativeSource,
      ),
      relativeSource,
    );
    fs.rmSync(relativeSource);
    t.is(
      currentAnalysisSourcePath(relativeMap.sources[0], {
        file: path.join(root, "maps", "game.debug.json"),
        map: relativeMap,
        sourceRoots: [root],
      }),
      undefined,
    );
  },
);

test.serial(
  "analysisDebugMapRanges dedupes logical/output hits and filters architectureHints",
  (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-ranges-"));
    t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = path.join(root, "main.asm");
    writeSource(source);
    const mapping = new AddressToLineMapping();
    mapping.includeByte(source, 1, "snes.65816", "snes.cpu", 0x80_8000, 0);
    mapping.includeByte(source, 2, "snes.spc700", "snes.cpu", 0x80_8000, 0);
    const map = createDebugMap({
      target: "snes.sfc",
      output: Uint8Array.of(0xea, 0xea),
      mapping,
      sourceRoot: root,
    });
    const location = {
      addressSpace: "snes.cpu",
      address: 0x80_8000,
      outputOffsets: [0],
      architectureHints: [] as string[],
    };
    t.is(analysisDebugMapRanges(map, location).length, 2);
    t.is(analysisDebugMapRanges(map, { ...location, architectureHints: ["snes.65816"] }).length, 1);
    t.deepEqual(analysisDebugMapRanges(map, { ...location, architectureHints: ["snes.sa1"] }), []);
  },
);

test.serial("findAnalysisDebugMapCandidates skips invalid and mismatched maps", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-candidates-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "main.asm");
  writeSource(source);
  const mapping = new AddressToLineMapping();
  mapping.includeByte(source, 1, "snes.65816", "snes.cpu", 0x80_8000, 0);
  const map = createDebugMap({
    target: "snes.sfc",
    output: Uint8Array.of(0xea),
    mapping,
    sourceRoot: root,
  });
  const matching = path.join(root, "match.debug.json");
  const mismatched = path.join(root, "mismatch.debug.json");
  const invalid = path.join(root, "invalid.debug.json");
  const other = createDebugMap({
    target: "snes.smc",
    output: Uint8Array.of(0xea),
    mapping,
    sourceRoot: root,
  });
  fs.writeFileSync(matching, JSON.stringify(map));
  fs.writeFileSync(mismatched, JSON.stringify(other));
  fs.writeFileSync(invalid, "{not json");
  host.files = [
    { fsPath: matching, scheme: "file" },
    { fsPath: mismatched, scheme: "file" },
    { fsPath: invalid, scheme: "file" },
    { fsPath: path.join(root, "missing.debug.json"), scheme: "file" },
  ];
  const identity = {
    target: "snes.sfc",
    romContentSha256: map.output.sha256,
    romContentSize: map.output.size,
  };
  const found = await findAnalysisDebugMapCandidates(identity);
  t.deepEqual(
    found.map((candidate) => candidate.file),
    [matching],
  );
  t.deepEqual(
    (await findAnalysisDebugMapCandidates([identity, { ...identity, target: "other" }])).map(
      (candidate) => candidate.file,
    ),
    [matching],
  );
});

test.serial(
  "discoverAnalysisDebugMapFiles includes configured maps, workspace roots and ancestors",
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-discover-"));
    t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
    const nested = path.join(root, "disassembly", "build", "game.debug.json");
    const extra = path.join(root, "other.debug.json");
    writeSource(nested, "{}");
    writeSource(extra, "{}");
    host.folders = [{ uri: { fsPath: root } }];
    host.files = [
      { fsPath: extra, scheme: "file" },
      { fsPath: nested, scheme: "file" },
      { fsPath: path.join(root, "skip.debug.json"), scheme: "untitled" },
    ];
    host.session = {
      type: "uttori-asm",
      configuration: {
        debugMap: "disassembly/build/game.debug.json",
        sourceRoot: "src",
      },
      workspaceFolder: { uri: { fsPath: root } },
    };
    const discovered = await discoverAnalysisDebugMapFiles();
    t.deepEqual(discovered.map((entry) => entry.file).sort(), [nested, extra].sort());
    const configured = discovered.find((entry) => entry.file === nested);
    t.true(configured?.sourceRoots.includes(path.join(root, "src")));
    t.true(configured?.sourceRoots.includes(root));
    t.true(configured?.sourceRoots.includes(path.join(root, "disassembly")));
    t.true(configured?.sourceRoots.includes(path.join(root, "disassembly", "build")));
    const other = discovered.find((entry) => entry.file === extra);
    t.false(other?.sourceRoots.includes(path.join(root, "src")));
  },
);
