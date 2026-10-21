import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";

/** Installed-editor soak with the maintained native runtime; saves alone use disposable storage. */
export async function runPausedRuntimeSmoke(folder: vscode.WorkspaceFolder): Promise<void> {
  const runtime = process.env.UTTORI_VSCODE_PAUSED_RUNTIME;
  const program = process.env.UTTORI_VSCODE_PAUSED_ROM;
  const debugMap = process.env.UTTORI_VSCODE_PAUSED_MAP;
  const receipt = process.env.UTTORI_VSCODE_PAUSED_RECEIPT;
  assert.ok(runtime && program && debugMap && receipt);
  const seconds = Number(process.env.UTTORI_VSCODE_PAUSED_SECONDS ?? "120");
  assert.ok(Number.isInteger(seconds) && seconds >= 10 && seconds <= 600);
  const saves = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-editor-soak-saves-"));
  const messages: { event?: string }[] = [];
  const tracking = vscode.debug.registerDebugAdapterTrackerFactory("uttori-asm", {
    createDebugAdapterTracker: () => ({ onDidSendMessage: message => messages.push(message) }),
  });
  const variants: { name: string; samples: ReturnType<typeof memory>[] }[] = [];
  let session: vscode.DebugSession | undefined;
  /** Keep ownership visible: extension-host, sidecar and emulator RSS are distinct columns. */
  function memory() {
    const rows = execFileSync("ps", ["-axo", "pid=,ppid=,rss=,comm="], { encoding: "utf8" })
      .trim().split("\n").map(line => {
        const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line);
        assert.ok(match);
        return { pid: Number(match[1]), parent: Number(match[2]), rss: Number(match[3]) * 1024, command: match[4] };
      });
    const emulator = rows.find(row => row.command === path.join(runtime!, "desktop-ui/ares.app/Contents/MacOS/ares"));
    assert.ok(emulator, "Owned emulator disappeared during pause");
    const sidecar = rows.find(row => row.pid === emulator.parent);
    assert.ok(sidecar && sidecar.parent === process.pid, "Emulator must belong to this extension host's sidecar");
    return { elapsedMs: performance.now(), extensionHost: process.memoryUsage().rss,
      sidecar: sidecar.rss, emulator: emulator.rss, sidecarPid: sidecar.pid, emulatorPid: emulator.pid };
  }
  /** Bound the asynchronous DAP entry stop before recording a paused interval. */
  async function launch(): Promise<vscode.DebugSession> {
    messages.length = 0;
    assert.equal(await vscode.debug.startDebugging(folder, {
      type: "uttori-asm", request: "launch", name: "Paused runtime acceptance", backend: "ares",
      program, debugMap, sourceRoot: process.env.UTTORI_VSCODE_PAUSED_SOURCE,
      runtimeManifest: path.join(runtime!, "ares-runtime-manifest.json"),
      emulator: path.join(runtime!, "desktop-ui/ares.app/Contents/MacOS/ares"),
      runtimeDirectory: runtime, saveDirectory: saves, aresSystem: "Super Famicom", fastBoot: true,
    }), true);
    const deadline = Date.now() + 30_000;
    while (!messages.some(message => message.event === "stopped")) {
      assert.ok(Date.now() < deadline, "Native editor launch did not stop");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(vscode.debug.activeDebugSession);
    return vscode.debug.activeDebugSession;
  }
  /** Match the standalone native soak's one-second sampling and fixed interval. */
  async function sample(name: string): Promise<void> {
    const started = performance.now();
    const samples = [];
    while (performance.now() - started <= seconds * 1000) {
      samples.push({ ...memory(), elapsedMs: performance.now() - started });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    variants.push({ name, samples });
    console.log(`Editor paused soak ${name}: ${JSON.stringify({ first: samples[0], last: samples.at(-1) })}`);
  }
  try {
    session = await launch();
    await sample("paused-no-capture");
    const capture: unknown = await session.customRequest("uttori/capture", {
      operation: "start", scope: "snes.65816.instructions", bufferBytes: 4718656,
    });
    assert.ok(typeof capture === "object" && capture !== null && "session" in capture && typeof capture.session === "string");
    await sample("paused-active-capture");
    await session.customRequest("uttori/capture", { operation: "stop", session: capture.session });
    await sample("paused-stopped-capture");
    await session.customRequest("uttori/capture", { operation: "abort", session: capture.session });
    await vscode.debug.stopDebugging(session);
    session = await launch();
    await sample("paused-editor-relaunch");
    fs.writeFileSync(receipt, JSON.stringify({ version: 1, editor: vscode.version,
      node: process.version, runtime, secondsPerVariant: seconds,
      installedExtension: vscode.extensions.getExtension("matthewcallis.uttori-asm-vscode")?.extensionPath,
      note: "Editor restart creates a fresh native process; standalone soak separately covers same-process backend reconnect.",
      variants }, null, 2) + "\n");
  } finally {
    if (session) {await vscode.debug.stopDebugging(session);}
    tracking.dispose();
    fs.rmSync(saves, { recursive: true, force: true });
  }
}
