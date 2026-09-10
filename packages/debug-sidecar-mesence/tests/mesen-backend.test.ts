import { Buffer } from "node:buffer";

import {
  DEBUG_BACKEND_CONFORMANCE_SCENARIOS,
  runDebugBackendConformance,
  type DebugBackendConformanceFixture,
  type DebugSubscription,
} from "@uttori/asm-debug-adapter";

import { test } from "../../../tests/ava-helper.js";
import { MesenDebugBackend, type MesenDebugClient } from "../src/index.js";

const INITIAL_PC = 0x80_8000;

interface FakeMesenState {
  stopped: boolean;
  pc: number;
  readonly breakpoints: Set<number>;
  readonly memory: Map<string, Map<number, number>>;
}

const resetState = (state: FakeMesenState): void => {
  state.stopped = true;
  state.pc = INITIAL_PC;
  state.breakpoints.clear();
};

const fakeState = (): FakeMesenState => {
  const state: FakeMesenState = {
    stopped: true,
    pc: INITIAL_PC,
    breakpoints: new Set<number>(),
    memory: new Map<string, Map<number, number>>([
      [
        "SnesMemory",
        new Map<number, number>([
          [INITIAL_PC, 0xea],
          [INITIAL_PC + 1, 0xea],
          [INITIAL_PC + 2, 0xdb],
          [INITIAL_PC + 3, 0xea],
        ]),
      ],
      [
        "SnesPrgRom",
        new Map<number, number>([
          [0x8000, 0xea],
          [0x8001, 0xea],
          [0x8002, 0xdb],
        ]),
      ],
      ["SnesWorkRam", new Map<number, number>()],
      ["SpcRam", new Map<number, number>([[0, 0x00]])],
      [
        "GsuMemory",
        new Map<number, number>([
          [0x0a_8000, 0x3d],
          [0x0a_8001, 0x50],
          [0x0a_8002, 0x01],
          [0x0a_8003, 0x01],
        ]),
      ],
      ["GsuWorkRam", new Map<number, number>()],
    ]),
  };
  resetState(state);
  return state;
};

class FakeMesenDebugClient implements MesenDebugClient {
  readonly #state: FakeMesenState;
  readonly #closeListeners = new Set<(error?: Error) => void>();
  closed = false;

  constructor(state: FakeMesenState) {
    this.#state = state;
  }

  async request(method: string, parameters: Readonly<Record<string, unknown>> = {}) {
    await Promise.resolve();
    if (this.closed) throw new Error("fake Mesen client is closed");
    if (method === "hello") {
      return {
        protocolVersion: 1,
        emulator: "MesenCE",
        stopped: this.#state.stopped,
        processors: ["65816", "spc700"],
        maxMemoryRead: 4096,
      };
    }
    if (method === "shutdown") return { shuttingDown: true };
    const cpu = typeof parameters.cpu === "string" ? parameters.cpu : "65816";
    if (
      method === "status" ||
      method === "pause" ||
      method === "reset" ||
      method === "resume" ||
      method === "step"
    ) {
      if (method === "reset") resetState(this.#state);
      if (method === "pause") this.#state.stopped = true;
      if (method === "resume") {
        const breakpoint = [...this.#state.breakpoints][0];
        if (breakpoint === undefined) this.#state.stopped = false;
        else {
          this.#state.pc = breakpoint;
          this.#state.stopped = true;
        }
        return { stopped: this.#state.stopped, cpu };
      }
      if (method === "step") {
        this.#state.pc++;
        this.#state.stopped = true;
      }
      return this.#status(cpu);
    }
    if (method === "setBreakpoints") {
      const addresses = parameters.addresses;
      if (!Array.isArray(addresses)) throw new Error("fake breakpoint list missing");
      this.#state.breakpoints.clear();
      for (const address of addresses) this.#state.breakpoints.add(Number(address));
      return { count: addresses.length };
    }
    if (method === "readMemory") {
      const space = String(parameters.space);
      const address = Number(parameters.address);
      const length = Number(parameters.length);
      const source = this.#state.memory.get(space) ?? new Map<number, number>();
      const data = Buffer.from(
        Array.from({ length }, (_, index) => source.get(address + index) ?? 0),
      ).toString("base64");
      return { space, address, data };
    }
    throw new Error(`Unknown fake Mesen method '${method}'.`);
  }

  async close(): Promise<void> {
    await Promise.resolve();
    if (this.closed) return;
    this.closed = true;
    for (const listener of this.#closeListeners) listener();
  }

  onClose(listener: (error?: Error) => void): DebugSubscription {
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }

  fail(error: Error): void {
    this.closed = true;
    for (const listener of this.#closeListeners) listener(error);
  }

  #status(cpu: string) {
    if (cpu === "spc700") {
      return {
        stopped: this.#state.stopped,
        cpu,
        programCounter: 0,
        registers: { A: 0, X: 0, Y: 0, SP: 0xff, PC: 0, PS: 0, cycle: 0 },
      };
    }
    return {
      stopped: this.#state.stopped,
      cpu: "65816",
      programCounter: this.#state.pc,
      registers: {
        A: 0,
        X: 0,
        Y: 0,
        SP: 0x01ff,
        D: 0,
        PC: this.#state.pc & 0xffff,
        K: this.#state.pc >>> 16,
        DBR: 0x7e,
        PS: 0x34,
        emulationMode: true,
        cycleCount: 0,
      },
    };
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
      memorySpaces: [{ addressSpace: "spc.aram", sideEffectFree: true }],
      capabilities: {
        pause: true,
        step: true,
        registers: true,
        memory: true,
        stackFrames: true,
        breakpoints: false,
        disassemble: true,
      },
    },
    {
      architecture: "snes.superfx",
      addressSpaces: ["superfx.rom", "superfx.ram"],
      memorySpaces: [
        { addressSpace: "superfx.rom", sideEffectFree: true },
        { addressSpace: "superfx.ram", sideEffectFree: true },
      ],
      capabilities: {
        pause: true,
        step: true,
        registers: true,
        memory: true,
        stackFrames: true,
        breakpoints: false,
        disassemble: true,
      },
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

const createBackend = (state = fakeState()): MesenDebugBackend =>
  new MesenDebugBackend({
    createClient: ({ reset }) => {
      if (reset) resetState(state);
      return new FakeMesenDebugClient(state);
    },
    pollIntervalMs: 1,
  });

const helloPayload = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  protocolVersion: 1,
  emulator: "MesenCE",
  stopped: true,
  processors: ["65816", "spc700"],
  maxMemoryRead: 4096,
  ...overrides,
});

const backendWithHello = (value: unknown): MesenDebugBackend => {
  const client = new FakeMesenDebugClient(fakeState());
  const request = client.request.bind(client);
  client.request = (method, parameters) =>
    method === "hello" ? Promise.resolve(value) : request(method, parameters);
  return new MesenDebugBackend({ createClient: () => client, pollIntervalMs: 1 });
};

test("Mesen translator passes the frozen backend conformance semantics", async (t) => {
  const state = fakeState();
  const report = await runDebugBackendConformance({
    backend: "mesence-scripted",
    createBackend: () => createBackend(state),
    fixture,
  });
  t.true(report.passed, JSON.stringify(report.scenarios, undefined, 2));
  t.deepEqual(
    report.scenarios.map(({ id, status }) => ({ id, status })),
    DEBUG_BACKEND_CONFORMANCE_SCENARIOS.map((id) => ({ id, status: "pass" })),
  );
});

test("Mesen translator exposes SPC700 state and native disassembly", async (t) => {
  const backend = createBackend();
  await backend.connect();
  const spc = (await backend.threads()).find(({ architecture }) => architecture === "snes.spc700");
  t.truthy(spc);
  const frame = (await backend.stackFrames(spc?.id ?? -1))[0];
  t.is(frame?.pc.address, 0);
  t.deepEqual(
    (await backend.registers(frame?.id ?? -1)).map(({ name }) => name),
    ["A", "X", "Y", "SP", "PC", "P", "Cycle"],
  );
  t.is((await backend.disassemble(frame?.pc ?? fixture.initialAddress, 1))[0]?.text, "NOP");
  await backend.disconnect();
});

test("Mesen translator fails closed on invalid native identity and client loss", async (t) => {
  const badIdentity = new FakeMesenDebugClient(fakeState());
  const originalRequest = badIdentity.request.bind(badIdentity);
  badIdentity.request = async (method, parameters) =>
    method === "hello"
      ? { ...(await originalRequest(method, parameters)), emulator: "unexpected" }
      : originalRequest(method, parameters);
  const invalid = new MesenDebugBackend({ createClient: () => badIdentity });
  await t.throwsAsync(invalid.connect(), { message: "Mesen emulator identity is unsupported." });

  const client = new FakeMesenDebugClient(fakeState());
  const backend = new MesenDebugBackend({ createClient: () => client });
  const events: string[] = [];
  backend.onEvent((event) => events.push(event.type));
  await backend.connect();
  client.fail(new Error("native Mesen connection failed"));
  t.deepEqual(events.slice(-2), ["output", "terminated"]);
  t.throws(() => backend.threads(), { message: "Mesen backend is not connected." });
});

test("Mesen translator rejects malformed discovery and incoherent connect states", async (t) => {
  const invalidHello: readonly [unknown, RegExp][] = [
    [null, /hello must be an object/],
    [helloPayload({ protocolVersion: 2 }), /protocol version 2 is unsupported/],
    [helloPayload({ processors: null }), /processor list must contain/],
    [helloPayload({ processors: [] }), /processor list must contain/],
    [helloPayload({ processors: ["65816", "spc700", "superfx", "65816"] }), /processor list/],
    [helloPayload({ processors: ["65816", "unknown"] }), /processor 1 is unsupported/],
    [helloPayload({ processors: ["65816", "65816"] }), /one unique 65816/],
    [helloPayload({ processors: ["spc700"] }), /one unique 65816/],
    [helloPayload({ maxMemoryRead: 0 }), /must be positive/],
    [helloPayload({ stopped: "yes" }), /stopped state must be a boolean/],
  ];
  for (const [hello, message] of invalidHello)
    await t.throwsAsync(backendWithHello(hello).connect(), { message });

  t.throws(
    () =>
      new MesenDebugBackend({
        createClient: () => new FakeMesenDebugClient(fakeState()),
        pollIntervalMs: 0,
      }),
    {
      message: /poll interval must be positive/,
    },
  );
  const closedClient = new FakeMesenDebugClient(fakeState());
  closedClient.closed = true;
  await t.throwsAsync(new MesenDebugBackend({ createClient: () => closedClient }).connect(), {
    message: /factory returned a closed client/,
  });

  const runningState = fakeState();
  runningState.stopped = false;
  const attach = createBackend(runningState);
  await attach.connect({ reset: false });
  await t.throwsAsync(attach.connect(), { message: /already connected/ });
  await attach.disconnect({ terminate: false });

  const noStopClient = new FakeMesenDebugClient(fakeState());
  const noStopRequest = noStopClient.request.bind(noStopClient);
  noStopClient.request = async (method, parameters) => {
    const value = await noStopRequest(method, parameters);
    return method === "reset" && typeof value === "object" && value
      ? { ...value, stopped: false }
      : value;
  };
  await t.throwsAsync(
    new MesenDebugBackend({ createClient: () => noStopClient }).connect({ reset: true }),
    { message: /did not reach a coherent stopped state/ },
  );
});

test("Mesen translator validates stopped state, addresses, and native responses", async (t) => {
  const client = new FakeMesenDebugClient(fakeState());
  const backend = new MesenDebugBackend({ createClient: () => client, pollIntervalMs: 1 });
  await backend.connect();
  const request = client.request.bind(client);
  const invalidStatus: readonly [Readonly<Record<string, unknown>>, RegExp][] = [
    [{ stopped: true, cpu: "spc700", programCounter: 0, registers: {} }, /did not match/],
    [{ stopped: "yes", cpu: "65816", programCounter: 0, registers: {} }, /must be a boolean/],
    [
      { stopped: true, cpu: "65816", programCounter: 0x1_00_00_00, registers: {} },
      /program counter/,
    ],
    [
      { stopped: true, cpu: "65816", programCounter: 0, registers: null },
      /registers must be an object/,
    ],
  ];
  for (const [status, message] of invalidStatus) {
    client.request = (method, parameters) =>
      method === "status" ? Promise.resolve(status) : request(method, parameters);
    await t.throwsAsync(backend.stackFrames(1), { message });
  }
  client.request = request;

  await backend.pause();
  await t.throwsAsync(
    backend.startTrace({ architecture: "snes.65816", addressSpace: "snes.cpu" }),
    { message: /not implemented/ },
  );
  await t.throwsAsync(backend.readTrace(1), { message: /not implemented/ });
  await t.throwsAsync(backend.stopTrace(), { message: /not implemented/ });
  await t.throwsAsync(backend.stackFrames(99), { message: /Unknown Mesen thread/ });
  await t.throwsAsync(backend.registers(99), { message: /Unknown Mesen frame/ });
  t.is(
    (
      await backend.readMemory(
        { architecture: "snes.65816", addressSpace: "snes.wram", address: 0 },
        0,
      )
    ).bytes.length,
    0,
  );
  await t.throwsAsync(
    backend.readMemory({ architecture: "snes.65816", addressSpace: "snes.cpu", address: 0 }, 1),
    { message: /reserved for disassembly/ },
  );
  await t.throwsAsync(
    backend.readMemory({ architecture: "wrong", addressSpace: "snes.wram", address: 0 }, 1),
    { message: /memory address.*unsupported/ },
  );
  await t.throwsAsync(
    backend.readMemory(
      { architecture: "snes.superfx", addressSpace: "superfx.rom", address: 0 },
      1,
    ),
    { message: /not available/ },
  );
  await t.throwsAsync(
    backend.setBreakpoints(Array.from({ length: 257 }, () => fixture.initialAddress)),
    {
      message: /at most 256/,
    },
  );
  await t.throwsAsync(
    backend.setBreakpoints([{ ...fixture.initialAddress, architecture: "wrong" }]),
    {
      message: /not a 65816 execution address/,
    },
  );
  await t.throwsAsync(backend.setBreakpoints([fixture.initialAddress, fixture.initialAddress]), {
    message: /Duplicate/,
  });

  client.request = async (method, parameters) => {
    if (method === "setBreakpoints") return { count: 0 };
    return request(method, parameters);
  };
  await t.throwsAsync(backend.setBreakpoints([fixture.initialAddress]), {
    message: /complete breakpoint set/,
  });

  const memoryCases: readonly [Readonly<Record<string, unknown>>, RegExp][] = [
    [{ space: "SpcRam", address: 0, data: "AA==" }, /wrong address space/],
    [{ space: "SnesWorkRam", address: 1, data: "AA==" }, /wrong address/],
    [{ space: "SnesWorkRam", address: 0, data: "A===" }, /not canonical base64/],
  ];
  for (const [response, message] of memoryCases) {
    client.request = (method, parameters) =>
      method === "readMemory" ? Promise.resolve(response) : request(method, parameters);
    await t.throwsAsync(
      backend.readMemory({ architecture: "snes.65816", addressSpace: "snes.wram", address: 0 }, 1),
      { message },
    );
  }
  client.request = request;

  const falseEmulationRequest = client.request.bind(client);
  client.request = async (method, parameters) => {
    const value = await falseEmulationRequest(method, parameters);
    if (method !== "status" || typeof value !== "object" || !value) return value;
    const status = value as { registers: Readonly<Record<string, unknown>> };
    return { ...value, registers: { ...status.registers, emulationMode: false } };
  };
  const registers = await backend.registers(1);
  t.is(registers.find(({ name }) => name === "E")?.value, "0");
  await backend.disconnect();
});

test("Mesen translator handles SuperFX state and execution failure paths", async (t) => {
  const superClient = new FakeMesenDebugClient(fakeState());
  const superRequest = superClient.request.bind(superClient);
  superClient.request = async (method, parameters) => {
    if (method === "hello") return helloPayload({ processors: ["65816", "spc700", "superfx"] });
    if (method === "status" && parameters.cpu === "superfx")
      return {
        stopped: true,
        cpu: "superfx",
        programCounter: 0x0a_8000,
        registers: {
          R: Array.from({ length: 16 }, (_, index) => index),
          SFR: {
            zero: false,
            carry: true,
            sign: false,
            overflow: true,
            running: true,
            alt1: false,
            alt2: false,
            irq: false,
          },
          programBank: 0x0a,
          romBank: 0x5e,
          ramBank: 0,
          sourceRegister: 0,
          destinationRegister: 0,
          programReadBuffer: 0x3d,
          cycleCount: 0x1234,
        },
      };
    return superRequest(method, parameters);
  };
  const superBackend = new MesenDebugBackend({ createClient: () => superClient });
  await superBackend.connect();
  const superRegisters = await superBackend.registers(3);
  t.deepEqual(
    superRegisters.map(({ name }) => name),
    [
      ...Array.from({ length: 16 }, (_, index) => `R${index}`),
      "PC",
      "PB",
      "ROMB",
      "RAMB",
      "SREG",
      "DREG",
      "Pipeline",
      "Z",
      "C",
      "S",
      "V",
      "RUN",
      "ALT1",
      "ALT2",
      "IRQ",
      "Cycle",
    ],
  );
  t.is(superRegisters.find(({ name }) => name === "PC")?.value, "0A8000");
  t.is(superRegisters.find(({ name }) => name === "Pipeline")?.value, "3D");
  t.deepEqual(
    await superBackend.disassemble(
      { architecture: "snes.superfx", addressSpace: "superfx.rom", address: 0x0a_8000 },
      1,
    ),
    [
      {
        address: {
          architecture: "snes.superfx",
          addressSpace: "superfx.rom",
          address: 0x0a_8000,
        },
        bytes: [0x3d, 0x50],
        text: "ADC R0",
      },
    ],
  );
  await superBackend.disconnect();

  const invalidSuperClient = new FakeMesenDebugClient(fakeState());
  const invalidSuperRequest = invalidSuperClient.request.bind(invalidSuperClient);
  invalidSuperClient.request = async (method, parameters) => {
    if (method === "hello") return helloPayload({ processors: ["65816", "superfx"] });
    if (method === "status" && parameters.cpu === "superfx")
      return { stopped: true, cpu: "superfx", programCounter: 0, registers: { R: [] } };
    return invalidSuperRequest(method, parameters);
  };
  const invalidSuper = new MesenDebugBackend({ createClient: () => invalidSuperClient });
  await invalidSuper.connect();
  await t.throwsAsync(invalidSuper.registers(3), { message: /must contain 16 entries/ });
  await invalidSuper.disconnect();

  const badResumeClient = new FakeMesenDebugClient(fakeState());
  const badResumeRequest = badResumeClient.request.bind(badResumeClient);
  badResumeClient.request = async (method, parameters) =>
    method === "resume" ? { stopped: false, cpu: "spc700" } : badResumeRequest(method, parameters);
  const badResume = new MesenDebugBackend({ createClient: () => badResumeClient });
  await badResume.connect();
  await t.throwsAsync(badResume.continue(), { message: /resume processor.*did not match/ });
  await badResume.disconnect({ terminate: false });

  const badStepClient = new FakeMesenDebugClient(fakeState());
  const badStepRequest = badStepClient.request.bind(badStepClient);
  badStepClient.request = async (method, parameters) => {
    const value = await badStepRequest(method, parameters);
    return method === "step" && typeof value === "object" && value
      ? { ...value, stopped: false }
      : value;
  };
  const badStep = new MesenDebugBackend({ createClient: () => badStepClient });
  await badStep.connect();
  await t.throwsAsync(badStep.step(1, "instruction"), { message: /completed without stopping/ });
  await badStep.disconnect({ terminate: false });

  const pollingClient = new FakeMesenDebugClient(fakeState());
  const pollingRequest = pollingClient.request.bind(pollingClient);
  pollingClient.request = async (method, parameters) => {
    // A third-party client can reject with a non-Error value; the backend must normalize it.
    // oxlint-disable-next-line typescript/only-throw-error
    if (method === "status") throw "poll failed";
    return pollingRequest(method, parameters);
  };
  const polling = new MesenDebugBackend({ createClient: () => pollingClient, pollIntervalMs: 1 });
  const events: string[] = [];
  polling.onEvent((event) => events.push(event.type));
  await polling.connect();
  await polling.continue();
  await new Promise((resolve) => setTimeout(resolve, 10));
  t.deepEqual(events.slice(-2), ["output", "terminated"]);
});
