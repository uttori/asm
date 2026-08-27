import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CompletionItemKind } from "vscode-languageserver";
import { test } from "./ava-helper.js";
import { WorkspaceIndex } from "../packages/core/src/lsp/workspace-index.js";
import { snesWorkspaceIndexOptions } from "./test-assembler.js";
import {
  completionsFor,
  definitionFor,
  documentSymbolsFor,
  hoverFor,
  pathToUri,
  prepareRenameFor,
  referencesFor,
  renameEditsFor,
  semanticTokensFor,
  semanticTokensLegend,
  signatureHelpFor,
} from "../language-server/src/providers.js";

const file = path.resolve("/virtual/providers.asm");
const source = "org $008000\nTarget:\n  LDA Target\n";

function createIndex(): WorkspaceIndex {
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(file, source);
  return index;
}

test("language-server providers expose navigation, docs, completion, and tokens", (t) => {
  const index = createIndex();

  const symbols = documentSymbolsFor(index, file);
  t.true(symbols.some((symbol) => symbol.name === "Target"));

  const definitions = definitionFor(index, file, { line: 2, character: 8 });
  t.is(definitions.length, 1);
  t.is(definitions[0].uri, pathToUri(file));
  t.is(definitions[0].range.start.line, 1);

  const references = referencesFor(index, file, { line: 1, character: 2 }, true);
  t.true(references.some((location) => location.range.start.line === 1));
  t.true(references.some((location) => location.range.start.line === 2));

  const hover = hoverFor(index, file, { line: 2, character: 3 }, source);
  t.regex(JSON.stringify(hover), /LDA/);

  const completions = completionsFor(index);
  t.true(completions.some((item) => item.label === "LDA"));
  t.true(
    completions.some((item) => item.label === "org" && item.kind === CompletionItemKind.Keyword),
  );
  t.true(completions.some((item) => item.label === "Target"));

  const signature = signatureHelpFor("  LDA ", index);
  t.true((signature?.signatures.length ?? 0) > 1);
  t.is(signature?.activeParameter, undefined);

  const semanticTokenData = semanticTokensFor(index, file).data;
  const tokenTypeIndex = semanticTokensLegend.tokenTypes.indexOf("label");
  t.true(semanticTokensLegend.tokenModifiers.includes("definition"));
  t.true(semanticTokenData.length > 0);
  t.true(
    Array.from({ length: semanticTokenData.length / 5 }, (_, index) =>
      semanticTokenData.slice(index * 5, index * 5 + 5),
    ).some((token) => token[3] === tokenTypeIndex && token[4] === 1),
  );
});

test("rename edits user symbols but rejects instruction mnemonics", (t) => {
  const index = createIndex();

  t.is(prepareRenameFor(index, file, { line: 2, character: 3 }), null);
  t.is(renameEditsFor(index, file, { line: 2, character: 3 }, "STA"), null);

  t.truthy(prepareRenameFor(index, file, { line: 2, character: 8 }));
  const edit = renameEditsFor(index, file, { line: 2, character: 8 }, "Destination");
  const changes = edit?.changes?.[pathToUri(file)] ?? [];
  t.is(changes.length, 2);
  t.true(changes.every((change) => change.newText === "Destination"));
  t.deepEqual(changes.map((change) => change.range.start.line).sort(), [1, 2]);
});

test("document symbols keep original source lines when comments precede labels", (t) => {
  const commented = path.resolve("/virtual/hello-world.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(
    commented,
    "; hello-world.asm\n; banner\n\nlorom\n\norg $008000\n\nReset:\n  sei\n",
  );

  const reset = documentSymbolsFor(index, commented).find((symbol) => symbol.name === "Reset");
  t.truthy(reset);
  t.is(reset?.range.start.line, 7);
  t.is(reset?.selectionRange.start.line, 7);
});

test("macro document symbols jump to the header, not endmacro", (t) => {
  const macroFile = path.resolve("/virtual/macros.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(macroFile, "macro foo()\n nop\nendmacro\n");

  const foo = documentSymbolsFor(index, macroFile).find((symbol) => symbol.name === "foo");
  t.truthy(foo);
  t.is(foo?.range.start.line, 0);
  t.is(foo?.selectionRange.start.line, 0);
});

test("incsrc and incbin paths are clickable after the local analysis pass", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-includes-"));
  const defines = path.join(directory, "snes_defines.asm");
  const objects = path.join(directory, "objects");
  const binary = path.join(objects, "bat.bin");
  const main = path.join(directory, "main.asm");
  fs.mkdirSync(objects);
  fs.writeFileSync(defines, "nop\n");
  fs.writeFileSync(binary, Buffer.from([0x00]));

  try {
    const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
    index.openDocument(main, 'incsrc "snes_defines.asm"\nincbin "objects/bat.bin"\nLocal:\n');

    t.true(index.getSymbols(main).some((entry) => entry.name === "Local"));

    const incsrc = definitionFor(index, main, { line: 0, character: 10 });
    t.is(incsrc.length, 1);
    const incsrcResult = incsrc[0] as { uri?: string; targetUri?: string };
    t.is(incsrcResult.uri ?? incsrcResult.targetUri, pathToUri(defines));

    const incbin = definitionFor(index, main, { line: 1, character: 12 });
    t.is(incbin.length, 1);
    const incbinResult = incbin[0] as { uri?: string; targetUri?: string };
    t.is(incbinResult.uri ?? incbinResult.targetUri, pathToUri(binary));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("define references, rename, and sigil-stripped new names", (t) => {
  const defineFile = path.resolve("/virtual/defines.asm");
  const source = "!version = 0\n  LDA !version\n";
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(defineFile, source);

  const definition = definitionFor(index, defineFile, { line: 1, character: 8 });
  t.is(definition.length, 1);
  t.is(definition[0].uri, pathToUri(defineFile));
  t.is(definition[0].range.start.line, 0);

  const references = referencesFor(index, defineFile, { line: 1, character: 8 }, true);
  t.true(references.some((location) => location.range.start.line === 0));
  t.true(references.some((location) => location.range.start.line === 1));
  t.true(
    references.some(
      (location) =>
        location.range.start.line === 1 &&
        location.range.start.character === 6 &&
        location.range.end.character === 14,
    ),
    "find-references highlight includes the ! sigil",
  );

  t.truthy(prepareRenameFor(index, defineFile, { line: 0, character: 2 }));
  t.truthy(prepareRenameFor(index, defineFile, { line: 1, character: 8 }));

  const edit = renameEditsFor(index, defineFile, { line: 1, character: 8 }, "!release");
  const changes = edit?.changes?.[pathToUri(defineFile)] ?? [];
  t.is(changes.length, 2);
  t.true(changes.every((change) => change.newText === "release"));
  t.true(
    changes.every((change) => change.range.end.character - change.range.start.character === 7),
    "rename replaces the bare name, preserving !",
  );
});

test("macro definitions can be renamed and found as references", (t) => {
  const macroFile = path.resolve("/virtual/rename-macro.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(macroFile, "macro greet()\n  nop\nendmacro\n  %greet()\n");

  const references = referencesFor(index, macroFile, { line: 0, character: 7 }, true);
  t.true(references.some((location) => location.range.start.line === 0));
  t.true(references.some((location) => location.range.start.line === 3));

  t.truthy(prepareRenameFor(index, macroFile, { line: 0, character: 7 }));
  const edit = renameEditsFor(index, macroFile, { line: 3, character: 5 }, "hello");
  const changes = edit?.changes?.[pathToUri(macroFile)] ?? [];
  t.true(changes.length >= 2);
  t.true(changes.every((change) => change.newText === "hello"));
});

test("unquoted hyphenated incsrc paths highlight the full filename", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-unquoted-inc-"));
  const bank = path.join(directory, "bank10-1D.asm");
  const main = path.join(directory, "main.asm");
  fs.writeFileSync(bank, "nop\n");

  try {
    const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
    index.openDocument(main, "incsrc bank10-1D.asm\n");

    const result = definitionFor(index, main, { line: 0, character: 10 });
    t.is(result.length, 1);
    const link = result[0] as {
      targetUri?: string;
      uri?: string;
      originSelectionRange?: { start: { line: number; character: number }; end: { character: number } };
    };
    t.is(link.uri ?? link.targetUri, pathToUri(bank));
    t.truthy(link.originSelectionRange);
    t.is(link.originSelectionRange?.start.line, 0);
    t.is(link.originSelectionRange?.start.character, 7);
    t.is(link.originSelectionRange?.end.character, 20);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
