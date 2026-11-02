import { EventEmitter } from "node:events";
import net from "node:net";

import type { DebugSubscription } from "@uttori/asm-debug-adapter";
import sinon from "sinon";

import { test } from "../ava-helper.js";

/** Common transport contract exercised independently for each sidecar implementation. */
interface TcpTransport {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  onData(listener: (data: Uint8Array) => void): DebugSubscription;
  onClose(listener: (error?: Error) => void): DebugSubscription;
}

interface TcpOptions {
  host?: string;
  port: number;
  connectTimeoutMs?: number;
  shutdownTimeoutMs?: number;
}

/** The transport only needs the socket methods this double implements. */
function isNetSocket(value: ControlledSocket): value is ControlledSocket & net.Socket {
  return (
    typeof value.connect === "function" &&
    typeof value.setNoDelay === "function" &&
    typeof value.write === "function" &&
    typeof value.end === "function" &&
    typeof value.destroy === "function"
  );
}

function netSocket(value: ControlledSocket): net.Socket {
  if (!isNetSocket(value)) {
    throw new Error("Controlled socket is missing the Node socket methods the transport calls.");
  }
  return value;
}

/** Manually driven socket keeps connection races and deadlines deterministic without a network. */
class ControlledSocket extends EventEmitter {
  destroyed = false;
  /** Tests disable automatic closure to exercise the shutdown deadline. */
  closeOnEnd = true;
  readonly connect = sinon.stub();
  readonly setNoDelay = sinon.stub();
  readonly write = sinon
    .stub()
    .callsFake((_data: Uint8Array, done: (error?: Error) => void) => done());
  readonly end = sinon.stub().callsFake(() => {
    if (this.closeOnEnd) {
      this.emit("close");
    }
  });
  readonly destroy = sinon.stub().callsFake(() => {
    this.destroyed = true;
    this.emit("close");
  });
}

/** Install one owned socket and restore global stubs even when an assertion fails. */
const setup = (t: { teardown(callback: () => void): void }) => {
  const socket = new ControlledSocket();
  const constructor = sinon.stub(net, "Socket").returns(netSocket(socket));
  const clock = sinon.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  t.teardown(() => {
    constructor.restore();
    clock.restore();
  });
  return { socket, clock };
};

/**
 * Register serial cases because each test temporarily replaces Node's socket constructor.
 * @param connect Production transport factory.
 */
export function testTcpTransport(connect: (options: TcpOptions) => Promise<TcpTransport>): void {
  test.serial("TCP validates endpoints and deadlines before allocating a socket", async (t) => {
    const constructor = sinon.stub(net, "Socket");
    t.teardown(() => constructor.restore());
    for (const host of ["localhost", "0.0.0.0", "192.0.2.1"]) {
      await t.throwsAsync(connect({ host, port: 1234 }), {
        message: /numeric loopback/,
      });
    }
    for (const port of [0, -1, 65_536, 1.5, NaN]) {
      await t.throwsAsync(connect({ port }), { message: /port must be an integer/ });
    }
    for (const name of ["connectTimeoutMs", "shutdownTimeoutMs"] as const) {
      for (const value of [0, -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        await t.throwsAsync(connect({ port: 1234, [name]: value }), {
          message: /positive safe integer/,
        });
      }
    }
    t.false(constructor.called);
  });

  test.serial(
    "TCP forwards bytes, disposes subscriptions, and reports write failures",
    async (t) => {
      const { socket, clock } = setup(t);
      const pending = connect({ port: 1234 });
      t.deepEqual(socket.connect.firstCall.args, [1234, "127.0.0.1"]);
      socket.emit("connect");
      const transport = await pending;
      t.true(socket.setNoDelay.calledWithExactly(true));
      t.is(clock.countTimers(), 0);
      const data = sinon.spy();
      const subscription = transport.onData(data);
      const bytes = Buffer.from([0, 255]);
      socket.emit("data", bytes);
      socket.emit("data", "packet");
      t.is(data.firstCall.args[0], bytes);
      t.deepEqual(data.secondCall.args[0], Buffer.from("packet"));
      subscription.dispose();
      socket.emit("data", bytes);
      t.is(data.callCount, 2);
      await transport.write(bytes);
      t.is(socket.write.firstCall.args[0], bytes);
      const error = new Error("write failed");
      socket.write.callsFake((_data: Uint8Array, done: (error: Error) => void) => done(error));
      await t.throwsAsync(transport.write(bytes), { is: error });
      await transport.close();
    },
  );

  test.serial("TCP connection errors clean up listeners and cancel the deadline", async (t) => {
    const { socket, clock } = setup(t);
    const pending = connect({ host: "::1", port: 65_535 });
    const failure = new Error("connection refused");
    const assertion = t.throwsAsync(pending, { is: failure });
    socket.emit("error", failure);
    await assertion;
    t.deepEqual(socket.connect.firstCall.args, [65_535, "::1"]);
    t.true(socket.destroy.calledOnce);
    t.is(socket.listenerCount("connect"), 0);
    t.is(socket.listenerCount("error"), 0);
    t.is(clock.countTimers(), 0);
  });

  test.serial("TCP connection deadlines destroy stalled sockets", async (t) => {
    const { socket, clock } = setup(t);
    const pending = connect({ port: 1234, connectTimeoutMs: 25 });
    const assertion = t.throwsAsync(pending, { message: /1234 timed out/ });
    await clock.tickAsync(24);
    t.false(socket.destroy.called);
    await clock.tickAsync(1);
    await assertion;
    t.true(socket.destroy.calledOnce);
    t.is(socket.listenerCount("connect"), 0);
    t.is(socket.listenerCount("error"), 0);
  });

  test.serial(
    "TCP close notifies once, preserves errors, and handles late subscribers",
    async (t) => {
      const { socket } = setup(t);
      const pending = connect({ port: 1 });
      socket.emit("connect");
      const transport = await pending;
      const removed = sinon.spy();
      transport.onClose(removed).dispose();
      const closed = sinon.spy();
      transport.onClose(closed);
      const data = sinon.spy();
      transport.onData(data);
      const error = new Error("connection reset");
      socket.emit("error", error);
      socket.emit("close");
      socket.emit("close");
      socket.emit("data", Buffer.from("ignored"));
      await transport.close();
      t.true(closed.calledOnceWithExactly(error));
      t.false(removed.called);
      t.false(data.called);
      const late = sinon.spy();
      const subscription = transport.onClose(late);
      t.false(late.called);
      await Promise.resolve();
      t.true(late.calledOnceWithExactly(error));
      subscription.dispose();
      await t.throwsAsync(transport.write(new Uint8Array()), { message: /transport is closed/ });
    },
  );

  test.serial("TCP graceful shutdown cancels its timer and is idempotent", async (t) => {
    const { socket, clock } = setup(t);
    const pending = connect({ port: 1234 });
    socket.emit("connect");
    const transport = await pending;
    const closed = sinon.spy();
    transport.onClose(closed);
    await transport.close();
    await transport.close();
    t.true(socket.end.calledOnce);
    t.false(socket.destroy.called);
    t.true(closed.calledOnceWithExactly(undefined));
    t.is(clock.countTimers(), 0);
  });

  test.serial("TCP shutdown deadline forces an unresponsive peer to close", async (t) => {
    const { socket, clock } = setup(t);
    const pending = connect({ port: 1234, shutdownTimeoutMs: 20 });
    socket.emit("connect");
    const transport = await pending;
    socket.closeOnEnd = false;
    const closing = transport.close();
    await clock.tickAsync(19);
    t.false(socket.destroy.called);
    await clock.tickAsync(1);
    await closing;
    t.true(socket.destroy.calledOnce);
    t.is(clock.countTimers(), 0);
  });

  test.serial("TCP closing an already destroyed socket still notifies subscribers", async (t) => {
    const { socket } = setup(t);
    const pending = connect({ port: 1234 });
    socket.emit("connect");
    const transport = await pending;
    const closed = sinon.spy();
    transport.onClose(closed);
    // Node can mark the socket destroyed before delivering its close event.
    socket.destroyed = true;
    await transport.close();
    socket.emit("close");
    t.true(closed.calledOnce);
    t.false(socket.end.called);
  });
}
