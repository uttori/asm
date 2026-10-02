import { test } from "../../../tests/ava-helper.js";
import {
  DEBUG_BACKEND_PROTOCOL_VERSION,
  ReplayDebugBackend,
  type DebugAddress,
  type DebugBackendEvent,
  type ReplaySnapshot,
} from "../src/index.js";

/** Returns the indexed element, or undefined when the index is past the end. */
const elementAt = <T>(items: readonly T[], index: number): T | undefined =>
  index >= 0 && index < items.length ? items[index] : undefined;

const cpu = (address: number, accumulator: string): ReplaySnapshot => ({
  threads: [
    { id: 1, name: "65816", architecture: "snes.65816" },
    { id: 2, name: "SPC700", architecture: "snes.spc700" },
  ],
  frames: [
    {
      id: 10,
      threadId: 1,
      name: "CPU",
      pc: {
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        address,
        outputOffset: address - 0x808000,
      },
    },
    {
      id: 20,
      threadId: 2,
      name: "APU",
      pc: { architecture: "snes.spc700", addressSpace: "spc.aram", address: 0x200 },
    },
  ],
  registers: {
    10: [{ name: "A", value: accumulator, bits: 16, group: "CPU" }],
    20: [{ name: "A", value: "00", bits: 8, group: "CPU" }],
  },
  memory: [
    { addressSpace: "snes.cpu", start: 0x808000, bytes: [0xea, 0xa9, 0x01] },
    { addressSpace: "spc.aram", start: 0x200, bytes: [0x00] },
  ],
  instructions: [
    {
      address: { architecture: "snes.65816", addressSpace: "snes.cpu", address },
      bytes: [0xea],
      text: "nop",
    },
  ],
});

const script = { snapshots: [cpu(0x808000, "0000"), cpu(0x808001, "0001"), cpu(0x808002, "0002")] };

test("ReplayDebugBackend covers threads, frames, registers, memory, and disassembly", async (t) => {
  const backend = new ReplayDebugBackend(script);
  const events: DebugBackendEvent[] = [];
  backend.onEvent((event) => events.push(event));

  t.is(backend.protocolVersion, DEBUG_BACKEND_PROTOCOL_VERSION);
  t.true(Object.values(backend.capabilities).every(Boolean));
  t.deepEqual(
    backend.capabilities.architectures.map(({ architecture, memorySpaces }) => ({
      architecture,
      memorySpaces,
    })),
    [
      {
        architecture: "snes.65816",
        memorySpaces: [{ addressSpace: "snes.cpu", sideEffectFree: true }],
      },
      {
        architecture: "snes.spc700",
        memorySpaces: [{ addressSpace: "spc.aram", sideEffectFree: true }],
      },
    ],
  );
  await backend.connect();
  t.deepEqual(
    (await backend.threads()).map(({ architecture }) => architecture),
    ["snes.65816", "snes.spc700"],
  );
  t.is((await backend.stackFrames(2))[0]?.pc.addressSpace, "spc.aram");
  t.is((await backend.registers(10))[0]?.value, "0000");

  const address: DebugAddress = {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: 0x808001,
  };
  const memory = await backend.readMemory(address, 4);
  t.deepEqual([...memory.bytes], [0xa9, 0x01, 0, 0]);
  t.is(memory.unreadableBytes, 2);
  t.is((await backend.disassemble({ ...address, address: 0x808000 }, 1))[0]?.text, "nop");
  t.throws(
    () =>
      backend.readMemory(
        { architecture: "snes.65816", addressSpace: "snes.unavailable", address: 0 },
        1,
      ),
    { message: /is not readable/ },
  );
  t.deepEqual(events, [{ type: "stopped", reason: "entry", threadId: 1 }]);
});

test("ReplayDebugBackend steps, pauses, stops on breakpoints, and reconnects", async (t) => {
  const backend = new ReplayDebugBackend(script);
  const events: DebugBackendEvent[] = [];
  backend.onEvent((event) => events.push(event));
  await backend.connect();
  await backend.step(1, "instruction");
  t.is(backend.position, 1);
  t.is((await backend.registers(10))[0]?.value, "0001");
  await backend.pause(1);

  const breakpoint = elementAt(
    await backend.setBreakpoints([
      {
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        address: 0x808002,
      },
    ]),
    0,
  );
  t.true(breakpoint?.verified);
  await backend.continue(1);
  t.is(backend.position, 2);
  const stopped = events.at(-1);
  t.is(stopped?.type, "stopped");
  t.is(stopped?.type === "stopped" ? stopped.reason : undefined, "breakpoint");

  await backend.disconnect({ terminate: false });
  await backend.connect({ reset: false });
  t.is(backend.position, 2);
  await backend.step(1, "out");
  t.deepEqual(events.slice(-3), [
    { type: "stopped", reason: "entry", threadId: 1 },
    { type: "continued", threadId: 1, allThreads: false },
    { type: "terminated", restart: false },
  ]);
});

test("ReplayDebugBackend records explicit pull-based instruction traces", async (t) => {
  const backend = new ReplayDebugBackend(script);
  await backend.connect();
  await backend.startTrace({
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
  });
  await backend.step(1, "instruction");
  t.deepEqual(await backend.readTrace(1), {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    sequenceStart: 1,
    addresses: [0x808000],
    droppedEvents: 0,
    active: true,
  });
  await backend.stopTrace();
  t.deepEqual(await backend.readTrace(4), {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    sequenceStart: 2,
    addresses: [0x808001],
    droppedEvents: 0,
    active: false,
  });
  t.throws(
    () => backend.startTrace({ architecture: "snes.superfx", addressSpace: "superfx.rom" }),
    { message: /is not supported/ },
  );
  t.throws(() => backend.readTrace(0), { message: /between 1 and/ });
});

test("ReplayDebugBackend verifies only scripted addresses and replaces breakpoint sets", async (t) => {
  const backend = new ReplayDebugBackend(script);
  await backend.connect();
  const first = await backend.setBreakpoints([
    { architecture: "snes.65816", addressSpace: "snes.cpu", address: 0x808001 },
    { architecture: "snes.spc700", addressSpace: "spc.aram", address: 0x200 },
    { architecture: "snes.65816", addressSpace: "snes.cpu", address: 0xffffff },
  ]);
  t.deepEqual(
    first.map(({ verified }) => verified),
    [true, false, true],
  );

  const replacement = await backend.setBreakpoints([
    { architecture: "snes.65816", addressSpace: "snes.cpu", address: 0x808002 },
  ]);
  t.is(replacement.length, 1);
  t.true(replacement[0]?.verified);
});
