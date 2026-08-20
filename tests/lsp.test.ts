import path from "node:path";
import { test } from "./ava-helper.js";

import { Assembler, snesWorkspaceIndexOptions } from "./test-assembler.js";
import {
  createMemoryAssemblyFileProvider,
  MemoryAssemblyFileProvider,
} from "../src/file-provider.js";
import { OverlayFileProvider } from "../src/lsp/overlay-file-provider.js";
import { WorkspaceIndex } from "../src/lsp/workspace-index.js";
import { findInstruction, findDirectiveEntry, buildCompletionEntries } from "../src/lsp/catalog.js";
import {
  positionInRange,
  referenceAt,
  symbolAt,
  resolveDefinition,
  findReferences,
} from "../src/lsp/position-lookup.js";
import type { AssemblySymbolDefinition, AssemblySymbolReference } from "../src/diagnostics.js";

const slideRoot = path.resolve(process.cwd(), "fixtures/integration/snes-slideshow/SLIDE.SRC");

test("analyzeSource records include-graph edges and attributes included symbols", (t) => {
  const fileProvider = createMemoryAssemblyFileProvider({
    "/proj/a.asm": 'org $8000\nincsrc "b.asm"\naLabel:\n  nop\n',
    "/proj/b.asm": "bLabel:\n  nop\n",
  });
  const assembler = new Assembler(undefined, { fileProvider });
  assembler.includePaths = ["/proj"];

  const result = assembler.analyzeSource(
    'org $8000\nincsrc "b.asm"\naLabel:\n  nop\n',
    "/proj/a.asm",
    0,
  );

  const edge = result.includeEdges.find((entry) => entry.toFile === "/proj/b.asm");
  t.truthy(edge, "expected an include edge to b.asm");
  t.is(edge?.fromFile, "/proj/a.asm");

  const includedSymbol = result.symbols.find((symbol) => symbol.name === "bLabel");
  t.truthy(includedSymbol, "expected bLabel from the included file");
  t.is(includedSymbol?.location.file, "/proj/b.asm");
});

test("overlay file provider prefers buffer content over the backing provider", (t) => {
  const base = new MemoryAssemblyFileProvider({ "/proj/main.asm": "org $8000\n" });
  const overlay = new Map<string, string>([["/proj/main.asm", "org $9000\n"]]);
  const provider = new OverlayFileProvider(overlay, base);

  t.is(provider.resolvePath("/proj/main.asm"), "/proj/main.asm");
  t.is(provider.readTextFile("/proj/main.asm"), "org $9000\n");
  t.true(provider.stat("/proj/main.asm").exists);
});

test("instruction and directive catalogs expose documented entries", (t) => {
  const lda = findInstruction("lda", "65816");
  t.truthy(lda);
  t.is(lda?.mnemonic, "LDA");
  t.true(lda!.modes.some((mode) => mode.mode === "immediate"));

  t.truthy(findDirectiveEntry("org"));
  t.truthy(findDirectiveEntry("incsrc"));

  const entries = buildCompletionEntries("65816");
  t.true(entries.some((entry) => entry.kind === "instruction" && entry.label === "JSR"));
  t.true(entries.some((entry) => entry.kind === "directive" && entry.label === "db"));
});

test("architecture encoders expose instruction catalogs", (t) => {
  const assembler = new Assembler();
  const encoder = assembler.architectureRegistry.getDefinition("65816")?.encoder;
  t.truthy(encoder?.getInstructionCatalog);
  const catalog = encoder?.getInstructionCatalog?.() ?? [];
  t.true(catalog.some((entry) => entry.mnemonic === "STA"));

  const spc =
    assembler.architectureRegistry.getDefinition("spc700")?.encoder.getInstructionCatalog?.() ?? [];
  t.true(spc.some((entry) => entry.mnemonic === "MOV"));
});

test("position lookup resolves references to definitions across files", (t) => {
  const definition: AssemblySymbolDefinition = {
    name: "playerHealth",
    kind: "label",
    location: {
      file: "/proj/a.asm",
      line: 2,
      range: { start: { line: 2, character: 0 }, end: { line: 2, character: 11 } },
    },
  };
  const reference: AssemblySymbolReference = {
    name: "playerHealth",
    kind: "label",
    location: {
      file: "/proj/b.asm",
      line: 5,
      range: { start: { line: 5, character: 4 }, end: { line: 5, character: 15 } },
    },
  };

  t.true(positionInRange({ line: 5, character: 8 }, reference.location.range!));
  t.false(positionInRange({ line: 6, character: 0 }, reference.location.range!));

  t.is(referenceAt([reference], { line: 5, character: 8 })?.name, "playerHealth");
  t.is(symbolAt([definition], { line: 2, character: 2 })?.name, "playerHealth");

  const resolved = resolveDefinition(reference, [definition]);
  t.is(resolved.length, 1);
  t.is(resolved[0].location.file, "/proj/a.asm");

  t.is(findReferences("playerHealth", [reference]).length, 1);
});

test("workspace index analyses SLIDE.SRC and follows includes", (t) => {
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions({ entryPoints: [slideRoot] }));
  index.reindex();

  const symbols = index.getSymbols(slideRoot);
  t.true(
    symbols.some((symbol) => symbol.name === "programStart"),
    "expected programStart label",
  );

  const edgeTargets = index
    .getIncludeEdges()
    .filter((edge) => edge.fromFile === slideRoot)
    .map((edge) => path.basename(edge.toFile).toLowerCase());
  t.true(edgeTargets.includes("compress.src"));
  t.true(edgeTargets.includes("frames.src"));
  t.true(edgeTargets.includes("animate.src"));

  const analyzedBasenames = index
    .getAnalyzedFiles()
    .map((file) => path.basename(file).toLowerCase());
  t.true(
    analyzedBasenames.includes("compress.src"),
    "included file should have its own analysis bucket",
  );

  // Cross-file: every analysed file's symbols are part of the merged set.
  t.true(index.getAllSymbols().length >= symbols.length);
});

test("workspace index serves open buffers and updates on change", (t) => {
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  const file = "/virtual/main.asm";

  index.openDocument(file, "org $8000\nstart:\n  nop\n");
  t.is(index.getText(file), "org $8000\nstart:\n  nop\n");
  t.true(index.getSymbols(file).some((symbol) => symbol.name === "start"));

  index.updateDocument(file, "org $8000\nbegin:\n  nop\n");
  t.true(index.getSymbols(file).some((symbol) => symbol.name === "start"));
  index.reindex();
  t.true(index.getSymbols(file).some((symbol) => symbol.name === "begin"));
  t.false(index.getSymbols(file).some((symbol) => symbol.name === "start"));

  index.closeDocument(file);
  t.is(index.getSymbols(file).length, 0);
});
