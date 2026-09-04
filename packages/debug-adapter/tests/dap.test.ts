import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { AddressToLineMapping, createDebugMap } from "@uttori/asm-core";

import {
  DapMessageParser,
  DebugAdapterSession,
  ReplayDebugBackend,
  createDebugMapReplayScript,
  encodeDapMessage,
  formatDebugAddress,
  type DapRequest,
  type DapResponse,
  type ReplaySnapshot,
} from "../src/index.js";
import { test } from "../../../tests/ava-helper.js";

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
      pc: { architecture: "snes.spc700", addressSpace: "spc.aram", address: 0x200 },
    },
  ],
  registers: { 10: [{ name: "A", value: "1234", bits: 16 }] },
  memory: [{ addressSpace: "snes.cpu", start: 0x008000, bytes: [0xea, 0xdb] }],
  instructions: [
    {
      address: { architecture: "snes.spc700", addressSpace: "spc.aram", address: 0x200 },
      bytes: [0x00],
      text: "nop",
    },
  ],
});

const setup = () => {
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
  });
  return { directory, source, output, map, backend, session };
};

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
    [
      [1, "response", "initialize"],
      [2, "event", "initialized"],
    ],
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
      [3, "response", "launch"],
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
    .body as { stackFrames: Array<{ line: number; source: { path: string } }> };
  t.is(stack.stackFrames[0]?.line, 2);
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
    .body as { stackFrames: Array<{ source: { sourceReference: number } }> };
  const sourceReference = spc.stackFrames[0]?.source.sourceReference;
  t.truthy(sourceReference);
  const virtual = response(
    await fixture.session.dispatch(request(5, "source", { sourceReference })),
  ).body as { content: string };
  t.regex(virtual.content, /snes\.spc700\|spc\.aram\|0x200.*nop/);
});

test("DAP adds host annotations to disassembly without changing backend instructions", async (t) => {
  const fixture = setup();
  const session = new DebugAdapterSession({
    backend: new ReplayDebugBackend({ snapshots: [snapshot(0x008000)] }),
    debugMap: fixture.map,
    output: fixture.output,
    sourceRoot: fixture.directory,
    instructionAnnotation: ({ architecture, address }) =>
      architecture === "snes.spc700" && address === 0x200 ? "▶ 3× · state p=$20" : undefined,
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
