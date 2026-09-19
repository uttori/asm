import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import type { DebugMap } from "@uttori/asm-core/debug-map";
import { parseDebugAddress, type DapProtocolMessage } from "@uttori/asm-debug-adapter";
import * as vscode from "vscode";

import { resolveDebugSourceRoot } from "../src/debug-source-root.js";

/** One actual generated line and the runtime PC expected when it stops. */
interface SourceTarget {
  readonly uri: vscode.Uri;
  readonly line: number;
  readonly pc: number;
}

/** Poll editor events with a bounded deadline; no assumptions about transport timing. */
const waitFor = async (condition: () => boolean, description: string): Promise<void> => {
  const deadline = Date.now() + 25_000;
  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${description}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

/**
 * Opt-in Secret of Mana proof using the workspace's configured ROM, map and ares runtime.
 * Tests a mirrored reset instruction, an edit while running, and restored breakpoints
 * in a fresh session. No source, ROM, launch configuration or analysis data is rewritten.
 * @param {vscode.WorkspaceFolder} folder Existing Secret of Mana workspace.
 * @returns {Promise<void>} Rejects on any editor, DAP or native stop mismatch.
 */
export async function runLiveBreakpointSmoke(folder: vscode.WorkspaceFolder): Promise<void> {
  const name = process.env.UTTORI_VSCODE_LIVE_LAUNCH ?? "Launch Emulator (ares)";
  const configuration = vscode.workspace
    .getConfiguration("launch", folder.uri)
    .get<vscode.DebugConfiguration[]>("configurations", [])
    .find((entry) => entry.name === name);
  assert.ok(configuration, `Missing launch configuration '${name}'.`);
  assert.equal(configuration.backend, "ares");
  const resolve = (value: string): string =>
    path.resolve(folder.uri.fsPath, value.replaceAll("${workspaceFolder}", folder.uri.fsPath));
  const mapFile = resolve(configuration.debugMap);
  const map = JSON.parse(fs.readFileSync(mapFile, "utf8")) as DebugMap;
  const sourceRoot = resolveDebugSourceRoot({
    map,
    configuredRoot: resolve(configuration.sourceRoot ?? "."),
    debugMapFile: mapFile,
    programFile: resolve(configuration.program),
    workspaceRoot: folder.uri.fsPath,
  });
  const target = (address: number, pc = address): SourceTarget => {
    const range = map.ranges.find(
      (entry) => entry.architecture === "snes.65816" && entry.start === address,
    );
    assert.ok(range, `No generated mapping for $${address.toString(16)}.`);
    const source = map.sources.find((entry) => entry.id === range.sourceId);
    assert.ok(source);
    return { uri: vscode.Uri.file(path.resolve(sourceRoot, source.path)), line: range.line, pc };
  };
  // Reset executes through bank $00; the generated HiROM source names bank $C0.
  const reset = target(0xc08005, 0x008005);
  const upload = target(0xc300c6);
  const messages: DapProtocolMessage[] = [];
  const tracker = vscode.debug.registerDebugAdapterTrackerFactory("uttori-asm", {
    createDebugAdapterTracker: () => ({
      onDidSendMessage: (message: unknown) => messages.push(message as DapProtocolMessage),
    }),
  });
  const owned = new Set<vscode.SourceBreakpoint>();
  const toggle = async (location: SourceTarget, enabled: boolean): Promise<number> => {
    const document = await vscode.workspace.openTextDocument(location.uri);
    assert.equal(document.languageId, "uttori-snes");
    // Pass selection with the show request so the workbench applies it before F9;
    // assigning editor.selection separately can race its batched IPC notification.
    await vscode.window.showTextDocument(document, {
      selection: new vscode.Range(location.line - 1, 0, location.line - 1, 0),
      preview: false,
    });
    const start = messages.length;
    await vscode.commands.executeCommand("editor.debug.action.toggleBreakpoint");
    const breakpoint = vscode.debug.breakpoints.find(
      (entry): entry is vscode.SourceBreakpoint =>
        entry instanceof vscode.SourceBreakpoint &&
        entry.location.uri.toString() === location.uri.toString() &&
        entry.location.range.start.line === location.line - 1,
    );
    assert.equal(
      Boolean(breakpoint),
      enabled,
      `Editor toggle did not ${enabled ? "add" : "remove"} breakpoint at ${location.uri.fsPath}:${location.line}. Existing: ${JSON.stringify(vscode.debug.breakpoints)}`,
    );
    if (breakpoint) {
      owned.add(breakpoint);
    }
    return start;
  };
  const verified = async (start: number, line: number | undefined): Promise<void> => {
    const response = () =>
      messages
        .slice(start)
        .find((message) => message.type === "response" && message.command === "setBreakpoints");
    await waitFor(() => Boolean(response()), "source breakpoint response");
    const result = response();
    assert.ok(result?.type === "response");
    assert.equal(result.success, true, result.message ?? "Source breakpoint request failed.");
    const body = result.body as { breakpoints: { verified: boolean; line: number }[] };
    if (line === undefined) {
      assert.deepEqual(body.breakpoints, []);
    } else {
      assert.ok(body.breakpoints.some((entry) => entry.line === line && entry.verified));
    }
  };
  const stopped = async (start: number, reason: string): Promise<void> => {
    await waitFor(
      () =>
        messages
          .slice(start)
          .some(
            (message) =>
              message.type === "event" &&
              message.event === "stopped" &&
              (message.body as { reason?: string }).reason === reason,
          ),
      `${reason} stop`,
    );
  };
  const frame = async (session: vscode.DebugSession, location: SourceTarget): Promise<void> => {
    const stack = (await session.customRequest("stackTrace", { threadId: 1 })) as {
      stackFrames: {
        line: number;
        source: { path: string };
        instructionPointerReference: string;
      }[];
    };
    assert.equal(stack.stackFrames[0]?.line, location.line);
    assert.equal(stack.stackFrames[0]?.source.path, location.uri.fsPath);
    assert.equal(
      parseDebugAddress(stack.stackFrames[0]?.instructionPointerReference)?.address,
      location.pc,
    );
  };
  const launch = async (): Promise<vscode.DebugSession> => {
    const start = messages.length;
    assert.equal(await vscode.debug.startDebugging(folder, name), true);
    await stopped(start, "entry");
    await verified(start, reset.line);
    assert.ok(vscode.debug.activeDebugSession);
    return vscode.debug.activeDebugSession;
  };
  try {
    assert.equal(
      vscode.workspace.getConfiguration("debug").get("allowBreakpointsEverywhere"),
      false,
    );
    await toggle(reset, true);
    let session = await launch();
    let start = messages.length;
    await session.customRequest("continue", { threadId: 1 });
    await stopped(start, "breakpoint");
    await frame(session, reset);
    await verified(await toggle(reset, false), undefined);
    start = messages.length;
    await session.customRequest("continue", { threadId: 1 });
    await verified(await toggle(upload, true), upload.line);
    await stopped(start, "breakpoint");
    await frame(session, upload);
    assert.equal(
      messages
        .slice(start)
        .some(
          (message) =>
            message.type === "event" &&
            message.event === "stopped" &&
            (message.body as { reason?: string }).reason === "pause",
        ),
      false,
    );
    await verified(await toggle(upload, false), undefined);
    // Persist a gutter breakpoint across a full native session restart.
    await verified(await toggle(reset, true), reset.line);
    await vscode.debug.stopDebugging(session);
    await waitFor(() => !vscode.debug.activeDebugSession, "session shutdown");
    session = await launch();
    start = messages.length;
    await session.customRequest("continue", { threadId: 1 });
    await stopped(start, "breakpoint");
    await frame(session, reset);
    assert.deepEqual(
      messages.filter((message) => message.type === "response" && !message.success),
      [],
    );
    console.log(
      JSON.stringify({
        liveBreakpointSmoke: "passed",
        runtime: configuration.emulator,
        mirroredReset: reset,
        runningUpdate: upload,
        restart: true,
      }),
    );
  } finally {
    await vscode.debug.stopDebugging(vscode.debug.activeDebugSession);
    vscode.debug.removeBreakpoints([...owned]);
    tracker.dispose();
  }
}
