import type { DebugSubscription } from "@uttori/asm-debug-adapter";

import { FramedMesenDebugClient, type MesenDebugTransport } from "../src/mesen-debug-client.js";
import { test } from "../../../tests/ava-helper.js";

const token = "ab".repeat(32);

class FakeTransport implements MesenDebugTransport {
  readonly writes: Uint8Array[] = [];
  readonly #dataListeners = new Set<(data: Uint8Array) => void>();
  readonly #closeListeners = new Set<(error?: Error) => void>();
  closed = false;

  async write(data: Uint8Array): Promise<void> {
    await Promise.resolve();
    if (this.closed) throw new Error("fake transport closed");
    this.writes.push(new Uint8Array(data));
  }

  async close(): Promise<void> {
    await Promise.resolve();
    if (this.closed) return;
    this.closed = true;
    for (const listener of this.#closeListeners) listener();
  }

  onData(listener: (data: Uint8Array) => void): DebugSubscription {
    this.#dataListeners.add(listener);
    return { dispose: () => this.#dataListeners.delete(listener) };
  }

  onClose(listener: (error?: Error) => void): DebugSubscription {
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }

  feed(data: Uint8Array): void {
    for (const listener of this.#dataListeners) listener(data);
  }

  fail(error: Error): void {
    for (const listener of this.#closeListeners) listener(error);
  }
}

const frame = (value: unknown): Buffer => {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  return rawFrame(body);
};

const rawFrame = (body: Uint8Array): Buffer => {
  const packet = Buffer.allocUnsafe(body.length + 4);
  packet.writeUInt32BE(body.length, 0);
  packet.set(body, 4);
  return packet;
};

const sentRequest = (data: Uint8Array): Readonly<Record<string, unknown>> => {
  const buffer = Buffer.from(data);
  return JSON.parse(buffer.subarray(4, buffer.readUInt32BE(0) + 4).toString("utf8")) as Readonly<
    Record<string, unknown>
  >;
};

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("framed Mesen client authenticates and parses fragmented ordered responses", async (t) => {
  const transport = new FakeTransport();
  const client = new FramedMesenDebugClient({ transport, token });
  const hello = client.request("hello");
  await flush();
  const request = sentRequest(transport.writes[0] ?? new Uint8Array());
  t.is(request.version, 1);
  t.is(request.token, token);
  t.is(request.id, 1);
  const response = frame({ version: 1, id: 1, ok: true, result: { emulator: "MesenCE" } });
  transport.feed(response.subarray(0, 3));
  transport.feed(response.subarray(3));
  t.deepEqual(await hello, { emulator: "MesenCE" });
  await client.close();
});

test("framed Mesen client bounds its sequential queue and continues after native errors", async (t) => {
  const transport = new FakeTransport();
  const client = new FramedMesenDebugClient({
    transport,
    token,
    maxQueuedRequests: 2,
    maxQueuedBytes: 65_540,
  });
  const first = client.request("status");
  const second = client.request("pause");
  await t.throwsAsync(client.request("resume"), {
    message: "Mesen debug request queue exceeds 2 requests.",
  });
  await flush();
  t.is(transport.writes.length, 1);
  transport.feed(frame({ version: 1, id: 1, ok: false, error: "bad state" }));
  await t.throwsAsync(first, { message: "Mesen status failed: bad state" });
  await flush();
  t.is(transport.writes.length, 2);
  transport.feed(frame({ version: 1, id: 2, ok: true, result: { stopped: true } }));
  t.deepEqual(await second, { stopped: true });
  t.false(client.closed);
  await client.close();
});

test("framed Mesen client fails closed on out-of-order and oversized responses", async (t) => {
  const transport = new FakeTransport();
  const client = new FramedMesenDebugClient({ transport, token, maxResponseBytes: 32 });
  const pending = client.request("hello");
  await flush();
  transport.feed(frame({ version: 1, id: 2, ok: true, result: null }));
  await t.throwsAsync(pending, {
    message: "Mesen debug receive buffer exceeds 36 bytes.",
  });
  t.true(client.closed);

  const secondTransport = new FakeTransport();
  const second = new FramedMesenDebugClient({ transport: secondTransport, token });
  const secondPending = second.request("hello");
  await flush();
  secondTransport.feed(frame({ version: 1, id: 9, ok: true, result: null }));
  await t.throwsAsync(secondPending, { message: "Mesen debug response id 9 is out of order." });
  t.true(second.closed);
});

test("framed Mesen client validates tokens and propagates transport loss", async (t) => {
  t.throws(() => new FramedMesenDebugClient({ transport: new FakeTransport(), token: "short" }), {
    message: "Mesen debug token must contain 256 bits of hexadecimal data.",
  });
  const transport = new FakeTransport();
  const client = new FramedMesenDebugClient({ transport, token });
  const pending = client.request("hello");
  transport.fail(new Error("native socket failed"));
  await t.throwsAsync(pending, { message: "native socket failed" });
  t.true(client.closed);
});

test("framed Mesen client rejects malformed requests and configuration bounds", async (t) => {
  t.throws(
    () =>
      new FramedMesenDebugClient({
        transport: new FakeTransport(),
        token,
        requestTimeoutMs: 0,
      }),
    { message: /positive safe integer/ },
  );
  t.throws(
    () =>
      new FramedMesenDebugClient({
        transport: new FakeTransport(),
        token,
        maxRequestBytes: 64,
        maxQueuedBytes: 64,
      }),
    { message: /must hold one maximum-sized request frame/ },
  );

  const invalidMethod = new FramedMesenDebugClient({ transport: new FakeTransport(), token });
  await t.throwsAsync(invalidMethod.request("bad-method"), { message: /invalid name/ });
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  await t.throwsAsync(invalidMethod.request("status", cyclic), { instanceOf: TypeError });
  await invalidMethod.close();
  await invalidMethod.close();
  await t.throwsAsync(invalidMethod.request("status"), { message: /client is closed/ });
  const closed = await new Promise<Error | undefined>((resolve) => invalidMethod.onClose(resolve));
  t.is(closed?.message, "Mesen debug client closed.");

  const oversizedTransport = new FakeTransport();
  const oversized = new FramedMesenDebugClient({
    transport: oversizedTransport,
    token,
    maxRequestBytes: 80,
  });
  await t.throwsAsync(oversized.request("status", { value: "x".repeat(80) }), {
    message: /request exceeds 80 bytes/,
  });
  await oversized.close();

  const byteBoundTransport = new FakeTransport();
  const byteBound = new FramedMesenDebugClient({
    transport: byteBoundTransport,
    token,
    maxRequestBytes: 180,
    maxQueuedBytes: 220,
  });
  const retained = byteBound.request("status");
  await t.throwsAsync(byteBound.request("pause"), { message: /queue exceeds 220 bytes/ });
  await byteBound.close();
  await t.throwsAsync(retained, { message: /client closed/ });
});

test("framed Mesen client fails closed on every malformed response envelope", async (t) => {
  const cases: readonly [Uint8Array, RegExp][] = [
    [rawFrame(Buffer.from("{")), /not valid UTF-8 JSON/],
    [frame(null), /response must be an object/],
    [frame({ version: 2, id: 1, ok: true }), /unsupported protocol version/],
    [frame({ version: 1, id: 1 }), /lacks ok state/],
    [frame({ version: 1, id: 1, ok: false, error: "" }), /lacks a message/],
  ];
  for (const [response, message] of cases) {
    const transport = new FakeTransport();
    const client = new FramedMesenDebugClient({ transport, token });
    const pending = client.request("status");
    await flush();
    transport.feed(response);
    await t.throwsAsync(pending, { message });
    t.true(client.closed);
  }

  const unsolicitedTransport = new FakeTransport();
  const unsolicited = new FramedMesenDebugClient({ transport: unsolicitedTransport, token });
  unsolicitedTransport.feed(frame({ version: 1, id: 1, ok: true }));
  t.true(unsolicited.closed);

  const emptyTransport = new FakeTransport();
  const empty = new FramedMesenDebugClient({ transport: emptyTransport, token });
  const pending = empty.request("status");
  await flush();
  emptyTransport.feed(Buffer.alloc(4));
  await t.throwsAsync(pending, { message: /response length 0/ });
});
