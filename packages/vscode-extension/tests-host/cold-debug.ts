import assert from "node:assert/strict";

import { AddressToLineMapping } from "@uttori/asm-core";
import { createDebugMap } from "@uttori/asm-core/debug-map";
import * as vscode from "vscode";

/** Prove F5 activates an idle extension and registers its adapter without opening assembly first. */
export async function runColdDebugActivationSmoke(
  extension: vscode.Extension<unknown>,
  folder: vscode.WorkspaceFolder,
): Promise<void> {
  assert.equal(extension.isActive, false, "Cold debugger smoke must start before activation.");
  const source = vscode.Uri.joinPath(folder.uri, "activation.fixture");
  const program = vscode.Uri.joinPath(folder.uri, "activation.bin");
  const debugMap = vscode.Uri.joinPath(folder.uri, "activation.debug.json");
  const output = new Uint8Array([0xea]);
  // Construct the matched pair directly: invoking the assembly command would activate the extension.
  await vscode.workspace.fs.writeFile(source, Buffer.from("nop\n"));
  await vscode.workspace.fs.writeFile(program, output);
  const mapping = new AddressToLineMapping();
  mapping.includeByte(source.fsPath, 1, "snes.65816", "snes.cpu", 0x8000, 0);
  await vscode.workspace.fs.writeFile(
    debugMap,
    Buffer.from(JSON.stringify(createDebugMap({ target: "snes.sfc", output, mapping }))),
  );
  let stopped = false;
  let session: vscode.DebugSession | undefined;
  const tracker = vscode.debug.registerDebugAdapterTrackerFactory("uttori-asm", {
    createDebugAdapterTracker: () => ({
      onDidSendMessage: (message: { event?: string }) => {
        if (message.event === "stopped") {
          stopped = true;
        }
      },
    }),
  });
  const started = vscode.debug.onDidStartDebugSession((value) => {
    if (value.name === "Cold debugger activation") {
      session = value;
    }
  });
  try {
    assert.equal(
      await vscode.debug.startDebugging(folder, {
        type: "uttori-asm",
        request: "launch",
        name: "Cold debugger activation",
        backend: "replay",
        program: program.fsPath,
        debugMap: debugMap.fsPath,
        sourceRoot: folder.uri.fsPath,
      }),
      true,
      "F5 must activate the extension before looking up its adapter descriptor.",
    );
    assert.equal(extension.isActive, true);
    const deadline = Date.now() + 10_000;
    const ready = (): boolean => stopped && session !== undefined;
    while (!ready()) {
      assert.ok(Date.now() < deadline, "Cold debugger launch did not stop at entry.");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(session);
    const stack = await session.customRequest("stackTrace", { threadId: 1 });
    assert.equal(stack.stackFrames[0].source.path, source.fsPath);
    console.log("Cold F5 activated Uttori and reached the mapped replay entry.");
  } finally {
    if (session) {
      await vscode.debug.stopDebugging(session);
    }
    started.dispose();
    tracker.dispose();
  }
}
