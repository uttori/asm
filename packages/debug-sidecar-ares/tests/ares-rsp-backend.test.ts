import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  DEBUG_BACKEND_CONFORMANCE_SCENARIOS,
  runDebugBackendConformance,
  type DebugBackendConformanceFixture,
  type DebugSubscription,
} from "@uttori/asm-debug-adapter";

import { test } from "../../../tests/ava-helper.js";
import {
  busCapabilities,
  busPosition,
  busSession,
  busScope,
} from "../../../tests/helpers/capture-bus.js";
import {
  ARES_TRACE_BUFFER_EVENTS,
  AresRspDebugBackend,
  type AresGdbRspClient,
  type GdbRspStop,
} from "../src/index.js";

const INITIAL_PC = 0x80_8000;

/** Returns the indexed element, or undefined when the index is past the end. */
const elementAt = <T>(items: readonly T[], index: number): T | undefined =>
  index >= 0 && index < items.length ? items[index] : undefined;

test("terminal detach accepts native EOF before OK and still terminates the owned process", async (t) => {
  const client = new FakeAresRspClient(fakeState());
  const original = client.request.bind(client);
  client.request = async (command) => {
    if (command !== "D") {
      return original(command);
    }
    await client.close();
    throw new Error("RSP transport closed.");
  };
  let terminated = false;
  const backend = new AresRspDebugBackend({
    createClient: () => Promise.resolve(client),
    terminate: () => {
      terminated = true;
      return Promise.resolve();
    },
  });
  await backend.connect();
  await backend.disconnect();
  t.true(terminated);
});

test("capture v2 rejects legacy runtimes and preserves exact acknowledgement integers", async (t) => {
  const legacyClient = new FakeAresRspClient(fakeState());
  const legacy = new AresRspDebugBackend({ createClient: () => Promise.resolve(legacyClient) });
  await legacy.connect();
  await t.throwsAsync(legacy.capture({ operation: "start", bufferBytes: 4718656 }), {
    message: /does not support lossless/,
  });
  t.false(legacyClient.commands.some((command) => command.startsWith("qUttoriCapture")));
  await legacy.disconnect();
  const client = new FakeAresRspClient(
    fakeState(),
    targetXml,
    "PacketSize=4096;xmlRegisters+;qXfer:features:read+;uttoriInstructionBoundaryStop+;uttoriNamedMemory+;uttoriInstructionTrace+;uttoriCaptureV2+",
  );
  const original = client.request.bind(client);
  let sent = "";
  client.request = async (command) => {
    if (!command.startsWith("qUttoriCapture:")) {
      return original(command);
    }
    sent = command;
    if (command.includes(":read:")) {
      return "";
    }
    return "E07";
  };
  const backend = new AresRspDebugBackend({ createClient: () => Promise.resolve(client) });
  await backend.connect();
  const session = "1".repeat(32),
    exact = "9007199254740993";
  t.deepEqual(await backend.capture({ operation: "read", session, chunk: exact }), { hex: "" });
  t.is(sent, `qUttoriCapture:read:${session}:${exact}`);
  await t.throwsAsync(backend.capture({ operation: "ack", session, chunk: exact, event: exact }), {
    message: /rejected \(E07\)/,
  });
  t.is(sent, `qUttoriCapture:ack:${session}:${exact}:${exact}`);
  await backend.disconnect();
});

test("bus capture negotiates distinct RSP commands and rejects scope changes", async (t) => {
  const client = new FakeAresRspClient(
    fakeState(),
    targetXml,
    "PacketSize=4096;xmlRegisters+;qXfer:features:read+;uttoriInstructionBoundaryStop+;uttoriNamedMemory+;uttoriInstructionTrace+;uttoriCaptureV2+",
  );
  const original = client.request.bind(client);
  const commands: string[] = [];
  let scopeChanged = false;
  client.request = async (command) => {
    if (!command.startsWith("qUttoriCapture:")) {
      return original(command);
    }
    commands.push(command);
    let value: unknown = busPosition();
    if (command.endsWith(":bus-capabilities")) {
      value = busCapabilities;
    } else if (command.endsWith(":capabilities")) {
      value = { ...busCapabilities, scope: "snes.65816.instructions", requiredReserveBytes: 71 };
    } else if (scopeChanged) {
      value = { ...busPosition(), scope: "snes.65816.instructions" };
    }
    return "J" + Buffer.from(JSON.stringify(value)).toString("hex");
  };
  const backend = new AresRspDebugBackend({ createClient: () => Promise.resolve(client) });
  await backend.connect();
  t.teardown(() => backend.disconnect());
  t.deepEqual(
    await backend.capture({ operation: "start", bufferBytes: 4718656, scope: busScope }),
    busPosition(),
  );
  t.deepEqual(commands, ["qUttoriCapture:bus-capabilities", "qUttoriCapture:start:4718656:bus"]);
  await backend.capture({ operation: "capabilities" });
  t.is(commands.at(-1), "qUttoriCapture:capabilities");
  // No stop has arrived yet: the step request must settle so a queued capture
  // pull can drain a long DMA instruction before its eventual stop notification.
  let stepped = false;
  client.step = () => {
    stepped = true;
    return Promise.resolve();
  };
  await backend.step(1, "instruction");
  t.true(stepped);
  t.deepEqual(await backend.capture({ operation: "status", session: busSession }), busPosition());
  scopeChanged = true;
  await t.throwsAsync(backend.capture({ operation: "status", session: busSession }), {
    message: /scope changed/,
  });
});

test("transfer capture negotiates separately and keeps long steps drainable", async (t) => {
  const client = new FakeAresRspClient(
    fakeState(),
    targetXml,
    "PacketSize=4096;xmlRegisters+;qXfer:features:read+;uttoriInstructionBoundaryStop+;uttoriNamedMemory+;uttoriInstructionTrace+;uttoriCaptureV2+",
  );
  const scope = "snes.cpu-bus-transfers";
  const position = () => ({ ...busPosition(), scope });
  const original = client.request.bind(client);
  const commands: string[] = [];
  let scopeChanged = false;
  client.request = async (command) => {
    if (!command.startsWith("qUttoriCapture:")) {
      return original(command);
    }
    commands.push(command);
    let value: unknown = position();
    if (command.endsWith(":transfer-capabilities")) {
      value = { ...busCapabilities, scope, requiredReserveBytes: 80 };
    } else if (command.endsWith(":capabilities")) {
      value = { ...busCapabilities, scope: "snes.65816.instructions", requiredReserveBytes: 71 };
    } else if (scopeChanged) {
      value = { ...busPosition(), scope: "snes.65816.instructions" };
    }
    return "J" + Buffer.from(JSON.stringify(value)).toString("hex");
  };
  const backend = new AresRspDebugBackend({ createClient: () => Promise.resolve(client) });
  await backend.connect();
  t.teardown(() => backend.disconnect());
  t.deepEqual(
    await backend.capture({ operation: "start", bufferBytes: 4718656, scope }),
    position(),
  );
  t.deepEqual(commands, [
    "qUttoriCapture:transfer-capabilities",
    "qUttoriCapture:start:4718656:bus-transfers",
  ]);
  await backend.capture({ operation: "capabilities" });
  t.is(commands.at(-1), "qUttoriCapture:capabilities");
  // No stop has arrived yet: the step request must settle so a queued capture
  // pull can drain a long DMA instruction before its eventual stop notification.
  let stepped = false;
  client.step = () => {
    stepped = true;
    return Promise.resolve();
  };
  await backend.step(1, "instruction");
  t.true(stepped);
  t.deepEqual(await backend.capture({ operation: "status", session: busSession }), position());
  scopeChanged = true;
  await t.throwsAsync(backend.capture({ operation: "status", session: busSession }), {
    message: /scope changed/,
  });
});

test("PPU effects negotiate separately and keeps long steps drainable", async (t) => {
  const client = new FakeAresRspClient(
    fakeState(),
    targetXml,
    "PacketSize=4096;xmlRegisters+;qXfer:features:read+;uttoriInstructionBoundaryStop+;uttoriNamedMemory+;uttoriInstructionTrace+;uttoriCaptureV2+",
  );
  const scope = "snes.cpu-bus-ppu";
  const position = () => ({ ...busPosition(), scope });
  const original = client.request.bind(client);
  const commands: string[] = [];
  let scopeChanged = false;
  client.request = async (command) => {
    if (!command.startsWith("qUttoriCapture:")) {
      return original(command);
    }
    commands.push(command);
    let value: unknown = position();
    if (command.endsWith(":ppu-capabilities")) {
      value = { ...busCapabilities, scope, requiredReserveBytes: 88 };
    } else if (command.endsWith(":capabilities")) {
      value = { ...busCapabilities, scope: "snes.65816.instructions", requiredReserveBytes: 71 };
    } else if (scopeChanged) {
      value = { ...busPosition(), scope: "snes.65816.instructions" };
    }
    return "J" + Buffer.from(JSON.stringify(value)).toString("hex");
  };
  const backend = new AresRspDebugBackend({ createClient: () => Promise.resolve(client) });
  await backend.connect();
  t.teardown(() => backend.disconnect());
  t.deepEqual(
    await backend.capture({ operation: "start", bufferBytes: 4718656, scope }),
    position(),
  );
  t.deepEqual(commands, [
    "qUttoriCapture:ppu-capabilities",
    "qUttoriCapture:start:4718656:bus-ppu",
  ]);
  await backend.capture({ operation: "capabilities" });
  t.is(commands.at(-1), "qUttoriCapture:capabilities");
  // No stop has arrived yet: the step request must settle so a queued capture
  // pull can drain a long DMA instruction before its eventual stop notification.
  let stepped = false;
  client.step = () => {
    stepped = true;
    return Promise.resolve();
  };
  await backend.step(1, "instruction");
  t.true(stepped);
  t.deepEqual(await backend.capture({ operation: "status", session: busSession }), position());
  scopeChanged = true;
  await t.throwsAsync(backend.capture({ operation: "status", session: busSession }), {
    message: /scope changed/,
  });
});

test("instruction-only capture runtimes reject bus setup before start", async (t) => {
  for (const reply of ["", "E05"]) {
    for (const [scope, operation] of [
      [busScope, "bus-capabilities"],
      ["snes.cpu-bus-ppu", "ppu-capabilities"],
    ] as const) {
      const client = new FakeAresRspClient(
        fakeState(),
        targetXml,
        "PacketSize=4096;xmlRegisters+;qXfer:features:read+;uttoriInstructionBoundaryStop+;uttoriNamedMemory+;uttoriInstructionTrace+;uttoriCaptureV2+",
      );
      const original = client.request.bind(client);
      const commands: string[] = [];
      client.request = async (command) => {
        if (!command.startsWith("qUttoriCapture:")) {
          return original(command);
        }
        commands.push(command);
        return reply;
      };
      const backend = new AresRspDebugBackend({ createClient: () => Promise.resolve(client) });
      await backend.connect();
      await t.throwsAsync(backend.capture({ operation: "start", bufferBytes: 4718656, scope }), {
        message: /does not support CPU\/DMA\/HDMA/,
      });
      t.deepEqual(commands, [`qUttoriCapture:${operation}`]);
      await backend.disconnect();
    }
  }
});

test("wrong-scope bus start is aborted before setup failure escapes", async (t) => {
  const client = new FakeAresRspClient(
    fakeState(),
    targetXml,
    "PacketSize=4096;xmlRegisters+;qXfer:features:read+;uttoriInstructionBoundaryStop+;uttoriNamedMemory+;uttoriInstructionTrace+;uttoriCaptureV2+",
  );
  const original = client.request.bind(client);
  const commands: string[] = [];
  client.request = async (command) => {
    if (!command.startsWith("qUttoriCapture:")) {
      return original(command);
    }
    commands.push(command);
    const value = command.endsWith(":bus-capabilities")
      ? busCapabilities
      : { ...busPosition(), scope: "snes.65816.instructions" };
    return "J" + Buffer.from(JSON.stringify(value)).toString("hex");
  };
  const backend = new AresRspDebugBackend({ createClient: () => Promise.resolve(client) });
  await backend.connect();
  await t.throwsAsync(
    backend.capture({ operation: "start", bufferBytes: 4718656, scope: busScope }),
    { message: /scope changed/ },
  );
  t.is(commands.at(-1), `qUttoriCapture:abort:${busSession}`);
  await backend.disconnect();
});

interface FakeAresState {
  a: number;
  x: number;
  y: number;
  s: number;
  d: number;
  db: number;
  pb: number;
  pc: number;
  p: number;
  e: number;
  readonly memory: Map<number, number>;
  readonly cartridgeRom: Map<number, number>;
  readonly breakpoints: Set<number>;
}

const resetState = (state: FakeAresState): void => {
  state.a = 0;
  state.x = 0;
  state.y = 0;
  state.s = 0x01ff;
  state.d = 0;
  state.db = 0x7e;
  state.pb = INITIAL_PC >>> 16;
  state.pc = INITIAL_PC & 0xffff;
  state.p = 0x34;
  state.e = 1;
  state.breakpoints.clear();
};

const fakeState = (): FakeAresState => {
  const state: FakeAresState = {
    a: 0,
    x: 0,
    y: 0,
    s: 0,
    d: 0,
    db: 0,
    pb: 0,
    pc: 0,
    p: 0,
    e: 0,
    memory: new Map([
      [INITIAL_PC, 0xea],
      [INITIAL_PC + 1, 0xea],
      [INITIAL_PC + 2, 0xdb],
    ]),
    cartridgeRom: new Map([
      [0x8000, 0xea],
      [0x8001, 0xea],
      [0x8002, 0xdb],
    ]),
    breakpoints: new Set(),
  };
  resetState(state);
  return state;
};

const littleEndian = (value: number, bytes: number): string =>
  Array.from({ length: bytes }, (_, index) =>
    ((value >>> (index * 8)) & 0xff).toString(16).padStart(2, "0"),
  ).join("");

const registerPayload = (state: FakeAresState): string =>
  [
    littleEndian(state.a, 2),
    littleEndian(state.x, 2),
    littleEndian(state.y, 2),
    littleEndian(state.s, 2),
    littleEndian(state.d, 2),
    littleEndian(state.db, 1),
    littleEndian(state.pb, 1),
    littleEndian(state.pc, 2),
    littleEndian(state.p, 1),
    littleEndian(state.e, 1),
  ].join("");

const targetXml =
  '<target version="1.0"><feature name="org.uttori.wdc65816.core">' +
  ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"]
    .map((name) => `<reg name="${name}"/>`)
    .join("") +
  "</feature></target>";

class FakeAresRspClient implements AresGdbRspClient {
  readonly #state: FakeAresState;
  readonly #targetXml: string;
  readonly #supported: string;
  readonly #namedMemoryResponse:
    | ((addressSpace: string, address: number, count: number) => string)
    | undefined;
  readonly #stopListeners = new Set<(event: GdbRspStop) => void>();
  readonly #closeListeners = new Set<(error: Error) => void>();
  readonly commands: string[] = [];
  #started = false;
  #traceActive = false;
  #traceAddresses: number[] = [];
  #traceNextSequence = 1;
  #traceDroppedEvents = 0;
  closed = false;

  constructor(
    state: FakeAresState,
    target = targetXml,
    supported = "PacketSize=4096;xmlRegisters+;qXfer:features:read+;uttoriInstructionBoundaryStop+;uttoriNamedMemory+;uttoriInstructionTrace+",
    namedMemoryResponse?: (addressSpace: string, address: number, count: number) => string,
  ) {
    this.#state = state;
    this.#targetXml = target;
    this.#supported = supported;
    this.#namedMemoryResponse = namedMemoryResponse;
  }

  async start(): Promise<void> {
    this.#started = true;
  }

  async request(command: string): Promise<string> {
    if (!this.#started || this.closed) {
      throw new Error("fake RSP client is unavailable");
    }
    this.commands.push(command);
    if (command === "qSupported") {
      return this.#supported;
    }
    if (command.startsWith("qXfer:features:read:target.xml:")) {
      return `l${this.#targetXml}`;
    }
    if (command === "g") {
      return registerPayload(this.#state);
    }
    if (command === "D") {
      return "OK";
    }
    if (command === "QUttoriTrace:1") {
      this.#traceActive = true;
      this.#traceAddresses = [];
      this.#traceNextSequence = 1;
      this.#traceDroppedEvents = 0;
      this.#recordTrace();
      return "OK";
    }
    if (command === "QUttoriTrace:0") {
      this.#traceActive = false;
      return "OK";
    }
    const traceRead = /^qUttoriTraceRead:([\dA-Fa-f]+)$/.exec(command);
    if (traceRead) {
      const count = Number.parseInt(traceRead[1], 16);
      const sequenceStart = this.#traceNextSequence - this.#traceAddresses.length;
      const addresses = this.#traceAddresses.splice(0, count);
      return `${this.#traceActive ? 1 : 0}:${sequenceStart.toString(16)}:${this.#traceDroppedEvents.toString(16)}:${addresses.map((address) => address.toString(16).padStart(16, "0")).join("")}`;
    }

    const memory = /^m([\dA-Fa-f]+),([\dA-Fa-f]+)$/.exec(command);
    if (memory) {
      const address = Number.parseInt(memory[1], 16);
      const count = Number.parseInt(memory[2], 16);
      return Array.from({ length: count }, (_, index) =>
        (this.#state.memory.get(address + index) ?? 0).toString(16).padStart(2, "0"),
      ).join("");
    }

    const namedMemory =
      /^qUttoriMemoryRead:(snes\.wram|snes\.cartridge-rom):([\dA-Fa-f]+),([\dA-Fa-f]+)$/.exec(
        command,
      );
    if (namedMemory) {
      const address = Number.parseInt(namedMemory[2], 16);
      const count = Number.parseInt(namedMemory[3], 16);
      if (this.#namedMemoryResponse) {
        return this.#namedMemoryResponse(namedMemory[1], address, count);
      }
      const source = namedMemory[1] === "snes.cartridge-rom" ? this.#state.cartridgeRom : new Map();
      return Array.from({ length: count }, (_, index) =>
        (source.get(address + index) ?? 0).toString(16).padStart(2, "0"),
      ).join("");
    }

    const breakpoint = /^([Zz])0,([\dA-Fa-f]+),1$/.exec(command);
    if (breakpoint) {
      const address = Number.parseInt(breakpoint[2], 16);
      if (breakpoint[1] === "Z") {
        this.#state.breakpoints.add(address);
      } else {
        this.#state.breakpoints.delete(address);
      }
      return "OK";
    }
    throw new Error(`Unexpected fake RSP command '${command}'.`);
  }

  async requestStop(command: string): Promise<string> {
    if (command !== "?") {
      throw new Error(`Unexpected fake stop command '${command}'.`);
    }
    await this.#emitStop();
    return "T05";
  }

  async continue(): Promise<void> {
    const breakpoint = elementAt([...this.#state.breakpoints], 0);
    if (breakpoint !== undefined) {
      this.#state.pb = breakpoint >>> 16;
      this.#state.pc = breakpoint & 0xffff;
    }
    this.#recordTrace();
    await this.#emitStop();
  }

  async step(): Promise<void> {
    const logicalPc = (this.#state.pb << 16) | this.#state.pc;
    this.#state.pc = (this.#state.pc + 1) & 0xffff;
    this.#state.a++;
    if ((logicalPc & 0xffff) === 0xffff) {
      this.#state.pb = (this.#state.pb + 1) & 0xff;
    }
    this.#recordTrace();
    await this.#emitStop();
  }

  async interrupt(): Promise<void> {
    await this.#emitStop();
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const listener of this.#closeListeners) {
      listener(new Error("fake RSP client closed"));
    }
  }

  onStop(listener: (event: GdbRspStop) => void): DebugSubscription {
    this.#stopListeners.add(listener);
    return { dispose: () => this.#stopListeners.delete(listener) };
  }

  onClose(listener: (error: Error) => void): DebugSubscription {
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }

  fail(error: Error): void {
    this.closed = true;
    for (const listener of this.#closeListeners) {
      listener(error);
    }
  }

  async #emitStop(): Promise<void> {
    await new Promise<void>((resolve) => {
      queueMicrotask(() => {
        for (const listener of this.#stopListeners) {
          listener({ signal: 5, payload: "S05" });
        }
        resolve();
      });
    });
  }

  #recordTrace(): void {
    if (!this.#traceActive) {
      return;
    }
    if (this.#traceAddresses.length === ARES_TRACE_BUFFER_EVENTS) {
      this.#traceAddresses.shift();
      this.#traceDroppedEvents++;
    }
    this.#traceAddresses.push((this.#state.pb << 16) | this.#state.pc);
    this.#traceNextSequence++;
  }
}

const fixture: DebugBackendConformanceFixture = {
  architectures: [
    {
      architecture: "snes.65816",
      addressSpaces: ["snes.cpu", "snes.wram", "snes.cartridge-rom"],
      memorySpaces: [
        { addressSpace: "snes.wram", sideEffectFree: true },
        { addressSpace: "snes.cartridge-rom", sideEffectFree: true },
      ],
      capabilities: {
        pause: true,
        step: true,
        registers: true,
        memory: true,
        stackFrames: true,
        breakpoints: true,
        disassemble: true,
      },
    },
    {
      architecture: "snes.spc700",
      addressSpaces: ["spc.aram"],
      memorySpaces: [],
      capabilities: { pause: false, step: false, registers: false, memory: false },
    },
    {
      architecture: "snes.superfx",
      addressSpaces: ["superfx.ram", "superfx.rom"],
      memorySpaces: [],
      capabilities: { pause: false, step: false, registers: false, memory: false },
    },
  ],
  primaryArchitecture: "snes.65816",
  primaryAddressSpace: "snes.cpu",
  initialAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: INITIAL_PC,
  },
  steppedAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: INITIAL_PC + 1,
  },
  breakpointAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: INITIAL_PC + 2,
  },
  memoryAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cartridge-rom",
    address: 0x8000,
  },
  memoryBytes: [0xea, 0xea, 0xdb],
  requiredRegisters: ["A", "PC"],
  disassemblyAddress: {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: INITIAL_PC,
  },
  disassemblyText: "NOP",
};

const createBackend = (): AresRspDebugBackend => {
  const state = fakeState();
  return new AresRspDebugBackend({
    createClient: ({ reset }) => {
      if (reset) {
        resetState(state);
      }
      return new FakeAresRspClient(state);
    },
  });
};

test("ares RSP backend passes the frozen conformance semantics with reduced coprocessor capabilities", async (t) => {
  const report = await runDebugBackendConformance({
    backend: "ares-rsp-scripted",
    createBackend,
    fixture,
  });
  t.true(report.passed, JSON.stringify(report.scenarios, undefined, 2));
  t.deepEqual(
    report.scenarios.map(({ id, status }) => ({ id, status })),
    DEBUG_BACKEND_CONFORMANCE_SCENARIOS.map((id) => ({ id, status: "pass" })),
  );
});

test("ares RSP backend rejects an incomplete target description", async (t) => {
  const backend = new AresRspDebugBackend({
    createClient: () => new FakeAresRspClient(fakeState(), '<target><reg name="pc"/></target>'),
  });
  const error = await t.throwsAsync(backend.connect());
  t.regex(error.message, /missing register 'a'/);
});

test("ares RSP backend requires the maintained fork's named-memory extension", async (t) => {
  const backend = new AresRspDebugBackend({
    createClient: () =>
      new FakeAresRspClient(
        fakeState(),
        targetXml,
        "PacketSize=4096;xmlRegisters+;qXfer:features:read+;uttoriInstructionBoundaryStop+;uttoriInstructionTrace+",
      ),
  });
  const error = await t.throwsAsync(backend.connect());
  t.regex(error.message, /required debugger extensions/);
});

test("ares RSP backend preserves the stopped RSP session across logical reconnect", async (t) => {
  const state = fakeState();
  let clients = 0;
  const backend = new AresRspDebugBackend({
    createClient: ({ reset }) => {
      clients++;
      if (reset) {
        resetState(state);
      }
      return new FakeAresRspClient(state);
    },
  });
  await backend.connect({ reset: true });
  await backend.step(1, "instruction");
  const before = elementAt(await backend.stackFrames(1), 0);
  await backend.disconnect({ terminate: false });
  await backend.connect({ reset: false });
  const after = elementAt(await backend.stackFrames(1), 0);
  t.is(clients, 1);
  t.deepEqual(after?.pc, before?.pc);
  await backend.disconnect({ terminate: true });
});

test("ares RSP backend pulls ordered bounded instruction traces with explicit stop", async (t) => {
  const backend = createBackend();
  await backend.connect({ reset: true });
  await backend.startTrace({
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
  });
  await backend.step(1, "instruction");
  t.deepEqual(await backend.readTrace(1), {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    sequenceStart: 1,
    addresses: [INITIAL_PC],
    droppedEvents: 0,
    active: true,
  });
  await backend.stopTrace();
  t.deepEqual(await backend.readTrace(240), {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    sequenceStart: 2,
    addresses: [INITIAL_PC + 1],
    droppedEvents: 0,
    active: false,
  });
  await t.throwsAsync(backend.readTrace(241), { message: /Trace batch size/ });
  await t.throwsAsync(
    backend.startTrace({ architecture: "snes.spc700", addressSpace: "spc.aram" }),
    { message: /is not supported/ },
  );
  await backend.disconnect({ terminate: true });
});

test("ares RSP backend reports an unexpected emulator-channel failure as restartable", async (t) => {
  const state = fakeState();
  let client: FakeAresRspClient | undefined;
  const backend = new AresRspDebugBackend({
    createClient: () => (client = new FakeAresRspClient(state)),
  });
  const events: string[] = [];
  backend.onEvent((event) => events.push(event.type));
  await backend.connect();
  client?.fail(new Error("ares crashed"));
  t.deepEqual(events.slice(-2), ["output", "terminated"]);
  t.throws(() => backend.threads(), { message: "ares RSP backend is not connected." });
});

test("ares RSP backend enforces stopped-state identities and request bounds", async (t) => {
  const backend = createBackend();
  t.throws(() => backend.threads(), { message: /not connected/ });
  await backend.connect({ reset: true });
  await t.throwsAsync(backend.connect({ reset: true }), { message: /already connected/ });
  await backend.pause();
  await t.throwsAsync(backend.pause(2), { message: /Unknown ares thread/ });
  await t.throwsAsync(backend.step(2, "instruction"), { message: /Unknown ares thread/ });
  await t.throwsAsync(backend.registers(2), { message: /Unknown ares frame/ });
  await t.throwsAsync(
    backend.readMemory({ architecture: "snes.spc700", addressSpace: "spc.aram", address: 0 }, 1),
    { message: /unsupported architecture/ },
  );
  await t.throwsAsync(
    backend.readMemory({ architecture: "snes.65816", addressSpace: "snes.rom", address: 0 }, 1),
    { message: /unsupported memory address space/ },
  );
  await t.throwsAsync(backend.readMemory(fixture.initialAddress, 1), {
    message: /unsupported memory address space/,
  });
  await t.throwsAsync(backend.readMemory(fixture.memoryAddress, -1), {
    message: /Memory count must be an integer/,
  });
  const empty = await backend.readMemory(fixture.memoryAddress, 0);
  t.deepEqual([...empty.bytes], []);
  t.is(empty.unreadableBytes, 0);
  await t.throwsAsync(backend.setBreakpoints([fixture.initialAddress, fixture.initialAddress]), {
    message: /Duplicate/,
  });
  const [first] = await backend.setBreakpoints([fixture.initialAddress]);
  const [same] = await backend.setBreakpoints([fixture.initialAddress]);
  t.deepEqual(same, first);
  t.deepEqual(await backend.disassemble(fixture.initialAddress, 0), []);
  await t.throwsAsync(backend.disassemble(fixture.initialAddress, -1), {
    message: /Disassembly count must be an integer/,
  });
  await backend.disconnect({ terminate: true });
});

test("ares RSP backend reads only advertised named storage and chunks bounded packets", async (t) => {
  const client = new FakeAresRspClient(fakeState());
  const backend = new AresRspDebugBackend({ createClient: () => client });
  await backend.connect({ reset: true });
  const memory = await backend.readMemory(
    { architecture: "snes.65816", addressSpace: "snes.wram", address: 0 },
    0x1001,
  );
  t.is(memory.unreadableBytes, 0);
  t.is(memory.bytes.length, 0x1001);
  t.deepEqual(
    client.commands.filter((command) => command.startsWith("qUttoriMemoryRead:")),
    ["qUttoriMemoryRead:snes.wram:0,1000", "qUttoriMemoryRead:snes.wram:1000,1"],
  );
  await backend.disconnect({ terminate: true });
});

const backendFor = (response: string) =>
  new AresRspDebugBackend({
    createClient: () => new FakeAresRspClient(fakeState(), targetXml, undefined, () => response),
  });

test("ares RSP backend rejects failed or malformed named-memory replies and reports short reads", async (t) => {
  const address = {
    architecture: "snes.65816",
    addressSpace: "snes.wram",
    address: 0,
  } as const;

  const failed = backendFor("E01");
  await failed.connect({ reset: true });
  await t.throwsAsync(failed.readMemory(address, 2), { message: /read failed/ });
  await failed.disconnect({ terminate: true });

  const malformed = backendFor("0");
  await malformed.connect({ reset: true });
  await t.throwsAsync(malformed.readMemory(address, 2), { message: /response is malformed/ });
  await malformed.disconnect({ terminate: true });

  const short = backendFor("aa");
  await short.connect({ reset: true });
  const result = await short.readMemory(address, 2);
  t.deepEqual([...result.bytes], [0xaa, 0]);
  t.is(result.unreadableBytes, 1);
  await short.disconnect({ terminate: true });
});

test("native file capture binds local manifest identity and keeps event bytes off RSP", async (t) => {
  const client = new FakeAresRspClient(
    fakeState(),
    targetXml,
    "PacketSize=4096;xmlRegisters+;qXfer:features:read+;uttoriInstructionBoundaryStop+;uttoriNamedMemory+;uttoriInstructionTrace+;uttoriCaptureV2+",
  );
  const original = client.request.bind(client),
    commands: string[] = [];
  client.request = async (command) => {
    if (!command.startsWith("qUttoriCaptureFile:")) {
      return original(command);
    }
    commands.push(command);
    const value = command.includes(":capabilities:")
      ? { ...busCapabilities, nativeFile: true }
      : { ...busPosition(), fileState: "writing", fileBytes: "0", fileBatches: "0" };
    return "J" + Buffer.from(JSON.stringify(value)).toString("hex");
  };
  const identity = { romSha256: "a".repeat(64), executableSha256: "b".repeat(64) };
  const backend = new AresRspDebugBackend({
    createClient: async () => client,
    nativeFileIdentity: identity,
  });
  await backend.connect();
  const request = {
    operation: "file-start",
    measureStages: true,
    file: "/tmp/trace: unicode-é.act2",
    scope: busScope,
    bufferBytes: 4718656,
    romContentSha256: identity.romSha256,
    producer: { id: "ares", revision: identity.executableSha256 },
  } as const;
  await t.throwsAsync(backend.capture({ ...request, romContentSha256: "c".repeat(64) }), {
    message: /identity does not match/,
  });
  t.is(commands.length, 0);
  await backend.capture(request);
  t.is(commands[0], "qUttoriCaptureFile:capabilities:bus");
  t.true(commands[1].includes(`:${Buffer.from(request.file).toString("hex")}:`));
  t.true(commands[1].endsWith(":profile"));
  await backend.capture({ operation: "file-stop", session: busSession });
  t.is(commands.at(-1), `qUttoriCaptureFile:stop:${busSession}`);
  await backend.disconnect();
});

test("capture context binds the runtime identity and holds the setup boundary", async (t) => {
  const client = new FakeAresRspClient(fakeState());
  const original = client.request.bind(client);
  const commands: string[] = [];
  client.request = async (command) => {
    if (!command.startsWith("qUttoriContext:")) {
      return original(command);
    }
    commands.push(command);
    if (command.startsWith("qUttoriContext:prepare:")) {
      return "prepared";
    }
    if (command.startsWith("qUttoriContext:start:")) {
      return "recording";
    }
    if (command === "qUttoriContext:abort") {
      return "aborted";
    }
    return "";
  };
  const nativeFileIdentity = { romSha256: "a".repeat(64), executableSha256: "b".repeat(64) };
  const backend = new AresRspDebugBackend({ createClient: async () => client, nativeFileIdentity });
  await backend.connect();
  const request = {
    operation: "context",
    action: "prepare",
    directory: "/tmp/capture: é.context",
    romContentSha256: nativeFileIdentity.romSha256,
    producer: { id: "ares", revision: nativeFileIdentity.executableSha256 },
  } as const;
  await t.throwsAsync(backend.capture({ ...request, romContentSha256: "c".repeat(64) }), {
    message: /does not match/,
  });
  t.is(commands.length, 0);
  t.deepEqual(await backend.capture(request), { contextState: "prepared" });
  t.true(commands[0].includes(Buffer.from(request.directory).toString("hex")));
  await t.throwsAsync(backend.continue(), { message: /fixing its execution boundary/ });
  await backend.capture({ operation: "context", action: "start", session: "1".repeat(32) });
  await t.notThrowsAsync(backend.continue());
  await backend.pause();
  await backend.capture({ operation: "context", action: "abort" });
  await backend.disconnect();
});

test("context restore/replay accepts a recorded build while authenticating its companion", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ares-context-build-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const romContentSha256 = "a".repeat(64),
    producer = { id: "ares", revision: "recorded-build" };
  // Native state deserialization is outside this fake transport test. The complete companion
  // exercises real artifact verification before the backend sends the old producer identity.
  const artifacts: Record<string, Buffer> = {
    "start.bst": Buffer.alloc(538),
    "wram-start.bin": Buffer.alloc(131072),
    "wram-end.bin": Buffer.alloc(131072),
    "inputs.bin": Buffer.alloc(0),
    "identity.txt": Buffer.from(`${romContentSha256}\nares\nrecorded-build\n`),
    "machine.json": Buffer.from('{"region":"NTSC","accuratePpu":false}'),
    "start-clock.txt": Buffer.from("0"),
    "end-clock.txt": Buffer.from("100"),
    "boundaries.json": Buffer.from("{}"),
  };
  const files: Record<string, { bytes: number; sha256: string }> = {};
  for (const [name, bytes] of Object.entries(artifacts)) {
    await writeFile(path.join(directory, name), bytes);
    files[name] = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      format: "uttori-capture-context",
      version: 1,
      romContentSha256,
      producer,
      files,
    }),
  );
  const client = new FakeAresRspClient(fakeState()),
    original = client.request.bind(client);
  const sent: string[] = [];
  client.request = async (command) => {
    if (!command.startsWith("qUttoriContext:")) return original(command);
    sent.push(command);
    if (command.startsWith("qUttoriContext:restore:")) return "restored";
    if (command.startsWith("qUttoriContext:replay:")) return "replaying";
    return "aborted";
  };
  const backend = new AresRspDebugBackend({
    createClient: async () => client,
    nativeFileIdentity: { romSha256: romContentSha256, executableSha256: "b".repeat(64) },
  });
  await backend.connect();
  t.teardown(() => backend.disconnect());
  const request = {
    operation: "context",
    action: "restore",
    directory,
    romContentSha256,
    producer: { id: "ares", revision: "b".repeat(64) },
  } as const;
  t.deepEqual(await backend.capture(request), { contextState: "restored" });
  t.deepEqual(await backend.capture({ ...request, action: "replay" }), {
    contextState: "replaying",
  });
  t.true(sent.every((command) => command.endsWith(Buffer.from(producer.revision).toString("hex"))));
  await t.throwsAsync(backend.capture({ ...request, producer, action: "prepare" }), {
    message: /does not match/,
  });
  await t.throwsAsync(backend.capture({ ...request, romContentSha256: "c".repeat(64) }), {
    message: /does not match/,
  });
  await writeFile(path.join(directory, "start-clock.txt"), "1");
  const before = sent.length;
  await t.throwsAsync(backend.capture(request), { message: /checksum mismatch/ });
  t.is(sent.length, before);
});

test("Famicom context requires full iNES identity before sending a native prepare", async (t) => {
  const xml =
    '<target><feature name="dev.ares.ricoh2a03.core">' +
    ["a", "x", "y", "s", "p", "pc"].map((name) => `<reg name="${name}"/>`).join("") +
    "</feature></target>";
  const client = new FakeAresRspClient(
    fakeState(),
    xml,
    "PacketSize=4096;xmlRegisters+;qXfer:features:read+;uttoriInstructionBoundaryStop+;uttoriNamedMemory+;uttoriInstructionTrace+;uttoriCaptureV2+",
  );
  const original = client.request.bind(client);
  const commands: string[] = [];
  client.request = async (command) => {
    if (command === "g") {
      return "000000fd240080";
    }
    if (command.startsWith("qUttoriContext:")) {
      commands.push(command);
      if (command.startsWith("qUttoriContext:prepare:")) {
        return "prepared";
      }
      if (command === "qUttoriContext:abort") {
        return "aborted";
      }
    }
    if (command.startsWith("qUttoriCaptureFile:")) {
      commands.push(command);
      let value: unknown = {
        ...busPosition(),
        scope: "nes.cpu-bus-ppu",
        fileState: "writing",
        fileBytes: "0",
        fileBatches: "0",
      };
      if (command.includes(":capabilities:")) {
        value = {
          ...busCapabilities,
          scope: "nes.cpu-bus-ppu",
          requiredReserveBytes: 128,
          nativeFile: true,
        };
      }
      return "J" + Buffer.from(JSON.stringify(value)).toString("hex");
    }
    return original(command);
  };
  const identity = {
    romSha256: "a".repeat(64),
    romFileSha256: "b".repeat(64),
    executableSha256: "c".repeat(64),
  };
  const backend = new AresRspDebugBackend({
    createClient: async () => client,
    nativeFileIdentity: identity,
  });
  await backend.connect();
  const request = {
    operation: "context",
    action: "prepare",
    directory: "/tmp/nes.context",
    romContentSha256: identity.romSha256,
    producer: { id: "ares", revision: identity.executableSha256 },
  } as const;
  await t.throwsAsync(backend.capture(request), { message: /does not match/ });
  await t.throwsAsync(backend.capture({ ...request, romFileSha256: "d".repeat(64) }), {
    message: /does not match/,
  });
  t.is(commands.length, 0);
  t.deepEqual(await backend.capture({ ...request, romFileSha256: identity.romFileSha256 }), {
    contextState: "prepared",
  });
  t.true(commands[0].endsWith(`:${Buffer.from(identity.romFileSha256).toString("hex")}`));
  await backend.capture({ operation: "context", action: "abort" });
  // Keep the native file command's digest raw, while context commands encode text.
  await backend.capture({
    operation: "file-start",
    scope: "nes.cpu-bus-ppu",
    file: "/tmp/nes.act2",
    bufferBytes: 8388608,
    romContentSha256: identity.romSha256,
    romFileSha256: identity.romFileSha256,
    producer: request.producer,
  });
  const start = commands.find((command) => command.startsWith("qUttoriCaptureFile:start:"))!;
  t.is(start.split(":").length, 9);
  t.true(start.endsWith(`:${identity.romFileSha256}`));
  await backend.disconnect();
});
