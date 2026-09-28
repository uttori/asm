import { test } from "../../../tests/ava-helper.js";
import { Assembler } from "../../../tests/test-assembler.js";
import {
  formatStructDeclaration,
  omitAssemblyResearchReferences,
  wrapAssemblyComments,
} from "../src/disassembler/source-layout.js";

test("research citations disappear from comments without rewriting quoted source data", (t) => {
  const source = [
    "; Research: research/captures/scene.md.",
    "; Copy four words. research/captures/scene.md",
    "; Compare whole bytes ([review](../research/captures/scene.md)).",
    "; Two-byte read. Recomputed in research/captures/scene.md. Preserve the boundary.",
    "; Pointer. get-spear: research/captures/scene.md; ACT2 evidence.",
    "  LDA #$20 ; research/captures/scene.md",
    '  db "text; research/captures/scene.md" ; Useful text.',
  ].join("\n");
  const cleaned = omitAssemblyResearchReferences(source);
  t.is(
    cleaned,
    [
      "; Copy four words.",
      "; Compare whole bytes.",
      "; Two-byte read. Preserve the boundary.",
      "; Pointer. ACT2 evidence.",
      "  LDA #$20",
      '  db "text; research/captures/scene.md" ; Useful text.',
    ].join("\n"),
  );
  t.is(omitAssemblyResearchReferences(cleaned), cleaned);
});

test("field descriptions precede separate assignments and preserve assembled data", (t) => {
  const lines = formatStructDeclaration(
    "dataStruct Record, ",
    [
      { assignment: "flag = $EA", description: "Opcode; kept with its field." },
      { assignment: "bytes = [$01, $02, $03]", description: "Following bytes." },
    ],
    100,
  );
  t.deepEqual(lines, [
    "dataStruct Record, {",
    "  ; Opcode; kept with its field.",
    "  flag = $EA,",
    "  ; Following bytes.",
    "  bytes = [$01, $02, $03]",
    "}",
  ]);
  const assembler = new Assembler();
  try {
    assembler.assembleSource(
      [
        "lorom",
        "org $808000",
        "struct Record $808000",
        ".flag: db",
        ".bytes: db[3]",
        "endstruct",
        ...lines,
      ].join("\n"),
      "fields.asm",
    );
    t.deepEqual(assembler.getBinaryOutput(), Uint8Array.from([0xea, 1, 2, 3]));
  } finally {
    assembler.dispose();
  }
});

test("comment wrapping preserves quotes, paragraphs, indentation and long tokens", (t) => {
  const input =
    '  db "a; b" ; A long explanation with enough words to wrap across several lines.\n;\n; https://example.test/an-indivisible-long-token\n';
  const output = wrapAssemblyComments(input, 32);
  t.true(output.includes('  db "a; b"\n;\n'));
  t.true(output.startsWith("  ; A long explanation with\n  ; enough words to wrap across\n"));
  t.true(output.endsWith("; https://example.test/an-indivisible-long-token\n"));
  t.is(wrapAssemblyComments(output, 32), output);
  t.is(wrapAssemblyComments('db "a; b"\n', 20), 'db "a; b"\n');
});

test("wrapped records and table rows preserve array bytes and instruction source locations", (t) => {
  const values = Array.from(
    { length: 128 },
    (_, index) => `$${index.toString(16).padStart(2, "0")}`,
  );
  for (const width of [40, 80, 100, 120]) {
    for (const table of [false, true]) {
      const prefix = table ? "  [0] = " : "dataStruct Record[0], ";
      const lines = formatStructDeclaration(
        prefix,
        [{ assignment: "flag = $EA" }, { assignment: `bytes = [${values.join(", ")}]` }],
        width,
      );
      t.true(lines.length > 3);
      t.true(lines.every((line) => line.length <= width));
      const source = [
        "lorom",
        "org $808000",
        "struct Record $808000",
        ".flag: db",
        ".bytes: db[128]",
        "endstruct count 1",
        ...(table ? ["dataStructs Record"] : []),
        ...lines,
        ...(table ? ["endDataStructs"] : []),
        "RTS",
      ];
      const assembler = new Assembler();
      try {
        assembler.assembleSource(source.join("\n"), "wrapped.asm");
        t.deepEqual(
          assembler.getBinaryOutput(),
          Uint8Array.from([0xea, ...values.map((_, index) => index), 0x60]),
        );
        t.true(
          assembler.addressToLineMapping.ranges.some(
            (range) => range.outputStart === 129 && range.line === source.length,
          ),
        );
      } finally {
        assembler.dispose();
      }
    }
  }
});
