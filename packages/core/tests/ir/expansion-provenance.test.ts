import sinon from "sinon";

import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import type { AssemblerTraceWriteEvent } from "../../src/debug-tracing.js";
import { MemoryAssemblyFileProvider } from "../../src/file-provider.js";
import { createMacroLineTemplate, parseMacroArguments } from "../../src/ir/macro-template.js";
import { createNormalizedCommand } from "../../src/ir/normalized-command.js";
import { sourceOriginLocations, sourceOccurrenceRange } from "../../src/source-provenance.js";

test("source occurrence ranges relocate normalized columns without guessing stale or repeated text", (t) => {
  const location = { file: "main.asm", line: 2, text: "%Emit(7)", span: { start: 6, end: 7 } };
  t.deepEqual(sourceOccurrenceRange(location, "  %Emit(7)"), {
    start: { line: 2, character: 8 },
    end: { line: 2, character: 9 },
  });
  t.is(sourceOccurrenceRange(location, "%Emit(7) : %Emit(7)"), undefined);
  t.is(sourceOccurrenceRange(location, "%Emit(8)"), undefined);
  t.is(sourceOccurrenceRange(location), undefined);
});

test("macro templates retain placeholder ranges and rebind cascaded substitutions in phase order", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const text = "db <value>, <other>, <...[0]>, sizeof(...)";
  const template = createMacroLineTemplate(
    createNormalizedCommand(text, text, ["db", text.slice(3)], "defs.asm", 2),
  );
  const snapshot = JSON.stringify(template);
  for (const kind of Object.values(template.placeholders)) {
    for (const part of kind) {
      t.is(text.slice(part.start, part.end), part.text);
    }
  }
  const args = new Map([
    ["value", "<other>"],
    ["other", "!current"],
  ]);
  assembler.defines.set("current", "3");
  // A named replacement is not revisited by its own phase, but a later variadic phase sees new text.
  t.is(
    assembler.macroEngine.expandMacroLine(text, args, ["7"], 1, template),
    "db <other>, 3, 7, 1",
  );
  args.set("value", "<...[0]>");
  assembler.defines.set("current", "4");
  t.is(assembler.macroEngine.expandMacroLine(text, args, ["8"], 1, template), "db 8, 4, 8, 1");
  t.is(JSON.stringify(template), snapshot);
});

test("macro argument decoding preserves quoted spelling, escaped separators and empty middle slots", (t) => {
  const raw = ' "a,b",, "a""b", c\\,d, ""';
  const args = parseMacroArguments(raw);
  t.deepEqual(
    args.map((argument) => argument.value),
    ["a,b", "", 'a"b', "c,d", ""],
  );
  for (const argument of args) {
    t.is(raw.slice(argument.start, argument.end), argument.text);
  }
  t.deepEqual(parseMacroArguments('""'), []);
});

test("literal macro commands reuse captured semantics and keep body occurrences immutable", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const consumed = sinon.spy(assembler.programModelBuilder, "consumeIncrementalCommand");
  assembler.assembleSource(
    "lorom\norg $808000\nmacro Emit()\ndb 7\nendmacro\n%Emit()\n%Emit()",
    "main.asm",
  );
  const body = assembler.macros.get("Emit")!.body[0];
  const expanded = consumed
    .getCalls()
    .map((call) => call.args[4])
    .filter((command) => command?.command === "db 7");
  t.true(expanded.length >= 2);
  for (const command of expanded) {
    t.is(command!.parsed, body.parsed);
    t.not(command, body);
    t.is(command!.source.origin?.kind, "macro");
  }
  t.is(body.source.origin, undefined);
  t.deepEqual([...assembler.getBinaryOutput()], [7, 7]);
});

test("nested macro and include origins distinguish invocations of the same cached body", (t) => {
  const fileProvider = new MemoryAssemblyFileProvider({
    "/game/defs.asm":
      "macro Inner(value)\ndb <value>\nendmacro\nmacro Outer(value)\n%Inner(<value>)\nincsrc payload.asm\nendmacro",
    "/game/payload.asm": "db 9",
  });
  const assembler = new Assembler(undefined, { fileProvider });
  t.teardown(() => assembler.dispose());
  const writes: AssemblerTraceWriteEvent[] = [];
  assembler.setTraceListener((event) => {
    if (event.type === "write" && event.stage === "emitProgram") {
      writes.push(event);
    }
  });
  assembler.assembleSource(
    "lorom\norg $808000\nincsrc defs.asm\n%Outer($07)\n%Outer($08)",
    "/game/main.asm",
  );
  t.deepEqual([...assembler.getBinaryOutput()], [7, 9, 8, 9]);
  const inner = writes[0].origin;
  t.is(inner?.kind, "macro");
  if (inner?.kind !== "macro" || inner.parent?.kind !== "macro") {
    return;
  }
  t.is(inner.name, "Inner");
  t.is(inner.template.line, 1);
  t.is(inner.invocation.line, 4);
  t.is(inner.parent.invocation.line, 3);
  t.is(inner.parent.arguments[0].text, "$07");
  t.deepEqual(inner.parent.arguments[0].location.span, { start: 7, end: 10, line: 3 });
  t.is(inner.definitionContext?.kind, "include");
  t.is(writes[1].origin?.kind, "include");
  t.true(
    sourceOriginLocations(inner).some(
      ({ location }) => location.file === "/game/main.asm" && location.line === 2,
    ),
  );
  t.not(writes[0].origin, writes[2].origin);
  t.is(
    writes[2].origin?.parent?.kind === "macro" ? writes[2].origin.parent.invocation.line : -1,
    4,
  );
  t.notThrows(() => JSON.stringify(writes));
});

test("ordered macro defines, inactive variadics and loop argument rebinding retain bytes", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.assembleSource(
    `lorom
org $808000
macro Emit(...)
!count = 0
if 0
db <...[999]>
endif
!i = 0
while !i < sizeof(...)
db <...[!i]>
!count #= !count+1
!i #= !i+1
endwhile
db !count
endmacro
%Emit($11,$22,$33)
%Emit($44)
`,
    "loops.asm",
  );
  t.deepEqual([...assembler.getBinaryOutput()], [0x11, 0x22, 0x33, 3, 0x44, 1]);
});

test("expansion errors retain the deepest template and invocation chain after unwinding", (t) => {
  const assembler = new Assembler(undefined, {
    fileProvider: new MemoryAssemblyFileProvider({
      "/game/defs.asm": "macro Bad(value)\ndb <value>\nendmacro",
    }),
  });
  t.teardown(() => assembler.dispose());
  const result = assembler.analyzeSource(
    "lorom\norg $808000\nincsrc defs.asm\n%Bad(Missing)\ndb 1",
    "/game/main.asm",
    0,
    { stages: ["collectDefinitions", "resolveLayout", "emitProgram"] },
  );
  const diagnostic = result.diagnostics.find((entry) => entry.message.includes("Missing"));
  t.truthy(diagnostic);
  t.is(diagnostic?.location.file, "/game/defs.asm");
  t.is(diagnostic?.location.line, 1);
  t.true(
    sourceOriginLocations(diagnostic?.location.origin).some(
      ({ location }) => location.file === "/game/main.asm" && location.line === 3,
    ),
  );
  assembler.assembleSource("lorom\norg $808000\ndb 2", "/game/clean.asm");
  t.deepEqual([...assembler.getBinaryOutput()], [2]);
  t.false(assembler.symbolReferences.some((reference) => reference.location.origin !== undefined));
});
