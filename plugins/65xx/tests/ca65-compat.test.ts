import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "../../../tests/ava-helper.js";

import { Assembler } from "@uttori/asm-core";
import {
  CA65_RAW_65XX_TARGET_ID,
  create65xxAssemblerEnvironment,
  NES_65XX_TARGET_ID,
} from "../src/index.js";

const environment = await create65xxAssemblerEnvironment();

function assembleCa65Raw(
  source: string,
  options: { architecture?: string; origin?: number; files?: Record<string, Uint8Array> } = {},
): Uint8Array {
  const assembler = new Assembler({
    environment,
    target: CA65_RAW_65XX_TARGET_ID,
    architecture: options.architecture,
    targetOptions: { origin: options.origin ?? 0 },
    collectSourceMetadata: false,
  });
  let directory: string | undefined;
  try {
    if (options.files) {
      directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-ca65-raw-"));
      for (const [name, contents] of Object.entries(options.files)) {
        fs.writeFileSync(path.join(directory, name), contents);
      }
      assembler.setIncludePaths([directory]);
      assembler.setCurrentFile(path.join(directory, "fixture.asm"));
    }
    assembler.assembleSource(source, assembler.currentFile || "fixture.asm");
    return assembler.getBinaryOutput();
  } finally {
    assembler.dispose();
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  }
}

const TINY_CFG = `MEMORY {
    ROM: start = $8000, size = $100, file = %O, fill = yes, fillval = $FF ;
    RAM: start = $0300, size = $80, file = "", fill = yes, fillval = $FF ;
}
SEGMENTS {
    CODE: load = ROM, type = ro ;
    OVERLAY: load = ROM, type = ro, run = RAM, define = yes ;
}
`;

function assembleNes(source: string, extra?: { files?: Record<string, string> }): Uint8Array {
  const assembler = new Assembler({
    environment,
    target: NES_65XX_TARGET_ID,
    architecture: "65xx.6502",
    targetOptions: {
      linkerConfig: TINY_CFG,
      header: new Array(16).fill(0),
      fillByte: 0xff,
    },
    collectSourceMetadata: false,
  });
  try {
    if (extra?.files) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-nes-ca65-"));
      try {
        for (const [name, contents] of Object.entries(extra.files)) {
          fs.writeFileSync(path.join(dir, name), contents);
        }
        assembler.setIncludePaths([dir]);
        assembler.setCurrentFile(path.join(dir, "driver.asm"));
        assembler.assembleSource(source, path.join(dir, "driver.asm"));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } else {
      assembler.assembleSource(source, "fixture.asm");
    }
    return assembler.getBinaryOutput();
  } finally {
    assembler.dispose();
  }
}

test("NES target prefills header and $FF, then emits ca65 .byte / lda", (t) => {
  const output = assembleNes(['.segment "CODE"', "lda #$12", ".byte $34, $56"].join("\n"));
  t.is(output.length, 16 + 0x100);
  t.deepEqual([...output.slice(0, 16)], new Array(16).fill(0));
  t.deepEqual([...output.slice(16, 20)], [0xa9, 0x12, 0x34, 0x56]);
  t.true(output.slice(20).every((byte) => byte === 0xff));
});

test("ca65 := assignment and unary < > encode as immediates", (t) => {
  const output = assembleNes(
    [
      '.segment "CODE"',
      "CurLevel := $10",
      "Label := $1234",
      "lda #CurLevel",
      "lda #<Label",
      "lda #>Label",
    ].join("\n"),
  );
  t.deepEqual([...output.slice(16, 22)], [0xa9, 0x10, 0xa9, 0x34, 0xa9, 0x12]);
});

test("ca65 zp equates $00-$FF encode as zero-page not absolute", (t) => {
  const output = assembleNes(
    ['.segment "CODE"', "Paused := $E0", "CurLevel := $10", "lda Paused", "lda CurLevel"].join(
      "\n",
    ),
  );
  t.deepEqual([...output.slice(16, 20)], [0xa5, 0xe0, 0xa5, 0x10]);
});

test("ca65 abs equates $100+ encode as absolute not zero-page", (t) => {
  const output = assembleNes(
    [
      '.segment "CODE"',
      "FirstNoteIndexSongNoise := $5F5",
      "NoteOffsetSongNoise := $60D",
      "lda FirstNoteIndexSongNoise",
      "sta NoteOffsetSongNoise",
    ].join("\n"),
  );
  t.deepEqual([...output.slice(16, 22)], [0xad, 0xf5, 0x05, 0x8d, 0x0d, 0x06]);
});

test("ca65 BNE :+ over abs LDA/STA/BNE :- matches ca65 skip length", (t) => {
  const output = assembleNes(
    [
      '.segment "CODE"',
      "FirstNoteIndexSongNoise := $5F5",
      "NoteOffsetSongNoise := $60D",
      ":",
      "bne :+",
      "lda FirstNoteIndexSongNoise",
      "sta NoteOffsetSongNoise",
      "bne :-",
      ":",
      "nop",
    ].join("\n"),
  );
  // bne :+ skips lda abs (3) + sta abs (3) + bne (2) = 8
  // bne :- from $8008 back to unnamed at $8000 is -10
  t.deepEqual(
    [...output.slice(16, 16 + 11)],
    [0xd0, 0x08, 0xad, 0xf5, 0x05, 0x8d, 0x0d, 0x06, 0xd0, 0xf6, 0xea],
  );
});

test("ca65 a: prefix forces absolute even for zp equates", (t) => {
  const output = assembleNes(
    ['.segment "CODE"', "ObjState := $AC", "lda a:ObjState, y", "sta a:ObjState"].join("\n"),
  );
  t.deepEqual([...output.slice(16, 22)], [0xb9, 0xac, 0x00, 0x8d, 0xac, 0x00]);
});

test("ca65 cheap locals @name attach to the current global", (t) => {
  const output = assembleNes(['.segment "CODE"', "DriveAudio:", "@Play:", "bne @Play"].join("\n"));
  t.deepEqual([...output.slice(16, 18)], [0xd0, 0xfe]);
});

test("ca65 unnamed labels : / :+ / :- / :++ resolve nth next and previous", (t) => {
  const output = assembleNes(
    [
      '.segment "CODE"',
      "bcc :+",
      "nop",
      ":",
      "lda #$01",
      "bne :-",
      "beq :++",
      "nop",
      ":",
      "nop",
      ":",
      "jmp :-",
    ].join("\n"),
  );
  // $8000 bcc :+  (90 01) skips nop to unnamed at $8003
  // $8002 nop
  // $8003 : lda #$01
  // $8005 bne :-  (d0 fc) back to $8003
  // $8007 beq :++ (f0 02) skips first unnamed at $800a, lands on second at $800b
  // $8009 nop
  // $800a : nop
  // $800b : jmp :- (4c 0a 80) to previous unnamed $800a
  t.deepEqual(
    [...output.slice(16, 16 + 14)],
    [0x90, 0x01, 0xea, 0xa9, 0x01, 0xd0, 0xfc, 0xf0, 0x02, 0xea, 0xea, 0x4c, 0x0a, 0x80],
  );
});

test("ca65 .addr / .dbyt / .lobytes / .hibytes emit the documented endianness", (t) => {
  const output = assembleNes(
    [
      '.segment "CODE"',
      "Target := $1234",
      ".addr Target",
      ".dbyt Target",
      ".lobytes Target",
      ".hibytes Target",
    ].join("\n"),
  );
  t.deepEqual([...output.slice(16, 22)], [0x34, 0x12, 0x12, 0x34, 0x34, 0x12]);
});

test("ca65 unnamed labels do not leak across included object files", (t) => {
  const output = assembleNes('.include "a.asm"\n.include "b.asm"', {
    files: {
      "a.asm": ['.segment "CODE"', "bne :+", "nop", ":", "rts"].join("\n"),
      "b.asm": ["bne :+", "nop", "nop", ":", "rts"].join("\n"),
    },
  });
  // a: bne :+ over nop (d0 01 ea) rts; b: bne :+ over two nops (d0 02 ea ea) rts
  t.deepEqual([...output.slice(16, 25)], [0xd0, 0x01, 0xea, 0x60, 0xd0, 0x02, 0xea, 0xea, 0x60]);
});

test("file-local labels do not collide across included object files", (t) => {
  const output = assembleNes('.include "a.asm"\n.include "b.asm"', {
    files: {
      "a.asm": ['.segment "CODE"', ".export Shared", "Exit:", "nop", "Shared:", "rts"].join("\n"),
      "b.asm": [".import Shared", "Exit:", "jmp Shared"].join("\n"),
    },
  });
  // a.asm: nop at $8000, rts at $8001; b.asm: jmp Shared ($8001)
  t.deepEqual([...output.slice(16, 21)], [0xea, 0x60, 0x4c, 0x01, 0x80]);
});

test("overlay segment define symbols expose load/run/size", (t) => {
  const output = assembleNes(
    [
      '.segment "CODE"',
      "nop",
      '.segment "OVERLAY"',
      "lda #$01",
      '.segment "CODE"',
      "lda #<__OVERLAY_LOAD__",
      "lda #>__OVERLAY_LOAD__",
      "lda #<__OVERLAY_RUN__",
      "lda #>__OVERLAY_RUN__",
    ].join("\n"),
  );
  // CODE nop at $8000; OVERLAY lda at load $8001 / run $0300; then CODE resumes at $8003
  t.is(output[16], 0xea);
  t.deepEqual([...output.slice(17, 19)], [0xa9, 0x01]);
  t.deepEqual([...output.slice(19, 27)], [0xa9, 0x01, 0xa9, 0x80, 0xa9, 0x00, 0xa9, 0x03]);
});

test("ca65 CPU selection, shorthand predicates, and CPU stack compose", (t) => {
  const output = assembleCa65Raw(
    [
      '.setcpu "65C02"',
      "rmb0 $12",
      ".pushcpu",
      ".p6280",
      "tma #$10",
      ".ifp6280",
      "cla",
      ".else",
      "nop",
      ".endif",
      ".popcpu",
      "rmb1 $13",
      ".ifpc02",
      ".byte $42",
      ".endif",
    ].join("\n"),
  );
  t.deepEqual([...output], [0x07, 0x12, 0x43, 0x10, 0x62, 0x17, 0x13, 0x42]);
});

test("ca65 names, shorthands, and CPU conditionals select every 65xx architecture", (t) => {
  const cases = [
    ["6502", "p02", "ifp02"],
    ["6502X", "p02x", "ifp02x"],
    ["6502DTV", "pdtv", "ifpdtv"],
    ["65SC02", "psc02", "ifpsc02"],
    ["65C02", "pc02", "ifpc02"],
    ["W65C02", "pwc02", "ifpwc02"],
    ["65CE02", "pce02", "ifpce02"],
    ["4510", "p4510", "ifp4510"],
    ["45GS02", "p45gs02", "ifp45gs02"],
    ["HuC6280", "p6280", "ifp6280"],
    ["M740", "pm740", "ifpm740"],
  ] as const;

  for (const [cpu, shorthand, conditional] of cases) {
    const named = assembleCa65Raw(
      [`.setcpu "${cpu}"`, `.${conditional}`, ".byte $5A", ".endif"].join("\n"),
    );
    const short = assembleCa65Raw(
      [`.${shorthand}`, `.${conditional}`, ".byte $A5", ".endif"].join("\n"),
    );
    t.deepEqual([...named], [0x5a], cpu);
    t.deepEqual([...short], [0xa5], shorthand);
  }
});

test("ca65 expressions, data aliases, reserve, and alignment emit a flat image", (t) => {
  const output = assembleCa65Raw(
    [
      ".byte @17, .lobyte($1234), .hibyte($1234), .bankbyte($123456)",
      ".res 2, $AA",
      ".align 8, $FF",
      ".dword $12345678",
      ".faraddr $123456",
      ".word .loword($12345678), .hiword($12345678)",
    ].join("\n"),
  );
  t.deepEqual(
    [...output],
    [
      15, 0x34, 0x12, 0x12, 0xaa, 0xaa, 0xff, 0xff, 0x78, 0x56, 0x34, 0x12, 0x56, 0x34, 0x12, 0x78,
      0x56, 0x34, 0x12,
    ],
  );
});

test("ca65 .incbin uses offset and size rather than Asar range syntax", (t) => {
  const output = assembleCa65Raw('.incbin "data.bin", 2, 3', {
    files: { "data.bin": Uint8Array.from([0, 1, 2, 3, 4, 5]) },
  });
  t.deepEqual([...output], [2, 3, 4]);
});

test("ca65 flat segments and the segment stack preserve source ordering", (t) => {
  const output = assembleCa65Raw(
    [
      '.segment "CODE"',
      ".byte $11",
      ".pushseg",
      '.segment "RODATA"',
      ".byte $22",
      ".popseg",
      ".byte $33",
    ].join("\n"),
  );
  t.deepEqual([...output], [0x11, 0x22, 0x33]);
});

test("ca65 dotted conditionals, scopes, procedures, macros, and repeats compose", (t) => {
  const output = assembleCa65Raw(
    [
      "FLAG := 1",
      ".ifdef FLAG",
      ".scope Outer",
      "Value:",
      ".byte $11",
      "lda a:Outer::Value",
      ".endscope",
      ".endif",
      ".macro emit value",
      ".byte \\value",
      ".endmacro",
      "emit $22",
      ".repeat 3, I",
      ".byte I",
      ".endrepeat",
      ".proc Sub",
      "rts",
      ".endproc",
      "jsr Sub",
    ].join("\n"),
  );
  t.deepEqual(
    [...output],
    [0x11, 0xad, 0x00, 0x00, 0x22, 0x00, 0x01, 0x02, 0x60, 0x20, 0x08, 0x00],
  );
});

test("ca65 assertions and object-only directives fail precisely", (t) => {
  t.throws(() => assembleCa65Raw('.assert 0, error, "bad layout"'), {
    message: /bad layout/i,
  });
  t.throws(() => assembleCa65Raw(".importzp External"), {
    message: /relocatable ca65 object\/linker semantics/i,
  });
  t.throws(() => assembleCa65Raw(".local Temporary"), {
    message: /macro compatibility slice/i,
  });
});
