import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DEBUG_SIDECAR_SESSION_ENV, type DebugSubscription } from "@uttori/asm-debug-adapter";
import test from "ava";

import {
  ARES_RUNTIME_MANIFEST_VERSION,
  AresProcessHost,
  parseAresRuntimeManifest,
  type AresProcessExit,
  type AresProcessHandle,
  type AresProcessLaunch,
  type AresProcessRuntime,
  type AresRuntimeManifest,
} from "../src/ares-process-host.js";
import type { GdbRspTransport } from "../src/gdb-rsp-client.js";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);

const manifest = (): AresRuntimeManifest => ({
  schemaVersion: ARES_RUNTIME_MANIFEST_VERSION,
  emulator: "ares",
  upstreamRevision: "1".repeat(40),
  headlessBaseRevision: "2".repeat(40),
  forkRevision: "3".repeat(40),
  headlessPatchSha256: SHA_D,
  patchSha256: SHA_A,
  executableSha256: SHA_B,
  romSha256: SHA_C,
  platform: "darwin",
  architecture: "arm64",
  buildConfiguration: "RelWithDebInfo; SNES-only; headless",
  resources: [{ path: "Database/Super Famicom.bml", sha256: SHA_D }],
});

class FakeTransport implements GdbRspTransport {
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

class FakeProcess implements AresProcessHandle {
  readonly pid: number;
  readonly signals: Array<"SIGTERM" | "SIGKILL"> = [];
  readonly #exit: Promise<AresProcessExit>;
  readonly #ignoreTerm: boolean;
  #resolveExit: (exit: AresProcessExit) => void = () => undefined;
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

  waitForExit(): Promise<AresProcessExit> {
    return this.#exit;
  }

  kill(signal: "SIGTERM" | "SIGKILL"): void {
    this.signals.push(signal);
    if (signal === "SIGTERM" && this.#ignoreTerm) return;
    this.exit({ code: null, signal });
  }

  exit(exit: AresProcessExit): void {
    if (this.#exited) return;
    this.#exited = true;
    this.#resolveExit(exit);
  }
}

class FakeRuntime implements AresProcessRuntime {
  platform: NodeJS.Platform = "darwin";
  architecture = "arm64";
  readonly launches: AresProcessLaunch[] = [];
  readonly processes: FakeProcess[] = [];
  readonly transports: FakeTransport[] = [];
  readonly hashCalls: string[] = [];
  readonly hashes = new Map<string, string>();
  connectFailures = 0;
  connectCalls = 0;
  ignoreTerm = false;
  exitOnLaunch: AresProcessExit | undefined;
  outputOnLaunch: Uint8Array | undefined;
  nextPort = 43_210;

  sha256(file: string): Promise<string> {
    this.hashCalls.push(file);
    const value = this.hashes.get(file);
    return value ? Promise.resolve(value) : Promise.reject(new Error("missing fake hash"));
  }

  reserveLoopbackPort(): Promise<number> {
    return Promise.resolve(this.nextPort++);
  }

  launch(options: AresProcessLaunch): AresProcessHandle {
    this.launches.push(options);
    const process = new FakeProcess(1_000 + this.processes.length, this.ignoreTerm);
    this.processes.push(process);
    if (this.outputOnLaunch) options.onOutput("stderr", this.outputOnLaunch);
    if (this.exitOnLaunch) process.exit(this.exitOnLaunch);
    return process;
  }

  connect(): Promise<GdbRspTransport> {
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

const setup = async (t: Parameters<Parameters<typeof test>[1]>[0]) => {
  const runtimeDirectory = await mkdtemp(path.join(os.tmpdir(), "uttori-ares-host-"));
  t.teardown(() => rm(runtimeDirectory, { recursive: true, force: true }));
  const executable = path.join(runtimeDirectory, "ares-headless");
  const rom = path.join(runtimeDirectory, "test.sfc");
  const resource = path.join(runtimeDirectory, "Database", "Super Famicom.bml");
  const runtime = new FakeRuntime();
  runtime.hashes.set(executable, SHA_B);
  runtime.hashes.set(rom, SHA_C);
  runtime.hashes.set(resource, SHA_D);
  return { runtimeDirectory, executable, rom, resource, runtime };
};

test("ares process host verifies identity, isolates launch arguments, and reconnects", async (t) => {
  const fixture = await setup(t);
  fixture.runtime.connectFailures = 1;
  const outputs: string[] = [];
  const host = new AresProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
    onOutput: (stream, text) => outputs.push(`${stream}:${text}`),
  });
  t.is(host.manifest.emulator, "ares");

  const first = await host.createClient({ reset: true });
  t.is(host.pid, 1_000);
  t.is(fixture.runtime.connectCalls, 2);
  t.deepEqual(fixture.runtime.hashCalls, [fixture.executable, fixture.rom, fixture.resource]);
  const launch = fixture.runtime.launches[0];
  t.is(launch?.cwd, fixture.runtimeDirectory);
  t.is(launch?.env[DEBUG_SIDECAR_SESSION_ENV], undefined);
  t.deepEqual(launch?.args, [
    "--system",
    "Super Famicom",
    "--settings-file",
    path.join(fixture.runtimeDirectory, "settings.bml"),
    "--setting",
    `Paths/Saves=${path.join(fixture.runtimeDirectory, "saves")}`,
    "--gdb-port",
    "43210",
    "--gdb-ipv4",
    "--wait-on-gdb",
    "--quiet",
    "--fast-boot",
    fixture.rom,
  ]);
  launch?.onOutput("stderr", Buffer.from("diagnostic\n"));
  t.is(host.output, "[ares stderr] diagnostic\n");
  t.deepEqual(outputs, ["stderr:diagnostic\n"]);

  await first.close();
  const second = await host.createClient({ reset: false });
  t.is(fixture.runtime.launches.length, 1);
  t.is(host.pid, 1_000);
  await second.close();
  await host.terminate();
  t.deepEqual(fixture.runtime.processes[0]?.signals, ["SIGTERM"]);
  t.is(host.pid, undefined);
});

test("desktop ares uses GUI settings, awaits entry, and keeps execution running when VS Code has focus", async (t) => {
  const fixture = await setup(t);
  const host = new AresProcessHost({
    ...fixture,
    manifest: { ...manifest(), frontend: "desktop" },
  });
  const client = await host.createClient({ reset: true });
  t.is(host.manifest.frontend, "desktop");
  const args = fixture.runtime.launches[0]!.args;
  for (const setting of [
    "Boot/AwaitGDBClient=true",
    "Developer/DebugServerEnabled=true",
    "Developer/DebugServerUseIPv4=true",
    "Input/Defocus=Allow",
    "General/RunAhead=false",
    "General/Rewind=false",
  ])
    t.true(args.includes(setting));
  for (const flag of ["--quiet", "--gdb-port", "--gdb-ipv4", "--wait-on-gdb", "--fast-boot"])
    t.false(args.includes(flag));
  await client.close();
  await host.terminate();
  t.throws(() => parseAresRuntimeManifest({ ...manifest(), frontend: "typo" }), {
    message: /frontend/,
  });
});

test("ares process host fails before launch on a manifest/hash mismatch", async (t) => {
  const fixture = await setup(t);
  fixture.runtime.hashes.set(fixture.rom, SHA_A);
  const host = new AresProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
  });
  const error = await t.throwsAsync(host.createClient({ reset: true }));
  t.regex(error?.message ?? "", /ROM SHA-256 mismatch/);
  t.is(fixture.runtime.launches.length, 0);
});

test("ares process host reports an unavailable identity before launch", async (t) => {
  const fixture = await setup(t);
  fixture.runtime.hashes.delete(fixture.executable);
  const host = new AresProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
  });
  const error = await t.throwsAsync(host.createClient({ reset: true }));
  t.regex(error?.message ?? "", /Unable to verify ares executable/);
  t.is(fixture.runtime.launches.length, 0);
});

test("ares process host preserves bounded process-exit diagnostics", async (t) => {
  const spawnFailure = await setup(t);
  spawnFailure.runtime.exitOnLaunch = {
    code: null,
    signal: null,
    error: new Error("spawn failed"),
  };
  await t.throwsAsync(
    new AresProcessHost({
      ...spawnFailure,
      manifest: manifest(),
      runtime: spawnFailure.runtime,
    }).createClient({ reset: true }),
    { message: /code null before RSP connected: spawn failed/ },
  );

  const fatalSignal = await setup(t);
  fatalSignal.runtime.exitOnLaunch = { code: null, signal: "SIGABRT" };
  fatalSignal.runtime.outputOnLaunch = Buffer.from("fatal diagnostic\n");
  await t.throwsAsync(
    new AresProcessHost({
      ...fatalSignal,
      manifest: manifest(),
      runtime: fatalSignal.runtime,
      maxOutputBytes: 12,
    }).createClient({ reset: true }),
    { message: /signal SIGABRT before RSP connected: diagnostic/ },
  );

  const cleanExit = await setup(t);
  cleanExit.runtime.exitOnLaunch = { code: 2, signal: null };
  await t.throwsAsync(
    new AresProcessHost({
      ...cleanExit,
      manifest: manifest(),
      runtime: cleanExit.runtime,
    }).createClient({ reset: true }),
    { message: /code 2 before RSP connected\.$/ },
  );
});

test("ares process host bounds shutdown and escalates a hung process", async (t) => {
  const fixture = await setup(t);
  fixture.runtime.ignoreTerm = true;
  const host = new AresProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
    shutdownTimeoutMs: 1,
  });
  const client = await host.createClient({ reset: true });
  await client.close();
  // A real hung child keeps Node alive while the host's unref'ed deadline runs.
  // Model that process handle here so AVA does not declare the pending promise inactive.
  const processHandle = setTimeout(() => undefined, 100);
  try {
    await host.terminate();
  } finally {
    clearTimeout(processHandle);
  }
  t.deepEqual(fixture.runtime.processes[0]?.signals, ["SIGTERM", "SIGKILL"]);
});

test("ares process host cleans up a fresh process when RSP readiness fails", async (t) => {
  const fixture = await setup(t);
  fixture.runtime.connectFailures = Number.MAX_SAFE_INTEGER;
  const host = new AresProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
    startupTimeoutMs: 1,
  });
  const error = await t.throwsAsync(host.createClient({ reset: true }));
  t.regex(error?.message ?? "", /was not ready within 1 ms/);
  t.deepEqual(fixture.runtime.processes[0]?.signals, ["SIGTERM"]);
  t.is(host.pid, undefined);
});

test("ares process host rejects non-portable resource paths", (t) => {
  const options = {
    executable: "/tmp/ares-headless",
    rom: "/tmp/test.sfc",
    runtimeDirectory: "/tmp/ares-runtime",
    manifest: { ...manifest(), resources: [{ path: "../outside", sha256: SHA_D }] },
  };
  t.throws(() => new AresProcessHost(options), { message: /normalized and relative/ });
});

test("ares process host rejects unavailable reconnect and host identity drift", async (t) => {
  const fixture = await setup(t);
  const options = {
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
  };
  const host = new AresProcessHost(options);
  await t.throwsAsync(host.createClient({ reset: false }), { message: /no preserved process/ });
  await host.terminate();

  fixture.runtime.platform = "linux";
  await t.throwsAsync(host.createClient({ reset: true }), { message: /platform 'darwin'/ });
  fixture.runtime.platform = "darwin";
  fixture.runtime.architecture = "x64";
  await t.throwsAsync(host.createClient({ reset: true }), { message: /architecture 'arm64'/ });
  t.is(fixture.runtime.launches.length, 0);
});

test("ares process host requires absolute launch paths", (t) => {
  t.throws(
    () =>
      new AresProcessHost({
        executable: "ares-headless",
        rom: "/tmp/test.sfc",
        runtimeDirectory: "/tmp/runtime",
        manifest: manifest(),
      }),
    { message: /executable must be an absolute path/ },
  );
  t.throws(
    () =>
      new AresProcessHost({
        executable: "/tmp/other/ares-headless",
        rom: "/tmp/test.sfc",
        runtimeDirectory: "/tmp/runtime",
        manifest: manifest(),
      }),
    { message: /contained within its portable runtime directory/ },
  );
});

test("ares process host validates optional launch policy", (t) => {
  const options = {
    executable: "/tmp/runtime/bin/ares-headless",
    rom: "/tmp/test.sfc",
    runtimeDirectory: "/tmp/runtime",
    manifest: manifest(),
  };
  t.throws(() => new AresProcessHost({ ...options, system: "" }), {
    message: /system name must be non-empty/,
  });
  t.throws(() => new AresProcessHost({ ...options, startupTimeoutMs: 0 }), {
    message: /startup timeout must be a positive safe integer/,
  });
  t.throws(() => new AresProcessHost({ ...options, maxOutputBytes: 1.5 }), {
    message: /output limit must be a positive safe integer/,
  });
});

test("ares process host applies explicit launch overrides", async (t) => {
  const fixture = await setup(t);
  const host = new AresProcessHost({
    ...fixture,
    manifest: manifest(),
    runtime: fixture.runtime,
    system: "Super Famicom (override)",
    fastBoot: false,
    env: { UTTORI_ARES_TEST: "enabled" },
  });
  const client = await host.createClient({ reset: true });
  const launch = fixture.runtime.launches[0];
  t.deepEqual(launch?.args.slice(0, 2), ["--system", "Super Famicom (override)"]);
  t.false(launch?.args.includes("--fast-boot"));
  t.is(launch?.env.UTTORI_ARES_TEST, "enabled");
  await client.close();
  await host.terminate();
});
