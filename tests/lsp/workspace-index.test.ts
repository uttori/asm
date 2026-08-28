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
  index.reindex();

  const analyzeSource = stub(Assembler.prototype, "analyzeSource").callThrough();
  try {
    index.updateDocument(shared, "SharedAfter:\n");
    index.reindex();

    t.true(analyzeSource.calledOnce);
    t.true(index.getSymbols(shared).some((entry) => entry.name === "SharedAfter"));
    t.false(index.getSymbols(shared).some((entry) => entry.name === "SharedBefore"));
    t.true(index.getSymbols(rootB).some((entry) => entry.name === "RootB"));
  } finally {
    analyzeSource.restore();
  }
});

test("workspace index conservatively re-analyses roots for unknown new dependencies", (t) => {
  const rootA = path.resolve("/virtual/unknown-a.asm");
  const rootB = path.resolve("/virtual/unknown-b.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions({ entryPoints: [rootA, rootB] }));
  index.openDocument(rootA, "RootA:\n");
  index.openDocument(rootB, "RootB:\n");
  index.reindex();

  const analyzeSource = stub(Assembler.prototype, "analyzeSource").callThrough();
  try {
    index.invalidateFile(path.resolve("/virtual/new-include.asm"));
    index.reindex();

    t.is(analyzeSource.callCount, 2);
  } finally {
    analyzeSource.restore();
  }
});

test("workspace index skips unreadable roots and unexpected analysis failures", (t) => {
  const missing = path.resolve("/virtual/missing.asm");
  const broken = path.resolve("/virtual/broken.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions({ entryPoints: [missing, broken] }));
  index.openDocument(broken, "org $8000\n");

  const analyzeSource = stub(Assembler.prototype, "analyzeSource").throws(new Error("unexpected"));
  try {
    index.reindex();

    t.true(analyzeSource.calledOnce);
    t.deepEqual(index.getAnalyzedFiles(), []);
  } finally {
    analyzeSource.restore();
  }
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

  try {
    index.reindex();

    t.is(
      index.getIncludeEdges().filter((edge) => edge.fromFile === root && edge.toFile === include)
        .length,
      1,
    );
  } finally {
    analyzeSource.restore();
  }
});

test("openDocument indexes the opened file without waiting on includes", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-local-"));
  const include = path.join(directory, "slow.asm");
  const root = path.join(directory, "main.asm");
  fs.writeFileSync(include, "IncludedLabel:\n  nop\n");

  try {
    const messages: string[] = [];
    const index = new WorkspaceIndex(
      snesWorkspaceIndexOptions({
        logger: { info: (message) => messages.push(message) },
      }),
    );
    index.openDocument(root, 'incsrc "slow.asm"\nLocalLabel:\n  nop\n');

    t.true(index.getSymbols(root).some((entry) => entry.name === "LocalLabel"));
    t.false(index.getSymbols(include).some((entry) => entry.name === "IncludedLabel"));
    t.true(
      index
        .getIncludeEdges()
        .some((edge) => edge.fromFile === root && path.basename(edge.toFile) === "slow.asm"),
    );
    t.true(messages.some((message) => message.includes("followIncludes=false")));

    index.reindex();

    t.true(index.getSymbols(include).some((entry) => entry.name === "IncludedLabel"));
    t.true(messages.some((message) => message.includes("followIncludes=true")));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("covered file opened directly does not produce false diagnostics", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-covered-"));
  const parent = path.join(directory, "root.asm");
  const child = path.join(directory, "child.asm");
  fs.writeFileSync(parent, '!config = 1\nincsrc "child.asm"\n');
  fs.writeFileSync(child, "if !config == 1\n  nop\nendif\n");

  try {
    const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
    index.openDocument(parent, '!config = 1\nincsrc "child.asm"\n');
    index.openDocument(child, "if !config == 1\n  nop\nendif\n");
    index.reindex();

    // child.asm is covered by parent's full-pass analysis; its standalone
    // analysis (which would produce "Define 'config' not found") must be
    // superseded so no false errors appear.
    const childDiagnostics = index.getDiagnostics(child);
    t.deepEqual(childDiagnostics, []);

    // Symbols defined in child.asm are still visible via parent's analysis.
    t.true(index.getIncludeEdges().some((edge) => edge.toFile === child));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("openDocument does not dirty a file whose buffer matches disk", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-clean-open-"));
  const file = path.join(directory, "main.asm");
  const source = "org $8000\nStart:\n  nop\n";
  fs.writeFileSync(file, source);

  try {
    const index = new WorkspaceIndex(snesWorkspaceIndexOptions({ entryPoints: [file] }));
    index.openDocument(file, source);
    t.false(index.dirtyFiles.has(file));
    t.true(index.isFileDirtyOrUncovered(file));
    index.reindex();
    t.false(index.isFileDirtyOrUncovered(file));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("reindex does not re-analyse roots when nothing is dirty", (t) => {
  const file = path.resolve("/virtual/stable.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions({ entryPoints: [file] }));
  index.openDocument(file, "org $8000\nStart:\n  nop\n");
  index.reindex();
  t.is(index.getStatus().lastReindexRootCount, 1);
  t.true(
    index.getStatus().lastReindexAnalyzedRoots + index.getStatus().lastReindexCachedRoots >= 1,
  );

  const analyzeSource = stub(Assembler.prototype, "analyzeSource").callThrough();
  try {
    index.reindex();
    t.is(analyzeSource.callCount, 0);
    const status = index.getStatus();
    t.is(status.lastReindexRootCount, 1);
    t.is(status.lastReindexCachedRoots, 1);
    t.is(status.lastReindexAnalyzedRoots, 0);
  } finally {
    analyzeSource.restore();
  }
});

test("covered include is not a reason to reindex after the parent is analysed", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-covered-open-"));
  const parent = path.join(directory, "root.asm");
  const child = path.join(directory, "child.asm");
  const parentSource = '!config = 1\nincsrc "child.asm"\n';
  const childSource = "ChildLabel:\n  nop\n";
  fs.writeFileSync(parent, parentSource);
  fs.writeFileSync(child, childSource);

  try {
    const index = new WorkspaceIndex(snesWorkspaceIndexOptions({ entryPoints: [parent] }));
    index.openDocument(parent, parentSource);
    index.reindex();

    t.false(index.isFileDirtyOrUncovered(child));
    index.openDocument(child, childSource);
    t.false(index.dirtyFiles.has(child));
    t.false(index.isFileDirtyOrUncovered(child));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("disk cache reuses a full-pass analysis when file hashes match", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-cache-"));
  const cacheDir = path.join(directory, "cache");
  const file = path.join(directory, "main.asm");
  const source = "org $8000\nCachedLabel:\n  nop\n";
  fs.writeFileSync(file, source);
  const messages: string[] = [];

  try {
    const first = new WorkspaceIndex(
      snesWorkspaceIndexOptions({
        entryPoints: [file],
        cacheDir,
        logger: { info: (message) => messages.push(message) },
      }),
    );
    first.openDocument(file, source);
    first.reindex();
    t.true(first.getSymbols(file).some((entry) => entry.name === "CachedLabel"));
    t.true(messages.some((message) => message.includes("Analyzing")));

    const second = new WorkspaceIndex(
      snesWorkspaceIndexOptions({
        entryPoints: [file],
        cacheDir,
        logger: { info: (message) => messages.push(message) },
      }),
    );
    second.openDocument(file, source);
    const analyzeSource = stub(Assembler.prototype, "analyzeSource").callThrough();
    try {
      second.reindex();
      t.is(analyzeSource.callCount, 0);
      t.true(second.getSymbols(file).some((entry) => entry.name === "CachedLabel"));
      t.true(messages.some((message) => message.includes("Using cached analysis")));
      const status = second.getStatus();
      t.is(status.lastReindexRootCount, 1);
      t.is(status.lastReindexCachedRoots, 1);
      t.is(status.lastReindexAnalyzedRoots, 0);
    } finally {
      analyzeSource.restore();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
