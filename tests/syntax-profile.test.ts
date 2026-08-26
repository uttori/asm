import { test } from "./ava-helper.js";

import {
  preprocessBlockCommands,
  removeInlineComment,
  splitInlineCommands,
} from "../packages/core/src/services/command-text-service.js";
import { findDirectiveInCatalog } from "../packages/core/src/lsp/catalog.js";
import { directiveCatalog } from "../packages/core/src/lsp/directive-catalog.js";
import {
  ASAR_SYNTAX_PROFILE,
  CA65_SYNTAX_PROFILE,
  NATIVE_SYNTAX_PROFILE,
} from "../packages/core/src/syntax-profile.js";

test("Asar syntax profile preserves legacy trimming and statement chains", (t) => {
  const processed = preprocessBlockCommands(
    "  lda #$01 : sta $00 ; comment",
    "",
    ASAR_SYNTAX_PROFILE,
  );

  t.deepEqual(splitInlineCommands(processed.commands, ASAR_SYNTAX_PROFILE), [
    "lda #$01",
    "sta $00",
  ]);
});

test("native syntax profile preserves columns and leaves colon chains intact", (t) => {
  const processed = preprocessBlockCommands(
    "  lda #$01 : sta $00 ; comment",
    "",
    NATIVE_SYNTAX_PROFILE,
  );

  t.deepEqual(processed.commands, ["  lda #$01 : sta $00"]);
  t.deepEqual(splitInlineCommands(processed.commands, NATIVE_SYNTAX_PROFILE), [
    "  lda #$01 : sta $00",
  ]);
  t.is(removeInlineComment("  label: nop ; comment", NATIVE_SYNTAX_PROFILE), "  label: nop");
});

test("ca65 syntax reserves leading dots for directive dispatch", (t) => {
  t.false(CA65_SYNTAX_PROFILE.leadingDotLabels);
  t.deepEqual(CA65_SYNTAX_PROFILE.directivePrefixes, ["."]);
  t.is(CA65_SYNTAX_PROFILE.cheapLocalPrefix, "@");
  t.true(CA65_SYNTAX_PROFILE.fileLocalSymbols);
  t.true(ASAR_SYNTAX_PROFILE.leadingDotLabels);
  t.is(ASAR_SYNTAX_PROFILE.cheapLocalPrefix, "");
  t.false(ASAR_SYNTAX_PROFILE.fileLocalSymbols);
});

test("directive tooling applies only active syntax-profile prefixes", (t) => {
  t.is(findDirectiveInCatalog("@org", directiveCatalog, []), undefined);
  t.is(findDirectiveInCatalog("@org", directiveCatalog, ["@"])?.keyword, "org");
});
