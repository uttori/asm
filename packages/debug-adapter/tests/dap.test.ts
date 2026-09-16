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

const response = (messages: Awaited<ReturnType<DebugAdapterSession["dispatch"]>>): DapResponse =>
  messages[0] as DapResponse;

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
      if (message.type === "event" && message.event === "initialized") ready();
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
  t.is(
    messages.at(-1)?.type === "event" && (messages.at(-1) as { event: string }).event,
    "stopped",
  );
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
  t.true(Boolean((initialize[0] as DapResponse).body && (initialize[0] as DapResponse).success));

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
  const breakpointBody = response(sourceBreakpoints).body as {
    breakpoints: Array<{ verified: boolean; line: number }>;
  };
  t.deepEqual(
    breakpointBody.breakpoints.map(({ verified, line }) => ({ verified, line })),
    [
      { verified: true, line: 2 },
      { verified: false, line: 99 },
    ],
  );

  const stack = response(await fixture.session.dispatch(request(4, "stackTrace", { threadId: 1 })))
    .body as { stackFrames: Array<{ name: string; line: number; source: { path: string } }> };
  t.is(stack.stackFrames[0]?.line, 2);
  t.is(stack.stackFrames[0]?.name, "65816 (current frame only)");
  t.is(stack.stackFrames[0]?.source.path, fixture.source);

  const scopes = response(await fixture.session.dispatch(request(5, "scopes", { frameId: 10 })))
    .body as { scopes: Array<{ variablesReference: number }> };
  const variables = response(
    await fixture.session.dispatch(
      request(6, "variables", { variablesReference: scopes.scopes[0]?.variablesReference }),
    ),
  ).body as { variables: Array<{ name: string; value: string }> };
  t.deepEqual(variables.variables, [
    { name: "A", value: "0x1234", type: "uint16", variablesReference: 0 },
  ]);

  const registerWatch = response(
    await fixture.session.dispatch(request(7, "evaluate", { expression: "a", frameId: 10 })),
  ).body as { result: string; type: string; variablesReference: number };
  t.deepEqual(registerWatch, { result: "0x1234", type: "uint16", variablesReference: 0 });
  const expressionWatch = response(
    await fixture.session.dispatch(
      request(8, "evaluate", { expression: "($10 + A) & $FFFF", frameId: 10 }),
    ),
  ).body as { result: string; type: string; variablesReference: number };
  t.deepEqual(expressionWatch, { result: "0x1244", type: "integer", variablesReference: 0 });
  const invalidWatch = response(
    await fixture.session.dispatch(request(9, "evaluate", { expression: "missing", frameId: 10 })),
  );
  t.false(invalidWatch.success);
  t.regex(invalidWatch.message ?? "", /Unknown register 'missing'/);

  const instructionBreakpoints = response(
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
  ).body as { breakpoints: Array<{ verified: boolean }> };
  t.true(instructionBreakpoints.breakpoints[0]?.verified);

  const memory = response(
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
  ).body as { data: string; unreadableBytes: number };
  t.is(memory.data, Buffer.from([0xea, 0xdb]).toString("base64"));
  t.is(memory.unreadableBytes, 0);

  const disassembly = response(
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
  ).body as { instructions: Array<{ instruction: string }> };
  t.is(disassembly.instructions[0]?.instruction, "nop");

  const step = await fixture.session.dispatch(request(13, "next", { threadId: 1 }));
  t.deepEqual(
    step.map((message) => ("event" in message ? message.event : message.command)),
    ["next", "continued", "stopped"],
  );
  const advanced = response(
    await fixture.session.dispatch(request(14, "stackTrace", { threadId: 1 })),
  ).body as { stackFrames: Array<{ line: number }> };
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
  t.true(
    (initialize.body as { supportsBreakpointLocationsRequest?: boolean })
      .supportsBreakpointLocationsRequest,
  );
  await fixture.session.dispatch(request(2, "launch"));
  const locations = response(
    await fixture.session.dispatch(
      request(3, "breakpointLocations", {
        source: { path: fixture.source },
        line: 1,
        endLine: 3,
      }),
    ),
  ).body as { breakpoints: Array<{ line: number; column: number }> };
  t.deepEqual(locations.breakpoints, [
    { line: 2, column: 1 },
    { line: 3, column: 1 },
  ]);

  const moved = response(
    await fixture.session.dispatch(
      request(4, "setBreakpoints", {
        source: { path: fixture.source },
        breakpoints: [{ line: 1 }],
      }),
    ),
  ).body as { breakpoints: Array<{ verified: boolean; line: number }> };
  t.deepEqual(
    moved.breakpoints.map(({ verified, line }) => ({ verified, line })),
    [{ verified: true, line: 2 }],
  );
});

test("DAP installs and removes source breakpoints while running without exposing maintenance stops", async (t) => {
  const fixture = setup();
  fixture.session.dispose();
  const listeners = new Set<(event: DebugBackendEvent) => void>();
  const actions: string[] = [];
  let stopped = true;
  let nextBreakpointId = 1;
  const emit = (event: DebugBackendEvent): void => {
    for (const listener of listeners) listener(event);
  };
  const unsupported = (): Promise<never> => Promise.reject(new Error("Not used by this test."));
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
      if (!stopped) return Promise.reject(new Error("Test backend is already running."));
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
      if (!stopped)
        return Promise.reject(new Error("Test backend must be stopped to change breakpoints."));
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
  t.is(messages.at(-1)?.type === "event" ? messages.at(-1).event : undefined, "stopped");
});

test("DAP resolves mirrored PCs and supplies virtual disassembly sources", async (t) => {
  const fixture = setup();
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await fixture.session.dispatch(request(1, "initialize"));
  await fixture.session.dispatch(request(2, "launch"));

  const cpu = response(await fixture.session.dispatch(request(3, "stackTrace", { threadId: 1 })))
    .body as { stackFrames: Array<{ line: number; source: { path?: string } }> };
  t.is(cpu.stackFrames[0]?.line, 2);
  t.is(cpu.stackFrames[0]?.source.path, fixture.source);

  const spc = response(await fixture.session.dispatch(request(4, "stackTrace", { threadId: 2 })))
    .body as {
    stackFrames: Array<{
      line: number;
      source: { sourceReference: number; path: string; presentationHint: string };
    }>;
  };
  const sourceReference = spc.stackFrames[0]?.source.sourceReference;
  t.truthy(sourceReference);
  t.is(spc.stackFrames[0]?.source.path, `/uttori-disassembly/snes.spc700/${sourceReference}.asm`);
  t.is(spc.stackFrames[0]?.source.presentationHint, "normal");
  const virtual = response(
    await fixture.session.dispatch(request(5, "source", { sourceReference })),
  ).body as { content: string };
  t.true(virtual.content.startsWith("; Debugger disassembly (temporary, read-only view)\n"));
  t.regex(virtual.content, /; Shown because the current instruction has no matching source line/);
  // The execution highlight must point at the instruction, below the explanation.
  t.regex(
    virtual.content.split("\n")[spc.stackFrames[0]!.line - 1]!,
    /^snes\.spc700\|spc\.aram\|0x200.*nop/,
  );

  await fixture.session.dispatch(request(6, "next", { threadId: 2 }));
  const refreshed = response(
    await fixture.session.dispatch(request(7, "stackTrace", { threadId: 2 })),
  ).body as { stackFrames: Array<{ source: { sourceReference: number } }> };
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
  const scopeBody = response(await fixture.session.dispatch(request(3, "scopes", { frameId: 10 })))
    .body as { scopes: Array<{ name: string; variablesReference: number }> };
  t.deepEqual(
    scopeBody.scopes.map(({ name }) => name),
    ["65816 Registers", "65816 CPU", "65816 Flags", "65816 Memory Spaces", "65816 Stack Bytes"],
  );

  const flagsScope = scopeBody.scopes.find(({ name }) => name === "65816 Flags");
  const flags = response(
    await fixture.session.dispatch(
      request(4, "variables", { variablesReference: flagsScope?.variablesReference }),
    ),
  ).body as { variables: Array<{ name: string; value: string }> };
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
  const spaces = response(
    await fixture.session.dispatch(
      request(5, "variables", { variablesReference: memoryScope?.variablesReference }),
    ),
  ).body as { variables: Array<{ name: string; memoryReference: string }> };
  t.deepEqual(
    spaces.variables.map(({ name }) => name),
    ["snes.cpu"],
  );
  t.truthy(spaces.variables[0]?.memoryReference);

  const stackScope = scopeBody.scopes.find(({ name }) => name === "65816 Stack Bytes");
  const stack = response(
    await fixture.session.dispatch(
      request(6, "variables", { variablesReference: stackScope?.variablesReference }),
    ),
  ).body as { variables: Array<{ name: string; value: string }> };
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
  const threads = response(await session.dispatch(request(2, "threads"))).body as {
    threads: Array<{ id: number; name: string }>;
  };
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
      if (architecture === "snes.spc700" && address === 0x200) return "▶ 3× · state p=$20";
      throw new Error("Optional annotation database unavailable");
    },
  });
  t.teardown(() => {
    fixture.session.dispose();
    session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await session.dispatch(request(1, "launch"));
  const disassembly = response(
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
  ).body as { instructions: Array<{ instruction: string }> };
  t.is(disassembly.instructions[0]?.instruction, "nop ; ▶ 3× · state p=$20");

  const stack = response(await session.dispatch(request(3, "stackTrace", { threadId: 2 })))
    .body as {
    stackFrames: Array<{ source: { sourceReference: number } }>;
  };
  const source = response(
    await session.dispatch(
      request(4, "source", { sourceReference: stack.stackFrames[0]?.source.sourceReference }),
    ),
  ).body as { content: string };
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
  const before = response(await session.dispatch(request(2, "stackTrace", { threadId: 1 })))
    .body as { stackFrames: Array<{ line: number }> };
  t.is(before.stackFrames[0]?.line, 2);
  await session.dispatch(request(3, "next", { threadId: 1 }));
  const after = response(await session.dispatch(request(4, "stackTrace", { threadId: 1 })))
    .body as { stackFrames: Array<{ line: number }> };
  t.is(after.stackFrames[0]?.line, 3);
});

test("DAP exposes explicit bounded trace recording only through custom requests", async (t) => {
  const fixture = setup();
  t.teardown(() => {
    fixture.session.dispose();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await fixture.session.dispatch(request(1, "launch"));
  const capabilities = response(
    await fixture.session.dispatch(request(2, "uttori/traceCapabilities")),
  ).body as {
    traces: Array<{
      architecture: string;
      addressSpace: string;
      maxBufferedEvents: number;
      maxBatchEvents: number;
    }>;
  };
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
  const batch = response(
    await fixture.session.dispatch(request(6, "uttori/readTrace", { maxEvents: 16 })),
  ).body as { addresses: number[]; active: boolean };
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
