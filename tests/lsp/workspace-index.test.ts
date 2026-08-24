import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stub } from "sinon";
import { test } from "../ava-helper.js";
import { Assembler } from "../../packages/core/src/assembler.js";
import { snesWorkspaceIndexOptions } from "../test-assembler.js";
import { WorkspaceIndex } from "../../packages/core/src/lsp/workspace-index.js";

test("workspace index reads open, disk, and missing file text", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-workspace-"));
  const diskFile = path.join(directory, "disk.asm");
  const openFile = path.join(directory, "open.asm");
  fs.writeFileSync(diskFile, "org $8000\nDiskLabel:\n");

  try {
    const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
    index.openDocument(openFile, "org $8000\nOpenLabel:\n");

    t.is(index.getFileText(openFile), "org $8000\nOpenLabel:\n");
    t.is(index.getFileText(diskFile), "org $8000\nDiskLabel:\n");
    t.is(index.getFileText(path.join(directory, "missing.asm")), undefined);
    t.is(index.getText(diskFile), undefined);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("workspace index configures roots, include paths, and architecture", (t) => {
  const root = path.resolve("/virtual/configured.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(root, "org $8000\nStart:\n  nop\n");

  index.configure({
    entryPoints: [root, root],
    includePaths: ["/virtual/includes", "/virtual/includes"],
    architecture: "superfx",
  });

  t.deepEqual(index.getAnalyzedFiles(), [root]);
  t.true(index.getSymbols(root).some((entry) => entry.name === "Start"));

  index.configure({});
  t.true(index.getSymbols(root).some((entry) => entry.name === "Start"));
});

test("workspace index exposes empty and populated artifact collections", (t) => {
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  const file = path.resolve("/virtual/artifacts.asm");

  t.deepEqual(index.getDiagnostics(file), []);
  t.deepEqual(index.getSymbols(file), []);
  t.deepEqual(index.getReferences(file), []);
  t.deepEqual(index.getAllSymbols(), []);
  t.deepEqual(index.getAllReferences(), []);
  t.deepEqual(index.getIncludeEdges(), []);
  t.is(index.getFileAnalysis(file), undefined);

  index.openDocument(file, "org $8000\nTarget:\n  lda Target\n");
  t.true(index.getSymbols(file).some((entry) => entry.name === "Target"));
  t.true(index.getAllSymbols().some((entry) => entry.name === "Target"));
  t.true(index.getReferences(file).some((entry) => entry.name === "Target"));
  t.true(index.getAllReferences().some((entry) => entry.name === "Target"));
  t.is(index.getFileAnalysis(file)?.file, file);
});

test("workspace index batches document updates until reindex", (t) => {
  const file = path.resolve("/virtual/batched.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(file, "org $8000\nBefore:\n");

  index.updateDocument(file, "org $8000\nAfter:\n");

  t.is(index.getText(file), "org $8000\nAfter:\n");
  t.true(index.getSymbols(file).some((entry) => entry.name === "Before"));
  t.false(index.getSymbols(file).some((entry) => entry.name === "After"));

  index.reindex();

  t.false(index.getSymbols(file).some((entry) => entry.name === "Before"));
  t.true(index.getSymbols(file).some((entry) => entry.name === "After"));
});

test("workspace index re-analyses only roots affected by an edited include", (t) => {
  const rootA = path.resolve("/virtual/root-a.asm");
  const rootB = path.resolve("/virtual/root-b.asm");
  const shared = path.resolve("/virtual/shared.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions({ entryPoints: [rootA, rootB] }));
  index.openDocument(shared, "SharedBefore:\n");
  index.openDocument(rootA, 'incsrc "shared.asm"\nRootA:\n');
  index.openDocument(rootB, "RootB:\n");

  const analyzeSource = stub(Assembler.prototype, "analyzeSource").callThrough();
  index.updateDocument(shared, "SharedAfter:\n");
  index.reindex();

  t.true(analyzeSource.calledOnce);
  t.true(index.getSymbols(shared).some((entry) => entry.name === "SharedAfter"));
  t.false(index.getSymbols(shared).some((entry) => entry.name === "SharedBefore"));
  t.true(index.getSymbols(rootB).some((entry) => entry.name === "RootB"));
  analyzeSource.restore();
});

test("workspace index conservatively re-analyses roots for unknown new dependencies", (t) => {
  const rootA = path.resolve("/virtual/unknown-a.asm");
  const rootB = path.resolve("/virtual/unknown-b.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions({ entryPoints: [rootA, rootB] }));
  index.openDocument(rootA, "RootA:\n");
  index.openDocument(rootB, "RootB:\n");

  const analyzeSource = stub(Assembler.prototype, "analyzeSource").callThrough();
  index.invalidateFile(path.resolve("/virtual/new-include.asm"));
  index.reindex();

  t.is(analyzeSource.callCount, 2);
  analyzeSource.restore();
});

test("workspace index skips unreadable roots and unexpected analysis failures", (t) => {
  const missing = path.resolve("/virtual/missing.asm");
  const broken = path.resolve("/virtual/broken.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions({ entryPoints: [missing, broken] }));
  index.openDocument(broken, "org $8000\n");

  const analyzeSource = stub(Assembler.prototype, "analyzeSource").throws(new Error("unexpected"));
  index.reindex();

  t.true(analyzeSource.calledOnce);
  t.deepEqual(index.getAnalyzedFiles(), []);
  analyzeSource.restore();
});

test("workspace index deduplicates include edges from repeated roots", (t) => {
  const root = path.resolve("/virtual/main.asm");
  const include = path.resolve("/virtual/include.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions({ entryPoints: [root] }));
  index.openDocument(root, 'incsrc "include.asm"\n');
  const analyzeSource = stub(Assembler.prototype, "analyzeSource").returns({
    diagnostics: [],
    symbols: [],
    references: [],
    includeEdges: [
      { fromFile: root, toFile: include },
      { fromFile: root, toFile: include },
    ],
    program: { sourceFile: root, startLine: 0, nodes: [] },
  });

  index.reindex();

  t.is(
    index.getIncludeEdges().filter((edge) => edge.fromFile === root && edge.toFile === include)
      .length,
    1,
  );
  analyzeSource.restore();
});
