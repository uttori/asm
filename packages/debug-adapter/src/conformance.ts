import {
  DEBUG_BACKEND_PROTOCOL_VERSION,
  type DebugAddress,
  type DebugArchitectureCapabilities,
  type DebugBackend,
  type DebugBackendEvent,
  type DebugExecutionCapabilities,
  type DebugMemorySpaceCapabilities,
  type DebugSubscription,
} from "./contracts.js";

/** Frozen contract revision shared by replay and live-emulator backend tests. */
export const DEBUG_BACKEND_CONFORMANCE_VERSION = 1 as const;

/** Stable scenario identifiers. Emulator integrations must not replace them with private suites. */
export const DEBUG_BACKEND_CONFORMANCE_SCENARIOS = Object.freeze([
  "protocol-and-capabilities",
  "connect-and-inspect",
  "exact-instruction-step",
  "continue-to-breakpoint",
  "reconnect-without-reset",
  "request-bounds",
] as const);

/** One architecture expected from capability negotiation. */
export interface DebugBackendConformanceArchitecture {
  /** Architecture identifier under test. */
  readonly architecture: string;
  /** Address spaces that must be advertised for this architecture. */
  readonly addressSpaces: readonly string[];
  /** Readable memory spaces and side-effect guarantees. */
  readonly memorySpaces: readonly DebugMemorySpaceCapabilities[];
  /** Execution features that must match exactly when present. */
  readonly capabilities: Partial<DebugExecutionCapabilities>;
}

/** Known program state used by every backend conformance run. */
export interface DebugBackendConformanceFixture {
  /** Expected capability entries for every emulated architecture. */
  readonly architectures: readonly DebugBackendConformanceArchitecture[];
  /** Architecture used for primary-thread scenarios. */
  readonly primaryArchitecture: string;
  /** Address space paired with the primary architecture. */
  readonly primaryAddressSpace: string;
  /** PC after connect with reset enabled. */
  readonly initialAddress: DebugAddress;
  /** PC after one instruction step on the primary thread. */
  readonly steppedAddress: DebugAddress;
  /** PC where an execute breakpoint must stop. */
  readonly breakpointAddress: DebugAddress;
  /** Address for the bounded memory read check. */
  readonly memoryAddress: DebugAddress;
  /** Expected bytes returned by the memory read check. */
  readonly memoryBytes: readonly number[];
  /** Register names that must exist on the initial frame. */
  readonly requiredRegisters: readonly string[];
  /** Address disassembled for text verification. */
  readonly disassemblyAddress: DebugAddress;
  /** Expected mnemonic text for disassemblyAddress. */
  readonly disassemblyText: string;
}

/** Inputs for one reusable conformance run. */
export interface DebugBackendConformanceOptions {
  /** Backend identifier recorded in the conformance report. */
  readonly backend: string;
  /** Factory that returns a fresh backend instance per scenario. */
  readonly createBackend: () => DebugBackend | Promise<DebugBackend>;
  /** Frozen addresses and bytes every scenario assumes. */
  readonly fixture: DebugBackendConformanceFixture;
  /** Per-operation timeout in milliseconds. */
  readonly timeoutMs?: number;
}

/** Deterministic result for one conformance scenario. */
export interface DebugBackendConformanceScenarioResult {
  /** Stable scenario identifier from DEBUG_BACKEND_CONFORMANCE_SCENARIOS. */
  readonly id: (typeof DEBUG_BACKEND_CONFORMANCE_SCENARIOS)[number];
  /** Pass or fail for this scenario only. */
  readonly status: "pass" | "fail";
  /** Failure message when status is fail. */
  readonly error?: string;
}

/** Machine-readable result suitable for a backend revision manifest. */
export interface DebugBackendConformanceReport {
  /** Conformance schema revision. */
  readonly version: typeof DEBUG_BACKEND_CONFORMANCE_VERSION;
  /** Backend identifier under test. */
  readonly backend: string;
  /** True only when every scenario passed. */
  readonly passed: boolean;
  /** Ordered scenario outcomes. */
  readonly scenarios: readonly DebugBackendConformanceScenarioResult[];
}

/** Throws an Error to abort a scenario with a readable message. */
const fail = (message: string): never => {
  throw new Error(message);
};

/** Undefined marks an absent result; other values, including null, retain their contract meaning. */
const requireValue = <Value>(value: Value | undefined, message: string): Value => {
  if (value === undefined) {
    return fail(message);
  }
  return value;
};

/** Compares qualified addresses including optional output-offset equality. */
const addressesMatch = (left: DebugAddress, right: DebugAddress): boolean =>
  left.architecture === right.architecture &&
  left.addressSpace === right.addressSpace &&
  (left.address === right.address ||
    (left.outputOffset !== undefined && left.outputOffset === right.outputOffset));

/** Asserts two addresses match or fails the scenario with context. */
const assertAddress = (actual: DebugAddress, expected: DebugAddress, context: string): void => {
  if (!addressesMatch(actual, expected)) {
    fail(
      `${context}: expected ${expected.architecture}/${expected.addressSpace}/${expected.address.toString(16)}, received ${actual.architecture}/${actual.addressSpace}/${actual.address.toString(16)}.`,
    );
  }
};

const CAPABILITY_KEYS = [
  "pause",
  "step",
  "stepKinds",
  "registers",
  "memory",
  "stackFrames",
  "breakpoints",
  "disassemble",
] as const satisfies readonly (keyof DebugExecutionCapabilities)[];

/** Compares negotiated architecture capabilities against fixture expectations. */
const assertCapability = (
  actual: DebugArchitectureCapabilities,
  expected: DebugBackendConformanceArchitecture,
): void => {
  const spaces = [...actual.addressSpaces].toSorted();
  const expectedSpaces = [...expected.addressSpaces].toSorted();
  if (JSON.stringify(spaces) !== JSON.stringify(expectedSpaces)) {
    fail(
      `${expected.architecture}: expected address spaces ${expectedSpaces.join(", ")}, received ${spaces.join(", ")}.`,
    );
  }
  const memorySpaces = [...actual.memorySpaces].toSorted((left, right) =>
    left.addressSpace.localeCompare(right.addressSpace),
  );
  const expectedMemorySpaces = [...expected.memorySpaces].toSorted((left, right) =>
    left.addressSpace.localeCompare(right.addressSpace),
  );
  if (JSON.stringify(memorySpaces) !== JSON.stringify(expectedMemorySpaces)) {
    fail(
      `${expected.architecture}: expected memory spaces ${JSON.stringify(expectedMemorySpaces)}, received ${JSON.stringify(memorySpaces)}.`,
    );
  }
  for (const key of CAPABILITY_KEYS) {
    if (!Object.hasOwn(expected.capabilities, key)) {
      continue;
    }
    if (actual[key] !== expected.capabilities[key]) {
      fail(
        `${expected.architecture}: expected capability '${key}' to be ${JSON.stringify(expected.capabilities[key])}.`,
      );
    }
  }
};

/** Records backend events for deterministic scenario assertions. */
class EventLog {
  /** Events appended in delivery order since construction. */
  readonly events: DebugBackendEvent[] = [];
  readonly #subscription: DebugSubscription;

  /** Subscribes to backend events until dispose is called. */
  constructor(backend: DebugBackend) {
    this.#subscription = backend.onEvent((event) => this.events.push(event));
  }

  /** Stops recording backend events. */
  dispose(): void {
    this.#subscription.dispose();
  }

  /** Polls recorded events until predicate matches or timeout elapses. */
  async waitFor(
    predicate: (event: DebugBackendEvent) => boolean,
    start: number,
    timeoutMs: number,
  ): Promise<DebugBackendEvent> {
    const existing = this.events.slice(start).find(predicate);
    if (existing) {
      return existing;
    }
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const match = this.events.slice(start).find(predicate);
        if (match) {
          clearInterval(timer);
          resolve(match);
        } else if (Date.now() - started >= timeoutMs) {
          clearInterval(timer);
          reject(new Error(`Timed out after ${timeoutMs} ms waiting for a backend event.`));
        }
      }, 5);
    });
  }
}

/** Wraps an async operation with a bounded wall-clock timeout. */
const withTimeout = async <Value>(
  operation: Promise<Value>,
  timeoutMs: number,
  context: string,
): Promise<Value> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${context} timed out after ${timeoutMs} ms.`)),
      timeoutMs,
    );
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
        return;
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      },
    );
  });

/** Runs one scenario with a fresh backend and guaranteed disconnect cleanup. */
const withBackend = async (
  options: DebugBackendConformanceOptions,
  action: (backend: DebugBackend, events: EventLog, timeoutMs: number) => void | Promise<void>,
): Promise<void> => {
  const timeoutMs = options.timeoutMs ?? 2_000;
  const backend = await withTimeout(
    Promise.resolve(options.createBackend()),
    timeoutMs,
    "Backend creation",
  );
  const events = new EventLog(backend);
  try {
    await withTimeout(
      Promise.resolve(action(backend, events, timeoutMs)),
      timeoutMs * 4,
      "Conformance scenario",
    );
  } finally {
    events.dispose();
    try {
      await withTimeout(backend.disconnect({ terminate: true }), timeoutMs, "Backend cleanup");
    } catch {
      // A scenario may intentionally finish disconnected or fail before connecting.
    }
  }
};

/** Maps backend events to their type names for order assertions. */
const eventTypes = (events: readonly DebugBackendEvent[]): string[] =>
  events.map((event) => event.type);

/** Returns the protocol version reported by a backend for comparison. */
function reportedProtocol(version: number): number {
  return version;
}

/** Frozen scenario implementations keyed by DEBUG_BACKEND_CONFORMANCE_SCENARIOS id. */
const scenarios: Readonly<
  Record<
    (typeof DEBUG_BACKEND_CONFORMANCE_SCENARIOS)[number],
    (options: DebugBackendConformanceOptions) => Promise<void>
  >
> = {
  "protocol-and-capabilities": async (options) =>
    withBackend(options, (backend) => {
      if (reportedProtocol(backend.protocolVersion) !== DEBUG_BACKEND_PROTOCOL_VERSION) {
        fail(`Expected backend protocol ${String(DEBUG_BACKEND_PROTOCOL_VERSION)}.`);
      }
      if (
        options.fixture.initialAddress.architecture !== options.fixture.primaryArchitecture ||
        options.fixture.initialAddress.addressSpace !== options.fixture.primaryAddressSpace
      ) {
        fail("The primary fixture identity does not match its initial address.");
      }
      const architectures = new Map(
        backend.capabilities.architectures.map((capability) => [
          capability.architecture,
          capability,
        ]),
      );
      if (architectures.size !== backend.capabilities.architectures.length) {
        fail("Architecture capability identifiers must be unique.");
      }
      for (const expected of options.fixture.architectures) {
        assertCapability(
          requireValue(
            architectures.get(expected.architecture),
            `Missing architecture capability '${expected.architecture}'.`,
          ),
          expected,
        );
      }
    }),
  "connect-and-inspect": async (options) =>
    withBackend(options, async (backend, events, timeoutMs) => {
      await backend.connect({ reset: true });
      await events.waitFor((event) => event.type === "stopped", 0, timeoutMs);
      const threads = await backend.threads();
      const primaryThread = requireValue(
        threads.find((thread) => thread.architecture === options.fixture.primaryArchitecture),
        `Missing primary thread '${options.fixture.primaryArchitecture}'.`,
      );
      const frame = requireValue(
        (await backend.stackFrames(primaryThread.id))[0],
        "Primary thread returned no stack frame.",
      );
      assertAddress(frame.pc, options.fixture.initialAddress, "Initial PC");
      const registerNames = new Set((await backend.registers(frame.id)).map(({ name }) => name));
      for (const name of options.fixture.requiredRegisters) {
        if (!registerNames.has(name)) {
          fail(`Missing required register '${name}'.`);
        }
      }
      const memory = await backend.readMemory(
        options.fixture.memoryAddress,
        options.fixture.memoryBytes.length,
      );
      if (memory.unreadableBytes !== 0) {
        fail(`Expected complete memory read. ${memory.unreadableBytes} byte(s) were unreadable.`);
      }
      if (JSON.stringify([...memory.bytes]) !== JSON.stringify(options.fixture.memoryBytes)) {
        fail("Memory bytes did not match the conformance fixture.");
      }
      const instruction = requireValue(
        (await backend.disassemble(options.fixture.disassemblyAddress, 1))[0],
        "Disassembler returned no instruction.",
      );
      if (instruction.text !== options.fixture.disassemblyText) {
        fail(
          `Expected disassembly '${options.fixture.disassemblyText}', received '${instruction.text}'.`,
        );
      }
    }),
  "exact-instruction-step": async (options) =>
    withBackend(options, async (backend, events, timeoutMs) => {
      await backend.connect({ reset: true });
      const thread = requireValue(
        (await backend.threads()).find(
          (candidate) => candidate.architecture === options.fixture.primaryArchitecture,
        ),
        "Missing primary thread.",
      );
      const start = events.events.length;
      await backend.step(thread.id, "instruction");
      await events.waitFor(
        (event) => event.type === "stopped" && event.reason === "step",
        start,
        timeoutMs,
      );
      const relevant = eventTypes(events.events.slice(start)).filter((type) =>
        ["continued", "stopped"].includes(type),
      );
      if (JSON.stringify(relevant) !== JSON.stringify(["continued", "stopped"])) {
        fail(`Instruction step event order was ${relevant.join(" -> ")}.`);
      }
      const frame = requireValue(
        (await backend.stackFrames(thread.id))[0],
        "Missing stepped frame.",
      );
      assertAddress(frame.pc, options.fixture.steppedAddress, "Stepped PC");
    }),
  "continue-to-breakpoint": async (options) =>
    withBackend(options, async (backend, events, timeoutMs) => {
      await backend.connect({ reset: true });
      const thread = requireValue(
        (await backend.threads()).find(
          (candidate) => candidate.architecture === options.fixture.primaryArchitecture,
        ),
        "Missing primary thread.",
      );
      const appliedBreakpoints = await backend.setBreakpoints([options.fixture.breakpointAddress]);
      const breakpoint = appliedBreakpoints.length > 0 ? appliedBreakpoints[0] : undefined;
      if (!breakpoint?.verified) {
        fail("Conformance breakpoint was not verified.");
      }
      const start = events.events.length;
      await backend.continue(thread.id);
      await events.waitFor(
        (event) => event.type === "stopped" && event.reason === "breakpoint",
        start,
        timeoutMs,
      );
      const relevant = eventTypes(events.events.slice(start)).filter((type) =>
        ["continued", "stopped"].includes(type),
      );
      if (JSON.stringify(relevant) !== JSON.stringify(["continued", "stopped"])) {
        fail(`Continue event order was ${relevant.join(" -> ")}.`);
      }
      const frame = requireValue(
        (await backend.stackFrames(thread.id))[0],
        "Missing breakpoint frame.",
      );
      assertAddress(frame.pc, options.fixture.breakpointAddress, "Breakpoint PC");
      if ((await backend.setBreakpoints([])).length !== 0) {
        fail("Clearing the breakpoint set did not return an empty result.");
      }
    }),
  "reconnect-without-reset": async (options) =>
    withBackend(options, async (backend) => {
      await backend.connect({ reset: true });
      const thread = requireValue(
        (await backend.threads()).find(
          (candidate) => candidate.architecture === options.fixture.primaryArchitecture,
        ),
        "Missing primary thread.",
      );
      await backend.step(thread.id, "instruction");
      const before = requireValue(
        (await backend.stackFrames(thread.id))[0],
        "Missing pre-reconnect frame.",
      ).pc;
      await backend.disconnect({ terminate: false });
      await backend.connect({ reset: false });
      const after = requireValue(
        (await backend.stackFrames(thread.id))[0],
        "Missing post-reconnect frame.",
      ).pc;
      assertAddress(after, before, "Reconnected PC");
    }),
  "request-bounds": async (options) =>
    withBackend(options, async (backend) => {
      await backend.connect({ reset: true });
      let rejected = false;
      try {
        await backend.readMemory(options.fixture.memoryAddress, -1);
      } catch {
        rejected = true;
      }
      if (!rejected) {
        fail("Negative memory-read count was accepted.");
      }
    }),
};

/**
 * Runs the frozen backend contract with fresh instances so scenarios cannot leak emulator state.
 * @param options Backend factory and known fixture state.
 * @returns Deterministic pass/fail report.
 */
export const runDebugBackendConformance = async (
  options: DebugBackendConformanceOptions,
): Promise<DebugBackendConformanceReport> => {
  const results: DebugBackendConformanceScenarioResult[] = [];
  for (const id of DEBUG_BACKEND_CONFORMANCE_SCENARIOS) {
    try {
      await scenarios[id](options);
      results.push({ id, status: "pass" });
    } catch (error) {
      results.push({
        id,
        status: "fail",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    version: DEBUG_BACKEND_CONFORMANCE_VERSION,
    backend: options.backend,
    passed: results.every(({ status }) => status === "pass"),
    scenarios: results,
  };
};
