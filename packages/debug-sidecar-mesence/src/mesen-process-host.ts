import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import {
  DEBUG_SIDECAR_SESSION_ENV,
  type DebugBackendConnectOptions,
} from "@uttori/asm-debug-adapter";

import { FramedMesenDebugClient, type MesenDebugTransport } from "./mesen-debug-client.js";
import { NodeTcpMesenTransport } from "./node-tcp-mesen-transport.js";

export const MESEN_RUNTIME_MANIFEST_VERSION = 1 as const;
export const MESEN_NATIVE_TOKEN_ENV = "MESEN_DEBUG_SERVER_TOKEN" as const;

/** One separately distributed runtime resource resolved beside the Mesen executable. */
export interface MesenRuntimeResource {
  readonly path: string;
  readonly sha256: string;
}

/** Versioned source, patch, binary, and ROM identity required before launch. */
export interface MesenRuntimeManifest {
  readonly schemaVersion: typeof MESEN_RUNTIME_MANIFEST_VERSION;
  readonly emulator: "MesenCE";
  readonly upstreamRevision: string;
  readonly patchSha256: string;
  readonly executableSha256: string;
  readonly romSha256: string;
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly buildConfiguration: string;
  readonly resources: readonly MesenRuntimeResource[];
}

/** Spawn parameters kept independent from Node for deterministic lifecycle tests. */
export interface MesenProcessLaunch {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly onOutput: (stream: "stdout" | "stderr", data: Uint8Array) => void;
}

/** Terminal state for one sidecar-owned MesenCE process. */
export interface MesenProcessExit {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly error?: Error;
}

/** Minimal native process surface used by the portable host policy. */
export interface MesenProcessHandle {
  readonly pid: number | undefined;
  readonly exited: boolean;
  waitForExit(): Promise<MesenProcessExit>;
  kill(signal: "SIGTERM" | "SIGKILL"): void;
}

/** Platform operations injected for deterministic tests and non-Node hosts. */
export interface MesenProcessRuntime {
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  sha256(file: string): Promise<string>;
  randomToken(): string;
  reserveLoopbackPort(): Promise<number>;
  launch(options: MesenProcessLaunch): MesenProcessHandle;
  connect(port: number, timeoutMs: number): Promise<MesenDebugTransport>;
  delay(milliseconds: number): Promise<void>;
}

/** Configuration for one restartable manifest-verified MesenCE process. */
export interface MesenProcessHostOptions {
  /** Absolute path to the executable whose hash is pinned by the manifest. */
  readonly executable: string;
  /** Absolute ROM file path. The manifest hashes the entire file, including any copier header. */
  readonly rom: string;
  /** Absolute working directory containing the declared runtime resources. */
  /** Platform operations override, primarily for process-host tests. */
  readonly runtimeDirectory: string;
  /** Validated identity for this executable, ROM, platform, and native protocol. */
  readonly manifest: MesenRuntimeManifest;
  /** Child environment overrides. Inherited values are used unless overridden. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Positive integer startup deadline in milliseconds. Defaults to 10,000. */
  readonly startupTimeoutMs?: number;
  /** Positive integer native request deadline in milliseconds. Defaults to 5,000. */
  readonly requestTimeoutMs?: number;
  /** Positive integer wait after SIGTERM in milliseconds, before SIGKILL. Defaults to 2,000. */
  readonly shutdownTimeoutMs?: number;
  /** Positive integer delay between startup connection attempts in milliseconds. Defaults to 25. */
  readonly connectRetryMs?: number;
  /** Positive integer native server lifetime in seconds. Defaults to 86,400 (24 hours). */
  readonly nativeLifetimeSeconds?: number;
  /** Positive integer retained stdout/stderr tail size in bytes. Defaults to 65,536. */
  readonly maxOutputBytes?: number;
  /** Synchronous output observer. Must not throw. */
  readonly onOutput?: (stream: "stdout" | "stderr", text: string) => void;
  readonly runtime?: MesenProcessRuntime;
}

const sha256Pattern = /^[\dA-Fa-f]{64}$/;
const revisionPattern = /^[\dA-Fa-f]{40}$/;

const checkedSha256 = (value: string, name: string): string => {
  if (!sha256Pattern.test(value)) {throw new Error(`${name} must be a 64-digit SHA-256 value.`);}
  return value.toLowerCase();
};

const checkedRevision = (value: string): string => {
  if (!revisionPattern.test(value))
    {throw new Error("Mesen upstream revision must be a 40-digit git revision.");}
  return value.toLowerCase();
};

const checkedAbsolutePath = (value: string, name: string): string => {
  if (!path.isAbsolute(value)) {throw new Error(`${name} must be an absolute path.`);}
  return path.normalize(value);
};

const checkedResourcePath = (value: string): string => {
  if (
    value === "." ||
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.split("/").includes("..")
  )
    {throw new Error(`Mesen resource path '${value}' must be normalized and relative.`);}
  return value;
};

const errorValue = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const waitWithTimeout = async <Value>(
  promise: Promise<Value>,
  timeoutMs: number,
): Promise<Value | undefined> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), timeoutMs);
    timer.unref();
    void promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });

class NodeMesenProcessHandle implements MesenProcessHandle {
  readonly #child: ReturnType<typeof spawn>;
  readonly #exit: Promise<MesenProcessExit>;
  #exited = false;

  constructor(options: MesenProcessLaunch) {
    let spawnError: Error | undefined;
    this.#child = spawn(options.command, [...options.args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    this.#child.stdout?.on("data", (data: Buffer) => options.onOutput("stdout", data));
    this.#child.stderr?.on("data", (data: Buffer) => options.onOutput("stderr", data));
    this.#child.once("error", (error) => {
      spawnError = error;
    });
    this.#exit = new Promise((resolve) => {
      this.#child.once("close", (code, signal) => {
        this.#exited = true;
        resolve({ code, signal, ...(spawnError ? { error: spawnError } : {}) });
      });
    });
  }

  get pid(): number | undefined {
    return this.#child.pid;
  }

  get exited(): boolean {
    return this.#exited;
  }

  waitForExit(): Promise<MesenProcessExit> {
    return this.#exit;
  }

  kill(signal: "SIGTERM" | "SIGKILL"): void {
    if (!this.#exited) {this.#child.kill(signal);}
  }
}

const nodeSha256 = async (file: string): Promise<string> => {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) {digest.update(chunk as Buffer);}
  return digest.digest("hex");
};

const reserveLoopbackPort = async (): Promise<number> => {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to reserve an IPv4 loopback port for MesenCE.");
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => {
      if (error) {reject(error);}
      else {resolve();}
    }),
  );
  return address.port;
};

/** Default Node platform operations for the sidecar-owned MesenCE process. */
export const nodeMesenProcessRuntime = Object.freeze<MesenProcessRuntime>({
  platform: process.platform,
  architecture: process.arch,
  sha256: nodeSha256,
  randomToken: () => randomBytes(32).toString("hex"),
  reserveLoopbackPort,
  launch: (options) => new NodeMesenProcessHandle(options),
  connect: (port, timeoutMs) =>
    NodeTcpMesenTransport.connect({
      host: "127.0.0.1",
      port,
      connectTimeoutMs: timeoutMs,
    }),
  delay: (milliseconds) =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, milliseconds);
      timer.unref();
    }),
});

const manifestRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    {throw new Error("Mesen runtime manifest must be an object.");}
  return value as Record<string, unknown>;
};

const manifestString = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.length === 0)
    {throw new Error(`${name} must be a non-empty string.`);}
  return value;
};

/**
 * Parses and freezes an untrusted versioned MesenCE runtime manifest.
 * @param {unknown} value Parsed JSON-like value.
 * @returns {MesenRuntimeManifest} Validated immutable runtime identity.
 */
export const parseMesenRuntimeManifest = (value: unknown): MesenRuntimeManifest => {
  const manifest = manifestRecord(value);
  if (manifest.schemaVersion !== MESEN_RUNTIME_MANIFEST_VERSION)
    {throw new Error(
      `Unsupported Mesen runtime manifest version ${String(manifest.schemaVersion)}.`,
    );}
  if (manifest.emulator !== "MesenCE") {throw new Error("Runtime manifest is not for MesenCE.");}
  if (!Array.isArray(manifest.resources))
    {throw new Error("Mesen runtime manifest resources must be an array.");}
  const resources = Object.freeze(
    manifest.resources.map((value, index) => {
      const resource = manifestRecord(value);
      const resourcePath = checkedResourcePath(
        manifestString(resource.path, `Mesen resource ${index} path`),
      );
      return Object.freeze({
        path: resourcePath,
        sha256: checkedSha256(
          manifestString(resource.sha256, `Resource '${resourcePath}' SHA-256`),
          `Resource '${resourcePath}' SHA-256`,
        ),
      });
    }),
  );
  if (new Set(resources.map(({ path: resourcePath }) => resourcePath)).size !== resources.length)
    {throw new Error("Mesen runtime manifest contains duplicate resource paths.");}
  return Object.freeze({
    schemaVersion: MESEN_RUNTIME_MANIFEST_VERSION,
    emulator: "MesenCE",
    upstreamRevision: checkedRevision(
      manifestString(manifest.upstreamRevision, "Mesen upstream revision"),
    ),
    patchSha256: checkedSha256(
      manifestString(manifest.patchSha256, "Mesen patch SHA-256"),
      "Mesen patch SHA-256",
    ),
    executableSha256: checkedSha256(
      manifestString(manifest.executableSha256, "Mesen executable SHA-256"),
      "Mesen executable SHA-256",
    ),
    romSha256: checkedSha256(manifestString(manifest.romSha256, "ROM SHA-256"), "ROM SHA-256"),
    platform: manifestString(manifest.platform, "Mesen manifest platform") as NodeJS.Platform,
    architecture: manifestString(manifest.architecture, "Mesen manifest architecture"),
    buildConfiguration: manifestString(manifest.buildConfiguration, "Mesen build configuration"),
    resources,
  });
};

/** Owns one verified portable MesenCE process and creates private framed clients. */
export class MesenProcessHost {
  readonly #executable: string;
  readonly #rom: string;
  readonly #runtimeDirectory: string;
  readonly #manifest: MesenRuntimeManifest;
  readonly #env: Readonly<Record<string, string | undefined>>;
  readonly #startupTimeoutMs: number;
  readonly #requestTimeoutMs: number;
  readonly #shutdownTimeoutMs: number;
  readonly #connectRetryMs: number;
  readonly #nativeLifetimeSeconds: number;
  readonly #maxOutputBytes: number;
  readonly #onOutput: ((stream: "stdout" | "stderr", text: string) => void) | undefined;
  readonly #runtime: MesenProcessRuntime;
  #process: MesenProcessHandle | undefined;
  #port: number | undefined;
  #token: string | undefined;
  #output = Buffer.alloc(0);
  #lifecycleTail: Promise<void> = Promise.resolve();

  /** @param {MesenProcessHostOptions} options Paths, identity, bounds, and platform runtime. */
  constructor(options: MesenProcessHostOptions) {
    this.#executable = checkedAbsolutePath(options.executable, "Mesen executable");
    this.#rom = checkedAbsolutePath(options.rom, "Mesen ROM");
    this.#runtimeDirectory = checkedAbsolutePath(
      options.runtimeDirectory,
      "Mesen runtime directory",
    );
    if (path.dirname(this.#executable) !== this.#runtimeDirectory)
      {throw new Error("Mesen executable must reside directly in its portable runtime directory.");}
    this.#manifest = parseMesenRuntimeManifest(options.manifest);
    this.#env = options.env ?? {};
    this.#startupTimeoutMs = options.startupTimeoutMs ?? 10_000;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 5_000;
    this.#shutdownTimeoutMs = options.shutdownTimeoutMs ?? 2_000;
    this.#connectRetryMs = options.connectRetryMs ?? 25;
    this.#nativeLifetimeSeconds = options.nativeLifetimeSeconds ?? 86_400;
    this.#maxOutputBytes = options.maxOutputBytes ?? 65_536;
    this.#onOutput = options.onOutput;
    this.#runtime = options.runtime ?? nodeMesenProcessRuntime;
    for (const [name, value] of [
      ["Mesen startup timeout", this.#startupTimeoutMs],
      ["Mesen request timeout", this.#requestTimeoutMs],
      ["Mesen shutdown timeout", this.#shutdownTimeoutMs],
      ["Mesen connect retry delay", this.#connectRetryMs],
      ["Mesen native lifetime", this.#nativeLifetimeSeconds],
      ["Mesen output limit", this.#maxOutputBytes],
    ] as const) {
      if (!Number.isSafeInteger(value) || value <= 0)
        {throw new Error(`${name} must be a positive safe integer.`);}
    }
  }

  /** @returns {MesenRuntimeManifest} Normalized immutable launch identity. */
  get manifest(): MesenRuntimeManifest {
    return this.#manifest;
  }

  /** @returns {number | undefined} PID of the current emulator process. */
  get pid(): number | undefined {
    return this.#process?.pid;
  }

  /** @returns {string} Bounded tail of emulator output, never neutral-protocol stdout. */
  get output(): string {
    return this.#output.toString("utf8");
  }

  /**
   * Starts a verified process for reset connects or reconnects to the preserved process.
   * @param {DebugBackendConnectOptions} options Backend reset policy.
   * @returns {Promise<FramedMesenDebugClient>} Connected private native-protocol client.
   */
  createClient(options: DebugBackendConnectOptions): Promise<FramedMesenDebugClient> {
    return this.#serializeLifecycle(async () => {
      let launched = false;
      if (options.reset ?? true) {
        await this.#terminateCurrent();
        await this.#launch();
        launched = true;
      } else if (
        !this.#process ||
        this.#process.exited ||
        this.#port === undefined ||
        this.#token === undefined
      ) {
        throw new Error("Cannot reconnect to MesenCE because no preserved process is running.");
      }
      try {
        return await this.#connect();
      } catch (error) {
        if (launched) {await this.#terminateCurrent();}
        throw error;
      }
    });
  }

  /** @returns {Promise<void>} Bounded graceful/forced cleanup of the owned process. */
  terminate(): Promise<void> {
    return this.#serializeLifecycle(() => this.#terminateCurrent());
  }

  async #launch(): Promise<void> {
    await this.#verifyIdentity();
    const port = await this.#runtime.reserveLoopbackPort();
    const token = this.#runtime.randomToken().toLowerCase();
    if (!sha256Pattern.test(token))
      {throw new Error("Mesen runtime generated an invalid 256-bit native token.");}
    const args = [
      "--testrunner",
      `--debugserverport=${port}`,
      `--timeout=${this.#nativeLifetimeSeconds}`,
      "--novideo",
      "--noaudio",
      "--noinput",
      this.#rom,
    ];
    this.#output = Buffer.alloc(0);
    const processHandle = this.#runtime.launch({
      command: this.#executable,
      args,
      cwd: this.#runtimeDirectory,
      env: {
        ...this.#env,
        [DEBUG_SIDECAR_SESSION_ENV]: undefined,
        [MESEN_NATIVE_TOKEN_ENV]: token,
      },
      onOutput: (stream, data) => this.#captureOutput(stream, data),
    });
    this.#process = processHandle;
    this.#port = port;
    this.#token = token;
  }

  async #connect(): Promise<FramedMesenDebugClient> {
    const processHandle = this.#process;
    const port = this.#port;
    const token = this.#token;
    if (!processHandle || port === undefined || token === undefined)
      {throw new Error("MesenCE process is not running.");}
    const deadline = Date.now() + this.#startupTimeoutMs;
    let lastError = new Error("MesenCE debugger listener was not ready.");
    while (Date.now() < deadline) {
      if (processHandle.exited)
        {throw await this.#exitError(processHandle, "before debugger connected");}
      try {
        const remaining = Math.max(1, deadline - Date.now());
        const transport = await this.#runtime.connect(port, Math.min(remaining, 250));
        return new FramedMesenDebugClient({
          transport,
          token,
          requestTimeoutMs: this.#requestTimeoutMs,
        });
      } catch (error) {
        lastError = errorValue(error);
      }
      await this.#runtime.delay(Math.min(this.#connectRetryMs, Math.max(1, deadline - Date.now())));
    }
    if (processHandle.exited)
      {throw await this.#exitError(processHandle, "before debugger connected");}
    throw new Error(
      `MesenCE debugger listener on 127.0.0.1:${port} was not ready within ${this.#startupTimeoutMs} ms: ${lastError.message}`,
    );
  }

  async #verifyIdentity(): Promise<void> {
    if (this.#runtime.platform !== this.#manifest.platform)
      {throw new Error(
        `Mesen manifest platform '${this.#manifest.platform}' does not match '${this.#runtime.platform}'.`,
      );}
    if (this.#runtime.architecture !== this.#manifest.architecture)
      {throw new Error(
        `Mesen manifest architecture '${this.#manifest.architecture}' does not match '${this.#runtime.architecture}'.`,
      );}
    const runtimeInfo = await stat(this.#runtimeDirectory).catch(() => undefined);
    if (!runtimeInfo?.isDirectory())
      {throw new Error("Mesen portable runtime path must be an existing directory.");}
    await this.#verifyHash(this.#executable, this.#manifest.executableSha256, "executable");
    await this.#verifyHash(this.#rom, this.#manifest.romSha256, "ROM");
    for (const resource of this.#manifest.resources) {
      // path.join already normalizes manifest separators. Keep the path as one argument.
      await this.#verifyHash(
        path.join(this.#runtimeDirectory, resource.path),
        resource.sha256,
        `resource '${resource.path}'`,
      );
    }
  }

  async #verifyHash(file: string, expected: string, context: string): Promise<void> {
    let actual: string;
    try {
      actual = checkedSha256(await this.#runtime.sha256(file), `Observed ${context} SHA-256`);
    } catch (error) {
      throw new Error(
        `Unable to verify MesenCE ${context} at '${file}': ${errorValue(error).message}`,
      );
    }
    if (actual !== expected)
      {throw new Error(
        `MesenCE ${context} SHA-256 mismatch: expected ${expected}, received ${actual}.`,
      );}
  }

  async #terminateCurrent(): Promise<void> {
    const processHandle = this.#process;
    this.#process = undefined;
    this.#port = undefined;
    this.#token = undefined;
    if (!processHandle || processHandle.exited) {return;}
    processHandle.kill("SIGTERM");
    if (await waitWithTimeout(processHandle.waitForExit(), this.#shutdownTimeoutMs)) {return;}
    processHandle.kill("SIGKILL");
    await processHandle.waitForExit();
  }

  async #exitError(processHandle: MesenProcessHandle, context: string): Promise<Error> {
    const exit = await processHandle.waitForExit();
    const status = exit.signal ? `signal ${exit.signal}` : `code ${String(exit.code)}`;
    const detail = this.output.trim();
    let suffix = ".";
    if (exit.error) {suffix = `: ${exit.error.message}`;}
    else if (detail) {suffix = `: ${detail}`;}
    return new Error(`MesenCE exited with ${status} ${context}${suffix}`);
  }

  #captureOutput(stream: "stdout" | "stderr", data: Uint8Array): void {
    const text = Buffer.from(data).toString("utf8");
    this.#onOutput?.(stream, text);
    const tagged = Buffer.from(`[MesenCE ${stream}] ${text}`, "utf8");
    const combined = Buffer.concat([this.#output, tagged]);
    this.#output = combined.subarray(Math.max(0, combined.length - this.#maxOutputBytes));
  }

  #serializeLifecycle<Value>(action: () => Promise<Value>): Promise<Value> {
    const operation = this.#lifecycleTail.then(action);
    this.#lifecycleTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}
