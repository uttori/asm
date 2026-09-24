import { test } from "../../../tests/ava-helper.js";
import { parseAssetCall } from "../src/ir/asset-call.js";
import { createNormalizedCommand } from "../src/ir/normalized-command.js";
import {
  removeInlineComment,
  splitCommandIntoWords,
  splitInlineCommands,
} from "../src/services/command-text-service.js";

test("includeAsset keeps typed nested values, escaped strings, and source spans", (t) => {
  const source =
    'includeAsset("art/a, b.png", "4bpp", layout: { tileOrder: "row-major", blockSize: [2, 2] }, priority: true, maxSize: $20 + 4)';
  const call = parseAssetCall(source, 7);
  t.is(call?.path.value, "art/a, b.png");
  t.is(call?.format.value, "4bpp");
  t.deepEqual(call?.options.layout.kind, "object");
  t.is(call?.options.maxSize.kind, "number");
  t.is(call?.options.maxSize.span.line, 7);
  t.is(source.slice(call!.path.span.start, call!.path.span.end), '"art/a, b.png"');
  t.deepEqual(splitCommandIntoWords(source).slice(0, 1), ["includeasset"]);
  const normalized = createNormalizedCommand(
    source,
    source,
    splitCommandIntoWords(source),
    "main.asm",
    7,
  );
  t.is(normalized.parsed.includeAsset?.options.maxSize.span.line, 7);
});

test("includeAsset preserves object colons, same-line labels, and comments", (t) => {
  const source =
    'Title: includeAsset("art/a : b.png", "4bpp", layout: { tileOrder: "row-major" }) : db $42 ; comment';
  const uncommented = removeInlineComment(source);
  const split = splitInlineCommands([uncommented]);
  t.is(split.length, 2);
  t.deepEqual(splitCommandIntoWords(split[0]).slice(0, 2), ["Title:", "includeasset"]);
  const call = parseAssetCall(split[0], 3);
  t.is(call?.path.span.start, split[0].indexOf('"art/a : b.png"'));
  t.is(call?.span.line, 3);
  t.is(split[1], "db $42");
});

test("includeAsset rejects malformed calls and duplicate or misplaced arguments", (t) => {
  for (const source of [
    'includeAsset("a.png", "4bpp", palette: "auto", palette: "embedded")',
    'includeAsset("a.png", "4bpp", output: "tiles", "extra")',
    'includeAsset("a.png", "4bpp", layout: { x: 1, x: 2 })',
    'includeAsset("a.png", "4bpp", layout: [1, 2)',
    'includeAsset("a.png", 4)',
  ]) {
    t.throws(() => parseAssetCall(source));
  }
});
