import type { DebugSubscription } from "@uttori/asm-debug-adapter";

import { GdbRspClient, type GdbRspStop, type GdbRspTransport } from "../src/index.js";
import { test } from "../../../tests/ava-helper.js";

class FakeTransport implements GdbRspTransport {
  readonly writes: Uint8Array[] = [];
  readonly #dataListeners = new Set<(data: Uint8Array) => void>();
  readonly #closeListeners = new Set<(error?: Error) => void>();
  closed = false;

  async write(data: Uint8Array): Promise<void> {
    if (this.closed) throw new Error("fake transport closed");
    this.writes.push(new Uint8Array(data));
  }

  async close(): Promise<void> {
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

  feed(data: Uint8Array | string): void {
    const bytes = typeof data === "string" ? Buffer.from(data, "ascii") : data;
    for (const listener of this.#dataListeners) listener(bytes);
  }

  fail(error: Error): void {
    for (const listener of this.#closeListeners) listener(error);
  }
}

const packet = (payload: string, checksumOverride?: string): string => {
  const bytes = Buffer.from(payload, "ascii");
  let sum = 0;
  for (const byte of bytes) sum = (sum + byte) & 0xff;
  return `$${payload}#${checksumOverride ?? sum.toString(16).padStart(2, "0")}`;
};

const text = (value: Uint8Array): string => Buffer.from(value).toString("ascii");
const flushWrites = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("RSP client starts with acknowledgement and parses fragmented checked responses", async (t) => {
  const transport = new FakeTransport();
  const client = new GdbRspClient({ transport });
  await client.start();
  t.deepEqual(transport.writes.map(text), ["+"]);

  const response = client.request("qSupported");
  await Promise.resolve();
  t.regex(transport.writes.map(text).at(-1) ?? "", /^\$qSupported#[\da-f]{2}$/);
  const reply = `+${packet("PacketSize=4096")}`;
  transport.feed(reply.slice(0, 7));
  transport.feed(reply.slice(7));
  t.is(await response, "PacketSize=4096");
  await flushWrites();
  t.is(transport.writes.map(text).at(-1), "+");
});

test("RSP client rejects bad checksums, accepts retry, and separates stop events", async (t) => {
  const transport = new FakeTransport();
  const client = new GdbRspClient({ transport });
  const stops: GdbRspStop[] = [];
  client.onStop((event) => stops.push(event));
  await client.start();

  const register = client.request("p0");
  transport.feed(packet("3412", "00"));
  await flushWrites();
  t.is(transport.writes.map(text).at(-1), "-");
  transport.feed(packet("3412"));
  t.is(await register, "3412");

  await client.continue();
  transport.feed(packet("S05"));
  t.deepEqual(stops, [{ signal: 5, payload: "S05" }]);

  const initialStop = client.requestStop("?");
  transport.feed(packet("T05"));
  t.is(await initialStop, "T05");
  t.is(stops.length, 1);
});

test("RSP client fails closed when the transport closes with a pending request", async (t) => {
  const transport = new FakeTransport();
  const client = new GdbRspClient({ transport, requestTimeoutMs: 100 });
  await client.start();
  const response = client.request("m808000,4");
  transport.fail(new Error("ares exited"));
  const error = await t.throwsAsync(response);
  t.is(error?.message, "ares exited");
  t.true(client.closed);
  await t.throwsAsync(client.request("g"), { message: "RSP client is closed." });
});

test("RSP client enforces packet and receive-buffer bounds", async (t) => {
  const transport = new FakeTransport();
  const client = new GdbRspClient({
    transport,
    maxPacketBytes: 8,
    maxBufferedBytes: 12,
  });
  await client.start();
  await t.throwsAsync(client.request("123456789"), {
    message: "RSP payload exceeds 8 bytes.",
  });
  transport.feed("$123456789012");
  t.true(client.closed);
  t.true(transport.closed);
});
