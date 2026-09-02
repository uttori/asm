import { Uint8ArrayDecoderSource } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import { createEncoderTestHost } from "../../../tests/architecture/test-stubs.js";
import { ArchSuperFX } from "../src/architectures/superfx.js";
import {
  formatSuperFxInstruction,
  SuperFxDecoder,
  type SuperFxDecodeState,
} from "../src/architectures/superfx-decoder.js";
import {
  buildSuperFxCatalog,
  superFxBaseSpecifications,
  superFxFusedSpecifications,
  superFxOpcodeMatrix,
  superFxSpecifications,
} from "../src/architectures/superfx-spec.js";
import {
  initialSuperFxState,
  superFxDecodeState,
  transferSuperFxState,
} from "../src/disassembler/superfx-state.js";

const logicalAddress = 0x088000;
const decoder = new SuperFxDecoder();
const decode = (bytes: readonly number[], state: SuperFxDecodeState = { alt: 0 }) =>
  decoder.decode({
    source: new Uint8ArrayDecoderSource(bytes),
    offset: 0,
    logicalAddress,
    state,
  });

const encode = (source: string, address = logicalAddress): readonly number[] => {
  const host = createEncoderTestHost();
  host.currentTargetAddress = address;
  host.activateStage("emitProgram");
  const encoder = new ArchSuperFX(host.context);
  const space = source.indexOf(" ");
  const words = space < 0 ? [source] : [source.slice(0, space), source.slice(space + 1)];
  if (!encoder.encode(words)) throw new Error(`SuperFX encoder rejected '${source}'.`);
  return host.emitted;
};

test("SuperFX specification covers every opcode under every ALT state", (t) => {
  t.is(superFxOpcodeMatrix.length, 4);
  for (const [alt, row] of superFxOpcodeMatrix.entries()) {
    t.is(row.length, 256);
    t.true(row.every((entry, opcode) => entry.alt === alt && entry.opcode[0] === opcode));
  }
  t.is(superFxBaseSpecifications.length, 256);
  t.true(superFxSpecifications.length > 256);
  t.is(superFxFusedSpecifications.length, 1232);
  const catalog = buildSuperFxCatalog();
  for (const mnemonic of ["ADC", "ALT1", "IBT", "LM", "MOVE", "SMS", "ROMB"]) {
    t.true(
      catalog.some((entry) => entry.mnemonic === mnemonic),
      mnemonic,
    );
  }
});

test("SuperFX selector-fused MOVE families decode-format-encode exhaustively", (t) => {
  for (const specification of superFxFusedSpecifications) {
    const result = decode(specification.opcode);
    t.is(result.kind, "instruction", specification.id);
    if (result.kind !== "instruction") continue;
    t.is(result.instruction.specificationId, specification.id);
    const source = formatSuperFxInstruction(result.instruction);
    t.deepEqual(encode(source), specification.opcode, `${specification.id}: ${source}`);
  }
});

test("SuperFX base opcode table decode-format-encodes all 256 bytes", (t) => {
  for (const specification of superFxBaseSpecifications) {
    const bytes = [specification.opcode[0], 0x34, 0x12].slice(0, specification.minimumSize);
    const result = decode(bytes);
    t.is(result.kind, "instruction", specification.id);
    if (result.kind !== "instruction") continue;
    const source = formatSuperFxInstruction(result.instruction);
    t.deepEqual(encode(source), bytes, `${specification.id}: ${source}`);
  }
});

test("SuperFX altered ALT forms decode as fused native instructions and round-trip", (t) => {
  for (const specification of superFxSpecifications.filter((entry) => entry.alteredByAlt)) {
    const bytes = [0x3c + specification.alt, specification.opcode[0], 0x34, 0x12].slice(
      0,
      specification.minimumSize + 1,
    );
    const result = decode(bytes);
    t.is(result.kind, "instruction", specification.id);
    if (result.kind !== "instruction") continue;
    const source = formatSuperFxInstruction(result.instruction);
    t.deepEqual(encode(source), bytes, `${specification.id}: ${source}`);
  }
});

test("SuperFX decoder exposes ALT ambiguity, fusion, truncation, and bounds", (t) => {
  const ambiguous = decode([0x50], { alt: "unknown" });
  t.is(ambiguous.kind, "ambiguous");
  if (ambiguous.kind === "ambiguous") {
    t.deepEqual(ambiguous.requiredState, ["alt"]);
    t.deepEqual(
      ambiguous.alternatives.map((entry) => formatSuperFxInstruction(entry)),
      ["ADD R0", "ADC R0", "ADD #0", "ADC #0"],
    );
  }
  const fused = decode([0x3d, 0x50]);
  t.is(fused.kind, "instruction");
  if (fused.kind === "instruction") {
    t.is(formatSuperFxInstruction(fused.instruction), "ADC R0");
    t.is(fused.instruction.size, 2);
  }
  t.like(decode([0xf0]), { kind: "error", code: "truncated", requiredBytes: 3 });
  t.like(decode([0x3d, 0xf0]), { kind: "error", code: "truncated", requiredBytes: 4 });
  t.like(decoder.decode({ source: new Uint8ArrayDecoderSource([0]), offset: 1, logicalAddress }), {
    kind: "error",
    code: "outOfBounds",
  });
});

test("SuperFX state models selector prefixes and R15 control flow", (t) => {
  let state = initialSuperFxState(0x08);
  const to = decode([0x1f], superFxDecodeState(state));
  t.is(to.kind, "instruction");
  if (to.kind !== "instruction") return;
  state = transferSuperFxState(to.instruction, state);
  t.deepEqual(state.destinationRegister, { kind: "known", value: 15 });

  const add = decode([0x51], superFxDecodeState(state));
  t.is(add.kind, "instruction");
  if (add.kind === "instruction") {
    t.deepEqual(add.instruction.flow, { kind: "jump", fallthrough: false, indirect: true });
    t.like(add.instruction.references[0], { kind: "jump", indirect: true });
  }

  const direct = decode([0xff, 0x34, 0x12], { alt: 0, programBank: 0x08 });
  t.is(direct.kind, "instruction");
  if (direct.kind === "instruction") {
    t.deepEqual(direct.instruction.flow, { kind: "jump", fallthrough: false });
    t.like(direct.instruction.references[0], { kind: "jump", address: 0x081234 });
  }
});
