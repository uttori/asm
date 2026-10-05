import { test } from "../../../tests/ava-helper.js";
import { Assembler } from "../../../tests/test-assembler.js";
import { planTypedSourceEdits } from "../src/source-field-edits.js";

/** Use real encoder metadata to cover multiline offsets and repeated identical literal spellings. */
function fixture(expression = "$6C") {
  const file = "records.asm";
  const source = `lorom\norg $808000\nstruct Record $808000\n  .offsets: db[4]\n  .tail: dw\nendstruct\ndataStruct Record, {\n  offsets = [$F8, ${expression}, $F8, $6C], ; retained ☃ comment\n  tail = $1234\n}\n`;
  const assembler = new Assembler(undefined, { collectSourceMetadata: true });
  const program = assembler.buildProgramModel(source, file);
  for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
    assembler.runStage(stage, program);
  }
  return {
    mapping: assembler.addressToLineMapping,
    snapshots: new Map([[file, new TextEncoder().encode(source)]]),
    output: Uint8Array.from(assembler.getBinaryOutput()),
    source,
  };
}

test("typed source write-back changes only attributed literals and preserves comments and formatting", (t) => {
  const input = fixture();
  const patches = [
    { offset: 1, before: Uint8Array.of(0x6c), after: Uint8Array.of(0x6d) },
    { offset: 4, before: Uint8Array.of(0x34, 0x12), after: Uint8Array.of(0x78, 0x56) },
  ];
  const edits = planTypedSourceEdits({ ...input, patches });
  t.is(edits.length, 1);
  t.is(
    new TextDecoder().decode(edits[0].after),
    input.source.replace("$F8, $6C,", "$F8, $6D,").replace("$1234", "$5678"),
  );
  t.deepEqual(edits[0].before, input.snapshots.get("records.asm"));
  t.deepEqual(
    planTypedSourceEdits({ ...input, patches: [{ ...patches[0], after: patches[0].before }] }),
    [],
  );
});

test("typed source edits reject expressions, ambiguous emission, stale bytes and duplicate patches", (t) => {
  const patch = { offset: 1, before: Uint8Array.of(0x6c), after: Uint8Array.of(0x6d) };
  t.throws(() => planTypedSourceEdits({ ...fixture("$60 + $0C"), patches: [patch] }), {
    message: /literal scalar/,
  });
  const input = fixture();
  t.throws(
    () => planTypedSourceEdits({ ...input, patches: [{ ...patch, before: Uint8Array.of(0) }] }),
    { message: /stale/ },
  );
  t.throws(() => planTypedSourceEdits({ ...input, patches: [patch, patch] }), {
    message: /Duplicate/,
  });
  t.throws(() => planTypedSourceEdits({ ...input, patches: [{ ...patch, offset: 99 }] }), {
    message: /extent/,
  });
  input.mapping.structFields.push({ ...input.mapping.structFields[1], outputOffset: 22 });
  t.throws(() => planTypedSourceEdits({ ...input, patches: [patch] }), {
    message: /repeated source emission/,
  });
});
