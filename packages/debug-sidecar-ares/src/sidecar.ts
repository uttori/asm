import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEBUG_SIDECAR_SESSION_ENV,
  DebugSidecarServer,
  assertDebugSidecarSessionToken,
} from "@uttori/asm-debug-adapter";

import { AresProcessHost, parseAresRuntimeManifest } from "./ares-process-host.js";
import { ARES_RSP_BACKEND_ID, AresRspDebugBackend } from "./ares-rsp-backend.js";

export interface AresSidecarArguments {
  readonly manifest: string;
  readonly executable: string;
  readonly rom: string;
  readonly runtimeDirectory: string;
  readonly system?: string;
  readonly fastBoot: boolean;
}

const usage = `Usage: uttori-asm-debug-sidecar-ares [options]

Required:
  --manifest path       Versioned ares runtime manifest JSON
  --ares path           Separately installed ares executable (manifest selects frontend)
  --rom path            SNES ROM whose SHA-256 matches the manifest
  --runtime-dir path    Portable root containing bin, resources, settings, and saves

Optional:
  --system name         Ares system name (default: Super Famicom)
  --no-fast-boot        Disable the ares fast-boot setting
  --help                Show this help
`;

const optionNames = new Set(["--manifest", "--ares", "--rom", "--runtime-dir", "--system"]);

/**
 * Strict shell-independent parser for the production sidecar executable.
 * @param {readonly string[]} arguments_ Sidecar command-line arguments.
 * @returns {AresSidecarArguments} Validated and path-resolved launch inputs.
 */
export const parseAresSidecarArguments = (arguments_: readonly string[]): AresSidecarArguments => {
  const values = new Map<string, string>();
  let fastBoot = true;
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    if (argument === undefined) throw new Error("Ares sidecar arguments cannot contain holes.");
    if (argument === "--no-fast-boot") {
      fastBoot = false;
      continue;
    }
    if (!optionNames.has(argument)) throw new Error(`Unknown ares sidecar option '${argument}'.`);
    if (values.has(argument)) throw new Error(`Duplicate ares sidecar option '${argument}'.`);
    const value = arguments_[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`Ares sidecar option '${argument}' requires a value.`);
    values.set(argument, value);
  }
  const required = (name: string): string => {
    const value = values.get(name);
    if (!value) throw new Error(`Missing required ares sidecar option '${name}'.`);
    return path.resolve(value);
  };
  const system = values.get("--system");
  return {
    manifest: required("--manifest"),
    executable: required("--ares"),
    rom: required("--rom"),
    runtimeDirectory: required("--runtime-dir"),
    ...(system ? { system } : {}),
    fastBoot,
  };
};

const write = (stream: NodeJS.WritableStream, data: string | Uint8Array): Promise<void> =>
  new Promise((resolve, reject) => {
    stream.write(data, (error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });

/**
 * Runs one authenticated stdio sidecar until shutdown, EOF, signal, or protocol failure.
 * @param {readonly string[]} arguments_ Sidecar command-line arguments.
 * @param {NodeJS.ProcessEnv} environment Environment containing the one-session token.
 * @returns {Promise<void>} Completion once stdio handlers and backend ownership are installed.
 */
export const runAresSidecar = async (
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> => {
  const options = parseAresSidecarArguments(arguments_);
  const session = environment[DEBUG_SIDECAR_SESSION_ENV];
  assertDebugSidecarSessionToken(session);
  const manifest = parseAresRuntimeManifest(
    JSON.parse(await readFile(options.manifest, "utf8")) as unknown,
  );
  const host = new AresProcessHost({
    executable: options.executable,
    rom: options.rom,
    runtimeDirectory: options.runtimeDirectory,
    manifest,
    system: options.system,
    fastBoot: options.fastBoot,
  });
  const backend = new AresRspDebugBackend({
    createClient: (connect) => host.createClient(connect),
    terminate: () => host.terminate(),
  });
  let ending = false;
  const close = async (error?: Error): Promise<void> => {
    if (ending) return;
    ending = true;
    if (error)
      await write(process.stderr, `${error.stack ?? error.message}\n`).catch(() => undefined);
    process.stdin.pause();
    await host.terminate().catch(() => undefined);
    await new Promise<void>((resolve) => process.stdout.end(resolve));
  };
  const server = new DebugSidecarServer({
    backend: ARES_RSP_BACKEND_ID,
    implementation: backend,
    session,
    write: (data) => write(process.stdout, data),
    close,
  });

  let receiveTail = Promise.resolve();
  process.stdin.on("data", (data: Buffer) => {
    receiveTail = receiveTail.then(() => server.receive(data));
    void receiveTail.catch(() => undefined);
  });
  process.stdin.on("end", () => {
    void receiveTail.then(() => server.close()).catch(() => undefined);
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void server.close().catch(() => undefined);
    });
  }
};

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes("--help")) {
    await write(process.stdout, usage);
  } else {
    await runAresSidecar(arguments_).catch(async (error: unknown) => {
      const failure = error instanceof Error ? error : new Error(String(error));
      await write(process.stderr, `${failure.stack ?? failure.message}\n`).catch(() => undefined);
      process.exitCode = 1;
    });
  }
}
