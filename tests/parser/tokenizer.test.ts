import ava, { type TestFn } from "ava";

import { tokenizeSource } from "../../src/parser/tokenizer.js";
const test = ava as unknown as TestFn;

test("tokenizeSource strips inline comments but preserves ;`+ directives", (t) => {
  const source = [
    "lda #$10 ; comment",
    ";`+ important directive",
  ].join("\n");

  const tokenized = tokenizeSource(source);
  t.is(tokenized.length, 2);
  t.is(tokenized[0].raw, "lda #$10");
  t.is(tokenized[1].raw, ";`+ important directive");
});

test("tokenizeSource supports command continuation and command chain split", (t) => {
  const source = [
    "db $01,\\",
    "$02 : db $03",
  ].join("\n");

  const tokenized = tokenizeSource(source);
  t.is(tokenized.length, 2);
  t.is(tokenized[0].raw, "db $01,$02");
  t.is(tokenized[1].raw, "db $03");
});

test("tokenizeSource keeps quoted sections while splitting words", (t) => {
  const source = "db \"hello world\", $20";
  const tokenized = tokenizeSource(source);

  t.is(tokenized.length, 1);
  t.deepEqual(tokenized[0].words.map((word) => word.value), ["db", "\"hello world\",", "$20"]);
});
