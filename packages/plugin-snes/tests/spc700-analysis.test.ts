import type { StaticInstruction } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { analyzeSpc700Aram, applySpc700StateOverride, joinSpc700States, SPC700_ARAM_ADDRESS_SPACE, SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR, Spc700AramImage, transferSpc700State, unknownSpc700State } from "@uttori/asm-plugin-snes/disassembler";

const entryPoint = (address: number, directPage?: 0 | 0x100) => ({
  id: "main",
  address,
  ...(directPage === undefined ? {} : { state: { directPage } }),
});

const instruction = (
  mnemonic: string,
  mode: string,
  effects: StaticInstruction["effects"],
): StaticInstruction => ({
  specificationId: `snes.spc700.${mnemonic}`,
  address: 0x0200,
  fileOffset: 0,
  size: 1,
  opcode: 0,
  mnemonic,
  mode,
  effects,
  flow: { kind: "fallthrough", fallthrough: true },
  targets: [],
});

test("SPC700 ARAM images expose a distinct bounded 16-bit address space", (t) => {
  const source = new Uint8Array([0x20, 0xff]);
  const image = new Spc700AramImage(source, 0x0200);
  source[0] = 0;

  t.deepEqual(SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR, {
    id: "snes.spc700.aram",
    name: "SPC700 ARAM",
    addressBits: 16,
    kind: "memory",
  });
  t.is(image.readByte(0x0200), 0x20);
  t.deepEqual(image.identifyAddress(0x0201), {
    addressSpace: SPC700_ARAM_ADDRESS_SPACE,
    address: 0x0201,
    imageOffset: 1,
  });
  t.deepEqual(image.identifyOffset(0), {
    addressSpace: SPC700_ARAM_ADDRESS_SPACE,
    address: 0x0200,
    imageOffset: 0,
  });
  t.is(image.identifyAddress(0x01ff), undefined);
  t.throws(() => new Spc700AramImage(new Uint8Array(2), 0xffff), {
    message: /fit contiguously/,
  });
});

test("SPC700 analysis follows calls and PSW.P-dependent direct-page accesses", (t) => {
  const image = new Spc700AramImage(
    [
      0x40, // SETP
      0xe4,
      0x10, // MOV A,$10 -> $0110
      0x3f,
      0x08,
      0x02, // CALL $0208
      0xff, // STOP
      0x00,
      0x20, // CLRP
      0xe4,
      0xf4, // MOV A,$F4 -> volatile $00F4
      0x6f, // RET
    ],
    0x0200,
  );
  const result = analyzeSpc700Aram(image, { entryPoints: [entryPoint(0x0200)] });

  t.is(result.status, "complete");
  t.true(result.edges.some((edge) => edge.kind === "call" && edge.toAddress === 0x0208));
  t.true(result.edges.some((edge) => edge.kind === "return" && edge.toAddress === 0x0206));
  t.is(
    result.nodes
      .find((node) => node.address === 0x0201)
      ?.effectiveAddresses.find((address) => address.address === 0x0110)?.volatile,
    false,
  );
  t.like(
    result.nodes
      .find((node) => node.address === 0x0209)
      ?.effectiveAddresses.find((address) => address.symbol === "CPUIO0"),
    { address: 0x00f4, volatile: true },
  );
  t.true(result.records.every((record) => record.kind === "summary" || "addressSpace" in record));
  t.true(
    result.records.some(
      (record) => record.kind === "cfg-node" && record.addressSpace === SPC700_ARAM_ADDRESS_SPACE,
    ),
  );
  t.true(
    result.annotations.every((annotation) => annotation.addressSpace === SPC700_ARAM_ADDRESS_SPACE),
  );
});

test("SPC700 analysis preserves conflicting PSW.P joins instead of guessing", (t) => {
  const image = new Spc700AramImage(
    [
      0xd0,
      0x03, // BNE $0305
      0x20, // CLRP
      0x2f,
      0x01, // BRA $0306
      0x40, // SETP
      0xe4,
      0x10, // MOV A,$10
      0xff, // STOP
    ],
    0x0300,
  );
  const result = analyzeSpc700Aram(image, { entryPoints: [entryPoint(0x0300)] });
  const merge = result.nodes.find((node) => node.address === 0x0306);

  t.deepEqual(merge?.incomingState.directPage, {
    kind: "conflicting",
    values: [0, 0x100],
  });
  t.like(merge?.effectiveAddresses[0], {
    address: undefined,
    volatile: false,
  });
});

test("SPC700 analysis resolves available TCALL vectors and preserves missing ones", (t) => {
  const bytes = new Uint8Array(0x10000);
  bytes[0x0200] = 0x01; // TCALL 0 through $FFDE
  bytes[0x0201] = 0xff;
  bytes[0x0300] = 0x6f;
  bytes[0xffde] = 0x00;
  bytes[0xffdf] = 0x03;
  const resolved = analyzeSpc700Aram(new Spc700AramImage(bytes), {
    entryPoints: [entryPoint(0x0200)],
  });
  t.true(
    resolved.edges.some(
      (edge) => edge.kind === "call" && edge.indirect && edge.toAddress === 0x0300,
    ),
  );

  const missing = analyzeSpc700Aram(new Spc700AramImage([0x01], 0x0200), {
    entryPoints: [entryPoint(0x0200)],
  });
  t.true(
    missing.unresolved.some(
      (flow) => flow.address === 0x0200 && flow.kind === "call" && flow.indirect,
    ),
  );
});

test("SPC700 analysis blocks data and honors ARAM-only target overrides", (t) => {
  const image = new Spc700AramImage([0x1f, 0x03, 0x02, 0xff], 0x0200);
  const unresolved = analyzeSpc700Aram(image, { entryPoints: [entryPoint(0x0200, 0)] });
  t.true(unresolved.unresolved.some((flow) => flow.address === 0x0200));

  const resolved = analyzeSpc700Aram(image, {
    entryPoints: [entryPoint(0x0200, 0)],
    targetOverrides: [
      {
        id: "manual:jump",
        kind: "target-override",
        addressSpace: SPC700_ARAM_ADDRESS_SPACE,
        address: 0x0200,
        targets: [0x0203],
        evidence: ["manual:jump"],
      },
    ],
  });
  t.false(resolved.unresolved.some((flow) => flow.address === 0x0200));
  t.true(resolved.edges.some((edge) => edge.override === "manual:jump"));

  const blocked = analyzeSpc700Aram(new Spc700AramImage([0x00], 0x0400), {
    entryPoints: [entryPoint(0x0400)],
    annotations: [
      {
        id: "manual:data",
        addressSpace: SPC700_ARAM_ADDRESS_SPACE,
        start: 0x0400,
        end: 0x0401,
        classification: "data8",
        architecture: "snes.spc700",
        evidence: ["manual:data"],
      },
    ],
  });
  t.true(blocked.conflicts.some((conflict) => conflict.kind === "blocked"));
});

test("SPC700 state joins conflicts and restores PSW.P through explicit PUSH/POP", (t) => {
  const pageZero = applySpc700StateOverride(unknownSpc700State(), { directPage: 0 });
  const pageOne = applySpc700StateOverride(unknownSpc700State(), { directPage: 0x100 });
  t.deepEqual(joinSpc700States(pageZero, pageOne).directPage, {
    kind: "conflicting",
    values: [0, 0x100],
  });

  const pushed = transferSpc700State(
    instruction("PUSH", "registerP", [{ kind: "push", source: "operand-register" }]),
    pageZero,
  );
  const selected = transferSpc700State(
    instruction("SETP", "implied", [{ kind: "setBits", target: "p", mask: 0x20 }]),
    pushed,
  );
  const restored = transferSpc700State(
    instruction("POP", "registerP", [{ kind: "pull", target: "operand-register" }]),
    selected,
  );
  t.deepEqual(restored.directPage, { kind: "known", value: 0 });

  const returned = transferSpc700State(
    instruction("RETI", "implied", [
      { kind: "pull", target: "p" },
      { kind: "pull", target: "pc" },
    ]),
    restored,
  );
  t.deepEqual(returned.directPage, { kind: "unknown" });
});
