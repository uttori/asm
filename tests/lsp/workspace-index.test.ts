import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stub } from "sinon";
import { test } from "../ava-helper.js";
import { Assembler } from "../../src/assembler.js";
import { WorkspaceIndex } from "../../src/lsp/workspace-index.js";

test("workspace index reads open, disk, and missing file text", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-workspace-"));
  const diskFile = path.join(directory, "disk.asm");
  const openFile = path.join(directory, "open.asm");
  fs.writeFileSync(diskFile, "org $8000\nDiskLabel:\n");

  try {
    const index = new WorkspaceIndex();
    index.openDocument(openFile, "org $8000\nOpenLabel:\n");

    t.is(index.getFileText(openFile), "org $8000\nOpenLabel:\n");
    t.is(index.getFileText(diskFile), "org $8000\nDiskLabel:\n");
    t.is(index.getFileText(path.join(directory, "missing.asm")), undefined);
    t.is(index.getText(diskFile), undefined);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("workspace index configures roots, include paths, and architecture", t => {
  const root = path.resolve("/virtual/configured.asm");
  const index = new WorkspaceIndex();
  index.openDocument(root, "org $8000\nStart:\n  nop\n");

  index.configure({
    entryPoints: [root, root],
    includePaths: ["/virtual/includes", "/virtual/includes"],
    architecture: "superfx",
  });

  t.deepEqual(index.getAnalyzedFiles(), [root]);
  t.true(index.getSymbols(root).some(entry => entry.name === "Start"));

  index.configure({});
  t.true(index.getSymbols(root).some(entry => entry.name === "Start"));
});

test("workspace index exposes empty and populated artifact collections", t => {
  const index = new WorkspaceIndex();
  const file = path.resolve("/virtual/artifacts.asm");

  t.deepEqual(index.getDiagnostics(file), []);
  t.deepEqual(index.getSymbols(file), []);
  t.deepEqual(index.getReferences(file), []);
  t.deepEqual(index.getAllSymbols(), []);
  t.deepEqual(index.getAllReferences(), []);
  t.deepEqual(index.getIncludeEdges(), []);
  t.is(index.getFileAnalysis(file), undefined);

  index.openDocument(file, "org $8000\nTarget:\n  lda Target\n");
  t.true(index.getSymbols(file).some(entry => entry.name === "Target"));
  t.true(index.getAllSymbols().some(entry => entry.name === "Target"));
  t.true(index.getReferences(file).some(entry => entry.name === "Target"));
  t.true(index.getAllReferences().some(entry => entry.name === "Target"));
  t.is(index.getFileAnalysis(file)?.file, file);
});

test("workspace index skips unreadable roots and unexpected analysis failures", t => {
  const missing = path.resolve("/virtual/missing.asm");
  const broken = path.resolve("/virtual/broken.asm");
  const index = new WorkspaceIndex({ entryPoints: [missing, broken] });
  index.openDocument(broken, "org $8000\n");

  const analyzeSource = stub(Assembler.prototype, "analyzeSource").throws(new Error("unexpected"));
  index.reindex();

  t.true(analyzeSource.calledOnce);
  t.deepEqual(index.getAnalyzedFiles(), []);
  analyzeSource.restore();
});

test("workspace index deduplicates include edges from repeated roots", t => {
  const root = path.resolve("/virtual/main.asm");
  const include = path.resolve("/virtual/include.asm");
  const index = new WorkspaceIndex({ entryPoints: [root] });
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

  t.is(index.getIncludeEdges().filter(edge => edge.fromFile === root && edge.toFile === include).length, 1);
  analyzeSource.restore();
});
