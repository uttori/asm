import { fileURLToPath } from "node:url";

import { test } from "../../../tests/ava-helper.js";
import {
  DEBUG_BACKEND_CONFORMANCE_SCENARIOS,
  DebugSidecarClient,
  NodeStdioSidecarTransport,
  ReplayDebugBackend,
  SidecarDebugBackend,
  createDebugSidecarSessionToken,
  runDebugBackendConformance,
  type DebugBackendEvent,
} from "../src/index.js";
import {
  debugConformanceFixture,
  debugConformanceScript,
} from "./fixtures/debug-conformance-fixture.js";

const mockSidecar = fileURLToPath(new URL("./fixtures/mock-sidecar.ts", import.meta.url));
const workspace = fileURLToPath(new URL("../../../", import.meta.url));
const capabilities = new ReplayDebugBackend(debugConformanceScript).capabilities;

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

function isMutableClone<T>(value: unknown): value is Mutable<T> {
  return typeof value === "object" && value !== null;
}

/** structuredClone keeps the source readonly type. Tests need a writable copy of the same data. */
function mutableClone<T extends object>(value: T): Mutable<T> {
  const cloned: unknown = structuredClone(value);
  if (!isMutableClone<T>(cloned)) {
    throw new Error("Expected a cloned capability object.");
  }
  return cloned;
}

const createBackend = (crashFirstOn?: string): SidecarDebugBackend => {
  let launches = 0;
  return new SidecarDebugBackend({
    backend: "mock-sidecar",
    capabilities,
    createClient: () => {
      const session = createDebugSidecarSessionToken();
      const transport = new NodeStdioSidecarTransport({
        command: process.execPath,
        args: ["--conditions=uttori-source", "--import=tsx", mockSidecar],
        cwd: workspace,
        env:
          launches++ === 0 && crashFirstOn ? { UTTORI_ASM_DEBUG_MOCK_CRASH_ON: crashFirstOn } : {},
        session,
        shutdownTimeoutMs: 2_000,
      });
      return new DebugSidecarClient({ transport, session, requestTimeoutMs: 3_000 });
    },
  });
};

test("stdio sidecar backend passes the frozen conformance suite through real child processes", async (t) => {
  const report = await runDebugBackendConformance({
    backend: "mock-sidecar-child-process",
    createBackend,
    fixture: debugConformanceFixture,
    timeoutMs: 4_000,
  });
  t.true(report.passed, JSON.stringify(report.scenarios, undefined, 2));
  t.deepEqual(
    report.scenarios.map(({ id, status }) => ({ id, status })),
    DEBUG_BACKEND_CONFORMANCE_SCENARIOS.map((id) => ({ id, status: "pass" })),
  );
});

test("stdio sidecar crash is isolated, reported, and restartable", async (t) => {
  const backend = createBackend("threads");
  const events: DebugBackendEvent[] = [];
  backend.onEvent((event) => events.push(event));
  await backend.connect({ reset: true });
  const error = await t.throwsAsync(backend.threads());
  t.regex(error.message, /exited with code 23/);
  t.true(events.some((event) => event.type === "terminated" && event.restart));
  t.true(
    events.some(
      (event) =>
        event.type === "output" &&
        event.category === "stderr" &&
        event.text.includes("mock sidecar crash on threads"),
    ),
  );

  await backend.connect({ reset: true });
  t.deepEqual(
    (await backend.threads()).map(({ architecture }) => architecture),
    ["snes.65816", "snes.spc700"],
  );
  await backend.disconnect({ terminate: true });
});

test("sidecar backend rejects memory capability declarations outside known address spaces", (t) => {
  const malformed = mutableClone(capabilities);
  malformed.architectures[0]!.memorySpaces[0]!.addressSpace = "snes.undeclared";
  t.throws(
    () =>
      new SidecarDebugBackend({
        backend: "malformed-sidecar",
        capabilities: malformed,
        createClient: () => {
          throw new Error("must not launch");
        },
      }),
    { message: /memorySpaces must be declared in addressSpaces/ },
  );
});

test("sidecar backend rejects duplicate and operation-inconsistent memory capabilities", (t) => {
  const duplicate = mutableClone(capabilities);
  duplicate.architectures[0]!.memorySpaces.push({
    ...duplicate.architectures[0]!.memorySpaces[0]!,
  });
  t.throws(
    () =>
      new SidecarDebugBackend({
        backend: "duplicate-memory-sidecar",
        capabilities: duplicate,
        createClient: () => {
          throw new Error("must not launch");
        },
      }),
    { message: /memorySpaces must use unique address spaces/ },
  );

  const inconsistent = mutableClone(capabilities);
  inconsistent.architectures[0]!.memory = false;
  t.throws(
    () =>
      new SidecarDebugBackend({
        backend: "inconsistent-memory-sidecar",
        capabilities: inconsistent,
        createClient: () => {
          throw new Error("must not launch");
        },
      }),
    { message: /memory must match whether memorySpaces is non-empty/ },
  );
});

test("sidecar backend rejects memory reads outside its negotiated readable spaces", async (t) => {
  const backend = createBackend();
  await backend.connect({ reset: true });
  await t.throwsAsync(
    backend.readMemory(
      { architecture: "snes.65816", addressSpace: "snes.unavailable", address: 0 },
      1,
    ),
    { message: /is not readable/ },
  );
  await backend.disconnect({ terminate: true });
});

test("stdio sidecar carries explicit bounded trace pulls without asynchronous trace events", async (t) => {
  const backend = createBackend();
  const events: DebugBackendEvent[] = [];
  backend.onEvent((event) => events.push(event));
  await backend.connect({ reset: true });
  await backend.startTrace({
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
  });
  await backend.step(1, "instruction");
  await backend.stopTrace();
  t.deepEqual(await backend.readTrace(4), {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    sequenceStart: 1,
    addresses: [0x808000, 0x808001],
    droppedEvents: 0,
    active: false,
  });
  t.deepEqual(
    events.map(({ type }) => type),
    ["stopped", "continued", "stopped"],
  );
  await t.throwsAsync(
    backend.startTrace({ architecture: "snes.superfx", addressSpace: "superfx.rom" }),
    { message: /is not supported/ },
  );
  await t.throwsAsync(
    backend.startTrace({ architecture: "unknown", addressSpace: "unknown.code" }),
    { message: /is not supported/ },
  );
  await t.throwsAsync(backend.startTrace({ architecture: "", addressSpace: "snes.cpu" }), {
    message: /Trace architecture must be a non-empty string/,
  });
  await t.throwsAsync(backend.startTrace({ architecture: "snes.65816", addressSpace: "" }), {
    message: /Trace address space must be a non-empty string/,
  });
  await backend.disconnect({ terminate: true });
});

test("sidecar backend rejects malformed trace capability declarations", (t) => {
  const undeclared = mutableClone(capabilities);
  undeclared.architectures[0]!.trace!.addressSpaces[0] = "snes.undeclared";
  t.throws(
    () =>
      new SidecarDebugBackend({
        backend: "malformed-trace-sidecar",
        capabilities: undeclared,
        createClient: () => {
          throw new Error("must not launch");
        },
      }),
    { message: /trace.addressSpaces must be declared in addressSpaces/ },
  );

  const unbounded = mutableClone(capabilities);
  unbounded.architectures[0]!.trace!.maxBatchEvents =
    unbounded.architectures[0]!.trace!.maxBufferedEvents + 1;
  t.throws(
    () =>
      new SidecarDebugBackend({
        backend: "unbounded-trace-sidecar",
        capabilities: unbounded,
        createClient: () => {
          throw new Error("must not launch");
        },
      }),
    { message: /maxBatchEvents must not exceed maxBufferedEvents/ },
  );

  const zeroBuffer = mutableClone(capabilities);
  zeroBuffer.architectures[0]!.trace!.maxBufferedEvents = 0;
  t.throws(
    () =>
      new SidecarDebugBackend({
        backend: "zero-buffer-trace-sidecar",
        capabilities: zeroBuffer,
        createClient: () => {
          throw new Error("must not launch");
        },
      }),
    { message: /maxBufferedEvents must be a safe integer/ },
  );

  const zeroBatch = mutableClone(capabilities);
  zeroBatch.architectures[0]!.trace!.maxBatchEvents = 0;
  t.throws(
    () =>
      new SidecarDebugBackend({
        backend: "zero-batch-trace-sidecar",
        capabilities: zeroBatch,
        createClient: () => {
          throw new Error("must not launch");
        },
      }),
    { message: /maxBatchEvents must be a safe integer/ },
  );

  const empty = mutableClone(capabilities);
  empty.architectures[0]!.trace!.addressSpaces = [];
  t.throws(
    () =>
      new SidecarDebugBackend({
        backend: "empty-trace-sidecar",
        capabilities: empty,
        createClient: () => {
          throw new Error("must not launch");
        },
      }),
    { message: /trace.addressSpaces must not be empty/ },
  );

  const duplicate = mutableClone(capabilities);
  duplicate.architectures[0]!.trace!.addressSpaces.push(
    duplicate.architectures[0]!.trace!.addressSpaces[0]!,
  );
  t.throws(
    () =>
      new SidecarDebugBackend({
        backend: "duplicate-trace-sidecar",
        capabilities: duplicate,
        createClient: () => {
          throw new Error("must not launch");
        },
      }),
    { message: /trace.addressSpaces must be unique/ },
  );
});
