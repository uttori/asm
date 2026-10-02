import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

type LspEnvelope = {
  id?: number;
  result?: unknown;
  error?: { message?: string };
  method?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isLspEnvelope(value: unknown): value is LspEnvelope {
  if (!isRecord(value)) {
    return false;
  }
  if (value.id !== undefined && typeof value.id !== "number") {
    return false;
  }
  if (value.method !== undefined && typeof value.method !== "string") {
    return false;
  }
  if (value.error === undefined) {
    return true;
  }
  return (
    isRecord(value.error) &&
    (value.error.message === undefined || typeof value.error.message === "string")
  );
}

function readStringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`Expected ${label} to be an array of strings.`);
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function readIds(value: unknown, label: string): { id: string }[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an array.`);
  }
  return value.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      throw new Error(`Expected ${label}[${index}] to have an id.`);
    }
    return { id: entry.id };
  });
}

function readBuildResult(value: unknown): { ok: boolean; outputPath?: string; message?: string } {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    throw new Error("Language-server build returned an unexpected result.");
  }
  if (value.outputPath !== undefined && typeof value.outputPath !== "string") {
    throw new Error("Language-server build output path must be a string.");
  }
  if (value.message !== undefined && typeof value.message !== "string") {
    throw new Error("Language-server build message must be a string.");
  }
  return {
    ok: value.ok,
    ...(typeof value.outputPath === "string" ? { outputPath: value.outputPath } : {}),
    ...(typeof value.message === "string" ? { message: value.message } : {}),
  };
}

function readEntryPoints(value: unknown): { entryPoints: string[] } {
  if (!isRecord(value)) {
    throw new Error("Language-server status is missing entry points.");
  }
  return { entryPoints: readStringList(value.entryPoints, "entryPoints") };
}

function readProjectMetadata(value: unknown): {
  activeTarget: string;
  activeArchitecture?: string;
  targets: { id: string }[];
  architectures?: { id: string }[];
} {
  if (!isRecord(value) || typeof value.activeTarget !== "string") {
    throw new Error("Project metadata is missing activeTarget.");
  }
  const metadata: {
    activeTarget: string;
    activeArchitecture?: string;
    targets: { id: string }[];
    architectures?: { id: string }[];
  } = {
    activeTarget: value.activeTarget,
    targets: readIds(value.targets, "targets"),
  };
  if (value.activeArchitecture !== undefined) {
    if (typeof value.activeArchitecture !== "string") {
      throw new Error("Project metadata activeArchitecture must be a string.");
    }
    metadata.activeArchitecture = value.activeArchitecture;
  }
  if (value.architectures !== undefined) {
    metadata.architectures = readIds(value.architectures, "architectures");
  }
  return metadata;
}

function readWorkspaceStatus(value: unknown): {
  configFile?: string;
  entryPoints: string[];
  fileCount: number;
  symbolCount: number;
  errorCount: number;
} {
  if (!isRecord(value)) {
    throw new Error("Workspace status must be an object.");
  }
  if (value.configFile !== undefined && typeof value.configFile !== "string") {
    throw new Error("Workspace status configFile must be a string.");
  }
  if (
    typeof value.fileCount !== "number" ||
    typeof value.symbolCount !== "number" ||
    typeof value.errorCount !== "number"
  ) {
    throw new Error("Workspace status counts must be numbers.");
  }
  return {
    ...(typeof value.configFile === "string" ? { configFile: value.configFile } : {}),
    entryPoints: readStringList(value.entryPoints, "entryPoints"),
    fileCount: value.fileCount,
    symbolCount: value.symbolCount,
    errorCount: value.errorCount,
  };
}

class LspClient {
  readonly child;
  #buffer = Buffer.alloc(0);
  #nextId = 1;
  readonly #pending = new Map<number, (response: LspEnvelope) => void>();

  constructor(server: string) {
    this.child = spawn(process.execPath, [server, "--stdio"], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    this.child.stdout.on("data", (chunk: Buffer) => {
      this.#buffer = Buffer.concat([this.#buffer, chunk]);
      this.#drain();
    });
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.#nextId++;
    this.#send({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`LSP request '${method}' timed out.`)),
        10_000,
      );
      this.#pending.set(id, (response) => {
        clearTimeout(timer);
        if (response.error) {
          reject(new Error(response.error.message ?? `LSP request '${method}' failed.`));
        } else {
          resolve(response.result);
        }
      });
    });
  }

  notify(method: string, params: unknown): void {
    this.#send({ jsonrpc: "2.0", method, params });
  }

  async close(): Promise<void> {
    await this.request("shutdown", null);
    this.notify("exit", null);
    await new Promise<void>((resolve) => this.child.once("exit", () => resolve()));
  }

  #send(message: unknown): void {
    const payload = Buffer.from(JSON.stringify(message));
    this.child.stdin.write(`Content-Length: ${payload.length}\r\n\r\n`);
    this.child.stdin.write(payload);
  }

  #drain(): void {
    for (;;) {
      const boundary = this.#buffer.indexOf("\r\n\r\n");
      if (boundary < 0) {
        return;
      }
      const header = this.#buffer.subarray(0, boundary).toString("ascii");
      const length = Number(/content-length:\s*(\d+)/i.exec(header)?.[1]);
      const bodyStart = boundary + 4;
      if (!Number.isFinite(length) || this.#buffer.length < bodyStart + length) {
        return;
      }
      const parsed: unknown = JSON.parse(
        this.#buffer.subarray(bodyStart, bodyStart + length).toString("utf8"),
      );
      if (!isLspEnvelope(parsed)) {
        throw new Error("Language server returned a non-object message.");
      }
      const message = parsed;
      this.#buffer = this.#buffer.subarray(bodyStart + length);
      if (message.method && message.id !== undefined) {
        this.#send({ jsonrpc: "2.0", id: message.id, result: null });
      } else if (message.id !== undefined) {
        this.#pending.get(message.id)?.(message);
        this.#pending.delete(message.id);
      }
    }
  }
}

const initialize = async (
  client: LspClient,
  workspace: string,
  initializationOptions: Record<string, unknown>,
): Promise<void> => {
  const workspaceUri = pathToFileURL(workspace).href;
  await client.request("initialize", {
    processId: process.pid,
    rootUri: workspaceUri,
    workspaceFolders: [{ uri: workspaceUri, name: path.basename(workspace) }],
    capabilities: { workspace: { configuration: false } },
    initializationOptions,
  });
  client.notify("initialized", {});
};

const build = async (client: LspClient, source: string): Promise<string> => {
  const result = readBuildResult(
    await client.request("workspace/executeCommand", {
      command: "asm.build",
      arguments: [pathToFileURL(source).href],
    }),
  );
  assert.equal(result.ok, true, result.message ?? "Language-server build failed.");
  assert.ok(result.outputPath);
  return result.outputPath;
};

const server = path.resolve(process.argv[2] ?? "packages/language-server/out/server.mjs");
assert.ok(
  fs.existsSync(server),
  "Build packages/language-server/out/server.mjs before running this smoke test.",
);

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-lsp-bundle-"));
try {
  const snesDirectory = path.join(directory, "snes");
  fs.mkdirSync(snesDirectory);
  const snesSource = path.join(snesDirectory, "main.asm");
  fs.writeFileSync(snesSource, "org $008000\nLDA #$01\n");
  const snesClient = new LspClient(server);
  await initialize(snesClient, snesDirectory, { workspaceTrusted: true });
  const snesOutput = await build(snesClient, snesSource);
  assert.equal(path.extname(snesOutput), ".sfc");
  assert.ok(fs.statSync(snesOutput).size > 0);
  await snesClient.close();

  const nesDirectory = path.join(directory, "nes");
  fs.mkdirSync(nesDirectory);
  const nesSource = path.join(nesDirectory, "main.asm");
  fs.writeFileSync(nesSource, '.segment "CODE"\nStart:\nLDA #$12\n.byte $34\n');
  fs.writeFileSync(
    path.join(nesDirectory, "uttori-asm.config.json"),
    JSON.stringify({
      target: "65xx.nes",
      architecture: "65xx.6502",
      entryPoints: ["main.asm"],
    }),
  );
  const nesClient = new LspClient(server);
  await initialize(nesClient, nesDirectory, { workspaceTrusted: true });
  const nesOutput = await build(nesClient, nesSource);
  assert.equal(path.extname(nesOutput), ".nes");
  const nesBytes = fs.readFileSync(nesOutput);
  assert.equal(nesBytes.length, 16 + 0x8000);
  assert.deepEqual([...nesBytes.subarray(0, 5)], [0x4e, 0x45, 0x53, 0x1a, 2]);
  assert.deepEqual([...nesBytes.subarray(16, 19)], [0xa9, 0x12, 0x34]);
  await nesClient.close();

  const nestedRoot = path.join(directory, "nested");
  const nestedProject = path.join(nestedRoot, "disassembly");
  fs.mkdirSync(path.join(nestedProject, "include"), { recursive: true });
  const nestedSource = path.join(nestedProject, "main.asm");
  fs.writeFileSync(nestedSource, 'lorom\norg $008000\nincsrc "body.asm"\n');
  fs.writeFileSync(path.join(nestedProject, "include", "body.asm"), "NOP\n");
  fs.writeFileSync(
    path.join(nestedProject, "uttori-asm.config.json"),
    JSON.stringify({
      target: "snes.sfc",
      architecture: "snes.65816",
      entryPoints: ["main.asm"],
      includePaths: ["include"],
      buildOutput: "build/nested.sfc",
    }),
  );
  const nestedClient = new LspClient(server);
  await initialize(nestedClient, nestedRoot, {
    workspaceTrusted: true,
    configFile: "disassembly/uttori-asm.config.json",
  });
  const nestedOutput = await build(nestedClient, nestedSource);
  assert.equal(nestedOutput, path.join(nestedProject, "build", "nested.sfc"));
  assert.equal(fs.readFileSync(nestedOutput)[0], 0xea);
  const alternateSource = path.join(nestedProject, "alternate.asm");
  fs.writeFileSync(alternateSource, "lorom\norg $008000\nSTP\n");
  const nestedConfig = path.join(nestedProject, "uttori-asm.config.json");
  fs.writeFileSync(
    nestedConfig,
    JSON.stringify({
      target: "snes.sfc",
      architecture: "snes.65816",
      entryPoints: ["alternate.asm"],
      includePaths: ["include"],
      buildOutput: "build/alternate.sfc",
    }),
  );
  nestedClient.notify("workspace/didChangeWatchedFiles", {
    changes: [{ uri: pathToFileURL(nestedConfig).href, type: 2 }],
  });
  const changedStatus = readEntryPoints(await nestedClient.request("asm/status", null));
  assert.deepEqual(
    changedStatus.entryPoints,
    [alternateSource],
    "config edits must not retain previously resolved defaults",
  );
  const alternateOutput = await build(nestedClient, nestedSource);
  assert.equal(alternateOutput, path.join(nestedProject, "build", "alternate.sfc"));
  assert.equal(fs.readFileSync(alternateOutput)[0], 0xdb);
  await nestedClient.close();

  const fixtureDirectory = path.join(directory, "fixture");
  fs.mkdirSync(fixtureDirectory);
  const fixturePlugin = path.join(fixtureDirectory, "fixture-plugin.mjs");
  fs.copyFileSync(
    path.resolve("packages/plugin-loader-node/tests/fixtures/relative-plugin.mjs"),
    fixturePlugin,
  );
  fs.writeFileSync(
    path.join(fixtureDirectory, "uttori-asm.config.json"),
    JSON.stringify({
      plugins: [{ module: "./fixture-plugin.mjs", options: { byte: 0x5a } }],
      target: "loader-fixture",
      architecture: "loader-cpu",
    }),
  );
  const fixtureSource = path.join(fixtureDirectory, "main.asm");
  fs.writeFileSync(fixtureSource, "org $008000\nLDA #$01\n");
  const fixtureClient = new LspClient(server);
  await initialize(fixtureClient, fixtureDirectory, { workspaceTrusted: false });
  const restrictedMetadata = readProjectMetadata(
    await fixtureClient.request("asm/projectMetadata", null),
  );
  assert.equal(restrictedMetadata.activeTarget, "snes.sfc");
  const restrictedTargets = new Set(restrictedMetadata.targets.map((target) => target.id));
  assert.equal(restrictedTargets.has("snes.sfc"), true);
  assert.equal(restrictedTargets.has("65xx.raw"), true);
  assert.equal(restrictedTargets.has("65xx.ca65-raw"), true);
  assert.equal(restrictedTargets.has("65xx.nes"), true);

  fs.writeFileSync(fixtureSource, "org 0\nFIX\n");
  fixtureClient.notify("workspace/didChangeConfiguration", {
    settings: { asm: { workspaceTrusted: true } },
  });
  const trustedMetadata = readProjectMetadata(
    await fixtureClient.request("asm/projectMetadata", null),
  );
  if (
    trustedMetadata.activeArchitecture === undefined ||
    trustedMetadata.architectures === undefined
  ) {
    throw new Error("Trusted project metadata is missing its architecture.");
  }
  assert.equal(trustedMetadata.activeTarget, "loader.fixture-target");
  assert.equal(trustedMetadata.activeArchitecture, "loader.fixture-architecture");
  assert.deepEqual(trustedMetadata.targets.map((target) => target.id).toSorted(), [
    "65xx.ca65-raw",
    "65xx.nes",
    "65xx.raw",
    "loader.fixture-target",
    "snes.sfc",
  ]);
  assert.deepEqual(
    trustedMetadata.architectures.map((architecture) => architecture.id),
    ["loader.fixture-architecture"],
  );
  const fixtureOutput = await build(fixtureClient, fixtureSource);
  assert.equal(path.extname(fixtureOutput), ".bin");
  assert.deepEqual([...fs.readFileSync(fixtureOutput)], [0x5a]);
  await fixtureClient.close();

  // Opt-in local integration gate: never requires or distributes a copyrighted ROM fixture.
  if (process.env.UTTORI_LSP_WORKSPACE) {
    const localRoot = path.resolve(process.env.UTTORI_LSP_WORKSPACE);
    const parsedSettings: unknown = JSON.parse(
      fs.readFileSync(path.join(localRoot, ".vscode/settings.json"), "utf8"),
    );
    if (!isRecord(parsedSettings)) {
      throw new Error("Workspace settings must be an object.");
    }
    const localSettings = parsedSettings;
    const initializationOptions = Object.fromEntries(
      Object.entries(localSettings)
        .filter(([key]) => key.startsWith("asm."))
        .map(([key, value]) => [key.slice(4), value]),
    );
    const localClient = new LspClient(server);
    const start = performance.now();
    await initialize(localClient, localRoot, { ...initializationOptions, workspaceTrusted: true });
    const status = readWorkspaceStatus(await localClient.request("asm/status", null));
    assert.ok(status.configFile, "Existing workspace must be initialized.");
    assert.equal(status.entryPoints.length, 1, "Generated workspace must have one include root.");
    const indexMs = Math.round(performance.now() - start);
    const output = await build(localClient, path.resolve(localRoot, status.entryPoints[0]));
    console.log(
      JSON.stringify({
        localWorkspace: localRoot,
        status,
        indexMs,
        totalMs: Math.round(performance.now() - start),
        output,
      }),
    );
    await localClient.close();
  }

  console.log(
    "Language-server bundle smoke test passed for bundled SNES and NES, nested config paths, trust reload, metadata, and workspace plugin targets.",
  );
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
