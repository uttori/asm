import { test } from "../../../tests/ava-helper.js";
import { analyzeSuperFxRom } from "../src/disassembler/superfx-analysis.js";
import {
  SUPERFX_ROM_ADDRESS_SPACE,
  SuperFxRomImage,
} from "../src/disassembler/superfx-address-space.js";
import {
  initialSuperFxState,
  joinSuperFxStates,
  superFxDecodeState,
  transferSuperFxState,
} from "../src/disassembler/superfx-state.js";

test("SuperFX images retain a distinct bounded 24-bit address identity", (t) => {
  const image = new SuperFxRomImage([0x01, 0x00], 0x088000);
  t.deepEqual(image.identifyOffset(1), {
    addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
    address: 0x088001,
    imageOffset: 1,
  });
  t.is(image.identifyAddress(0x088002), undefined);
  t.throws(() => new SuperFxRomImage([0, 0], 0xffffff));
});

test("SuperFX analysis follows direct R15 writes and preserves indirect R15 flow", (t) => {
  const directImage = new SuperFxRomImage([0xff, 0x06, 0x80, 0x01, 0x01, 0x01, 0x00], 0x088000);
  const direct = analyzeSuperFxRom(directImage, {
    entryPoints: [{ id: "start", address: 0x088000 }],
  });
  t.deepEqual(
    direct.nodes.map((entry) => entry.address),
    [0x088000, 0x088006],
  );
  t.true(direct.edges.some((entry) => entry.kind === "jump" && entry.toAddress === 0x088006));

  const indirectImage = new SuperFxRomImage([0x1f, 0x51], 0x098000);
  const indirect = analyzeSuperFxRom(indirectImage, {
    entryPoints: [{ id: "start", address: 0x098000 }],
  });
  t.deepEqual(
    indirect.nodes.map((entry) => entry.address),
    [0x098000, 0x098001],
  );
  t.true(indirect.unresolved.some((entry) => entry.address === 0x098001 && entry.indirect));
});

test("SuperFX analysis follows short branches and honors data annotations", (t) => {
  const image = new SuperFxRomImage([0x06, 0x02, 0x01, 0x00, 0x00], 0x0a8000);
  const result = analyzeSuperFxRom(image, {
    entryPoints: [{ id: "start", address: 0x0a8000 }],
    annotations: [
      {
        id: "manual:data",
        addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
        start: 0x0a8002,
        end: 0x0a8003,
        classification: "data8",
        evidence: ["manual:data"],
      },
    ],
  });
  t.true(result.conflicts.some((entry) => entry.address === 0x0a8002 && entry.kind === "blocked"));
  t.true(result.nodes.some((entry) => entry.address === 0x0a8004));
  t.true(result.records.some((entry) => entry.kind === "summary"));
});

test("SuperFX state joins and ALT prefixes remain conservative", (t) => {
  const known = initialSuperFxState(0x08);
  const unknown = initialSuperFxState();
  const joined = joinSuperFxStates(known, unknown);
  t.is(joined.programBank.kind, "unknown");

  const conflicting = joinSuperFxStates(known, {
    ...known,
    destinationRegister: { kind: "known", value: 1 },
  });
  t.is(conflicting.destinationRegister.kind, "conflict");

  const prefixed = transferSuperFxState(
    {
      effects: [{ kind: "custom", name: "set-superfx-alt", details: { alt: 1 } }],
    },
    { ...known, alt: { kind: "unknown" } },
  );
  t.is(superFxDecodeState(prefixed).alt, "unknown");
});
