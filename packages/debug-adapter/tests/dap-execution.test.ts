import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { AddressToLineMapping, createDebugMap } from "@uttori/asm-core";
import type { ExecutionContext } from "ava";
import sinon from "sinon";

import { test } from "../../../tests/ava-helper.js";
import { DebugAdapterSession, DebugSidecarClient, DebugSidecarServer, DebugSidecarMessageParser, SidecarDebugBackend, createDebugSidecarSessionToken, type DapProtocolMessage, type DebugBackend, type DebugSidecarTransport } from "../src/index.js";
import { ControlledExecutionBackend } from "./fixtures/controlled-execution-backend.js";

const ignoreSidecarFrame = (): void => undefined;

/** Returns the indexed element, or undefined when the index is past the end. */
const elementAt = <T>(items: readonly T[], index: number): T | undefined =>
  index >= 0 && index < items.length ? items[index] : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const eventReason = (body: unknown): string | undefined => {
  if (!isRecord(body) || typeof body.reason !== "string") {
    return undefined;
  }
  return body.reason;
};

const breakpointVerified = (body: unknown): boolean => {
  if (
    !isRecord(body) ||
    !isRecord(body.breakpoint) ||
    typeof body.breakpoint.verified !== "boolean"
  ) {
    throw new Error("Expected a breakpoint event body.");
  }
  return body.breakpoint.verified;
};

/** Two mapped files let execution tests also detect lost per-source breakpoint updates. */
const setup = (
  t: ExecutionContext,
  wrap?: (backend: ControlledExecutionBackend) => DebugBackend,
) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-dap-execution-"));
  const sources = ["main.asm", "included.asm"].map((name) => path.join(directory, name));
  const mapping = new AddressToLineMapping();
  for (const [index, source] of sources.entries()) {
    fs.writeFileSync(source, "; comment\nnop\n");
    mapping.includeByte(source, 2, "snes.65816", "snes.cpu", 0x808000 + index, index);
  }
  const output = Uint8Array.from([0xea, 0xea]);
  const backend = new ControlledExecutionBackend();
  const messages: DapProtocolMessage[] = [];
  const session = new DebugAdapterSession({
    backend: wrap ? wrap(backend) : backend,
    debugMap: createDebugMap({ target: "snes.sfc", output, mapping, sourceRoot: directory }),
    output,
    sourceRoot: directory,
    onMessage: (message) => messages.push(message),
  });
  let sequence = 0;
  const request = async (command: string, args: Record<string, unknown> = {}) => {
    const message = (
      await session.dispatch({ seq: ++sequence, type: "request", command, arguments: args })
    )[0];
    if (message.type !== "response") {
      throw new Error("Expected a DAP response.");
    }
    return message;
  };
  const set = (index = 0, lines = [2]) =>
    request("setBreakpoints", {
      source: { path: sources[index] },
      breakpoints: lines.map((line) => ({ line })),
    });
  t.teardown(() => {
    session.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { backend, session, request, set, messages };
};

test("breakpoint updates pause after Continue and maintenance resume resolve before continued", async (t) => {
  const { backend, request, set, messages } = setup(t);
  backend.delayContinued = true;
  await request("launch");
  await request("continue", { threadId: 1 });
  const first = await set();
  t.true(first.success, first.message);
  const second = await set(1);
  t.true(second.success, second.message);
  const removed = await set(0, []);
  t.true(removed.success, removed.message);
  t.deepEqual(backend.actions, [
    "continue",
    "pause",
    "set:1",
    "continue",
    "pause",
    "set:2",
    "continue",
    "pause",
    "set:1",
    "continue",
  ]);
  t.deepEqual(backend.tables, [[0x808000], [0x808000, 0x808001], [0x808001]]);
  backend.releaseContinued();
  t.deepEqual(
    messages.filter((m) => m.type === "event").map((m) => m.event),
    ["initialized", "stopped", "continued"],
  );
});

for (const command of ["next", "stepIn", "stepOut"]) {
  test(`breakpoint maintenance observes a delayed continued event from ${command}`, async (t) => {
    const { backend, request, set } = setup(t);
    backend.delayContinued = true;
    await request("launch");
    t.true((await request(command, { threadId: 1, granularity: "instruction" })).success);
    t.true((await set()).success);
    t.deepEqual(backend.actions.slice(1), ["pause", "set:1", "continue"]);
  });
}

for (const reason of ["breakpoint", "exception"] as const) {
  test(`a real ${reason} wins the race with maintenance pause`, async (t) => {
    const { backend, request, set, messages } = setup(t);
    await request("launch");
    await request("continue", { threadId: 1 });
    backend.onPause = async () => backend.stop(reason);
    t.true((await set()).success);
    t.deepEqual(backend.actions, ["continue", "pause", "set:1"]);
    t.deepEqual(messages.at(-1)?.body, { reason, threadId: 1, allThreadsStopped: true });
  });
}

test("a newer stop before pause acknowledgment prevents maintenance resume", async (t) => {
  const { backend, request, set } = setup(t);
  await request("launch");
  await request("continue", { threadId: 1 });
  backend.onPause = async () => {
    backend.stop("pause");
    backend.stop("exception");
  };
  t.true((await set()).success);
  t.deepEqual(backend.actions, ["continue", "pause", "set:1"]);
});

for (const reject of [false, true]) {
  test(`a stop before Continue ${reject ? "rejects" : "resolves"} remains stopped`, async (t) => {
    const { backend, request, set } = setup(t);
    await request("launch");
    backend.onResume = async () => {
      backend.stop("breakpoint");
      if (reject) {
        throw new Error("Resume failed after stop.");
      }
    };
    t.is((await request("continue", { threadId: 1 })).success, !reject);
    t.true((await set()).success);
    t.deepEqual(backend.actions, ["continue", "set:1"]);
  });
}

test("a rejected Continue without an event restores the previous stopped state", async (t) => {
  const { backend, request, set } = setup(t);
  await request("launch");
  backend.resumeFailure = new Error("Continue refused.");
  t.false((await request("continue", { threadId: 1 })).success);
  t.true((await set()).success);
  t.deepEqual(backend.actions, ["continue", "set:1"]);
});

test("concurrent source updates preserve the union with instruction breakpoints", async (t) => {
  const { backend, request, set } = setup(t);
  await request("launch");
  t.true(
    (
      await request("setInstructionBreakpoints", {
        breakpoints: [{ instructionReference: "snes.65816|snes.cpu|0x808002" }],
      })
    ).success,
  );
  const results = await Promise.all([set(), set(1)]);
  t.true(results.every(({ success }) => success));
  t.deepEqual(backend.tables.at(-1), [0x808000, 0x808001, 0x808002]);
  await request("setInstructionBreakpoints", { breakpoints: [] });
  await set(0, []);
  await request("continue", { threadId: 1 });
  t.true((await set(1, [])).success);
  t.deepEqual(backend.tables.at(-1), []);
  t.deepEqual(backend.actions.slice(-3), ["pause", "set:0", "continue"]);
});

test("user Continue waits until a stopped breakpoint replacement completes", async (t) => {
  const { backend, request, set } = setup(t);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  backend.onSet = async () => {
    entered.resolve();
    await release.promise;
  };
  await request("launch");
  const update = set();
  await entered.promise;
  const continued = request("continue", { threadId: 1 });
  t.deepEqual(backend.actions, ["set:1"]);
  release.resolve();
  t.true((await update).success);
  t.true((await continued).success);
  t.deepEqual(backend.actions, ["set:1", "continue"]);
});

test("user Pause during a hidden table update prevents automatic resume", async (t) => {
  const { backend, request, set, messages } = setup(t);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  backend.onSet = async () => {
    entered.resolve();
    await release.promise;
  };
  await request("launch");
  await request("continue", { threadId: 1 });
  const update = set();
  await entered.promise;
  const paused = request("pause", { threadId: 1 });
  release.resolve();
  t.true((await update).success);
  t.true((await paused).success);
  t.is(backend.actions.filter((action) => action === "continue").length, 1);
  t.true(backend.stopped);
  t.true(
    messages.some(
      (message) =>
        message.type === "event" &&
        message.event === "stopped" &&
        eventReason(message.body) === "pause",
    ),
  );
});

test("failed breakpoint replacement restores the prior table and discards rejected requests", async (t) => {
  const { backend, request, set } = setup(t);
  await request("launch");
  await set();
  await request("continue", { threadId: 1 });
  backend.onSet = async () => {
    backend.onSet = undefined;
    throw new Error("Native table partially changed.");
  };
  t.false((await set(1)).success);
  t.deepEqual(backend.tables.slice(-2), [[0x808000, 0x808001], [0x808000]]);
  t.false(backend.stopped);
  t.true((await set(0, [])).success);
  t.deepEqual(backend.tables.at(-1), []);
});

test("failed table recovery exposes the stop and blocks execution until reconciliation", async (t) => {
  const { backend, request, set, messages } = setup(t);
  await request("launch");
  await set();
  await request("continue", { threadId: 1 });
  backend.onSet = async () => {
    throw new Error("Native writes unavailable.");
  };
  const update = await set(1);
  t.false(update.success);
  t.regex(update.message ?? "", /could not be restored/);
  t.true(backend.stopped);
  t.false((await request("continue", { threadId: 1 })).success);
  t.false((await request("stepIn", { threadId: 1 })).success);
  const invalidated = messages.find(
    (message) => message.type === "event" && message.event === "breakpoint",
  );
  t.truthy(invalidated);
  t.is(breakpointVerified(invalidated?.body), false);
  backend.onSet = undefined;
  t.true((await set()).success);
  t.deepEqual(backend.tables.at(-1), [0x808000]);
  t.true((await request("continue", { threadId: 1 })).success);
});

test("failed maintenance resume exposes the paused CPU and preserves the installed table", async (t) => {
  const { backend, request, set, messages } = setup(t);
  await request("launch");
  await request("continue", { threadId: 1 });
  backend.resumeFailure = new Error("Resume refused.");
  t.false((await set()).success);
  t.true(backend.stopped);
  t.deepEqual(messages.at(-1)?.body, { reason: "pause", threadId: 1, allThreadsStopped: true });
  backend.resumeFailure = undefined;
  t.true((await set(1)).success);
  t.deepEqual(backend.tables.at(-1), [0x808000, 0x808001]);
});

test("disconnect cancels a maintenance pause whose backend promise is still pending", async (t) => {
  const { backend, request, set } = setup(t);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  backend.onPause = async () => {
    entered.resolve();
    await release.promise;
  };
  await request("launch");
  await request("continue", { threadId: 1 });
  const update = set();
  await entered.promise;
  const disconnected = request("disconnect");
  t.false((await update).success);
  t.true((await disconnected).success);
  release.reject(new Error("Late transport close."));
  t.deepEqual(backend.actions, ["continue", "pause", "disconnect"]);
  t.false((await set()).success);
});

test("termination during Continue cannot be undone by a rejected operation", async (t) => {
  const { backend, request, set } = setup(t);
  await request("launch");
  backend.onResume = async () => {
    backend.emit({ type: "terminated", restart: false });
    throw new Error("Transport closed.");
  };
  t.false((await request("continue", { threadId: 1 })).success);
  t.false((await set()).success);
  t.deepEqual(backend.tables, []);
});

test.serial(
  "maintenance timeout never writes a running table and a late stop stays visible",
  async (t) => {
    const clock = sinon.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    t.teardown(() => clock.restore());
    const { backend, request, set, messages } = setup(t);
    const entered = Promise.withResolvers<void>();
    backend.onPause = async () => {
      entered.resolve();
    };
    await request("launch");
    await request("continue", { threadId: 1 });
    const update = set();
    await entered.promise;
    await clock.tickAsync(5_000);
    const result = await update;
    t.false(result.success);
    t.regex(result.message ?? "", /Timed out while pausing/);
    t.deepEqual(backend.tables, []);
    backend.stop("pause");
    t.deepEqual(messages.at(-1)?.body, { reason: "pause", threadId: 1, allThreadsStopped: true });
  },
);

test("real sidecar framing tolerates Continue response and continued event in separate reads", async (t) => {
  const commands: string[] = [];
  const { backend, request, set } = setup(t, (native) => {
    const token = createDebugSidecarSessionToken();
    const outputParser = new DebugSidecarMessageParser();
    const inputParser = new DebugSidecarMessageParser();
    let receive: (data: Uint8Array) => void = ignoreSidecarFrame;
    const held: Uint8Array[] = [];
    const transport: DebugSidecarTransport = {
      write: async (data) => {
        for (const message of inputParser.push(data)) {
          if (message.type === "request") {
            commands.push(message.command);
          }
        }
        // Deliver the previous command's event only once a new request is sent.
        // This preserves wire order while guaranteeing response/event separation.
        for (const frame of held.splice(0)) {
          receive(frame);
        }
        await server.receive(data);
      },
      close: async () => {
        await server.close();
      },
      onData: (listener) => {
        receive = listener;
        return {
          dispose: () => {
            receive = () => undefined;
          },
        };
      },
      onClose: () => ({ dispose: () => undefined }),
    };
    const server = new DebugSidecarServer({
      backend: "controlled",
      implementation: native,
      session: token,
      write: async (frame) => {
        const message = elementAt(outputParser.push(frame), 0);
        if (held.length || (message?.type === "event" && message.event === "continued")) {
          held.push(frame);
        } else {
          receive(frame);
        }
      },
      close: async () => undefined,
    });
    t.teardown(() => server.close());
    return new SidecarDebugBackend({
      backend: "controlled",
      capabilities: native.capabilities,
      createClient: () => new DebugSidecarClient({ session: token, transport }),
    });
  });
  await request("launch");
  await request("continue", { threadId: 1 });
  t.true((await set()).success);
  t.true((await set(1)).success);
  t.deepEqual(backend.tables.at(-1), [0x808000, 0x808001]);
  t.deepEqual(
    commands.filter((command) => ["continue", "pause", "setBreakpoints"].includes(command)),
    ["continue", "pause", "setBreakpoints", "continue", "pause", "setBreakpoints", "continue"],
  );
  await request("disconnect");
});
