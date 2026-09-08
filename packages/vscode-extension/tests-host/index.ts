import * as assert from "node:assert/strict";

import * as vscode from "vscode";
import { AnalysisCoverageProvider } from "../src/coverage-tree.js";
import { AnalysisGraphProvider } from "../src/analysis-graph-tree.js";
import { initializeAnalysisWorker } from "../src/analysis-worker-client.js";

const EXTENSION_ID = "matthewcallis.uttori-asm-vscode";
const REQUIRED_COMMANDS = [
  "asm.build",
  "asm.runEmulator",
  "asm.debugEmulator",
  "asm.runAndWatch",
  "asm.configureEmulatorRuntime",
  "asm.outline.refresh",
  "asm.coverage.refresh",
  "asm.analysisGraph.refresh",
  "asm.trace.start",
  "asm.capture.idle",
  "asm.capture.behavior",
  "asm.capture.stop",
  "asm.capture.review",
  "asm.capture.demo",
  "asm.capture.guide",
  "asm.trace.stop",
  "asm.trace.stopAnalyze",
  "asm.trace.importRegenerate",
  "asm.ramMap.open",
  "asm.disassembly.status",
  "asm.disassembly.regenerate",
  "asm.disassembly.editAnnotation",
];

/**
 * Opt-in production VS Code launch against locally supplied ares artifacts.
 * @param {vscode.WorkspaceFolder} folder Existing local workspace (never rewritten by the test).
 * @returns {Promise<void>} Launch, stopped frame, and trace capability checks.
 */
async function runLiveLaunch(folder: vscode.WorkspaceFolder): Promise<void> {
  // A fresh Electron test host has not yet installed its deferred debug content provider.
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const messages: {
    type?: string;
    event?: string;
    command?: string;
    success?: boolean;
    message?: string;
    body?: { threadId?: number; reason?: string };
  }[] = [];
  const tracker = vscode.debug.registerDebugAdapterTrackerFactory("uttori-asm", {
    createDebugAdapterTracker: () => ({
      onDidSendMessage: (raw: unknown) => {
        const message = raw as (typeof messages)[number];
        messages.push(message);
        console.log(
          JSON.stringify({
            type: message.type,
            event: message.event,
            command: message.command,
            success: message.success,
            message: message.message,
          }),
        );
      },
    }),
  });
  const started = Date.now();
  try {
    const name = process.env.UTTORI_VSCODE_LIVE_LAUNCH ?? "Secret of Mana (ares)";
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      assert.equal(
        await Promise.race([
          vscode.debug.startDebugging(folder, name),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Launch did not complete within 25 seconds.")),
              25_000,
            );
          }),
        ]),
        true,
      );
    } finally {
      clearTimeout(timer);
    }
    while (
      !messages.some((message) => message.event === "stopped") &&
      Date.now() - started < 25_000
    )
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(
      messages.some((message) => message.event === "stopped"),
      `No stopped event: ${JSON.stringify(messages)}`,
    );
    const session = vscode.debug.activeDebugSession;
    assert.ok(session);
    const threads = (await session.customRequest("threads")) as { threads: { id: number }[] };
    type LiveSource = { name?: string; path?: string; sourceReference?: number };
    const waitForVirtualEditor = async (source: LiveSource): Promise<void> => {
      const uri = vscode.debug.asDebugSourceUri(source, session);
      const deadline = Date.now() + 20_000;
      let lastError: unknown;
      while (Date.now() < deadline) {
        try {
          // The test host starts before VS Code's deferred debug content provider is ready.
          const document = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(document);
          assert.match(document.getText(), /snes\.65816\|snes\.cpu\|0x[\da-f]+/);
          return;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      throw new Error(
        `VS Code did not render virtual source ${source.sourceReference}: ${String(lastError)}`,
      );
    };
    const stack = (await session.customRequest("stackTrace", {
      threadId: threads.threads[0].id,
    })) as { stackFrames: { id: number; line: number; source?: LiveSource }[] };
    assert.ok(stack.stackFrames[0].source);
    const frame = stack.stackFrames[0];
    if (frame.source?.sourceReference) {
      const source = (await session.customRequest("source", {
        sourceReference: frame.source.sourceReference,
      })) as { content: string };
      assert.ok(source.content.length > 0);
      await waitForVirtualEditor(frame.source);
    }
    const scopes = (await session.customRequest("scopes", { frameId: frame.id })) as {
      scopes: { variablesReference: number }[];
    };
    const variables = (await session.customRequest("variables", {
      variablesReference: scopes.scopes[0].variablesReference,
    })) as { variables: unknown[] };
    assert.ok(variables.variables.length > 0);
    const trace = (await session.customRequest("uttori/traceCapabilities")) as {
      traces: unknown[];
    };
    assert.ok(trace.traces.length);
    assert.deepEqual(
      messages.filter((entry) => entry.type === "response" && entry.success === false),
      [],
      "Debugger startup must not emit failed responses.",
    );
    await session.customRequest("uttori/startTrace", {
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
    });
    for (let step = 0; step < 2; step++) {
      await session.customRequest("stepIn", { threadId: threads.threads[0].id });
      const stepped = (await session.customRequest("stackTrace", {
        threadId: threads.threads[0].id,
      })) as { stackFrames: { source?: LiveSource }[] };
      const source = stepped.stackFrames[0].source;
      if (source?.sourceReference) await waitForVirtualEditor(source);
    }
    const observed = (await session.customRequest("uttori/readTrace", { maxEvents: 240 })) as {
      addresses: number[];
      droppedEvents: number;
    };
    await session.customRequest("uttori/stopTrace");
    assert.ok(observed.addresses.length >= 2);
    assert.equal(observed.droppedEvents, 0);
    console.log(
      JSON.stringify({
        liveLaunchMs: Date.now() - started,
        stoppedFrame: stack.stackFrames[0],
        trace,
        observed,
      }),
    );
    const hold = Math.min(Number(process.env.UTTORI_VSCODE_LIVE_HOLD_MS ?? 0), 300_000);
    if (hold > 0) {
      await session.customRequest("continue", { threadId: threads.threads[0].id });
      console.log("Headed emulator running for interactive verification.");
      await new Promise((resolve) => setTimeout(resolve, hold));
      await session.customRequest("pause", { threadId: threads.threads[0].id });
    }
  } finally {
    await vscode.debug.stopDebugging(vscode.debug.activeDebugSession);
    tracker.dispose();
  }
}

/**
 * Waits until the language client has registered a document-symbol provider.
 * @param {vscode.Uri} uri Open assembly document URI.
 * @returns {Promise<void>} Promise resolved when the provider answers.
 */
async function waitForLanguageServer(uri: vscode.Uri): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
      "vscode.executeDocumentSymbolProvider",
      uri,
    );
    if (Array.isArray(symbols)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Uttori language server did not register within 20 seconds.");
}

async function verifyReplaySourceBreakpoint(
  folder: vscode.WorkspaceFolder,
  sourceUri: vscode.Uri,
  programUri: vscode.Uri,
  debugMapUri: vscode.Uri,
): Promise<void> {
  const messages: Array<{
    type?: string;
    command?: string;
    success?: boolean;
    body?: { breakpoints?: Array<{ verified?: boolean; line?: number }> };
  }> = [];
  const tracker = vscode.debug.registerDebugAdapterTrackerFactory("uttori-asm", {
    createDebugAdapterTracker: () => ({
      onDidSendMessage: (message: unknown) => messages.push(message as (typeof messages)[number]),
    }),
  });
  // VS Code positions are zero-based, so row 3 asks DAP for mapped source line 4.
  const breakpoint = new vscode.SourceBreakpoint(
    new vscode.Location(sourceUri, new vscode.Position(3, 0)),
  );
  vscode.debug.addBreakpoints([breakpoint]);
  try {
    assert.equal(
      await vscode.debug.startDebugging(folder, {
        type: "uttori-asm",
        request: "launch",
        name: "Smoke source breakpoint",
        backend: "replay",
        program: programUri.fsPath,
        debugMap: debugMapUri.fsPath,
        sourceRoot: folder.uri.fsPath,
      }),
      true,
    );
    const deadline = Date.now() + 10_000;
    while (
      !messages.some((message) => message.command === "setBreakpoints") &&
      Date.now() < deadline
    )
      await new Promise((resolve) => setTimeout(resolve, 25));
    const response = messages.find((message) => message.command === "setBreakpoints");
    assert.equal(response?.success, true, "VS Code source-breakpoint request failed.");
    assert.deepEqual(response?.body?.breakpoints, [
      {
        id: 1,
        verified: true,
        instructionReference: "snes.65816|snes.cpu|0x8000|0x0",
        line: 4,
      },
    ]);
  } finally {
    await vscode.debug.stopDebugging(vscode.debug.activeDebugSession);
    vscode.debug.removeBreakpoints([breakpoint]);
    tracker.dispose();
  }
}

/**
 * Executes the minimum end-to-end editor contract in an Extension Development Host.
 *
 * The test activates the packaged entry point, opens a language-associated document, observes an
 * LSP response, invokes read-only analysis-tree commands, and assembles through the registered VS
 * Code command. It does not start an emulator or claim native-runtime portability.
 * @returns {Promise<void>} Promise rejected when any editor, LSP, or build assertion fails.
 */
export async function run(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "Smoke test requires its temporary workspace.");
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `Extension '${EXTENSION_ID}' was not discovered.`);
  await extension.activate();
  assert.equal(extension.isActive, true, "Extension did not activate.");
  if (process.env.UTTORI_VSCODE_LIVE_WORKSPACE) return runLiveLaunch(folder);

  const commands = new Set(await vscode.commands.getCommands(true));
  for (const command of REQUIRED_COMMANDS) {
    assert.ok(commands.has(command), `Command '${command}' was not registered.`);
  }
  await vscode.commands.executeCommand("asm.capture.demo");
  assert.match(
    vscode.window.activeTextEditor?.document.getText() ?? "",
    /Idle capture demo — synthetic/,
  );
  assert.match(
    vscode.window.activeTextEditor?.document.getText() ?? "",
    /Second identical apply changed anything: false/,
  );
  await vscode.commands.executeCommand("asm.capture.guide");
  assert.match(
    vscode.window.activeTextEditor?.document.getText() ?? "",
    /Idle-subtracted behavior capture/,
  );

  const sourceUri = vscode.Uri.joinPath(folder.uri, "main.asm");
  const document = await vscode.workspace.openTextDocument(sourceUri);
  await vscode.window.showTextDocument(document);
  assert.equal(document.languageId, "uttori-snes", "Assembly language association is missing.");
  await waitForLanguageServer(sourceUri);

  await vscode.commands.executeCommand("asm.outline.refresh");
  await vscode.commands.executeCommand("asm.coverage.refresh");
  await vscode.commands.executeCommand("asm.analysisGraph.refresh");
  const worker = initializeAnalysisWorker(extension.extensionPath);
  try {
    const coverage = new AnalysisCoverageProvider();
    const roots = await coverage.getChildren();
    assert.equal(roots.length, 1);
    assert.equal(
      coverage.getTreeItem(roots[0]).collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    const groups = await coverage.getChildren(roots[0]);
    const segments = groups.find(({ label }) => label === "ROM map segments");
    assert.ok(segments);
    const pages = await coverage.getChildren(segments);
    assert.equal(pages.length, 3);
    assert.equal((await coverage.getChildren(pages[0])).length, 200);
    const graph = new AnalysisGraphProvider();
    const graphRoots = await graph.getChildren();
    const graphGroups = await graph.getChildren(graphRoots[0]);
    const functions = graphGroups.find(({ label }) => label === "Functions");
    assert.ok(functions);
    const functionPages = await graph.getChildren(functions);
    assert.equal(functionPages.length, 3);
    const functionsOnPage = await graph.getChildren(functionPages[0]);
    assert.equal(functionsOnPage.length, 200);
    assert.equal((await graph.getChildren(functionsOnPage[0])).length, 3);
  } finally {
    worker.dispose();
  }
  await vscode.commands.executeCommand("asm.build");

  const outputUri = vscode.Uri.joinPath(folder.uri, "main.sfc");
  const output = await vscode.workspace.fs.readFile(outputUri);
  assert.ok(output.length > 0, "VS Code build command produced no ROM bytes.");
  const debugMapUri = vscode.Uri.joinPath(folder.uri, "main.sfc.debug.json");
  const debugMap = JSON.parse(
    Buffer.from(await vscode.workspace.fs.readFile(debugMapUri)).toString("utf8"),
  ) as { output?: { size?: number; sha256?: string }; fingerprint?: { value?: string } };
  assert.equal(debugMap.output?.size, output.length, "Debug map does not identify the built ROM.");
  assert.match(debugMap.output?.sha256 ?? "", /^[\da-f]{64}$/);
  assert.match(debugMap.fingerprint?.value ?? "", /^[\da-f]{64}$/);
  await verifyReplaySourceBreakpoint(folder, sourceUri, outputUri, debugMapUri);
}
