import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { recoverCaptureFile, validateCaptureResult } from "@uttori/asm-capture";
import { NativeCaptureFileRecorder } from "@uttori/asm-debug-adapter";
import { sourceContentHash } from "@uttori/asm-disassembler/source-project";
import type { NesSourceBuild } from "@uttori/asm-plugin-65xx/disassembler";
import * as vscode from "vscode";

/** Bound editor transitions so failures terminate the disposable extension host. */
async function until(check: () => boolean, phase: string): Promise<void> {
  const deadline = Date.now() + 30000;
  while (!check()) {
    assert.ok(Date.now() < deadline, `NES smoke timed out: ${phase}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** Exercise the actual NES build worker, F5 adapter, source mapping, native recorder and import commands. */
export async function runNesSourceSmoke(folder: vscode.WorkspaceFolder): Promise<void> {
  const root = folder.uri.fsPath;
  const launch = JSON.parse(await fs.readFile(path.join(root, ".vscode/launch.json"), "utf8"));
  const configuration = launch.configurations.find(
    (entry: { type: string; aresSystem: string; sourceProject: boolean }) =>
      entry.type === "uttori-asm" && entry.aresSystem === "Famicom" && entry.sourceProject,
  );
  assert.ok(configuration, "NES smoke requires a Famicom source launch.");
  const manifest = JSON.parse(
    await fs.readFile(configuration.runtimeManifest.replace("${workspaceFolder}", root), "utf8"),
  );
  const producer = {
    id: "ares",
    revision: `${manifest.forkRevision}:${manifest.patchSha256}:${manifest.executableSha256}`,
  };
  const events: { event?: string; command?: string; success?: boolean; message?: string }[] = [];
  const tracking = vscode.debug.registerDebugAdapterTrackerFactory("uttori-asm", {
    createDebugAdapterTracker: () => ({ onDidSendMessage: (message) => events.push(message) }),
  });
  let session: vscode.DebugSession | undefined;
  const started = vscode.debug.onDidStartDebugSession((value) => {
    if (value.name === configuration.name) {
      session = value;
    }
  });
  try {
    await vscode.commands.executeCommand("asm.source.select", folder.uri);
    const build = await vscode.commands.executeCommand<NesSourceBuild>(
      "asm.source.buildProject",
      folder.uri,
    );
    assert.ok(build);
    assert.equal(build.verification.outputSha256, manifest.romSha256);
    assert.equal(await vscode.debug.startDebugging(folder, configuration.name), true);
    await until(
      () => !!session && events.some((event) => event.event === "stopped"),
      "F5 reset stop",
    );
    const active = session!;
    const stack = await active.customRequest("stackTrace", { threadId: 1 });
    assert.match(stack.stackFrames[0].instructionPointerReference, /65xx\.2a03\|nes\.cpu/);
    assert.ok(stack.stackFrames[0].source?.path, "NES reset must resolve to generated source");
    const before = events.filter((event) => event.event === "stopped").length;
    await active.customRequest("stepIn", { threadId: 1, granularity: "instruction" });
    await until(
      () => events.filter((event) => event.event === "stopped").length > before,
      "instruction step",
    );
    const bytes = await fs.readFile(build.outputFile);
    const ppuFile = path.join(root, ".uttori-local/captures", `vscode-ppu-${Date.now()}.act2`);
    const ppuRecorder = await NativeCaptureFileRecorder.create({
      file: ppuFile,
      scope: "nes.cpu-bus-ppu",
      architecture: "65xx.2a03",
      addressSpace: "nes.cpu",
      romContentSha256: sourceContentHash(bytes.subarray(16)),
      romFileSha256: sourceContentHash(bytes),
      producer,
      context: true,
      transport: async (request) =>
        validateCaptureResult(await active.customRequest("uttori/capture", request)),
    });
    await active.customRequest("continue", { threadId: 1 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const ppuCapture = await ppuRecorder.stop();
    assert.equal(ppuCapture.complete, true);
    assert.equal(ppuCapture.droppedEvents, 0);
    assert.ok(ppuCapture.observedEvents > 0);
    const effects: Record<string, number> = {};
    const timeline = { fetches: 0, a12: 0, irqPins: 0 };
    const verifiedPpu = await recoverCaptureFile(ppuFile, (chunk) => {
      assert.equal(chunk.scope, "nes.cpu-bus-ppu");
      for (const event of chunk.events) {
        if ("timeline" in event) {
          if (event.timeline === "fetch") {
            timeline.fetches++;
          }
          if (event.timeline === "a12") {
            timeline.a12++;
          }
          if (event.timeline === "irq-pin") {
            timeline.irqPins++;
          }
          continue;
        }
        if (event.effect?.outcome === "written") {
          effects[event.effect.target] =
            (effects[event.effect.target] ?? 0) + event.effect.bytes.length;
        }
      }
    });
    assert.equal(verifiedPpu.complete, true);
    assert.ok(timeline.fetches > 0 && timeline.a12 > 0);
    assert.ok(
      effects.palette > 0 && effects.ciram > 0 && effects.oam > 0,
      "Cold boot must upload palette, nametables and sprites",
    );
    // Context stop already acknowledges a halted CPU boundary.

    const ppuSnapshot = await vscode.commands.executeCommand<{ directory: string }>(
      "asm.nes.ppuSnapshot",
    );
    assert.ok(ppuSnapshot.directory);
    assert.equal((await fs.stat(path.join(ppuSnapshot.directory, "ppu.bin"))).size, 13056);
    const file = path.join(root, ".uttori-local/captures", `vscode-${Date.now()}.act2`);
    const recorder = await NativeCaptureFileRecorder.create({
      file,
      scope: "nes.2a03.instructions",
      architecture: "65xx.2a03",
      addressSpace: "nes.cpu",
      romContentSha256: sourceContentHash(bytes.subarray(16)),
      romFileSha256: sourceContentHash(bytes),
      producer,
      context: true,
      transport: async (request) =>
        validateCaptureResult(await active.customRequest("uttori/capture", request)),
    });
    await active.customRequest("continue", { threadId: 1 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const capture = await recorder.stop();
    assert.equal(capture.complete, true);
    assert.equal(capture.droppedEvents, 0);
    assert.ok(capture.observedEvents > 0);
    assert.equal((await recoverCaptureFile(file)).complete, true);
    assert.ok(capture.contextDirectory);
    const companion = JSON.parse(
      await fs.readFile(path.join(capture.contextDirectory, "manifest.json"), "utf8"),
    );
    assert.equal(companion.endpoint.encoding, "ares-famicom-canonical-v1");
    const graphics = await recoverCaptureFile(path.join(capture.contextDirectory, "graphics.act2"));
    assert.equal(graphics.complete, true);
    assert.equal(graphics.header.scope, "nes.cpu-bus-ppu");
    const replayStart = events.filter((event) => event.event === "stopped").length;
    await active.customRequest("uttori/capture", {
      operation: "context",
      action: "replay",
      directory: capture.contextDirectory,
      romContentSha256: sourceContentHash(bytes.subarray(16)),
      romFileSha256: sourceContentHash(bytes),
      producer,
    });
    await active.customRequest("continue", { threadId: 1 });
    await until(
      () => events.filter((event) => event.event === "stopped").length > replayStart,
      "NES deterministic replay endpoint",
    );
    assert.deepEqual(
      await active.customRequest("uttori/capture", { operation: "context", action: "status" }),
      { contextState: "idle" },
    );
    await vscode.debug.stopDebugging(active);
    session = undefined;
    const imported = await vscode.commands.executeCommand(
      "asm.source.importCapture",
      vscode.Uri.file(file),
    );
    assert.ok(imported, "NES capture import command did not return a result");
    const ppuImported = await vscode.commands.executeCommand(
      "asm.source.importCapture",
      vscode.Uri.file(ppuFile),
    );
    assert.ok(ppuImported, "PPU evidence import did not return a result");
    const graphicsSha256 = sourceContentHash(await fs.readFile(ppuFile));
    await vscode.commands.executeCommand("asm.source.graphics", graphicsSha256);
    const evidenceText = vscode.window.activeTextEditor?.document.getText() ?? "";
    assert.ok(
      evidenceText.includes(graphicsSha256),
      "Graphics selection must use portable archive identity",
    );
    assert.ok(
      evidenceText.includes('"instructionVariants"'),
      "Graphics report must expose CPU SQLite joins",
    );
    const analysis = await vscode.commands.executeCommand("asm.source.analyze");
    assert.ok(analysis, "NES evidence analysis command did not return a result");
    const rebuilt = await vscode.commands.executeCommand<NesSourceBuild>(
      "asm.source.buildProject",
      folder.uri,
    );
    assert.ok(rebuilt);
    assert.equal(rebuilt.verification.outputSha256, manifest.romSha256);
    const report = {
      editor: vscode.version,
      node: process.versions.node,
      success: true,
      capture: file,
      instructions: capture.observedEvents,
      ppuCapture: ppuFile,
      ppuEvents: ppuCapture.observedEvents,
      ppuWrites: effects,
      timeline,
      context: capture.contextDirectory,
      graphicsEvents: graphics.eventThrough,
      replay: "matched-full-machine-endpoint",
      ppuSnapshot: ppuSnapshot.directory,
      outputSha256: build.verification.outputSha256,
      checks: [
        "build worker",
        "F5 reset/source navigation",
        "step",
        "native capture",
        "NES PPU bus capture",
        "PPU fetch/A12/IRQ timeline",
        "NES full machine context and input replay",
        "NES PPU snapshot webview",
        "NES PPU report import",
        "portable graphics selection and CPU SQLite joins",
        "import",
        "analysis",
        "rebuild",
      ],
    };
    await fs.writeFile(
      path.join(root, ".uttori-local/nes-vscode-verification.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    if (session) {
      await vscode.debug.stopDebugging(session);
    }
    started.dispose();
    tracking.dispose();
  }
}
