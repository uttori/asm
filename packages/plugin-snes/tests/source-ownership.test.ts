import fs from "node:fs";
import path from "node:path";

import {
  findManagedSourceFile,
  loadSourceOwnership,
  sourceOwnersAt,
  validateSourceExportFiles,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { ownershipFixture } from "../../../tests/helpers/ownership-fixture.js";
import { verifySnesProjectRoundTrip } from "../src/disassembler/project-initializer.js";

test("ownership resolves mirrored data-only labels and wrapped comments before any build", async (t) => {
  const fixture = ownershipFixture();
  t.teardown(fixture.cleanup);
  const managed = findManagedSourceFile(fixture.file)!;
  const map = loadSourceOwnership(managed)!;
  const owners = sourceOwnersAt(map, managed.relative, fixture.text, fixture.line, 0);
  t.is(owners[0].id, "imported.candy");
  t.is(owners[0].address, 0x400020);
  t.is(owners[0].emittedAddress, 0xc00020);
  t.is(owners[0].outputStart, 0x20);
  t.true(owners[0].startLine < fixture.line);
  t.is(
    sourceOwnersAt(map, managed.relative, fixture.text, fixture.line - 1, 5)[0].id,
    "imported.candy",
  );
  t.is(
    sourceOwnersAt(map, "reference.asm", "  LDA L_Item_Price_Candy", 1, 10)[0].id,
    "imported.candy",
  );
  t.false(fixture.text.includes("\0"));
  t.true(map.entries.some((entry) => entry.kind === "comment" && entry.id === "note"));
  validateSourceExportFiles(fixture.sourceDirectory);
  t.true(
    (
      await verifySnesProjectRoundTrip({
        sourceDirectory: fixture.sourceDirectory,
        romFile: fixture.romFile,
        emitDebugMap: false,
      })
    ).comparison.equal,
  );
});

test("typed fields and declarations route to their map without guessing an instruction", (t) => {
  const fixture = ownershipFixture();
  t.teardown(fixture.cleanup);
  const managed = findManagedSourceFile(fixture.file)!;
  const map = loadSourceOwnership(managed)!;
  const fieldLine = fixture.text.split("\n").findIndex((line) => /value =/.test(line)) + 1;
  const field = sourceOwnersAt(map, managed.relative, fixture.text, fieldLine, 5)[0];
  t.is(field.kind, "field");
  t.is(field.id, "PriceLayout.value");
  t.is(field.outputStart, 0x40);
  t.is(field.inputPath, "struct-map.json");
  const defs = fs.readFileSync(path.join(fixture.sourceDirectory, "structs.asm"), "utf8");
  const line = defs.split("\n").findIndex((value) => value.includes(".value:")) + 1;
  t.is(sourceOwnersAt(map, "structs.asm", defs, line, 3)[0].kind, "field");
  t.true(map.entries.some((entry) => entry.kind === "constant" && entry.symbol === "FixtureLimit"));
  t.true(map.entries.some((entry) => entry.kind === "hardware"));
});

test("tampered sidecars fail closed and unlisted source remains user-owned", (t) => {
  const fixture = ownershipFixture();
  t.teardown(fixture.cleanup);
  const managed = findManagedSourceFile(fixture.file)!;
  fs.writeFileSync(path.join(fixture.sourceDirectory, fixture.manifest.ownershipFile!), "{}");
  t.throws(() => loadSourceOwnership(managed), { message: /ownership metadata changed/ });
  t.is(findManagedSourceFile(path.join(fixture.sourceDirectory, "patch.asm")), undefined);
});
