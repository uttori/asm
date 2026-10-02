import type { DebugSubscription } from "@uttori/asm-debug-adapter";

import { test } from "../../../tests/ava-helper.js";
import { GdbRspClient, type GdbRspStop, type GdbRspTransport } from "../src/index.js";

class FakeTransport implements GdbRspTransport {
  readonly writes: Uint8Array[] = [];
  readonly #dataListeners = new Set<(data: Uint8Array) => void>();
  readonly #closeListeners = new Set<(error?: Error) => void>();
  closed = false;

  async write(data: Uint8Array): Promise<void> {
    if (this.closed) {
      throw new Error("fake transport closed");
    }
    this.writes.push(new Uint8Array(data));
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const listener of this.#closeListeners) {
      listener();
    }
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
    for (const listener of this.#dataListeners) {
      listener(bytes);
    }
  }

  fail(error: Error): void {
    for (const listener of this.#closeListeners) {
      listener(error);
    }
  }
}

const packet = (payload: string, checksumOverride?: string): string => {
  const bytes = Buffer.from(payload, "ascii");
  let sum = 0;
  for (const byte of bytes) {
    sum = (sum + byte) & 0xff;
  }
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
  t.is(error.message, "ares exited");
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

test("large capture replies survive fragmentation, buffer reuse and transport-owned input", async (t) => {
  const transport = new FakeTransport();
  const client = new GdbRspClient({ transport, maxPacketBytes: 524288, maxBufferedBytes: 524292 });
  t.teardown(() => client.close());
  await client.start();
  const payload = "0123456789abcdef".repeat(32768);
  const bytes = Buffer.from(packet(payload), "ascii");
  // Odd fragments split payload/checksum positions differently. Single-byte input
  // exercises growth and delimiter scanning without any timing-based assertion.
  for (const width of [65536, 1023, 1]) {
    const response = client.request("qUttoriCapture:read:test:1");
    for (let offset = 0; offset < bytes.length; offset += width) {
      const fragment = Buffer.from(bytes.subarray(offset, offset + width));
      transport.feed(fragment);
      fragment.fill(0); // A retained view into the caller's fragment would corrupt the packet.
    }
    t.is(await response, payload);
    const small = client.request("p0");
    transport.feed("+");
    transport.feed("$");
    transport.feed("1"); // Old '#' bytes in retained capacity must not terminate this packet.
    transport.feed("2#63");
    t.is(await small, "12");
  }
});

test("coalesced stop replies and incomplete tails survive receive-buffer compaction", async (t) => {
  const transport = new FakeTransport();
  const client = new GdbRspClient({ transport, maxPacketBytes: 32, maxBufferedBytes: 40 });
  const stops: GdbRspStop[] = [];
  client.onStop((event) => stops.push(event));
  t.teardown(() => client.close());
  await client.start();
  const response = client.request("g");
  const payload = "ab".repeat(16);
  const wire = packet(payload);
  // First delivery consumes an unsolicited stop but retains the partial register reply.
  // Its tail cannot fit at the old write offset, though the unconsumed packet fits the bound.
  transport.feed(`noise+${packet("S05")}${wire.slice(0, 15)}`);
  transport.feed(wire.slice(15));
  t.is(await response, payload);
  t.deepEqual(
    stops.map((event) => event.payload),
    ["S05"],
  );
  transport.feed(packet("T02"));
  t.deepEqual(
    stops.map((event) => event.payload),
    ["S05", "T02"],
  );
});

test("escape decoding handles every fragmentation boundary and rejects unsupported RLE", async (t) => {
  // Escaped '#', '$', '*', '}' and an escaped wire '*' (decoded newline).
  const encoded = "prefix}\x03}\x04}\x0a}\x5d}\x2asuffix";
  const expected = "prefix#$*}\nsuffix";
  const wire = packet(encoded);
  for (let split = 0; split <= wire.length; split++) {
    const transport = new FakeTransport();
    const client = new GdbRspClient({ transport });
    await client.start();
    const response = client.request("qXfer:features:read:target.xml:0,fff");
    transport.feed(wire.slice(0, split));
    transport.feed(wire.slice(split));
    t.is(await response, expected);
    await client.close();
  }
  for (const [payload, message] of [
    ["raw*run", /run-length/],
    ["escaped}\x0a*run", /run-length/],
    ["incomplete}", /escape sequence/],
  ] as const) {
    const transport = new FakeTransport();
    const client = new GdbRspClient({ transport });
    await client.start();
    const response = client.request("g");
    transport.feed(packet(payload));
    await t.throwsAsync(response, { message });
    t.true(client.closed);
  }
});

test("both checksum bytes must be hexadecimal, with bad packets retried before acceptance", async (t) => {
  const transport = new FakeTransport();
  const client = new GdbRspClient({ transport });
  t.teardown(() => client.close());
  await client.start();
  const response = client.request("g");
  // 'aaa' sums to 0x23, while ASCII byte 1 sums to 0x01: parseInt('1g', 16)
  // would wrongly accept the latter. High-bit bytes must not become ASCII digits.
  for (const bad of ["$aaa#2g", "$\x01#1g", "$aaa# 3", "$aaa#-d", "$aaa#\xb2\xb3"]) {
    transport.feed(Buffer.from(bad, "latin1"));
    await flushWrites();
    t.is(transport.writes.map(text).at(-1), "-");
    t.false(client.closed);
  }
  transport.feed(packet("aaa"));
  t.is(await response, "aaa");
  const upper = client.request("g");
  transport.feed(packet("zz", "F4"));
  t.is(await upper, "zz");
});

test("framing enforces exact packet bounds and supports empty replies and reentrant stops", async (t) => {
  const transport = new FakeTransport();
  const client = new GdbRspClient({ transport, maxPacketBytes: 8, maxBufferedBytes: 24 });
  t.teardown(() => client.close());
  await client.start();
  client.onStop(() => transport.feed(packet("OK")));
  const response = client.request("g");
  transport.feed(packet("S05"));
  t.is(await response, "OK");
  const empty = client.request("qUnknown");
  for (const byte of packet("")) {
    transport.feed(byte);
  }
  t.is(await empty, "");
  const maximum = client.request("g");
  transport.feed(packet("12345678"));
  t.is(await maximum, "12345678");
  const exceeded = client.request("g");
  transport.feed("$12345678");
  transport.feed("9");
  await t.throwsAsync(exceeded, { message: "RSP packet exceeds 8 bytes." });
  t.true(client.closed);
});
