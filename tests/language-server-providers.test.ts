import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CompletionItemKind, SymbolKind } from "vscode-languageserver";
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
  projectOutlineFor,
  referencesFor,
  renameEditsFor,
  semanticTokensFor,
  semanticTokensLegend,
  signatureHelpFor,
} from "../packages/language-server/src/providers.js";

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

test("semantic tokens extend stale prefix matches to the full identifier", (t) => {
  const macroFile = path.resolve("/virtual/stale-rename.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(macroFile, "macro unk1E()\n  nop\nendmacro\n");
  index.updateDocument(macroFile, "macro unk1E__WE()\n  nop\nendmacro\n");

  const tokens = semanticTokensFor(index, macroFile).data;
  const decoded = Array.from({ length: tokens.length / 5 }, (_, i) =>
    tokens.slice(i * 5, i * 5 + 5),
  );
  t.true(
    decoded.some((token) => token[2] === "unk1E__WE".length),
    "stale symbol name unk1E extends to cover unk1E__WE",
  );
});

test("find-references returns no locations when the index is empty", (t) => {
  const emptyFile = path.resolve("/virtual/empty.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  t.deepEqual(referencesFor(index, emptyFile, { line: 0, character: 0 }, true), []);
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
      originSelectionRange?: {
        start: { line: number; character: number };
        end: { character: number };
      };
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

function decodeSemanticTokens(data: number[]): Array<{
  line: number;
  char: number;
  length: number;
  type: number;
}> {
  const decoded: Array<{ line: number; char: number; length: number; type: number }> = [];
  let line = 0;
  let char = 0;
  for (let index = 0; index + 4 < data.length; index += 5) {
    const deltaLine = data[index] ?? 0;
    const deltaStart = data[index + 1] ?? 0;
    line += deltaLine;
    char = deltaLine === 0 ? char + deltaStart : deltaStart;
    decoded.push({
      line,
      char,
      length: data[index + 2] ?? 0,
      type: data[index + 3] ?? 0,
    });
  }
  return decoded;
}

function childNamed(
  symbols: ReturnType<typeof documentSymbolsFor>,
  name: string,
): ReturnType<typeof documentSymbolsFor>[number] | undefined {
  for (const symbol of symbols) {
    if (symbol.name === name) {
      return symbol;
    }
    const nested = childNamed(symbol.children ?? [], name);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

function columnOf(line: string, token: string): number {
  return line.indexOf(token);
}

test("struct members nest in the outline and are independently targetable", (t) => {
  const structFile = path.resolve("/virtual/object_defines.asm");
  const source = [
    "lorom",
    "org $008000",
    "struct obj 0 ;65 bytes / obj",
    "    .timer:      skip 1",
    "    ; used as a state index",
    "    ._13:        skip 2 ;physics pointer?",
    "endstruct",
    "cop:",
    "    sta.b obj.timer",
    "    sta.b obj._13",
    "",
  ].join("\n");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(structFile, source);

  const outline = documentSymbolsFor(index, structFile);
  const obj = outline.find((symbol) => symbol.name === "obj");
  t.truthy(obj);
  t.is(obj?.kind, SymbolKind.Struct);
  t.true((obj?.children ?? []).some((child) => child.name === "timer"));
  t.true((obj?.children ?? []).some((child) => child.name === "_13"));

  const useLine = source.split("\n")[8];
  const objColumn = columnOf(useLine, "obj");
  const timerColumn = columnOf(useLine, "timer");

  const objDefinition = definitionFor(index, structFile, { line: 8, character: objColumn + 1 });
  t.is(objDefinition.length, 1);
  t.is(objDefinition[0].range.start.line, 2);

  const timerDefinition = definitionFor(index, structFile, {
    line: 8,
    character: timerColumn + 1,
  });
  t.is(timerDefinition.length, 1);
  t.is(timerDefinition[0].range.start.line, 3);

  const objHover = hoverFor(index, structFile, { line: 8, character: objColumn + 1 }, source);
  t.regex(JSON.stringify(objHover), /struct/);
  t.regex(JSON.stringify(objHover), /65 bytes \/ obj/);

  const fieldHover = hoverFor(
    index,
    structFile,
    { line: 9, character: columnOf(source.split("\n")[9], "_13") + 1 },
    source,
  );
  t.regex(JSON.stringify(fieldHover), /physics pointer\?/);
  t.regex(JSON.stringify(fieldHover), /used as a state index/);

  const timerRefs = referencesFor(index, structFile, { line: 8, character: timerColumn + 1 }, true);
  t.true(timerRefs.some((location) => location.range.start.line === 3));
  t.true(timerRefs.some((location) => location.range.start.line === 8));
  t.false(timerRefs.some((location) => location.range.start.line === 2));

  const objRefs = referencesFor(index, structFile, { line: 8, character: objColumn + 1 }, true);
  t.true(objRefs.some((location) => location.range.start.line === 2));
  t.true(objRefs.some((location) => location.range.start.line === 8));

  const edit = renameEditsFor(
    index,
    structFile,
    { line: 8, character: timerColumn + 1 },
    "elapsed",
  );
  const changes = edit?.changes?.[pathToUri(structFile)] ?? [];
  t.true(changes.length >= 2);
  t.true(changes.every((change) => change.newText === "elapsed"));
  t.false(
    changes.some((change) => {
      const line = source.split("\n")[change.range.start.line];
      return line.slice(change.range.start.character, change.range.end.character) === "obj";
    }),
  );

  const structType = semanticTokensLegend.tokenTypes.indexOf("struct");
  const propertyType = semanticTokensLegend.tokenTypes.indexOf("property");
  t.true(structType >= 0);
  t.true(propertyType >= 0);
  const decoded = decodeSemanticTokens(semanticTokensFor(index, structFile).data);
  t.true(
    decoded.some(
      (token) => token.line === 8 && token.type === structType && token.length === "obj".length,
    ),
    "obj.timer root is a struct token",
  );
  t.true(
    decoded.some(
      (token) => token.line === 8 && token.type === propertyType && token.length === "timer".length,
    ),
    "obj.timer field is a property token",
  );
});

test("define-rooted struct members and immediate labels are targetable", (t) => {
  const sourceFile = path.resolve("/virtual/object_aliases.asm");
  const source = [
    "lorom",
    "org $008000",
    "struct obj 0",
    "    .flags2: skip 1",
    "    ._13: skip 2",
    "endstruct",
    "obj_start:",
    "!obj_arthur = obj_start+obj[0]",
    "cop:",
    "    lda.w !obj_arthur.flags2",
    "    lda.b #coord_offsets_arthur : sta.w !obj_arthur._13",
    "    lda.b #coord_offsets_arthur>>8 : sta.w !obj_arthur._13+1",
    "coord_offsets_arthur:",
    "    nop",
    "",
  ].join("\n");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(sourceFile, source);
  const lines = source.split("\n");

  const flagsLine = 9;
  const defineColumn = columnOf(lines[flagsLine], "!obj_arthur");
  const flagsColumn = columnOf(lines[flagsLine], "flags2");
  const defineDefinition = definitionFor(index, sourceFile, {
    line: flagsLine,
    character: defineColumn + 2,
  });
  t.is(defineDefinition.length, 1);
  t.is(defineDefinition[0].range.start.line, 7);

  const flagsDefinition = definitionFor(index, sourceFile, {
    line: flagsLine,
    character: flagsColumn + 1,
  });
  t.is(flagsDefinition.length, 1);
  t.is(flagsDefinition[0].range.start.line, 3);

  const defineHover = hoverFor(
    index,
    sourceFile,
    { line: flagsLine, character: defineColumn + 2 },
    source,
  );
  t.regex(JSON.stringify(defineHover), /obj_arthur/);

  const flagsHover = hoverFor(
    index,
    sourceFile,
    { line: flagsLine, character: flagsColumn + 1 },
    source,
  );
  t.regex(JSON.stringify(flagsHover), /flags2/);
  t.regex(JSON.stringify(flagsHover), /In `obj`/);

  const immediateLine = 10;
  const labelColumn = columnOf(lines[immediateLine], "coord_offsets_arthur");
  const memberColumn = columnOf(lines[immediateLine], "_13");
  const labelDefinition = definitionFor(index, sourceFile, {
    line: immediateLine,
    character: labelColumn + 1,
  });
  t.is(labelDefinition.length, 1);
  t.is(labelDefinition[0].range.start.line, 12);

  const labelHover = hoverFor(
    index,
    sourceFile,
    { line: immediateLine, character: labelColumn + 1 },
    source,
  );
  t.regex(JSON.stringify(labelHover), /coord_offsets_arthur/);

  const memberDefinition = definitionFor(index, sourceFile, {
    line: immediateLine,
    character: memberColumn + 1,
  });
  t.is(memberDefinition.length, 1);
  t.is(memberDefinition[0].range.start.line, 4);

  const shiftedLine = 11;
  const shiftedLabelColumn = columnOf(lines[shiftedLine], "coord_offsets_arthur");
  const shiftedHover = hoverFor(
    index,
    sourceFile,
    { line: shiftedLine, character: shiftedLabelColumn + 1 },
    source,
  );
  t.regex(JSON.stringify(shiftedHover), /coord_offsets_arthur/);

  const propertyType = semanticTokensLegend.tokenTypes.indexOf("property");
  const labelType = semanticTokensLegend.tokenTypes.indexOf("label");
  const decoded = decodeSemanticTokens(semanticTokensFor(index, sourceFile).data);
  t.true(
    decoded.some(
      (token) =>
        token.line === flagsLine &&
        token.char === flagsColumn &&
        token.type === propertyType &&
        token.length === "flags2".length,
    ),
    "flags2 is a property token",
  );
  t.true(
    decoded.some(
      (token) =>
        token.line === flagsLine &&
        token.char === defineColumn &&
        token.length === "!obj_arthur".length,
    ),
    "!obj_arthur is highlighted as a define",
  );
  t.true(
    decoded.some(
      (token) =>
        token.line === immediateLine &&
        token.char === labelColumn &&
        token.type === labelType &&
        token.length === "coord_offsets_arthur".length,
    ),
    "#coord_offsets_arthur is a label token",
  );
});

test("namespaces and nested labels appear as an outline tree", (t) => {
  const nsFile = path.resolve("/virtual/namespaces.asm");
  const source = [
    "lorom",
    "org $008000",
    "namespace Audio",
    "Upload:",
    ".loop:",
    "  rtl",
    "namespace off",
    "Parent:",
    ".inner:",
    "  nop",
    "",
  ].join("\n");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(nsFile, source);

  const outline = documentSymbolsFor(index, nsFile);
  const audio = outline.find((symbol) => symbol.name === "Audio");
  t.truthy(audio);
  t.is(audio?.kind, SymbolKind.Namespace);
  t.true((audio?.children ?? []).some((child) => child.name === "Upload"));
  const upload = (audio?.children ?? []).find((child) => child.name === "Upload");
  t.true((upload?.children ?? []).some((child) => child.name === "loop"));

  const parent = childNamed(outline, "Parent");
  t.truthy(parent);
  t.true((parent?.children ?? []).some((child) => child.name === "inner"));
});

test("sibling dot labels nest flat under their parent global label", (t) => {
  // Regression: consumeNamedLabelDefinitions captured parentBefore = currentParentLabel
  // AFTER each handleLabelDefinition call, so sibling .B51A got containerName
  // "bars_create_B512" instead of "bars_create", causing cascading nesting in the outline.
  const barsFile = path.resolve("/virtual/bars-outline.asm");
  const source = [
    "lorom",
    "org $008000",
    "namespace bars",
    "{",
    "create:",
    "    nop",
    "    bne .B512",
    "    bra .B51A",
    ".B512:",
    "    nop",
    ".B51A:",
    "    nop",
    ".B52A:",
    "    nop",
    ".B52C:",
    "    nop",
    "}",
    "",
  ].join("\n");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(barsFile, source);

  const outline = documentSymbolsFor(index, barsFile);
  const bars = outline.find((symbol) => symbol.name === "bars");
  t.truthy(bars, "bars namespace present");

  const create = (bars?.children ?? []).find((child) => child.name === "create");
  t.truthy(create, "create label is a child of bars");

  const childNames = (create?.children ?? []).map((child) => child.name);
  // All sibling dot labels must be direct children of 'create' — not nested under each other.
  t.true(childNames.includes("B512"), "B512 is a direct child of create");
  t.true(childNames.includes("B51A"), "B51A is a direct child of create");
  t.true(childNames.includes("B52A"), "B52A is a direct child of create");
  t.true(childNames.includes("B52C"), "B52C is a direct child of create");

  // No dot label should have another dot label as a child (the cascading nesting bug).
  for (const child of create?.children ?? []) {
    const grandchildren = child.children ?? [];
    t.is(
      grandchildren.length,
      0,
      `${child.name} should have no children, got: ${grandchildren.map((g) => g.name).join(", ")}`,
    );
  }

  // The setLabel recording (which has the address value) should win the dedup.
  const b512 = (create?.children ?? []).find((child) => child.name === "B512");
  t.truthy(b512?.detail?.includes("$"), "B512 outline entry should carry its address value");
});

test("compound hierarchical labels are independently targetable", (t) => {
  const sourceFile = path.resolve("/virtual/compound-labels.asm");
  const source = [
    "lorom",
    "org $008000",
    "_018049:",
    "    lda #$F2",
    "    bra .8053",
    ".804D:",
    "    lda #$F0",
    "    bra .8053",
    ".8053:",
    "    rtl",
    "caller:",
    "    jsl _018049_8053",
    "",
  ].join("\n");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(sourceFile, source);
  const lines = source.split("\n");

  const localUseLine = 4;
  const localColumn = columnOf(lines[localUseLine], ".8053");
  const localDefinition = definitionFor(index, sourceFile, {
    line: localUseLine,
    character: localColumn + 2,
  });
  t.is(localDefinition.length, 1);
  t.is(localDefinition[0].range.start.line, 8);

  const localHover = hoverFor(
    index,
    sourceFile,
    { line: localUseLine, character: localColumn + 2 },
    source,
  );
  t.regex(JSON.stringify(localHover), /8053/);

  const compoundLine = 11;
  const parentColumn = columnOf(lines[compoundLine], "_018049");
  const suffixColumn = columnOf(lines[compoundLine], "_8053") + 1;
  const parentDefinition = definitionFor(index, sourceFile, {
    line: compoundLine,
    character: parentColumn + 1,
  });
  t.is(parentDefinition.length, 1);
  t.is(parentDefinition[0].range.start.line, 2);

  const suffixDefinition = definitionFor(index, sourceFile, {
    line: compoundLine,
    character: suffixColumn + 1,
  });
  t.is(suffixDefinition.length, 1);
  t.is(suffixDefinition[0].range.start.line, 8);

  const parentHover = hoverFor(
    index,
    sourceFile,
    { line: compoundLine, character: parentColumn + 1 },
    source,
  );
  t.regex(JSON.stringify(parentHover), /_018049/);
  t.notRegex(JSON.stringify(parentHover), /_018049_8053/);

  const suffixHover = hoverFor(
    index,
    sourceFile,
    { line: compoundLine, character: suffixColumn + 1 },
    source,
  );
  t.regex(JSON.stringify(suffixHover), /8053/);

  const labelType = semanticTokensLegend.tokenTypes.indexOf("label");
  const decoded = decodeSemanticTokens(semanticTokensFor(index, sourceFile).data);
  t.true(
    decoded.some(
      (token) =>
        token.line === compoundLine &&
        token.char === parentColumn &&
        token.type === labelType &&
        token.length === "_018049".length,
    ),
    "parent segment of _018049_8053 is a label token",
  );
  t.true(
    decoded.some(
      (token) =>
        token.line === compoundLine &&
        token.char === suffixColumn &&
        token.type === labelType &&
        token.length === "8053".length,
    ),
    "sublabel segment of _018049_8053 is a label token",
  );
  t.true(
    decoded.some(
      (token) =>
        token.line === localUseLine &&
        token.char === localColumn &&
        token.length === ".8053".length,
    ),
    "bra .8053 is highlighted",
  );
});

test("dotted local compounds like .idx_beginner hover each segment", (t) => {
  const sourceFile = path.resolve("/virtual/difficulty-tables.asm");
  const source = [
    "lorom",
    "org $008000",
    "Tables:",
    ".difficulty_offset:",
    "    dw .idx_beginner, .idx_normal",
    ".idx:",
    "..beginner:",
    "    nop",
    "..normal:",
    "    nop",
    "",
  ].join("\n");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(sourceFile, source);
  const lines = source.split("\n");
  const useLine = 4;
  const token = ".idx_beginner";
  const tokenColumn = columnOf(lines[useLine], token);
  const idxColumn = tokenColumn + 1;
  const beginnerColumn = tokenColumn + token.indexOf("beginner");

  const outline = documentSymbolsFor(index, sourceFile);
  const tables = outline.find((symbol) => symbol.name === "Tables");
  const idx = (tables?.children ?? []).find((child) => child.name === "idx");
  t.truthy(idx, "outline shows .idx under Tables");
  t.true(
    (idx?.children ?? []).some((child) => child.name === "beginner"),
    "outline nests ..beginner under .idx",
  );

  const idxHover = hoverFor(index, sourceFile, { line: useLine, character: idxColumn }, source);
  t.truthy(idxHover, "hover on .idx in .idx_beginner");
  t.regex(JSON.stringify(idxHover), /\*\*\.idx\*\*/);
  t.notRegex(JSON.stringify(idxHover), /beginner/i);

  const beginnerHover = hoverFor(
    index,
    sourceFile,
    { line: useLine, character: beginnerColumn },
    source,
  );
  t.truthy(beginnerHover, "hover on beginner in .idx_beginner");
  t.regex(JSON.stringify(beginnerHover), /beginner/i);

  const idxDefinition = definitionFor(index, sourceFile, {
    line: useLine,
    character: idxColumn,
  });
  t.is(idxDefinition.length, 1);
  t.is(idxDefinition[0].range.start.line, 5);

  const beginnerDefinition = definitionFor(index, sourceFile, {
    line: useLine,
    character: beginnerColumn,
  });
  t.is(beginnerDefinition.length, 1);
  t.is(beginnerDefinition[0].range.start.line, 6);

  const labelType = semanticTokensLegend.tokenTypes.indexOf("label");
  const decoded = decodeSemanticTokens(semanticTokensFor(index, sourceFile).data);
  t.true(
    decoded.some(
      (token) =>
        token.line === useLine &&
        token.char === tokenColumn &&
        token.type === labelType &&
        token.length === ".idx".length,
    ),
    "parent segment of .idx_beginner is a label token",
  );
  t.true(
    decoded.some(
      (token) =>
        token.line === useLine &&
        token.char === beginnerColumn &&
        token.type === labelType &&
        token.length === "beginner".length,
    ),
    "sublabel segment of .idx_beginner is a label token",
  );
  t.false(
    decoded.some(
      (entry) =>
        entry.line === useLine &&
        entry.char === tokenColumn &&
        entry.length === ".idx_beginner".length,
    ),
    "compound .idx_beginner is not a single token",
  );
});

test("asar directive operands have hover docs", (t) => {
  const sourceFile = path.resolve("/virtual/directive-operands.asm");
  const source = [
    "lorom",
    "org $008000",
    "check bankcross full",
    "optimize dp ram",
    "arch spc700-inline",
    "namespace nested on",
    "base off",
    'table "font.tbl",ltr',
    "spcblock $5000 nspc",
    "endspcblock execute Start",
    "struct Enemy extends Actor",
    "endstruct align $10",
    "warnings disable Wmapper_already_set",
    ".smart on",
    "nop",
    "",
  ].join("\n");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(sourceFile, source);
  const lines = source.split("\n");
  const hoverWord = (line: number, token: string, pattern: RegExp): void => {
    const column = columnOf(lines[line], token);
    const hover = hoverFor(index, sourceFile, { line, character: column }, source);
    t.regex(JSON.stringify(hover), pattern, `${token} on line ${line}`);
  };

  hoverWord(2, "bankcross", /bankcross/i);
  hoverWord(2, "full", /\*\*full\*\*/);
  hoverWord(3, "dp", /\*\*dp\*\*/);
  hoverWord(3, "ram", /direct-page|DP/i);
  hoverWord(4, "spc700-inline", /spc700-inline/);
  hoverWord(5, "nested", /\*\*nested\*\*/);
  hoverWord(5, "on", /nested/i);
  hoverWord(6, "off", /base off/);
  hoverWord(7, "ltr", /\*\*ltr\*\*/);
  hoverWord(8, "nspc", /\*\*nspc\*\*/);
  hoverWord(9, "execute", /\*\*execute\*\*/);
  hoverWord(10, "extends", /\*\*extends\*\*/);
  hoverWord(11, "align", /\*\*align\*\*/);
  hoverWord(12, "disable", /\*\*disable\*\*/);
  hoverWord(13, "on", /\.smart on/);
});

test("project outline groups the include DAG under entry points and lists orphans", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-project-outline-"));
  const main = path.join(directory, "main.asm");
  const child = path.join(directory, "child.asm");
  const shared = path.join(directory, "shared.asm");
  const other = path.join(directory, "other.asm");
  const orphan = path.join(directory, "orphan.asm");
  fs.writeFileSync(main, 'incsrc "child.asm"\nincsrc "shared.asm"\nMainLabel:\n  nop\n');
  fs.writeFileSync(child, 'incsrc "shared.asm"\nChildLabel:\n  nop\n');
  fs.writeFileSync(shared, "SharedLabel:\n  nop\n");
  fs.writeFileSync(other, "OtherLabel:\n  nop\n");
  fs.writeFileSync(orphan, "OrphanLabel:\n  nop\n");

  try {
    const index = new WorkspaceIndex(
      snesWorkspaceIndexOptions({ entryPoints: [main, other], includePaths: [directory] }),
    );
    index.reindex();
    index.openDocument(orphan, "OrphanLabel:\n  nop\n");

    const outline = projectOutlineFor(index);
    t.deepEqual(
      outline.map((node) => node.kind),
      ["entry", "entry", "orphanGroup"],
    );
    t.is(outline[0]?.label, "Entry: main.asm");
    t.is(outline[1]?.label, "Entry: other.asm");
    t.is(outline[2]?.label, "Orphans");

    const mainFile = outline[0]?.children?.[0];
    t.is(mainFile?.kind, "file");
    t.is(mainFile?.label, "main.asm");
    const included = mainFile?.children ?? [];
    t.true(included.some((node) => node.label === "child.asm" && node.kind === "file"));
    t.true(included.some((node) => node.label === "shared.asm" && node.kind === "include"));

    const childNode = included.find((node) => node.label === "child.asm");
    t.true(
      (childNode?.children ?? []).some(
        (node) => node.label === "shared.asm" && node.kind === "file",
      ),
    );

    t.true((outline[2]?.children ?? []).some((node) => node.label === "orphan.asm"));
    t.false(JSON.stringify(outline).includes("MainLabel"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
