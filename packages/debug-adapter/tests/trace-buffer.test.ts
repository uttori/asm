import { test } from "../../../tests/ava-helper.js";
import { DebugTraceBuffer } from "../src/index.js";

test("DebugTraceBuffer bounds producer memory and exposes ordered oldest-first loss", (t) => {
  const trace = new DebugTraceBuffer({
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    capacity: 3,
  });
  trace.start();
  for (const address of [0x808000, 0x808001, 0x808002, 0x808003, 0x808004]) {
    trace.append(address);
  }
  t.is(trace.bufferedEvents, 3);
  t.deepEqual(trace.read(2), {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    sequenceStart: 3,
    addresses: [0x808002, 0x808003],
    droppedEvents: 2,
    active: true,
  });
  trace.stop();
  trace.append(0xffffff);
  t.deepEqual(trace.read(4), {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    sequenceStart: 5,
    addresses: [0x808004],
    droppedEvents: 2,
    active: false,
  });
});

test("DebugTraceBuffer validates identities, bounds, addresses, and batch sizes", (t) => {
  t.throws(() => new DebugTraceBuffer({ architecture: "", addressSpace: "cpu", capacity: 1 }), {
    message: /architecture/,
  });
  t.throws(() => new DebugTraceBuffer({ architecture: "cpu", addressSpace: "", capacity: 1 }), {
    message: /address space/,
  });
  t.throws(() => new DebugTraceBuffer({ architecture: "cpu", addressSpace: "code", capacity: 0 }), {
    message: /capacity/,
  });
  t.throws(
    () =>
      new DebugTraceBuffer({
        architecture: "cpu",
        addressSpace: "code",
        capacity: Number.MAX_SAFE_INTEGER + 1,
      }),
    { message: /capacity/ },
  );
  const trace = new DebugTraceBuffer({ architecture: "cpu", addressSpace: "code", capacity: 1 });
  trace.start();
  t.throws(() => trace.append(-1), { message: /Trace address/ });
  t.throws(() => trace.read(0), { message: /batch size/ });
});
