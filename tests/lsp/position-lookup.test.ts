import { test } from "../ava-helper.js";
import type { AssemblySymbolDefinition, AssemblySymbolReference } from "../../src/diagnostics.js";
import {
  findReferences,
  locationRange,
  positionInRange,
  referenceAt,
  resolveDefinition,
  symbolAt,
} from "../../src/lsp/position-lookup.js";

const range = (startLine: number, startCharacter: number, endLine: number, endCharacter: number) => ({
  start: { line: startLine, character: startCharacter },
  end: { line: endLine, character: endCharacter },
});

const symbol = (
  name: string,
  kind: AssemblySymbolDefinition["kind"],
  containerName?: string,
): AssemblySymbolDefinition => ({
  name,
  kind,
  containerName,
  location: { file: "/project/definitions.asm", line: 1, range: range(1, 0, 1, name.length) },
});

const reference = (
  name: string,
  kind: AssemblySymbolReference["kind"],
  containerName?: string,
): AssemblySymbolReference => ({
  name,
  kind,
  containerName,
  location: { file: "/project/main.asm", line: 2, range: range(2, 1, 2, name.length + 1) },
});

test("locationRange prefers explicit ranges and derives span ranges", t => {
  const explicit = range(3, 2, 3, 8);
  t.is(locationRange({ line: 3, range: explicit }), explicit);
  t.deepEqual(
    locationRange({ line: 7, span: { start: 4, end: 9 } }),
    range(7, 4, 7, 9),
  );
  t.deepEqual(
    locationRange({ line: 7, span: { start: 4, end: 9, line: 5, columnStart: 1, columnEnd: 6 } }),
    range(5, 1, 5, 6),
  );
  t.is(locationRange({ line: 0 }), undefined);
});

test("positionInRange covers multiline boundaries", t => {
  const multiline = range(2, 3, 4, 6);
  t.false(positionInRange({ line: 1, character: 99 }, multiline));
  t.false(positionInRange({ line: 5, character: 0 }, multiline));
  t.false(positionInRange({ line: 2, character: 2 }, multiline));
  t.false(positionInRange({ line: 4, character: 7 }, multiline));
  t.true(positionInRange({ line: 2, character: 3 }, multiline));
  t.true(positionInRange({ line: 3, character: 0 }, multiline));
  t.true(positionInRange({ line: 4, character: 6 }, multiline));
});

test("position lookup chooses the narrowest located artifact", t => {
  const wide = reference("wide", "unknown");
  wide.location.range = range(1, 0, 3, 10);
  const narrow = reference("narrow", "label");
  narrow.location.range = range(2, 2, 2, 8);
  const missing = reference("missing", "label");
  delete missing.location.range;

  t.is(referenceAt([wide, missing, narrow], { line: 2, character: 4 }), narrow);
  t.is(referenceAt([wide], { line: 9, character: 0 }), undefined);

  const wideSymbol = symbol("wide", "label");
  wideSymbol.location.range = range(1, 0, 3, 10);
  const narrowSymbol = symbol("narrow", "label");
  narrowSymbol.location.range = range(2, 2, 2, 8);
  t.is(symbolAt([wideSymbol, narrowSymbol], { line: 2, character: 4 }), narrowSymbol);
});

test("resolveDefinition matches compatible kinds and container scope", t => {
  const label = symbol("target", "label");
  const member = symbol("target", "structMember", "Player");
  const struct = symbol("target", "struct");
  const define = symbol("target", "define");
  const macro = symbol("target", "macro");
  const fn = symbol("target", "function");
  const all = [label, member, struct, define, macro, fn];

  t.deepEqual(resolveDefinition(reference("absent", "label"), all), []);
  t.deepEqual(resolveDefinition(reference("target", "label", "Player"), all), [member]);
  t.deepEqual(resolveDefinition(reference("target", "define"), all), [define]);
  t.deepEqual(resolveDefinition(reference("target", "macro"), all), [macro]);
  t.deepEqual(resolveDefinition(reference("target", "function"), all), [macro, fn]);
  t.deepEqual(resolveDefinition(reference("target", "include"), all), all);
  t.deepEqual(resolveDefinition(reference("target", "instruction"), all), all);
  t.deepEqual(resolveDefinition(reference("target", "unknown"), all), all);
  t.deepEqual(resolveDefinition(reference("target", "label", "Other"), all), [label, member, struct]);
});

test("findReferences optionally restricts container scope", t => {
  const global = reference("target", "label");
  const player = reference("target", "label", "Player");
  const enemy = reference("target", "label", "Enemy");
  const other = reference("other", "label", "Player");

  t.deepEqual(findReferences("target", [global, player, enemy, other]), [global, player, enemy]);
  t.deepEqual(findReferences("target", [global, player, enemy, other], "Player"), [player]);
});
