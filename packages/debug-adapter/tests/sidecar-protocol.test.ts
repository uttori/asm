import { test } from "../../../tests/ava-helper.js";
import {
  DEBUG_SIDECAR_PROTOCOL,
  DEBUG_SIDECAR_PROTOCOL_VERSION,
  DEFAULT_DEBUG_SIDECAR_LIMITS,
  DebugSidecarMessageParser,
  DebugSidecarMessageQueue,
  assertDebugSidecarMessage,
  createDebugSidecarSessionToken,
  encodeDebugSidecarMessage,
  type DebugSidecarMessage,
  type DebugSidecarProtocolLimits,
  type DebugSidecarRequest,
} from "../src/index.js";

const session = "a".repeat(43);

const request = (
  sequence: number,
  command: DebugSidecarRequest["command"] = "ping",
  args?: Readonly<Record<string, unknown>>,
): DebugSidecarRequest => ({
  protocol: DEBUG_SIDECAR_PROTOCOL,
  version: DEBUG_SIDECAR_PROTOCOL_VERSION,
  session,
  sequence,
  type: "request",
  command,
  ...(args ? { arguments: args } : {}),
});

const limits = (overrides: Partial<DebugSidecarProtocolLimits> = {}) => ({
  ...DEFAULT_DEBUG_SIDECAR_LIMITS,
  ...overrides,
});

test("sidecar framing is fragmented-input safe and preserves strict message order", (t) => {
  const messages: DebugSidecarMessage[] = [
    request(1),
    {
      protocol: DEBUG_SIDECAR_PROTOCOL,
      version: DEBUG_SIDECAR_PROTOCOL_VERSION,
      session,
      sequence: 2,
      type: "response",
      requestSequence: 1,
      success: true,
      result: { pong: true },
    },
    {
      protocol: DEBUG_SIDECAR_PROTOCOL,
      version: DEBUG_SIDECAR_PROTOCOL_VERSION,
      session,
      sequence: 3,
      type: "event",
      event: "stopped",
      body: { reason: "entry", threadId: 1 },
    },
  ];
  const bytes = Buffer.concat(messages.map((message) => encodeDebugSidecarMessage(message)));
  const parser = new DebugSidecarMessageParser();
  t.deepEqual(parser.push(bytes.subarray(0, 3)), []);
  t.deepEqual(parser.push(bytes.subarray(3, 17)), []);
  t.deepEqual(parser.push(bytes.subarray(17)), messages);
});

test("sidecar protocol rejects replayed sequences, invalid versions, and malformed frames", (t) => {
  const parser = new DebugSidecarMessageParser();
  parser.push(encodeDebugSidecarMessage(request(2)));
  const replay = t.throws(() => parser.push(encodeDebugSidecarMessage(request(1))));
  t.regex(replay?.message ?? "", /not greater than 2/);

  const wrongVersion = { ...request(1), version: 99 };
  const version = t.throws(() => assertDebugSidecarMessage(wrongVersion));
  t.regex(version?.message ?? "", /protocol version/);

  const malformed = new DebugSidecarMessageParser();
  const frame = Buffer.from([0, 0, 0, 1, 0xff]);
  const json = t.throws(() => malformed.push(frame));
  t.regex(json?.message ?? "", /invalid JSON/);

  const oversized = new DebugSidecarMessageParser(limits({ maxFrameBytes: 32 }));
  const header = Buffer.alloc(4);
  header.writeUInt32BE(33);
  const size = t.throws(() => oversized.push(header));
  t.regex(size?.message ?? "", /above the configured limit/);
});

test("sidecar request limits reject unsafe emulator work before dispatch", (t) => {
  const memory = t.throws(() =>
    assertDebugSidecarMessage(
      request(1, "readMemory", { count: DEFAULT_DEBUG_SIDECAR_LIMITS.maxMemoryReadBytes + 1 }),
    ),
  );
  t.regex(memory?.message ?? "", /Memory read count/);

  const disassembly = t.throws(() =>
    assertDebugSidecarMessage(request(1, "disassemble", { count: -1 })),
  );
  t.regex(disassembly?.message ?? "", /Disassembly count/);

  const breakpoints = t.throws(() =>
    assertDebugSidecarMessage(
      request(1, "setBreakpoints", {
        breakpoints: Array.from(
          { length: DEFAULT_DEBUG_SIDECAR_LIMITS.maxBreakpoints + 1 },
          () => ({}),
        ),
      }),
    ),
  );
  t.regex(breakpoints?.message ?? "", /Breakpoint count/);

  const trace = t.throws(() =>
    assertDebugSidecarMessage(
      request(1, "readTrace", { maxEvents: DEFAULT_DEBUG_SIDECAR_LIMITS.maxTraceBatchEvents + 1 }),
    ),
  );
  t.regex(trace?.message ?? "", /Trace batch size/);
});

test("sidecar sessions are unpredictable and outgoing backpressure is bounded", (t) => {
  const first = createDebugSidecarSessionToken();
  const second = createDebugSidecarSessionToken();
  t.regex(first, /^[\w-]{43}$/);
  t.not(first, second);

  const queue = new DebugSidecarMessageQueue(
    limits({
      maxFrameBytes: 1_024,
      maxBufferedBytes: 2_048,
      maxQueuedMessages: 1,
      maxQueuedBytes: 1_024,
    }),
  );
  queue.enqueue(request(1));
  t.is(queue.length, 1);
  t.true(queue.bytes > 0);
  const overflow = t.throws(() => queue.enqueue(request(2)));
  t.regex(overflow?.message ?? "", /backpressure limit/);
  t.truthy(queue.dequeue());
  t.is(queue.length, 0);
  t.is(queue.bytes, 0);
});
