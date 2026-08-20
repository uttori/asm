import path from "node:path";
import { CompletionItemKind } from "vscode-languageserver";
import { test } from "./ava-helper.js";
import { WorkspaceIndex } from "../src/lsp/workspace-index.js";
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

  const hover = hoverFor(index, file, { line: 2, character: 3 }, source, "65816");
  t.regex(JSON.stringify(hover), /LDA/);

  const completions = completionsFor(index, "65816");
  t.true(completions.some((item) => item.label === "LDA"));
  t.true(
    completions.some((item) => item.label === "org" && item.kind === CompletionItemKind.Keyword),
  );
  t.true(completions.some((item) => item.label === "Target"));

  const signature = signatureHelpFor("  LDA ", "65816");
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
