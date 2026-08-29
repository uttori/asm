import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Response = { id: number; result?: unknown; error?: { message?: string } };

class LspClient {
  readonly child;
  #buffer = Buffer.alloc(0);
  #nextId = 1;
  #pending = new Map<number, (response: Response) => void>();

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
        if (response.error)
          reject(new Error(response.error.message ?? `LSP request '${method}' failed.`));
        else resolve(response.result);
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
      if (boundary < 0) return;
      const header = this.#buffer.subarray(0, boundary).toString("ascii");
      const length = Number(/Content-Length:\s*(\d+)/i.exec(header)?.[1]);
      const bodyStart = boundary + 4;
      if (!Number.isFinite(length) || this.#buffer.length < bodyStart + length) return;
      const message = JSON.parse(
        this.#buffer.subarray(bodyStart, bodyStart + length).toString("utf8"),
      ) as Response & { method?: string };
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
  const result = (await client.request("workspace/executeCommand", {
    command: "asm.build",
    arguments: [pathToFileURL(source).href],
  })) as { ok: boolean; outputPath?: string; message?: string };
  assert.equal(result.ok, true, result.message ?? "Language-server build failed.");
  assert.ok(result.outputPath);
  return result.outputPath;
};

const server = path.resolve("language-server/out/server.mjs");
assert.ok(
  fs.existsSync(server),
  "Build language-server/out/server.mjs before running this smoke test.",
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
  const restrictedMetadata = (await fixtureClient.request("asm/projectMetadata", null)) as {
    activeTarget: string;
    targets: Array<{ id: string }>;
  };
  assert.equal(restrictedMetadata.activeTarget, "snes.sfc");
  const restrictedTargets = new Set(restrictedMetadata.targets.map((target) => target.id));
  assert.equal(restrictedTargets.has("snes.sfc"), true);
  assert.equal(restrictedTargets.has("65xx.raw"), true);
  assert.equal(restrictedTargets.has("65xx.nes"), true);

  fs.writeFileSync(fixtureSource, "org 0\nFIX\n");
  fixtureClient.notify("workspace/didChangeConfiguration", {
    settings: { asm: { workspaceTrusted: true } },
  });
  const trustedMetadata = (await fixtureClient.request("asm/projectMetadata", null)) as {
    activeTarget: string;
    activeArchitecture: string;
    targets: Array<{ id: string }>;
    architectures: Array<{ id: string }>;
  };
  assert.equal(trustedMetadata.activeTarget, "loader.fixture-target");
  assert.equal(trustedMetadata.activeArchitecture, "loader.fixture-architecture");
  assert.deepEqual([...trustedMetadata.targets.map((target) => target.id)].sort(), [
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

  console.log(
    "Language-server bundle smoke test passed for bundled SNES, trust reload, metadata, and workspace plugin targets.",
  );
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
