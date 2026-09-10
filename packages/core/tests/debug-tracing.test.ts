import { test } from "../../../tests/ava-helper.js";
import {
  createTraceCollector,
  formatTraceEvent,
  type AssemblerTraceCommandEvent,
  type AssemblerTraceWriteEvent,
  type TraceCollectorOptions,
} from "../src/debug-tracing.js";

const write: AssemblerTraceWriteEvent = {
  type: "write",
  stage: "emitProgram",
  arch: "cpu",
  file: "src/main.asm",
  line: 3,
  raw: "db $EA",
  normalized: "db $EA",
  logicalAddress: 0x8000,
  outputOffset: 0,
  value: 0xea,
};
const command: AssemblerTraceCommandEvent = {
  ...write,
  type: "command-end",
  endLogicalAddress: 0x8004,
  bytesWritten: 4,
};

test("trace collectors retain event snapshots and clear their existing array", (t) => {
  const collector = createTraceCollector();
  const event = { ...write };
  collector.listener(event);
  event.value = 0;
  t.deepEqual(collector.events, [write]);
  t.not(collector.events[0], event);
  const events = collector.events;
  collector.clear();
  t.is(collector.events, events);
  t.deepEqual(events, []);
});

test("trace range filters include crossing command spans and inclusive endpoints", (t) => {
  for (const options of [
    { startAddress: 0x8000, endAddress: 0x8000 },
    { startAddress: 0x8002, endAddress: 0x8003 },
    { startAddress: 0x8004 },
    { endAddress: 0x8000 },
  ]) {
    const collector = createTraceCollector(options);
    collector.listener(command);
    t.deepEqual(collector.events, [command]);
  }
  for (const options of [{ startAddress: 0x8005 }, { endAddress: 0x7fff }]) {
    const collector = createTraceCollector(options);
    collector.listener(command);
    collector.listener(write);
    t.deepEqual(collector.events, []);
  }
  const collector = createTraceCollector({ startAddress: 0x8001 });
  collector.listener({ ...command, endLogicalAddress: undefined });
  t.deepEqual(collector.events, []);
});

test("trace filters combine stage, architecture, event kind, and source matches", (t) => {
  const options: TraceCollectorOptions = {
    stage: "emitProgram",
    arch: "cpu",
    eventTypes: ["write"],
    fileIncludes: ["other", "main.asm"],
  };
  const collector = createTraceCollector(options);
  collector.listener(write);
  collector.listener({ ...write, stage: "resolveLayout" });
  collector.listener({ ...write, arch: "other" });
  collector.listener(command);
  collector.listener({ ...write, file: "unrelated.asm" });
  t.deepEqual(collector.events, [write]);
  const unrestrictedFiles = createTraceCollector({ fileIncludes: [] });
  unrestrictedFiles.listener(write);
  t.is(unrestrictedFiles.events.length, 1);
  const noEvents = createTraceCollector({ eventTypes: [] });
  noEvents.listener(write);
  t.deepEqual(noEvents.events, []);
});

test("trace formatting uses stable hex widths, masks bytes, and includes command completion", (t) => {
  t.is(
    formatTraceEvent({ ...write, value: 0x1ea }),
    "stage=emitProgram arch=cpu addr=$008000 offset=$000000 value=$EA src/main.asm:3 db $EA",
  );
  t.is(
    formatTraceEvent({ ...command, addressWidth: 16 }),
    "stage=emitProgram arch=cpu command-end addr=$8000 src/main.asm:3 db $EA end=$8004 bytes=4",
  );
  t.is(
    formatTraceEvent({ ...command, endLogicalAddress: undefined, bytesWritten: undefined }),
    "stage=emitProgram arch=cpu command-end addr=$008000 src/main.asm:3 db $EA end=$008000 bytes=0",
  );
  t.is(
    formatTraceEvent({ ...command, type: "command-start" }),
    "stage=emitProgram arch=cpu command-start addr=$008000 src/main.asm:3 db $EA",
  );
});
