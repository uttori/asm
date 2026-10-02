import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { AddressToLineMapping, createDebugMap } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import { busCapabilities, busScope } from "../../../tests/helpers/capture-bus.js";
import {
  DapMessageParser,
  DebugAdapterSession,
  ReplayDebugBackend,
  createDebugMapReplayScript,
  encodeDapMessage,
  formatDebugAddress,
  type DapRequest,
  type DapResponse,
  type DebugBackend,
  type DebugBackendEvent,
  type DapProtocolMessage,
  type DebugAdapterSessionOptions,
  type ReplaySnapshot,
} from "../src/index.js";

const request = (seq: number, command: string, args: Record<string, unknown> = {}): DapRequest => ({
  seq,
  type: "request",
  command,
  arguments: args,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** DAP replies and events share one array; only a response may satisfy a request assertion. */
const response = (messages: Awaited<ReturnType<DebugAdapterSession["dispatch"]>>): DapResponse => {
  const message = messages[0];
  if (message.type !== "response") {
    throw new Error("Expected a DAP response.");
  }
  return message;
};

const bodyRecord = (body: unknown): Record<string, unknown> => {
  if (!isRecord(body)) {
    throw new Error("Expected a DAP response body.");
  }
  return body;
};

const stringField = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a string.`);
  }
  return value;
};

const numberField = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== "number") {
    throw new Error(`Expected ${key} to be a number.`);
  }
  return value;
};

const booleanField = (record: Record<string, unknown>, key: string): boolean => {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`Expected ${key} to be a boolean.`);
  }
  return value;
};

const recordField = (record: Record<string, unknown>, key: string): Record<string, unknown> => {
  const value = record[key];
  if (!isRecord(value)) {
    throw new Error(`Expected ${key} to be an object.`);
  }
  return value;
};

const objectArray = (record: Record<string, unknown>, key: string): Record<string, unknown>[] => {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${key} to be an array.`);
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Expected ${key}[${index}] to be an object.`);
    }
    return entry;
  });
};

const numberList = (record: Record<string, unknown>, key: string): number[] => {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${key} to be an array of numbers.`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== "number") {
      throw new Error(`Expected ${key}[${index}] to be a number.`);
    }
    return entry;
  });
};

const verifiedLineBreakpoints = (body: unknown) => ({
  breakpoints: objectArray(bodyRecord(body), "breakpoints").map((entry) => ({
    verified: booleanField(entry, "verified"),
    line: numberField(entry, "line"),
  })),
});

const verifiedBreakpoints = (body: unknown) => ({
  breakpoints: objectArray(bodyRecord(body), "breakpoints").map((entry) => ({
    verified: booleanField(entry, "verified"),
  })),
});

const locationBreakpoints = (body: unknown) => ({
  breakpoints: objectArray(bodyRecord(body), "breakpoints").map((entry) => ({
    line: numberField(entry, "line"),
    column: numberField(entry, "column"),
  })),
});

const namedSourceFrames = (body: unknown) => ({
  stackFrames: objectArray(bodyRecord(body), "stackFrames").map((entry) => ({
    name: stringField(entry, "name"),
    line: numberField(entry, "line"),
    source: { path: stringField(recordField(entry, "source"), "path") },
  })),
});

const lineFrames = (body: unknown) => ({
  stackFrames: objectArray(bodyRecord(body), "stackFrames").map((entry) => ({
    line: numberField(entry, "line"),
  })),
});

const sourcePathFrames = (body: unknown) => ({
  stackFrames: objectArray(bodyRecord(body), "stackFrames").map((entry) => ({
    line: numberField(entry, "line"),
    source: { path: stringField(recordField(entry, "source"), "path") },
  })),
});

const disassemblyFrames = (body: unknown) => ({
  stackFrames: objectArray(bodyRecord(body), "stackFrames").map((entry) => {
    const source = recordField(entry, "source");
    return {
      line: numberField(entry, "line"),
      source: {
        sourceReference: numberField(source, "sourceReference"),
        path: stringField(source, "path"),
        presentationHint: stringField(source, "presentationHint"),
      },
    };
  }),
});

const sourceReferenceFrames = (body: unknown) => ({
  stackFrames: objectArray(bodyRecord(body), "stackFrames").map((entry) => ({
    source: {
      sourceReference: numberField(recordField(entry, "source"), "sourceReference"),
    },
  })),
});

const scopeReferences = (body: unknown) => ({
  scopes: objectArray(bodyRecord(body), "scopes").map((entry) => ({
    variablesReference: numberField(entry, "variablesReference"),
  })),
});

const namedScopes = (body: unknown) => ({
  scopes: objectArray(bodyRecord(body), "scopes").map((entry) => ({
    name: stringField(entry, "name"),
    variablesReference: numberField(entry, "variablesReference"),
  })),
});

const namedVariables = (body: unknown) => ({
  variables: objectArray(bodyRecord(body), "variables").map((entry) => ({
    name: stringField(entry, "name"),
    value: stringField(entry, "value"),
    type: stringField(entry, "type"),
    variablesReference: numberField(entry, "variablesReference"),
  })),
});

const memoryVariables = (body: unknown) => ({
  variables: objectArray(bodyRecord(body), "variables").map((entry) => ({
    name: stringField(entry, "name"),
    memoryReference: stringField(entry, "memoryReference"),
  })),
});

const stackVariables = (body: unknown) => ({
  variables: objectArray(bodyRecord(body), "variables").map((entry) => ({
    name: stringField(entry, "name"),
    value: stringField(entry, "value"),
    type: stringField(entry, "type"),
    memoryReference: stringField(entry, "memoryReference"),
    variablesReference: numberField(entry, "variablesReference"),
  })),
});

const evaluation = (body: unknown) => {
  const record = bodyRecord(body);
  return {
    result: stringField(record, "result"),
    type: stringField(record, "type"),
    variablesReference: numberField(record, "variablesReference"),
  };
};

const memoryRead = (body: unknown) => {
  const record = bodyRecord(body);
  return {
    data: stringField(record, "data"),
    unreadableBytes: numberField(record, "unreadableBytes"),
  };
};

const instructionText = (body: unknown) => ({
  instructions: objectArray(bodyRecord(body), "instructions").map((entry) => ({
    instruction: stringField(entry, "instruction"),
  })),
});

const sourceContent = (body: unknown) => ({
  content: stringField(bodyRecord(body), "content"),
});

const threadList = (body: unknown) => ({
  threads: objectArray(bodyRecord(body), "threads").map((entry) => ({
    id: numberField(entry, "id"),
    name: stringField(entry, "name"),
  })),
});

const traceCapabilities = (body: unknown) => ({
  traces: objectArray(bodyRecord(body), "traces").map((entry) => ({
    architecture: stringField(entry, "architecture"),
    addressSpace: stringField(entry, "addressSpace"),
  })),
});

const traceBatch = (body: unknown) => {
  const record = bodyRecord(body);
  return {
    addresses: numberList(record, "addresses"),
    active: booleanField(record, "active"),
  };
};

const breakpointLocationsSupported = (body: unknown): boolean =>
  booleanField(bodyRecord(body), "supportsBreakpointLocationsRequest");

const snapshot = (cpuAddress: number): ReplaySnapshot => ({
  threads: [
    { id: 1, name: "Main CPU", architecture: "snes.65816" },
    { id: 2, name: "Audio CPU", architecture: "snes.spc700" },
  ],
  frames: [
    {
      id: 10,
      threadId: 1,
      name: "65816",
      currentOnly: true,
      pc: {
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        address: cpuAddress,
        outputOffset: cpuAddress & 0x7fff,
      },
    },
    {
      id: 20,
      threadId: 2,
      name: "SPC700",
      currentOnly: true,
      pc: { architecture: "snes.spc700", addressSpace: "spc.aram", address: 0x200 },
    },
  ],
  registers: {
    10: [
      { name: "A", value: "1234", bits: 16 },
      { name: "S", value: "01f0", bits: 16, group: "CPU" },
      { name: "P", value: "b5", bits: 8, group: "CPU" },
      { name: "E", value: "1", bits: 1, group: "CPU" },
    ],
  },
  memory: [
    { addressSpace: "snes.cpu", start: 0x008000, bytes: [0xea, 0xdb] },
    {
      addressSpace: "snes.cpu",
      start: 0x01f1,
      bytes: Array.from({ length: 32 }, (_, index) => index),
    },
  ],
  instructions: [
    {
      address: { architecture: "snes.spc700", addressSpace: "spc.aram", address: 0x200 },
      bytes: [0x00],
      text: "nop",
    },
  ],
});

const setup = (
  options: Pick<DebugAdapterSessionOptions, "configurationHandshake" | "onMessage"> = {},
) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-dap-"));
  const source = path.join(directory, "main.asm");
  fs.writeFileSync(source, "org $808000\nnop\nstp\n");
  const mapping = new AddressToLineMapping();
  mapping.includeByte(source, 2, "snes.65816", "snes.cpu", 0x808000, 0);
  mapping.includeByte(source, 3, "snes.65816", "snes.cpu", 0x808001, 1);
  const output = Uint8Array.from([0xea, 0xdb]);
  const map = createDebugMap({ target: "snes.sfc", output, mapping, sourceRoot: directory });
  const backend = new ReplayDebugBackend({
    snapshots: [snapshot(0x008000), snapshot(0x008001)],
  });
  const session = new DebugAdapterSession({
    backend,
    debugMap: map,
    output,
    sourceRoot: directory,
    ...options,
  });
  return { directory, source, output, map, backend, session };
};

test("DAP forwards explicit bus scope and rejects unsupported capture negotiation", async (t) => {
  const fixture = setup();
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  const seen: unknown[] = [];
  (fixture.backend as DebugBackend).capture = async (capture) => {
    seen.push(capture);
    return busCapabilities;
  };
  const args = { operation: "capabilities", scope: busScope };
  t.deepEqual(
    response(await fixture.session.dispatch(request(1, "uttori/capture", args))).body,
    busCapabilities,
  );
  t.deepEqual(seen, [args]);
  t.false(
    response(
      await fixture.session.dispatch(request(2, "uttori/capture", { ...args, scope: "bus" })),
    ).success,
  );
  t.is(seen.length, 1);
});

test("live DAP handshake connects before initialized and configures breakpoints before stopping", async (t) => {
  const messages: DapProtocolMessage[] = [];
  let ready!: () => void;
  const initialized = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const fixture = setup({
    configurationHandshake: true,
    onMessage: (message) => {
      messages.push(message);
      if (message.type === "event" && message.event === "initialized") {
        ready();
      }
    },
  });
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await fixture.session.dispatch(request(1, "initialize"));
  t.is(messages.length, 1);
  const launch = fixture.session.dispatch(request(2, "launch"));
  await initialized;
  t.deepEqual(
    messages.map((entry) => (entry.type === "event" ? entry.event : entry.command)),
    ["initialize", "initialized"],
  );
  t.true(
    response(
      await fixture.session.dispatch(
        request(3, "setBreakpoints", {
          source: { path: fixture.source },
          breakpoints: [{ line: 2 }],
        }),
      ),
    ).success,
  );
  t.true(response(await fixture.session.dispatch(request(4, "threads"))).success);
  t.false(messages.some((entry) => entry.type === "event" && entry.event === "stopped"));
  await fixture.session.dispatch(request(5, "configurationDone"));
  t.true(response(await launch).success);
  t.deepEqual(
    messages.map((entry) => (entry.type === "event" ? entry.event : entry.command)),
    [
      "initialize",
      "initialized",
      "setBreakpoints",
      "breakpoint",
      "threads",
      "configurationDone",
      "launch",
      "stopped",
    ],
  );
  t.deepEqual(
    messages.map(({ seq }) => seq),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  // Future events must not stay queued in the completed launch request's async context.
  await fixture.backend.step(1, "instruction");
  const latest = messages.at(-1);
  t.is(latest?.type === "event" ? latest.event : undefined, "stopped");
  t.is(messages.at(-1)?.seq, 10);
});

test("failed live connection never announces initialized; cancelled configuration never stops", async (t) => {
  const messages: DapProtocolMessage[] = [];
  const fixture = setup({
    configurationHandshake: true,
    onMessage: (entry) => messages.push(entry),
  });
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  const connect = fixture.backend.connect.bind(fixture.backend);
  fixture.backend.connect = async () => {
    throw new Error("ares unavailable");
  };
  const failed = response(await fixture.session.dispatch(request(1, "launch")));
  t.false(failed.success);
  t.is(failed.message, "ares unavailable");
  t.false(messages.some((entry) => entry.type === "event"));
  fixture.backend.connect = connect;
  const launch = fixture.session.dispatch(request(2, "launch"));
  await new Promise<void>((resolve) => setImmediate(resolve));
  await fixture.session.dispatch(request(3, "disconnect"));
  const cancelled = response(await launch);
  t.false(cancelled.success);
  t.regex(cancelled.message ?? "", /cancelled/);
  t.false(messages.some((entry) => entry.type === "event" && entry.event === "stopped"));
});

test("Run without debugging resumes native execution without a configuration handshake or reset stop", async (t) => {
  const messages: DapProtocolMessage[] = [];
  const fixture = setup({
    configurationHandshake: true,
    onMessage: (message) => messages.push(message),
  });
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  const result = await fixture.session.dispatch(request(1, "launch", { noDebug: true }));
  t.true(response(result).success);
  t.deepEqual(
    messages.map((message) => (message.type === "event" ? message.event : message.command)),
    ["launch", "continued", "terminated"],
  );
});

test("DAP transcript negotiates capabilities and preserves response/event order", async (t) => {
  const fixture = setup();
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });

  const initialize = await fixture.session.dispatch(request(1, "initialize"));
  t.deepEqual(
    initialize.map((message) => [
      message.seq,
      message.type,
      "event" in message ? message.event : message.command,
    ]),
    [[1, "response", "initialize"]],
  );
  const initialized = response(initialize);
  t.true(Boolean(initialized.body && initialized.success));

  const launch = await fixture.session.dispatch(request(2, "launch"));
  t.deepEqual(
    launch.map((message) => [
      message.seq,
      message.type,
      "event" in message ? message.event : message.command,
    ]),
    [
      [2, "response", "launch"],
      [3, "event", "initialized"],
      [4, "event", "stopped"],
    ],
  );

  const sourceBreakpoints = await fixture.session.dispatch(
    request(3, "setBreakpoints", {
      source: { path: fixture.source },
      breakpoints: [{ line: 2 }, { line: 99 }],
    }),
  );
  const breakpointBody = verifiedLineBreakpoints(response(sourceBreakpoints).body);
  t.deepEqual(
    breakpointBody.breakpoints.map(({ verified, line }) => ({ verified, line })),
    [
      { verified: true, line: 2 },
      { verified: false, line: 99 },
    ],
  );

  const stack = namedSourceFrames(
    response(await fixture.session.dispatch(request(4, "stackTrace", { threadId: 1 }))).body,
  );
  t.is(stack.stackFrames[0]?.line, 2);
  t.is(stack.stackFrames[0]?.name, "65816 (current frame only)");
  t.is(stack.stackFrames[0]?.source.path, fixture.source);

  const scopes = scopeReferences(
    response(await fixture.session.dispatch(request(5, "scopes", { frameId: 10 }))).body,
  );
  const variables = namedVariables(
    response(
      await fixture.session.dispatch(
        request(6, "variables", { variablesReference: scopes.scopes[0]?.variablesReference }),
      ),
    ).body,
  );
  t.deepEqual(variables.variables, [
    { name: "A", value: "0x1234", type: "uint16", variablesReference: 0 },
  ]);

  const registerWatch = evaluation(
    response(
      await fixture.session.dispatch(request(7, "evaluate", { expression: "a", frameId: 10 })),
    ).body,
  );
  t.deepEqual(registerWatch, { result: "0x1234", type: "uint16", variablesReference: 0 });
  const expressionWatch = evaluation(
    response(
      await fixture.session.dispatch(
        request(8, "evaluate", { expression: "($10 + A) & $FFFF", frameId: 10 }),
      ),
    ).body,
  );
  t.deepEqual(expressionWatch, { result: "0x1244", type: "integer", variablesReference: 0 });
  const invalidWatch = response(
    await fixture.session.dispatch(request(9, "evaluate", { expression: "missing", frameId: 10 })),
  );
  t.false(invalidWatch.success);
  t.regex(invalidWatch.message ?? "", /Unknown register 'missing'/);

  const instructionBreakpoints = verifiedBreakpoints(
    response(
      await fixture.session.dispatch(
        request(10, "setInstructionBreakpoints", {
          breakpoints: [
            {
              instructionReference: formatDebugAddress({
                architecture: "snes.65816",
                addressSpace: "snes.cpu",
                address: 0x008001,
                outputOffset: 1,
              }),
            },
          ],
        }),
      ),
    ).body,
  );
  t.true(instructionBreakpoints.breakpoints[0]?.verified);

  const memory = memoryRead(
    response(
      await fixture.session.dispatch(
        request(11, "readMemory", {
          memoryReference: formatDebugAddress({
            architecture: "snes.65816",
            addressSpace: "snes.cpu",
            address: 0x008000,
          }),
          count: 2,
        }),
      ),
    ).body,
  );
  t.is(memory.data, Buffer.from([0xea, 0xdb]).toString("base64"));
  t.is(memory.unreadableBytes, 0);

  const disassembly = instructionText(
    response(
      await fixture.session.dispatch(
        request(12, "disassemble", {
          memoryReference: formatDebugAddress({
            architecture: "snes.spc700",
            addressSpace: "spc.aram",
            address: 0x200,
          }),
          instructionCount: 1,
        }),
      ),
    ).body,
  );
  t.is(disassembly.instructions[0]?.instruction, "nop");

  const step = await fixture.session.dispatch(request(13, "next", { threadId: 1 }));
  t.deepEqual(
    step.map((message) => ("event" in message ? message.event : message.command)),
    ["next", "continued", "stopped"],
  );
  const advanced = lineFrames(
    response(await fixture.session.dispatch(request(14, "stackTrace", { threadId: 1 }))).body,
  );
  t.is(advanced.stackFrames[0]?.line, 3);

  const disconnect = await fixture.session.dispatch(request(15, "disconnect"));
  t.deepEqual(
    disconnect.map((message) => ("event" in message ? message.event : message.command)),
    ["disconnect", "terminated"],
  );
});

test("DAP advertises executable breakpoint locations and moves directive breakpoints forward", async (t) => {
  const fixture = setup();
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });

  const initialize = response(await fixture.session.dispatch(request(1, "initialize")));
  t.true(breakpointLocationsSupported(initialize.body));
  await fixture.session.dispatch(request(2, "launch"));
  const locations = locationBreakpoints(
    response(
      await fixture.session.dispatch(
        request(3, "breakpointLocations", {
          source: { path: fixture.source },
          line: 1,
          endLine: 3,
        }),
      ),
    ).body,
  );
  t.deepEqual(locations.breakpoints, [
    { line: 2, column: 1 },
    { line: 3, column: 1 },
  ]);

  const moved = verifiedLineBreakpoints(
    response(
      await fixture.session.dispatch(
        request(4, "setBreakpoints", {
          source: { path: fixture.source },
          breakpoints: [{ line: 1 }],
        }),
      ),
    ).body,
  );
  t.deepEqual(
    moved.breakpoints.map(({ verified, line }) => ({ verified, line })),
    [{ verified: true, line: 2 }],
  );
});

const unsupported = (): Promise<never> => Promise.reject(new Error("Not used by this test."));

test("DAP installs and removes source breakpoints while running without exposing maintenance stops", async (t) => {
  const fixture = setup();
  fixture.session.dispose();
  const listeners = new Set<(event: DebugBackendEvent) => void>();
  const actions: string[] = [];
  let stopped = true;
  let nextBreakpointId = 1;
  const emit = (event: DebugBackendEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };
  const backend: DebugBackend = {
    protocolVersion: fixture.backend.protocolVersion,
    capabilities: fixture.backend.capabilities,
    connect: () => {
      stopped = true;
      emit({ type: "stopped", reason: "entry", threadId: 1 });
      return Promise.resolve();
    },
    disconnect: () => {
      emit({ type: "terminated", restart: false });
      return Promise.resolve();
    },
    pause: async () => {
      actions.push("pause");
      // Real sidecars acknowledge pause with a later event, after the request returns.
      await new Promise<void>((resolve) => setImmediate(resolve));
      stopped = true;
      emit({ type: "stopped", reason: "pause", threadId: 1 });
    },
    continue: () => {
      if (!stopped) {
        return Promise.reject(new Error("Test backend is already running."));
      }
      actions.push("continue");
      stopped = false;
      emit({ type: "continued", threadId: 1, allThreads: true });
      return Promise.resolve();
    },
    step: unsupported,
    threads: () => Promise.resolve([{ id: 1, name: "Main CPU", architecture: "snes.65816" }]),
    stackFrames: unsupported,
    registers: unsupported,
    readMemory: unsupported,
    setBreakpoints: (addresses) => {
      if (!stopped) {
        return Promise.reject(new Error("Test backend must be stopped to change breakpoints."));
      }
      actions.push(`set:${addresses.length}`);
      return Promise.resolve(
        addresses.map((address) => ({
          id: nextBreakpointId++,
          address,
          verified: true,
        })),
      );
    },
    disassemble: unsupported,
    startTrace: unsupported,
    readTrace: unsupported,
    stopTrace: unsupported,
    onEvent: (listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
  const messages: DapProtocolMessage[] = [];
  const session = new DebugAdapterSession({
    backend,
    debugMap: fixture.map,
    output: fixture.output,
    sourceRoot: fixture.directory,
    onMessage: (message) => messages.push(message),
  });
  t.teardown(() => {
    session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });

  await session.dispatch(request(1, "initialize"));
  await session.dispatch(request(2, "launch"));
  await session.dispatch(request(3, "continue", { threadId: 1 }));
  const beforeSet = messages.length;
  const set = response(
    await session.dispatch(
      request(4, "setBreakpoints", {
        source: { path: fixture.source },
        breakpoints: [{ line: 2 }],
      }),
    ),
  );
  t.true(set.success, set.message);
  t.deepEqual(actions, ["continue", "pause", "set:1", "continue"]);
  t.deepEqual(
    messages
      .slice(beforeSet)
      .map((message) => (message.type === "event" ? message.event : message.command)),
    ["setBreakpoints"],
  );

  const beforeRemove = messages.length;
  const remove = response(
    await session.dispatch(
      request(5, "setBreakpoints", {
        source: { path: fixture.source },
        breakpoints: [],
      }),
    ),
  );
  t.true(remove.success, remove.message);
  t.deepEqual(actions.slice(-3), ["pause", "set:0", "continue"]);
  t.deepEqual(
    messages
      .slice(beforeRemove)
      .map((message) => (message.type === "event" ? message.event : message.command)),
    ["setBreakpoints"],
  );

  await session.dispatch(request(6, "pause", { threadId: 1 }));
  const paused = messages.at(-1);
  t.is(paused?.type === "event" ? paused.event : undefined, "stopped");
});

test("DAP resolves mirrored PCs and supplies virtual disassembly sources", async (t) => {
  const fixture = setup();
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await fixture.session.dispatch(request(1, "initialize"));
  await fixture.session.dispatch(request(2, "launch"));

  const cpu = sourcePathFrames(
    response(await fixture.session.dispatch(request(3, "stackTrace", { threadId: 1 }))).body,
  );
  t.is(cpu.stackFrames[0]?.line, 2);
  t.is(cpu.stackFrames[0]?.source.path, fixture.source);

  const spc = disassemblyFrames(
    response(await fixture.session.dispatch(request(4, "stackTrace", { threadId: 2 }))).body,
  );
  const sourceReference = spc.stackFrames[0]?.source.sourceReference;
  t.truthy(sourceReference);
  t.is(spc.stackFrames[0]?.source.path, `/uttori-disassembly/snes.spc700/${sourceReference}.asm`);
  t.is(spc.stackFrames[0]?.source.presentationHint, "normal");
  const virtual = sourceContent(
    response(await fixture.session.dispatch(request(5, "source", { sourceReference }))).body,
  );
  t.true(virtual.content.startsWith("; Debugger disassembly (temporary, read-only view)\n"));
  t.regex(virtual.content, /; Shown because the current instruction has no matching source line/);
  // The execution highlight must point at the instruction, below the explanation.
  t.regex(
    virtual.content.split("\n")[spc.stackFrames[0]!.line - 1]!,
    /^snes\.spc700\|spc\.aram\|0x200.*nop/,
  );

  await fixture.session.dispatch(request(6, "next", { threadId: 2 }));
  const refreshed = sourceReferenceFrames(
    response(await fixture.session.dispatch(request(7, "stackTrace", { threadId: 2 }))).body,
  );
  t.not(refreshed.stackFrames[0]?.source.sourceReference, sourceReference);
});

test("DAP groups processor registers and exposes decoded flags, safe memory, and stack bytes", async (t) => {
  const fixture = setup();
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await fixture.session.dispatch(request(1, "launch"));
  await fixture.session.dispatch(request(2, "stackTrace", { threadId: 1 }));
  const scopeBody = namedScopes(
    response(await fixture.session.dispatch(request(3, "scopes", { frameId: 10 }))).body,
  );
  t.deepEqual(
    scopeBody.scopes.map(({ name }) => name),
    ["65816 Registers", "65816 CPU", "65816 Flags", "65816 Memory Spaces", "65816 Stack Bytes"],
  );

  const flagsScope = scopeBody.scopes.find(({ name }) => name === "65816 Flags");
  const flags = namedVariables(
    response(
      await fixture.session.dispatch(
        request(4, "variables", { variablesReference: flagsScope?.variablesReference }),
      ),
    ).body,
  );
  t.deepEqual(
    flags.variables.map(({ name, value }) => ({ name, value })),
    [
      { name: "N", value: "set (1)" },
      { name: "V", value: "clear (0)" },
      { name: "M", value: "set (1)" },
      { name: "X", value: "set (1)" },
      { name: "D", value: "clear (0)" },
      { name: "I", value: "set (1)" },
      { name: "Z", value: "clear (0)" },
      { name: "C", value: "set (1)" },
      { name: "E", value: "set (1)" },
    ],
  );

  const memoryScope = scopeBody.scopes.find(({ name }) => name === "65816 Memory Spaces");
  const spaces = memoryVariables(
    response(
      await fixture.session.dispatch(
        request(5, "variables", { variablesReference: memoryScope?.variablesReference }),
      ),
    ).body,
  );
  t.deepEqual(
    spaces.variables.map(({ name }) => name),
    ["snes.cpu"],
  );
  t.truthy(spaces.variables[0]?.memoryReference);

  const stackScope = scopeBody.scopes.find(({ name }) => name === "65816 Stack Bytes");
  const stack = stackVariables(
    response(
      await fixture.session.dispatch(
        request(6, "variables", { variablesReference: stackScope?.variablesReference }),
      ),
    ).body,
  );
  t.deepEqual(stack.variables[0], {
    name: "0x01f1",
    value: "00 01 02 03 04 05 06 07",
    type: "bytes",
    memoryReference: "snes.65816|snes.cpu|0x1f1",
    variablesReference: 0,
  });

  const unsafe = response(
    await fixture.session.dispatch(
      request(7, "readMemory", {
        memoryReference: "snes.spc700|spc.aram|0x200",
        count: 1,
      }),
    ),
  );
  t.false(unsafe.success);
  t.regex(unsafe.message ?? "", /side-effect-free/);
});

test("DAP reports and rejects unavailable live-style step semantics instead of approximating", async (t) => {
  const fixture = setup();
  const backend = new ReplayDebugBackend({
    snapshots: [snapshot(0x008000), snapshot(0x008001)],
    architectures: fixture.backend.capabilities.architectures.map((capabilities) =>
      capabilities.architecture === "snes.65816"
        ? { ...capabilities, stepKinds: ["instruction", "in"] }
        : capabilities,
    ),
  });
  const session = new DebugAdapterSession({
    backend,
    debugMap: fixture.map,
    output: fixture.output,
    sourceRoot: fixture.directory,
  });
  t.teardown(() => {
    fixture.session.dispose();
    session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await session.dispatch(request(1, "launch"));
  const threads = threadList(response(await session.dispatch(request(2, "threads"))).body);
  t.regex(threads.threads.find(({ id }) => id === 1)?.name ?? "", /step over, step out/);

  const unavailable = response(await session.dispatch(request(3, "next", { threadId: 1 })));
  t.false(unavailable.success);
  t.regex(unavailable.message ?? "", /does not support step over/);

  const instruction = response(
    await session.dispatch(request(4, "next", { threadId: 1, granularity: "instruction" })),
  );
  t.true(instruction.success);
});

test("DAP adds host annotations to disassembly without changing backend instructions", async (t) => {
  const fixture = setup();
  const session = new DebugAdapterSession({
    backend: new ReplayDebugBackend({ snapshots: [snapshot(0x008000)] }),
    debugMap: fixture.map,
    output: fixture.output,
    sourceRoot: fixture.directory,
    instructionAnnotation: async ({ architecture, address }) => {
      await Promise.resolve();
      if (architecture === "snes.spc700" && address === 0x200) {
        return "▶ 3× · state p=$20";
      }
      throw new Error("Optional annotation database unavailable");
    },
  });
  t.teardown(() => {
    fixture.session.dispose();
    session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await session.dispatch(request(1, "launch"));
  const disassembly = instructionText(
    response(
      await session.dispatch(
        request(2, "disassemble", {
          memoryReference: formatDebugAddress({
            architecture: "snes.spc700",
            addressSpace: "spc.aram",
            address: 0x200,
          }),
          instructionCount: 1,
        }),
      ),
    ).body,
  );
  t.is(disassembly.instructions[0]?.instruction, "nop ; ▶ 3× · state p=$20");

  const stack = sourceReferenceFrames(
    response(await session.dispatch(request(3, "stackTrace", { threadId: 2 }))).body,
  );
  const source = sourceContent(
    response(
      await session.dispatch(
        request(4, "source", { sourceReference: stack.stackFrames[0]?.source.sourceReference }),
      ),
    ).body,
  );
  t.regex(source.content, /nop ; ▶ 3× · state p=\$20/);
  const withoutAnnotations = response(
    await session.dispatch(
      request(5, "disassemble", {
        memoryReference: formatDebugAddress({
          architecture: "snes.65816",
          addressSpace: "snes.cpu",
          address: 0x008000,
        }),
        instructionCount: 1,
      }),
    ),
  );
  t.true(withoutAnnotations.success, "a rejected optional query does not break disassembly");
});

test("debug-map replay stepping advances the highlighted native source line", async (t) => {
  const fixture = setup();
  const replay = new ReplayDebugBackend(createDebugMapReplayScript(fixture.map, fixture.output));
  const session = new DebugAdapterSession({
    backend: replay,
    debugMap: fixture.map,
    output: fixture.output,
    sourceRoot: fixture.directory,
  });
  t.teardown(() => {
    fixture.session.dispose();
    session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await session.dispatch(request(1, "launch"));
  const before = lineFrames(
    response(await session.dispatch(request(2, "stackTrace", { threadId: 1 }))).body,
  );
  t.is(before.stackFrames[0]?.line, 2);
  await session.dispatch(request(3, "next", { threadId: 1 }));
  const after = lineFrames(
    response(await session.dispatch(request(4, "stackTrace", { threadId: 1 }))).body,
  );
  t.is(after.stackFrames[0]?.line, 3);
});

test("DAP exposes explicit bounded trace recording only through custom requests", async (t) => {
  const fixture = setup();
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await fixture.session.dispatch(request(1, "launch"));
  const capabilities = traceCapabilities(
    response(await fixture.session.dispatch(request(2, "uttori/traceCapabilities"))).body,
  );
  t.true(
    capabilities.traces.some(
      ({ architecture, addressSpace }) =>
        architecture === "snes.65816" && addressSpace === "snes.cpu",
    ),
  );
  t.true(
    response(
      await fixture.session.dispatch(
        request(3, "uttori/startTrace", {
          architecture: "snes.65816",
          addressSpace: "snes.cpu",
        }),
      ),
    ).success,
  );
  await fixture.session.dispatch(request(4, "next", { threadId: 1 }));
  t.true(response(await fixture.session.dispatch(request(5, "uttori/stopTrace"))).success);
  const batch = traceBatch(
    response(await fixture.session.dispatch(request(6, "uttori/readTrace", { maxEvents: 16 })))
      .body,
  );
  t.deepEqual(batch.addresses, [0x008000, 0x008001]);
  t.false(batch.active);
});

test("DAP rejects stale maps and parses fragmented transport frames deterministically", async (t) => {
  const fixture = setup();
  const stale = new DebugAdapterSession({
    backend: new ReplayDebugBackend({ snapshots: [snapshot(0x008000)] }),
    debugMap: fixture.map,
    output: Uint8Array.from([0x00, 0x00]),
    sourceRoot: fixture.directory,
  });
  t.teardown(() => {
    fixture.session.dispose();
    stale.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  const launch = response(await stale.dispatch(request(1, "launch")));
  t.false(launch.success);
  t.regex(launch.message ?? "", /SHA-256 mismatch/);

  const framed = encodeDapMessage(request(7, "threads"));
  const parser = new DapMessageParser();
  t.deepEqual(parser.push(framed.subarray(0, 12)), []);
  t.deepEqual(parser.push(framed.subarray(12)), [request(7, "threads")]);
  t.is(
    formatDebugAddress({
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      address: 0x808000,
    }),
    "snes.65816|snes.cpu|0x808000",
  );
});
