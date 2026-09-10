import { test } from "../../../tests/ava-helper.js";
import {
  DEBUG_SIDECAR_PROTOCOL,
  DEBUG_SIDECAR_PROTOCOL_VERSION,
  DEFAULT_DEBUG_SIDECAR_LIMITS,
  DebugSidecarClient,
  DebugSidecarMessageParser,
  encodeDebugSidecarMessage,
  type DebugSidecarEvent,
  type DebugSidecarMessage,
  type DebugSidecarTransport,
  type DebugSubscription,
} from "../src/index.js";

class MemoryTransport implements DebugSidecarTransport {
  readonly dataListeners = new Set<(data: Uint8Array) => void>();
  readonly closeListeners = new Set<(error?: Error) => void>();
  writes = 0;
  closes = 0;
  onWrite?: (data: Uint8Array) => void | Promise<void>;

  async write(data: Uint8Array): Promise<void> {
    this.writes++;
    await this.onWrite?.(data);
  }

  close(): Promise<void> {
    this.closes++;
    return Promise.resolve();
  }

  onData(listener: (data: Uint8Array) => void): DebugSubscription {
    this.dataListeners.add(listener);
    return { dispose: () => this.dataListeners.delete(listener) };
  }

  onClose(listener: (error?: Error) => void): DebugSubscription {
    this.closeListeners.add(listener);
    return { dispose: () => this.closeListeners.delete(listener) };
  }

  emitData(data: Uint8Array): void {
    for (const listener of this.dataListeners) listener(data);
  }

  emitClose(error?: Error): void {
    for (const listener of this.closeListeners) listener(error);
  }
}

const session = "a".repeat(43);

const serverMessage = (
  sequence: number,
  message: Omit<DebugSidecarMessage, "protocol" | "version" | "session" | "sequence">,
  token = session,
): DebugSidecarMessage =>
  ({
    protocol: DEBUG_SIDECAR_PROTOCOL,
    version: DEBUG_SIDECAR_PROTOCOL_VERSION,
    session: token,
    sequence,
    ...message,
  }) as DebugSidecarMessage;

test("sidecar client pairs ordered responses and publishes authenticated events", async (t) => {
  const transport = new MemoryTransport();
  const requests = new DebugSidecarMessageParser();
  let serverSequence = 1;
  transport.onWrite = (data) => {
    const [request] = requests.push(data);
    if (request?.type !== "request") throw new Error("Expected request.");
    transport.emitData(
      encodeDebugSidecarMessage(
        serverMessage(serverSequence++, {
          type: "response",
          requestSequence: request.sequence,
          success: true,
          result: { pong: true },
        }),
      ),
    );
  };
  const client = new DebugSidecarClient({ transport, session });
  t.deepEqual(await client.request("ping"), { pong: true });

  const events: DebugSidecarEvent[] = [];
  client.onEvent((event) => events.push(event));
  transport.emitData(
    encodeDebugSidecarMessage(
      serverMessage(serverSequence++, {
        type: "event",
        event: "stopped",
        body: { reason: "pause", threadId: 1 },
      }),
    ),
  );
  t.deepEqual(
    events.map(({ event, body }) => ({ event, body })),
    [{ event: "stopped", body: { reason: "pause", threadId: 1 } }],
  );
  await client.close();
  t.true(client.closed);
});

test("sidecar client fails closed on a mismatched session", async (t) => {
  const transport = new MemoryTransport();
  const requests = new DebugSidecarMessageParser();
  transport.onWrite = (data) => {
    const [request] = requests.push(data);
    if (request?.type !== "request") throw new Error("Expected request.");
    transport.emitData(
      encodeDebugSidecarMessage(
        serverMessage(
          1,
          {
            type: "response",
            requestSequence: request.sequence,
            success: true,
          },
          "b".repeat(43),
        ),
      ),
    );
  };
  const client = new DebugSidecarClient({ transport, session });
  const error = await t.throwsAsync(client.request("ping"));
  t.regex(error?.message ?? "", /session does not match/);
  t.true(client.closed);
  t.is(transport.closes, 1);
});

test("sidecar client times out, closes, and rejects every pending request", async (t) => {
  const transport = new MemoryTransport();
  const client = new DebugSidecarClient({ transport, session, requestTimeoutMs: 10 });
  const error = await t.throwsAsync(client.request("threads"));
  t.regex(error?.message ?? "", /timed out/);
  t.true(client.closed);
  t.is(transport.closes, 1);
});

test("sidecar client bounds pending requests and propagates transport failure", async (t) => {
  const transport = new MemoryTransport();
  const client = new DebugSidecarClient({
    transport,
    session,
    requestTimeoutMs: 1_000,
    limits: { ...DEFAULT_DEBUG_SIDECAR_LIMITS, maxQueuedMessages: 1 },
  });
  const first = client.request("threads");
  const overflow = await t.throwsAsync(client.request("registers"));
  t.regex(overflow?.message ?? "", /Too many pending/);
  const closeErrors: string[] = [];
  client.onClose((error) => closeErrors.push(error.message));
  transport.emitClose(new Error("native sidecar crashed"));
  const crash = await t.throwsAsync(first);
  t.is(crash?.message, "native sidecar crashed");
  t.deepEqual(closeErrors, ["native sidecar crashed"]);
  t.true(client.closed);

  const byteTransport = new MemoryTransport();
  const byteBounded = new DebugSidecarClient({
    transport: byteTransport,
    session,
    limits: { ...DEFAULT_DEBUG_SIDECAR_LIMITS, maxQueuedBytes: 1 },
  });
  const byteOverflow = await t.throwsAsync(byteBounded.request("ping"));
  t.regex(byteOverflow?.message ?? "", /request bytes exceed/);
  t.is(byteTransport.writes, 0);
  await byteBounded.close();
});
