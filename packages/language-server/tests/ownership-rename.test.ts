import fs from "node:fs";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import { ownershipFixture } from "../../../tests/helpers/ownership-fixture.js";
import { snesWorkspaceIndexOptions } from "../../../tests/test-assembler.js";
import { WorkspaceIndex } from "../../core/src/lsp/workspace-index.js";
import { prepareRenameFor, renameEditsFor } from "../src/providers.js";

test("both LSP rename paths protect managed definitions and references reached from owned source", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(f.file, f.text);
  const position = { line: f.line - 1, character: 2 };
  t.throws(() => prepareRenameFor(index, f.file, position), {
    message: /Inspect Disassembly Ownership/,
  });
  t.throws(() => renameEditsFor(index, f.file, position, "Candy"), { message: /Text-only Rename/ });
  const patch = path.join(f.sourceDirectory, "patch.asm");
  index.openDocument(patch, "org $C00000\nLDA L_Item_Price_Candy\n");
  t.throws(() => renameEditsFor(index, patch, { line: 1, character: 10 }, "Candy"), {
    message: /generated disassembly/,
  });
  t.is(fs.readFileSync(f.file, "utf8"), f.text);
});

test("ordinary files inside an export retain normal text rename", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const file = path.join(f.sourceDirectory, "user.asm");
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  index.openDocument(file, "org $C00000\nOwned:\nLDA Owned\n");
  t.truthy(prepareRenameFor(index, file, { line: 1, character: 2 }));
  t.is(
    Object.values(renameEditsFor(index, file, { line: 1, character: 2 }, "NewOwned")!.changes!)[0]
      .length,
    2,
  );
});
