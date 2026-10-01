import test from "ava";

import { paletteView, paletteWordEdit } from "../../src/assets/palette-model.js";

const source =
  '{\n "version": 1, "unknown": {"keep": "verbatim"}, "palettes": {"C81000": {"romAddress":"C81000", "firstIndex":1, "words":["8000", "8000", "7FFF"], "name":"A < B", "extra":true}}\n}\n';

test("palette token edits retain duplicate slots, bit 15, formatting and unknown fields", (t) => {
  const edit = paletteWordEdit(source, "C81000", 2, "fc00");
  const after = source.slice(0, edit.offset) + edit.text + source.slice(edit.offset + edit.length);
  t.is(after, source.replace('"8000", "8000"', '"8000", "FC00"'));
  t.deepEqual(paletteView(after), [
    { id: "C81000", name: "A < B", firstIndex: 1, words: ["8000", "FC00", "7FFF"] },
  ]);
});

test("palette editor rejects ambiguous JSON, invalid slots and coercive color inputs", (t) => {
  t.throws(() => paletteView(source.replace('"version": 1', '"version": 0, "version": 1')), {
    message: /Duplicate/,
  });
  t.throws(() => paletteView(source.replace('"version": 1', '"version": 1,')), {
    message: /Repair/,
  });
  for (const [id, index, word] of [
    ["C81000", 0, "0000"],
    ["C81000", 4, "0000"],
    ["C81000", 1.5, "0000"],
    ["__proto__", 1, "0000"],
    ["C81000", 1, "0x00"],
    ["C81000", 1, "00000"],
  ] as const) {
    t.throws(() => paletteWordEdit(source, id, index, word), { message: /Select/ });
  }
});
