import { test } from "../../../tests/ava-helper.js";
import type { DebugTraceInstructionDetail } from "../src/contracts.js";
import { validateDebugTraceDetails } from "../src/trace-detail-validation.js";

const instruction = { bytes: [0xea], state: { p: 0x30 } };
const access = { addressSpace: "cpu", address: 0, access: "read", width: 1 };

test("trace details preserve valid instruction and bus data at the supported bounds", (t) => {
  const details: DebugTraceInstructionDetail[] = [
    {
      bytes: Array(16).fill(255),
      state: { count: 0, enabled: false, label: "" },
      droppedMemoryAccesses: Number.MAX_SAFE_INTEGER,
      memoryAccesses: Array.from({ length: 256 }, (_, channel) => ({
        ...access,
        address: Number.MAX_SAFE_INTEGER,
        access: (["read", "write", "fetch"] as const)[channel % 3],
        width: 8,
        value: Number.MAX_SAFE_INTEGER,
        actor: channel % 2 === 0 ? "dma" : "hdma",
        channel: channel % 8,
      })),
    },
  ];
  t.is(validateDebugTraceDetails(details, 1), details);
  t.deepEqual(validateDebugTraceDetails([], 0), []);
  t.deepEqual(validateDebugTraceDetails([instruction], 1), [instruction]);
  t.notThrows(() =>
    validateDebugTraceDetails(
      [
        {
          ...instruction,
          droppedMemoryAccesses: 0,
          memoryAccesses: [access, { ...access, actor: "cpu", value: 0 }],
        },
      ],
      1,
    ),
  );
});

test("trace details reject a missing or misaligned instruction array", (t) => {
  for (const value of [null, {}, "details", [], [instruction, instruction]]) {
    t.throws(() => validateDebugTraceDetails(value, 1), {
      message: /align with instruction addresses/,
    });
  }
});

test("trace details reject non-byte values and empty or oversized instructions", (t) => {
  t.throws(() => validateDebugTraceDetails([null], 1), { message: /instruction bytes/ });
  for (const bytes of [
    undefined,
    {},
    new Uint8Array([0]),
    [],
    Array(17).fill(0),
    [-1],
    [256],
    [0.5],
    [NaN],
    ["0"],
  ]) {
    t.throws(() => validateDebugTraceDetails([{ ...instruction, bytes }], 1), {
      message: /instruction bytes/,
    });
  }
});

test("trace state requires named finite scalar entries", (t) => {
  for (const state of [
    null,
    0,
    "state",
    [],
    { "": 0 },
    { p: null },
    { p: {} },
    { p: [] },
    { p: NaN },
    { p: Infinity },
  ]) {
    t.throws(() => validateDebugTraceDetails([{ ...instruction, state }], 1), {
      message: /instruction state/,
    });
  }
  t.notThrows(() => validateDebugTraceDetails([{ ...instruction, state: {} }], 1));
});

test("trace memory loss and access counts have explicit bounds", (t) => {
  for (const droppedMemoryAccesses of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null]) {
    t.throws(() => validateDebugTraceDetails([{ ...instruction, droppedMemoryAccesses }], 1), {
      message: /memory loss/,
    });
  }
  for (const memoryAccesses of [null, {}, Array.from({ length: 257 }, () => access)]) {
    t.throws(() => validateDebugTraceDetails([{ ...instruction, memoryAccesses }], 1), {
      message: /access bound/,
    });
  }
});

test("trace bus operations reject invalid addresses, widths, actors, and DMA channels", (t) => {
  const invalid = [
    null,
    ...[
      { addressSpace: "" },
      { addressSpace: 1 },
      { address: -1 },
      { address: 0.5 },
      { address: Number.MAX_SAFE_INTEGER + 1 },
      { access: "execute" },
      { width: 0 },
      { width: 9 },
      { width: 1.5 },
      { value: -1 },
      { value: 0.5 },
      { value: Number.MAX_SAFE_INTEGER + 1 },
      { actor: "gpu" },
      { channel: 0 },
      { actor: "cpu", channel: 0 },
      { actor: "dma", channel: -1 },
      { actor: "dma", channel: 8 },
      { actor: "hdma", channel: 0.5 },
    ].map((overrides) => Object.assign({}, access, overrides)),
  ];
  for (const busOperation of invalid) {
    t.throws(
      () =>
        validateDebugTraceDetails(
          [
            {
              ...instruction,
              memoryAccesses: [busOperation],
            },
          ],
          1,
        ),
      { message: /bus operation/ },
    );
  }
});
