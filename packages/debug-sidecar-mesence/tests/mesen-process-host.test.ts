import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DEBUG_SIDECAR_SESSION_ENV, type DebugSubscription } from "@uttori/asm-debug-adapter";

import type { MesenDebugTransport } from "../src/mesen-debug-client.js";
import {
  MESEN_NATIVE_TOKEN_ENV,
  MESEN_RUNTIME_MANIFEST_VERSION,
  MesenProcessHost,
  parseMesenRuntimeManifest,
  type MesenProcessExit,
  type MesenProcessHandle,
  type MesenProcessLaunch,
  type MesenProcessRuntime,
  type MesenRuntimeManifest,
} from "../src/mesen-process-host.js";
import { test } from "../../../tests/ava-helper.js";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const SHA_E = "e".repeat(64);
const TOKEN = "1".repeat(64);

const manifest = (): MesenRuntimeManifest => ({
  schemaVersion: MESEN_RUNTIME_MANIFEST_VERSION,
  emulator: "MesenCE",
  upstreamRevision: "2".repeat(40),
  patchSha256: SHA_A,
  executableSha256: SHA_B,
  romSha256: SHA_C,
  platform: "darwin",
  architecture: "arm64",
  buildConfiguration: "Release; osx-arm64; optimized",
  resources: [
    { path: "Mesen.dll", sha256: SHA_D },
    { path: "MesenCore.dylib", sha256: SHA_E },
  ],
});

class FakeTransport implements MesenDebugTransport {
  readonly dataListeners = new Set<(data: Uint8Array) => void>();
  readonly closeListeners = new Set<(error?: Error) => void>();
  closed = false;

  write(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.closed = true;
    for (const listener of this.closeListeners) listener();
    return Promise.resolve();
  }

  onData(listener: (data: Uint8Array) => void): DebugSubscription {
    this.dataListeners.add(listener);
    return { dispose: () => this.dataListeners.delete(listener) };
  }

  onClose(listener: (error?: Error) => void): DebugSubscription {
    this.closeListeners.add(listener);
    return { dispose: () => this.closeListeners.delete(listener) };
  }
}

class FakeProcess implements MesenProcessHandle {
  readonly pid: number;
  readonly signals: Array<"SIGTERM" | "SIGKILL"> = [];
  readonly #exit: Promise<MesenProcessExit>;
  readonly #ignoreTerm: boolean;
  #resolveExit: (exit: MesenProcessExit) => void = () => undefined;
  #exited = false;

  constructor(pid: number, ignoreTerm = false) {
    this.pid = pid;
    this.#ignoreTerm = ignoreTerm;
    this.#exit = new Promise((resolve) => {
      this.#resolveExit = resolve;
    });
  }

  get exited(): boolean {
    return this.#exited;
  }

  waitForExit(): Promise<MesenProcessExit> {
    return this.#exit;
  }

  kill(signal: "SIGTERM" | "SIGKILL"): void {
    this.signals.push(signal);
    if (signal === "SIGTERM" && this.#ignoreTerm) return;
    this.exit({ code: null, signal });
  }

  exit(exit: MesenProcessExit): void {
    if (this.#exited) return;
    this.#exited = true;
    this.#resolveExit(exit);
  }
}

class FakeRuntime implements MesenProcessRuntime {
  platform: NodeJS.Platform = "darwin";
  architecture = "arm64";
  readonly launches: MesenProcessLaunch[] = [];
  readonly processes: FakeProcess[] = [];
  readonly transports: FakeTransport[] = [];
  readonly hashCalls: string[] = [];
  readonly hashes = new Map<string, string>();
  connectFailures = 0;
  connectCalls = 0;
  ignoreTerm = false;
  exitOnLaunch: MesenProcessExit | undefined;
  launchOutput: readonly ["stdout" | "stderr", string] | undefined;
  nextPort = 43_210;

  sha256(file: string): Promise<string> {
    this.hashCalls.push(file);
    const value = this.hashes.get(file);
    return value ? Promise.resolve(value) : Promise.reject(new Error("missing fake hash"));
  }

  randomToken(): string {
    return TOKEN;
  }

  reserveLoopbackPort(): Promise<number> {
    return Promise.resolve(this.nextPort++);
  }

  launch(options: MesenProcessLaunch): MesenProcessHandle {
    this.launches.push(options);
    const process = new FakeProcess(2_000 + this.processes.length, this.ignoreTerm);
    this.processes.push(process);
    if (this.launchOutput)
      options.onOutput(this.launchOutput[0], Buffer.from(this.launchOutput[1]));
    if (this.exitOnLaunch) process.exit(this.exitOnLaunch);
    return process;
  }

  connect(): Promise<MesenDebugTransport> {
    this.connectCalls++;
    if (this.connectCalls <= this.connectFailures)
      return Promise.reject(new Error("connection refused"));
    const transport = new FakeTransport();
    this.transports.push(transport);
    return Promise.resolve(transport);
  }

  delay(): Promise<void> {
    return Promise.resolve();
  }
}

const setup = async (t: { teardown: (callback: () => unknown) => void }) => {
  const runtimeDirectory = await mkdtemp(path.join(os.tmpdir(), "uttori-mesen-host-"));
  t.teardown(() => rm(runtimeDirectory, { recursive: true, force: true }));
  const executable = path.join(runtimeDirectory, "Mesen");
  const rom = path.join(runtimeDirectory, "test.sfc");
  const managed = path.join(runtimeDirectory, "Mesen.dll");
  const core = path.join(runtimeDirectory, "MesenCore.dylib");
  const runtime = new FakeRuntime();
  runtime.hashes.set(executable, SHA_B);
  runtime.hashes.set(rom, SHA_C);
  runtime.hashes.set(managed, SHA_D);
  runtime.hashes.set(core, SHA_E);
  return { runtimeDirectory, executable, rom, managed, core, runtime };
};

test("Mesen process host verifies portable identity, launch isolation, and reconnect", async (t) => {
  const fixture = await setup(t);
  fixture.runtime.connectFailures = 1;
  const host = new MesenProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
    env: { [DEBUG_SIDECAR_SESSION_ENV]: "must-not-leak" },
  });
  const first = await host.createClient({ reset: true });
  t.is(host.pid, 2_000);
  t.is(fixture.runtime.connectCalls, 2);
  t.deepEqual(fixture.runtime.hashCalls, [
    fixture.executable,
    fixture.rom,
    fixture.managed,
    fixture.core,
  ]);
  const launch = fixture.runtime.launches[0];
  t.deepEqual(launch?.args, [
    "--testrunner",
    "--debugserverport=43210",
    "--timeout=86400",
    "--novideo",
    "--noaudio",
    "--noinput",
    fixture.rom,
  ]);
  t.is(launch?.cwd, fixture.runtimeDirectory);
  t.is(launch?.env[DEBUG_SIDECAR_SESSION_ENV], undefined);
  t.is(launch?.env[MESEN_NATIVE_TOKEN_ENV], TOKEN);
  await first.close();

  const second = await host.createClient({ reset: false });
  t.is(fixture.runtime.launches.length, 1);
  await second.close();
  await host.terminate();
  t.deepEqual(fixture.runtime.processes[0]?.signals, ["SIGTERM"]);
});

test("Mesen process host fails before launch on manifest, hash, or path drift", async (t) => {
  const fixture = await setup(t);
  fixture.runtime.hashes.set(fixture.rom, SHA_A);
  const host = new MesenProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
  });
  await t.throwsAsync(host.createClient({ reset: true }), { message: /ROM SHA-256 mismatch/ });
  t.is(fixture.runtime.launches.length, 0);
  t.throws(
    () =>
      new MesenProcessHost({
        executable: "/tmp/elsewhere/Mesen",
        rom: fixture.rom,
        runtimeDirectory: fixture.runtimeDirectory,
        manifest: manifest(),
      }),
    { message: /must reside directly/ },
  );
});

test("Mesen process host cleans failed readiness and bounds forced shutdown", async (t) => {
  const readiness = await setup(t);
  readiness.runtime.connectFailures = Number.MAX_SAFE_INTEGER;
  const failedHost = new MesenProcessHost({
    ...readiness,
    manifest: manifest(),
    runtime: readiness.runtime,
    startupTimeoutMs: 1,
  });
  await t.throwsAsync(failedHost.createClient({ reset: true }), { message: /was not ready/ });
  t.deepEqual(readiness.runtime.processes[0]?.signals, ["SIGTERM"]);

  const shutdown = await setup(t);
  shutdown.runtime.ignoreTerm = true;
  const hungHost = new MesenProcessHost({
    ...shutdown,
    manifest: manifest(),
    runtime: shutdown.runtime,
    shutdownTimeoutMs: 1,
  });
  const client = await hungHost.createClient({ reset: true });
  await client.close();
  const keepAlive = setTimeout(() => undefined, 100);
  try {
    await hungHost.terminate();
  } finally {
    clearTimeout(keepAlive);
  }
  t.deepEqual(shutdown.runtime.processes[0]?.signals, ["SIGTERM", "SIGKILL"]);
});

test("Mesen runtime manifest rejects traversal and unavailable reconnect", async (t) => {
  const fixture = await setup(t);
  t.throws(
    () =>
      new MesenProcessHost({
        ...fixture,
        manifest: { ...manifest(), resources: [{ path: "../outside", sha256: SHA_D }] },
        runtime: fixture.runtime,
      }),
    { message: /normalized and relative/ },
  );
  const host = new MesenProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
  });
  await t.throwsAsync(host.createClient({ reset: false }), { message: /no preserved process/ });
});

test("Mesen runtime manifest rejects every malformed identity field", (t) => {
  const invalid: readonly [unknown, RegExp][] = [
    [null, /manifest must be an object/],
    [{ ...manifest(), schemaVersion: 2 }, /Unsupported.*version/],
    [{ ...manifest(), emulator: "Other" }, /not for MesenCE/],
    [{ ...manifest(), resources: null }, /resources must be an array/],
    [{ ...manifest(), resources: [null] }, /manifest must be an object/],
    [{ ...manifest(), resources: [{ path: "", sha256: SHA_D }] }, /non-empty string/],
    [{ ...manifest(), resources: [{ path: ".", sha256: SHA_D }] }, /normalized and relative/],
    [
      { ...manifest(), resources: [{ path: "bad\\path", sha256: SHA_D }] },
      /normalized and relative/,
    ],
    [
      { ...manifest(), resources: [{ path: "/absolute", sha256: SHA_D }] },
      /normalized and relative/,
    ],
    [
      {
        ...manifest(),
        resources: [
          { path: "same", sha256: SHA_D },
          { path: "same", sha256: SHA_E },
        ],
      },
      /duplicate resource paths/,
    ],
    [{ ...manifest(), upstreamRevision: "short" }, /40-digit git revision/],
    [{ ...manifest(), patchSha256: "short" }, /64-digit SHA-256/],
    [{ ...manifest(), executableSha256: "short" }, /64-digit SHA-256/],
    [{ ...manifest(), romSha256: "short" }, /64-digit SHA-256/],
    [{ ...manifest(), platform: "" }, /non-empty string/],
    [{ ...manifest(), architecture: "" }, /non-empty string/],
    [{ ...manifest(), buildConfiguration: "" }, /non-empty string/],
  ];
  for (const [value, message] of invalid)
    t.throws(() => parseMesenRuntimeManifest(value), { message });
});

test("Mesen process host validates paths, numeric bounds, platform, and tokens", async (t) => {
  const fixture = await setup(t);
  t.throws(
    () =>
      new MesenProcessHost({
        ...fixture,
        executable: "relative/Mesen",
        manifest: manifest(),
        runtime: fixture.runtime,
      }),
    { message: /must be an absolute path/ },
  );
  t.throws(
    () =>
      new MesenProcessHost({
        ...fixture,
        manifest: manifest(),
        runtime: fixture.runtime,
        startupTimeoutMs: 0,
      }),
    { message: /positive safe integer/ },
  );

  fixture.runtime.platform = "linux";
  const platform = new MesenProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
  });
  await t.throwsAsync(platform.createClient({ reset: true }), {
    message: /platform.*does not match/,
  });

  fixture.runtime.platform = "darwin";
  fixture.runtime.architecture = "x64";
  const architecture = new MesenProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
  });
  await t.throwsAsync(architecture.createClient({ reset: true }), {
    message: /architecture.*does not match/,
  });

  fixture.runtime.architecture = "arm64";
  fixture.runtime.randomToken = () => "short";
  const token = new MesenProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
  });
  await t.throwsAsync(token.createClient({ reset: true }), {
    message: /invalid 256-bit native token/,
  });
});

test("Mesen process host reports missing runtime, invalid hashes, early exit, and bounded output", async (t) => {
  const missing = await setup(t);
  const missingDirectory = path.join(missing.runtimeDirectory, "missing");
  const missingHost = new MesenProcessHost({
    executable: path.join(missingDirectory, "Mesen"),
    rom: missing.rom,
    runtimeDirectory: missingDirectory,
    manifest: manifest(),
    runtime: missing.runtime,
  });
  await t.throwsAsync(missingHost.createClient({ reset: true }), {
    message: /portable runtime path must be an existing directory/,
  });

  const invalidHash = await setup(t);
  invalidHash.runtime.hashes.set(invalidHash.executable, "not-a-hash");
  const invalidHashHost = new MesenProcessHost({
    ...invalidHash,
    manifest: manifest(),
    runtime: invalidHash.runtime,
  });
  await t.throwsAsync(invalidHashHost.createClient({ reset: true }), {
    message: /Unable to verify.*executable/,
  });

  const exited = await setup(t);
  exited.runtime.exitOnLaunch = { code: 23, signal: null, error: new Error("spawn detail") };
  exited.runtime.launchOutput = ["stderr", "sensitive native failure tail"];
  const observed: string[] = [];
  const exitedHost = new MesenProcessHost({
    ...exited,
    manifest: manifest(),
    runtime: exited.runtime,
    maxOutputBytes: 8,
    onOutput: (_stream, text) => observed.push(text),
  });
  await t.throwsAsync(exitedHost.createClient({ reset: true }), {
    message: /code 23.*spawn detail/,
  });
  t.is(exitedHost.output, "ure tail");
  t.deepEqual(observed, ["sensitive native failure tail"]);
});
