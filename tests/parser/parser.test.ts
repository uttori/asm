import { test } from "../ava-helper.js";

import { parseTokenizedCommands } from "../../src/parser/parser.js";
import { tokenizeSource } from "../../src/parser/tokenizer.js";

test("parseTokenizedCommands parses labels with explicit label form", (t) => {
  const [parsed] = parseTokenizedCommands(tokenizeSource("MainLabel:"));

  t.is(parsed.kind, "label");
  if (parsed.kind === "label") {
    t.is(parsed.labelKind, "declaration");
    t.is(parsed.labelName, "MainLabel");
  }
});

test("parseTokenizedCommands parses data directives with argument list", (t) => {
  const [parsed] = parseTokenizedCommands(tokenizeSource("db $01, $02, \"ABC\""));

  t.is(parsed.kind, "directive");
  if (parsed.kind === "directive") {
    t.is(parsed.directive, "db");
    t.deepEqual(parsed.arguments, ["$01", "$02", "\"ABC\""]);
    t.is(parsed.argumentsRaw, "$01, $02, \"ABC\"");
  }
});

test("parseTokenizedCommands parses instruction operands and immediates", (t) => {
  const [parsed] = parseTokenizedCommands(tokenizeSource("lda #$10"));

  t.is(parsed.kind, "instruction");
  if (parsed.kind === "instruction") {
    t.is(parsed.mnemonic, "lda");
    t.is(parsed.operand, "#$10");
    t.true(parsed.isImmediate);
    t.deepEqual(parsed.operands, ["#$10"]);
  }
});
