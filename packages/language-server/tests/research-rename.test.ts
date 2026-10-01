import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Assembler, MemoryAssemblyFileProvider } from "@uttori/asm-core";
import { sourceGit, writeResearchDocument } from "@uttori/asm-disassembler";
import {
  createSnesAssemblerEnvironment,
  validateSnesStructMap,
  validateSnesRamMap,
} from "@uttori/asm-plugin-snes";
import { TextDocumentEdit, type WorkspaceEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { test } from "../../../tests/ava-helper.js";
import { snesWorkspaceIndexOptions } from "../../../tests/test-assembler.js";
import { WorkspaceIndex } from "../../core/src/lsp/workspace-index.js";
import { renderSnesRamDefines } from "../../plugin-snes/src/disassembler/ram-map.js";
import { renderSnesStructDefines } from "../../plugin-snes/src/disassembler/struct-map.js";
import { pathToUri, prepareRenameFor, renameEditsFor } from "../src/providers.js";
import { renameRecipeExpression } from "../src/recipe-rename.js";
import { researchRenameEditsFor, type RenameBuffer } from "../src/research-rename.js";

test("recipe expression rename preserves literals, grouping, array indexes and field scope", (t) => {
  const input = '(Table[Index + Other[0].value].value & $FFFF) + Unrelated.value + "Table.value"';
  t.is(
    renameRecipeExpression(input, "value", "payload", ["Table"]),
    '(Table[Index + Other[0].value].payload & $FFFF) + Unrelated.value + "Table.value"',
  );
  t.is(
    renameRecipeExpression(input, "Index", "Row"),
    '(Table[Row + Other[0].value].value & $FFFF) + Unrelated.value + "Table.value"',
  );
});

test("RAM, constants, shared fields and struct types persist through repeated unsaved F2 and recipe rendering", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-recipe-f2-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  await sourceGit(root, ["init", "-b", "main"]);
  fs.mkdirSync(path.join(root, ".uttori/research"), { recursive: true });
  fs.mkdirSync(path.join(root, "source"));
  const romSha256 = "a".repeat(64);
  fs.writeFileSync(
    path.join(root, ".uttori/project.json"),
    JSON.stringify({
      format: "uttori-source-project",
      version: 1,
      id: "test",
      target: "snes.sfc",
      romSha256,
      sourceRoots: ["source"],
      researchRoots: [".uttori/research"],
      buildConfig: "source/config.json",
      layout: ".uttori/layout.json",
      captures: ".uttori/captures.json",
    }),
  );
  const map = {
    format: "uttori-asm-snes-struct-map",
    schemaVersion: 1,
    constants: [{ name: "CONST", value: 0x1234, description: "Initial counter." }],
    structures: [
      { id: "Word", size: 2, fields: [{ name: "value", offset: 0, size: 2 }] },
      { id: "Unrelated", size: 2, fields: [{ name: "value", offset: 0, size: 2 }] },
    ],
    bindings: [
      { name: "Table", structure: "Word", address: 0xc00000, fileOffset: 0, count: 2 },
      { name: "Other", structure: "Word", address: 0xc00004, fileOffset: 4, count: 1 },
    ],
    instructionUses: [
      {
        address: 0xc0000a,
        expectedBytes: [0xa0, 2, 0],
        operand: "(Table[1].value & $FFFF)",
        reason: "Second row pointer.",
      },
    ],
  };
  const ram = {
    format: "uttori-asm-snes-ram-map",
    schemaVersion: 1,
    variables: [{ name: "RAM_X", address: "$7E0010", description: "Counter." }],
  };
  const structs = (value: unknown) =>
    renderSnesStructDefines({ ...validateSnesStructMap(value), sourceBytes: new Uint8Array() });
  const inputs = {
    "struct-map.json": JSON.stringify(map),
    "ram-map.json": JSON.stringify(ram),
    "structs.asm": structs(map),
    "ram-defines.asm": renderSnesRamDefines(validateSnesRamMap(ram)),
    "main.asm":
      'hirom\nincsrc "ram-defines.asm"\nincsrc "structs.asm"\norg $C00000\ndataStructs Table\n  [0] = {\n    ; Preserve comment and blank physical lines.\n\n    value = (CONST + CONST -\n      CONST)\n  }\n[1] = { value = $5678 }\nendDataStructs\ndataStructs Other\n[0] = {\n  value = $ABCD\n}\nendDataStructs\nLDA.l RAM_X\nLDY.w #(Table[1].value & $FFFF)\ndw Word.value\ndw Unrelated.value\n',
  };
  let buffers: RenameBuffer[] = Object.entries(inputs).map(([name, text]) => ({
    uri: pathToUri(path.join(root, "source", name)),
    text,
    version: 1,
  }));
  for (const [name, text] of Object.entries(inputs)) {
    fs.writeFileSync(path.join(root, "source", name), text);
  }
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  const reindex = () => {
    for (const buffer of buffers.filter((item) => item.uri.endsWith(".asm"))) {
      index.openDocument(new URL(buffer.uri).pathname, buffer.text);
    }
    index.reindex();
  };
  const content = (name: string) =>
    buffers.find((item) => item.uri === pathToUri(path.join(root, "source", name)))!.text;
  const environment = await createSnesAssemblerEnvironment();
  const assemble = () => {
    const fileProvider = new MemoryAssemblyFileProvider(
      Object.fromEntries(buffers.map((item) => [new URL(item.uri).pathname, item.text])),
    );
    const assembler = new Assembler({
      environment,
      target: "snes.sfc",
      architecture: "snes.65816",
      fileProvider,
      targetOptions: { checksumEnabled: false },
    });
    try {
      assembler.assembleProgram(
        assembler.buildProgramModel(content("main.asm"), path.join(root, "source/main.asm"), 0),
      );
      return assembler.getBinaryOutput();
    } finally {
      assembler.dispose();
    }
  };
  const originalBytes = assemble();
  t.deepEqual(
    originalBytes,
    Uint8Array.from([
      0x34, 0x12, 0x78, 0x56, 0xcd, 0xab, 0xaf, 0x10, 0, 0x7e, 0xa0, 2, 0, 0, 0, 0, 0,
    ]),
  );
  for (const [file, container, oldName, newName] of [
    ["ram-defines.asm", "", "RAM_X", "PlayerCounter"],
    ["structs.asm", "", "CONST", "START_COUNT"],
    ["structs.asm", "Word", "value", "payload"],
    ["structs.asm", "", "Word", "EntryRecord"],
  ]) {
    reindex();
    const symbol = index
      .getAllSymbols()
      .find(
        (item) =>
          item.location.file === path.join(root, "source", file) &&
          item.name === oldName &&
          (item.containerName ?? "") === container,
      )!;
    t.truthy(symbol);
    const line = content(file).split("\n")[symbol.location.line];
    const edit = await researchRenameEditsFor(
      index,
      symbol.location.file,
      { line: symbol.location.line, character: line.indexOf(oldName) + 1 },
      newName,
      buffers,
    );
    t.truthy(edit?.documentChanges);
    buffers = apply(edit!, buffers);
    t.deepEqual(assemble(), originalBytes, `Renaming ${oldName} must not change encoded bytes`);
  }
  const renamed = JSON.parse(content("struct-map.json"));
  t.is(renamed.structures[0].id, "EntryRecord");
  t.is(renamed.structures[0].fields[0].name, "payload");
  t.is(renamed.structures[1].fields[0].name, "value");
  t.true(renamed.bindings.every((item: { structure: string }) => item.structure === "EntryRecord"));
  t.is(renamed.instructionUses[0].operand, "(Table[1].payload & $FFFF)");
  // Re-render just the declarations as a later generation would; normal source edits still assemble.
  buffers = buffers.map((item) => {
    if (item.uri.endsWith("/structs.asm")) {
      return { ...item, text: structs(renamed) };
    }
    if (item.uri.endsWith("/ram-defines.asm")) {
      return {
        ...item,
        text: renderSnesRamDefines(validateSnesRamMap(JSON.parse(content("ram-map.json")))),
      };
    }
    return item;
  });
  t.deepEqual(assemble(), originalBytes);
  t.is(
    fs.readFileSync(path.join(root, "source/struct-map.json"), "utf8"),
    inputs["struct-map.json"],
  );
});

/** Apply only protocol text changes to in-memory buffers, as a client does before save. */
function apply(edit: WorkspaceEdit, before: readonly RenameBuffer[]): RenameBuffer[] {
  const buffers = new Map(before.map((buffer) => [buffer.uri, buffer]));
  for (const change of edit.documentChanges ?? []) {
    if (!TextDocumentEdit.is(change)) {
      continue;
    }
    const previous = buffers.get(change.textDocument.uri) ?? {
      uri: change.textDocument.uri,
      version: 0,
      text: "",
    };
    const document = TextDocument.create(
      previous.uri,
      "plaintext",
      previous.version,
      previous.text,
    );
    buffers.set(previous.uri, {
      ...previous,
      version: previous.version + 1,
      text: TextDocument.applyEdits(document, change.edits),
    });
  }
  return [...buffers.values()];
}

test("F2 changes source and persistent research in one versioned edit, including repeated unsaved renames", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-f2-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  await sourceGit(root, ["init", "-b", "main"]);
  fs.mkdirSync(path.join(root, ".uttori/research"), { recursive: true });
  fs.mkdirSync(path.join(root, "source"));
  const romSha256 = "a".repeat(64);
  fs.writeFileSync(
    path.join(root, ".uttori/project.json"),
    JSON.stringify({
      format: "uttori-source-project",
      version: 1,
      id: "test",
      target: "snes.sfc",
      romSha256,
      sourceRoots: ["source"],
      researchRoots: [".uttori/research"],
      buildConfig: "source/config.json",
      layout: ".uttori/layout.json",
      captures: ".uttori/captures.json",
    }),
  );
  writeResearchDocument(
    root,
    ".uttori/research/notes.json",
    { format: "uttori-research", version: 1, project: "test", romSha256, decisions: [] },
    null,
  );
  const layoutFile = path.join(root, ".uttori/layout.json");
  const layout = JSON.stringify({
    format: "uttori-snes-layout",
    version: 1,
    romSha256,
    extents: [{ id: "stable-object", startSymbol: "Fn_C00000", endSymbol: "End" }],
    objects: [{ id: "stable-object", startSymbol: "Fn_C00000", endSymbol: "End" }],
    freeSpace: [],
    references: [
      {
        id: "stable-reference",
        target: "stable-object",
        expression: '(Fn_C00000 & $FFFF) + sizeof(Fn_C00000.member) + "Fn_C00000"',
      },
    ],
  });
  fs.writeFileSync(layoutFile, layout);
  fs.writeFileSync(
    path.join(root, "source/source-symbols.json"),
    JSON.stringify({
      format: "uttori-source-symbols",
      version: 1,
      romSha256,
      symbols: [
        {
          id: "symbol:snes.cpu:c00000",
          name: "Fn_C00000",
          addressSpace: "snes.cpu",
          address: 0xc00000,
          evidence: ["capture-one"],
        },
      ],
    }),
  );
  const file = path.join(root, "source/main.asm");
  const text = "org $C00000\nFn_C00000:\nJSL Fn_C00000\n";
  fs.writeFileSync(file, text);
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(file, text);
  const position = { line: 1, character: 3 };
  t.truthy(prepareRenameFor(index, file, position));
  const initial: RenameBuffer[] = [
    { uri: pathToUri(file), version: 1, text },
    { uri: pathToUri(layoutFile), version: 4, text: layout },
  ];
  const first = await researchRenameEditsFor(index, file, position, "RandomByte", initial);
  t.is(first!.documentChanges!.length, 4);
  const buffers = apply(first!, initial);
  const source = buffers.find((buffer) => buffer.uri === pathToUri(file))!;
  t.is(source.text, "org $C00000\nRandomByte:\nJSL RandomByte\n");
  const research = buffers.find((buffer) => buffer.uri.endsWith("symbols.json"))!;
  t.true(research.text.includes('"Fn_C00000"'));
  t.false(fs.existsSync(path.join(root, ".uttori/research/symbols.json")));
  t.is(fs.readFileSync(file, "utf8"), text);
  index.updateDocument(file, source.text);
  index.reindex();
  const second = await researchRenameEditsFor(index, file, position, "NextRandom", buffers);
  t.is(second!.documentChanges!.length, 3);
  const next = apply(second!, buffers);
  const declaration = JSON.parse(next.find((buffer) => buffer.uri.endsWith("symbols.json"))!.text)
    .decisions[0].value;
  t.is(declaration.id, "symbol:snes.cpu:c00000");
  t.deepEqual(declaration.aliases, ["Fn_C00000", "RandomByte"]);
  t.is(declaration.sourceName, "NextRandom");
  t.false(declaration.analysisEntryPoint);
  const renamedLayout = JSON.parse(
    next.find((buffer) => buffer.uri === pathToUri(layoutFile))!.text,
  );
  t.is(renamedLayout.objects[0].id, "stable-object");
  t.is(renamedLayout.objects[0].startSymbol, "NextRandom");
  t.is(renamedLayout.extents[0].startSymbol, "NextRandom");
  t.is(
    renamedLayout.references[0].expression,
    '(NextRandom & $FFFF) + sizeof(NextRandom.member) + "Fn_C00000"',
  );
  t.is(fs.readFileSync(layoutFile, "utf8"), layout);
});

test("ordinary source uses normal text rename without a project database", (t) => {
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  const file = path.join(os.tmpdir(), "uttori-ordinary.asm");
  index.openDocument(file, "org $C00000\nEntry:\nJSL Entry\n");
  t.is(
    Object.values(renameEditsFor(index, file, { line: 1, character: 2 }, "Start")!.changes!)[0]!
      .length,
    2,
  );
});

test("F2 on an addressed table updates source, placement and generation recipe without moving original bindings", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-table-f2-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  await sourceGit(root, ["init", "-b", "main"]);
  fs.mkdirSync(path.join(root, ".uttori/research"), { recursive: true });
  fs.mkdirSync(path.join(root, "source"));
  const romSha256 = "a".repeat(64);
  fs.writeFileSync(
    path.join(root, ".uttori/project.json"),
    JSON.stringify({
      format: "uttori-source-project",
      version: 1,
      id: "test",
      target: "snes.sfc",
      romSha256,
      sourceRoots: ["source"],
      researchRoots: [".uttori/research"],
      buildConfig: "source/config.json",
      layout: ".uttori/layout.json",
      captures: ".uttori/captures.json",
    }),
  );
  const layoutFile = path.join(root, ".uttori/layout.json");
  fs.writeFileSync(
    layoutFile,
    JSON.stringify({
      format: "uttori-snes-layout",
      version: 1,
      romSha256,
      objects: [
        { id: "table", startSymbol: "Table", endSymbol: "TableEnd", start: 0x100, length: 2 },
      ],
      extents: [{ id: "table", startSymbol: "Table", endSymbol: "TableEnd", size: 2 }],
      references: [{ id: "call", target: "table", expression: "(Table & $FFFF)" }],
    }),
  );
  const recipeFile = path.join(root, "source/struct-map.json");
  const recipe = JSON.stringify({
    format: "uttori-asm-snes-struct-map",
    schemaVersion: 1,
    structures: [{ id: "Word", size: 2, fields: [{ name: "value", offset: 0, size: 2 }] }],
    bindings: [{ name: "Table", structure: "Word", address: 0xc00020, fileOffset: 0x20, count: 1 }],
    instructionUses: [
      {
        address: 0xc00000,
        expectedBytes: [0xa0, 0x20, 0],
        operand: "Table.value & $FFFF",
        reason: "Original table offset.",
      },
    ],
  });
  fs.writeFileSync(recipeFile, recipe);
  const file = path.join(root, "source/main.asm");
  const text =
    "struct Table $C00100\n.value: dw\nendstruct count 1 firstindex 0\norg $C00100\ndataStructs Table\n[0] = { value = $1234 }\nendDataStructs\nTableEnd:\nJSR ((Table & $FFFF),x)\nLDA [Table],y\n";
  fs.writeFileSync(file, text);
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(file, text);
  const before: RenameBuffer[] = [
    { uri: pathToUri(file), version: 1, text },
    { uri: pathToUri(recipeFile), version: 2, text: recipe },
  ];
  const edit = await researchRenameEditsFor(
    index,
    file,
    { line: 0, character: 8 },
    "Handlers",
    before,
  );
  const buffers = apply(edit!, before);
  const changed = JSON.parse(buffers.find((buffer) => buffer.uri === pathToUri(recipeFile))!.text);
  t.deepEqual(changed.bindings[0], {
    name: "Handlers",
    structure: "Word",
    address: 0xc00020,
    fileOffset: 0x20,
    count: 1,
  });
  t.is(changed.instructionUses[0].operand, "Handlers.value & $FFFF");
  const placement = JSON.parse(
    buffers.find((buffer) => buffer.uri === pathToUri(layoutFile))!.text,
  );
  t.is(placement.objects[0].startSymbol, "Handlers");
  t.is(placement.objects[0].start, 0x100);
  t.is(placement.references[0].expression, "(Handlers & $FFFF)");
  t.true(
    buffers.find((buffer) => buffer.uri === pathToUri(file))!.text.includes("dataStructs Handlers"),
  );
  t.is(fs.readFileSync(recipeFile, "utf8"), recipe);
  t.true(
    buffers
      .find((buffer) => buffer.uri === pathToUri(file))!
      .text.includes("JSR ((Handlers & $FFFF),x)"),
  );
  t.true(
    buffers.find((buffer) => buffer.uri === pathToUri(file))!.text.includes("LDA [Handlers],y"),
  );
});
