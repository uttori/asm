import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { test } from "../../../tests/ava-helper.js";
import { createEncoderTestHost } from "../../../tests/architecture/test-stubs.js";

import { ArchSPC700 } from "../src/architectures/spc700.js";
import {
  formatSpc700Instruction,
  Spc700Decoder,
  type Spc700DecodeState,
} from "../src/architectures/spc700-decoder.js";
import { buildSpc700Catalog, spc700Specifications } from "../src/architectures/spc700-spec.js";

const decoder = new Spc700Decoder();
const logicalAddress = 0x2000;

const decode = (bytes: readonly number[], state: Spc700DecodeState = {}) =>
  decoder.decode({
    source: new Uint8ArrayDecoderSource(bytes),
    offset: 0,
    logicalAddress,
    state,
  });

test("SPC700 declarative table covers every opcode and generates complete tooling", (t) => {
  t.is(spc700Specifications.length, 256);
  t.deepEqual(
    spc700Specifications.map((entry) => entry.opcode[0]),
    Array.from({ length: 256 }, (_, opcode) => opcode),
  );
  t.is(new Set(spc700Specifications.map((entry) => entry.id)).size, 256);
  t.true(spc700Specifications.every((entry) => entry.minimumSize === entry.maximumSize));

  const catalog = buildSpc700Catalog();
  t.deepEqual(
    catalog.map((entry) => entry.mnemonic),
    [...catalog.map((entry) => entry.mnemonic)].sort(),
  );
  t.is(catalog.find((entry) => entry.mnemonic === "MOV")?.modes.length, 41);
  t.deepEqual(
    catalog.find((entry) => entry.mnemonic === "JMP")?.modes.map((entry) => entry.opcode),
    [0x1f, 0x5f],
  );
});

test("SPC700 decoder reports flow, direct-page references, bit operands, and effects", (t) => {
  const branch = decode([0xd0, 0xfe]);
  t.is(branch.kind, "instruction");
  if (branch.kind === "instruction") {
    t.is(formatSpc700Instruction(branch.instruction), "BNE $2000");
    t.deepEqual(branch.instruction.references, [
      { kind: "branch", operandIndex: 0, address: logicalAddress },
    ]);
    t.deepEqual(branch.instruction.flow, { kind: "conditionalBranch", fallthrough: true });
  }

  const bit = decode([0x6a, 0x34, 0x72]);
  t.is(bit.kind, "instruction");
  if (bit.kind === "instruction") {
    t.is(formatSpc700Instruction(bit.instruction), "AND1 C,/$1234.3");
    t.is(bit.instruction.operands.find((operand) => operand.kind === "bit")?.value, 3);
  }

  const tableCall = decode([0x01]);
  t.is(tableCall.kind, "instruction");
  if (tableCall.kind === "instruction") {
    t.deepEqual(tableCall.instruction.references, [
      { kind: "call", operandIndex: 0, indirect: true },
      { kind: "pointer", operandIndex: 0, address: 0xffde, indirect: true },
    ]);
  }

  const indirectJump = decode([0x1f, 0x34, 0x12]);
  t.is(indirectJump.kind, "instruction");
  if (indirectJump.kind === "instruction") {
    t.deepEqual(indirectJump.instruction.references, [
      { kind: "jump", operandIndex: 0, indirect: true },
      { kind: "pointer", operandIndex: 0, address: 0x1234, indirect: true },
    ]);
  }

  const knownDirectPage = decode([0xe4, 0x34], { directPage: 0x100 });
  t.is(knownDirectPage.kind, "instruction");
  if (knownDirectPage.kind === "instruction") {
    t.true(
      knownDirectPage.instruction.references.some(
        (reference) => reference.kind === "data" && reference.address === 0x134,
      ),
    );
  }
  const unknownDirectPage = decode([0xe4, 0x34]);
  t.is(unknownDirectPage.kind, "instruction");
  if (unknownDirectPage.kind === "instruction") {
    t.true(
      unknownDirectPage.instruction.references.some(
        (reference) => reference.kind === "data" && reference.address === undefined,
      ),
    );
  }

  const setPage = decode([0x40]);
  t.is(setPage.kind, "instruction");
  if (setPage.kind === "instruction") {
    t.deepEqual(setPage.instruction.effects, [{ kind: "setBits", target: "p", mask: 0x20 }]);
  }
  const stop = decode([0xff]);
  t.is(stop.kind, "instruction");
  if (stop.kind === "instruction") {
    t.deepEqual(stop.instruction.flow, { kind: "stop", fallthrough: false });
  }
});

test("SPC700 official-documentation vectors decode in native syntax", (t) => {
  const vectors = [
    { bytes: [0x00], source: "NOP", flow: "fallthrough" },
    { bytes: [0x03, 0x12, 0xfc], source: "BBS0 $12,$1FFF", flow: "conditionalBranch" },
    { bytes: [0x3f, 0x34, 0x12], source: "CALL $1234", flow: "call" },
    { bytes: [0x8f, 0x56, 0x34], source: "MOV $34,#$56", flow: "fallthrough" },
    { bytes: [0xaa, 0x34, 0x72], source: "MOV1 C,$1234.3", flow: "fallthrough" },
    { bytes: [0xcf], source: "MUL YA", flow: "fallthrough" },
    { bytes: [0xff], source: "STOP", flow: "stop" },
  ];
  for (const vector of vectors) {
    const result = decode(vector.bytes);
    t.is(result.kind, "instruction", vector.source);
    if (result.kind !== "instruction") continue;
    t.is(formatSpc700Instruction(result.instruction), vector.source);
    t.is(result.instruction.flow.kind, vector.flow);
  }
});

test("SPC700 decoder reports every truncated multi-byte opcode without over-reading", (t) => {
  for (const specification of spc700Specifications) {
    for (let available = 1; available < specification.minimumSize; available++) {
      const result = decode([
        specification.opcode[0],
        ...Array.from({ length: available - 1 }, () => 0),
      ]);
      t.like(
        result,
        {
          kind: "error",
          code: "truncated",
          requiredBytes: specification.minimumSize,
          availableBytes: available,
        },
        specification.id,
      );
    }
  }
});

test("SPC700 decode-format-encode round trips all 256 opcode bytes", (t) => {
  for (const specification of spc700Specifications) {
    const bytes = [specification.opcode[0], 0x34, 0x12].slice(0, specification.minimumSize);
    const result = decode(bytes, { directPage: 0 });
    t.is(result.kind, "instruction", specification.id);
    if (result.kind !== "instruction") continue;

    const source = formatSpc700Instruction(result.instruction);
    const host = createEncoderTestHost();
    host.currentTargetAddress = logicalAddress;
    host.activateStage("emitProgram");
    const encoder = new ArchSPC700(host.context);
    const space = source.indexOf(" ");
    const words = space < 0 ? [source] : [source.slice(0, space), source.slice(space + 1)];
    t.true(encoder.encode(words), source);
    t.deepEqual(host.emitted, bytes, `${specification.id}: ${source}`);
  }
});

test("SPC700 decoder reports an out-of-bounds starting offset", (t) => {
  const result = decoder.decode({
    source: new Uint8ArrayDecoderSource([0x00]),
    offset: 1,
    logicalAddress,
  });
  t.like(result, { kind: "error", code: "outOfBounds", availableBytes: 0 });
});
