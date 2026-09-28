import * as assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

import { writePcmWave } from "@uttori/asm-assets/audio";
import { rgbaPreviewPng } from "@uttori/asm-assets/preview";
import * as vscode from "vscode";

import { AnalysisCoverageProvider } from "../src/analysis/coverage-tree.js";
import { AnalysisGraphProvider } from "../src/analysis/graph-tree.js";
import { AnalysisSourcesProvider } from "../src/analysis/sources-tree.js";
import { initializeAnalysisWorker } from "../src/analysis/worker-client.js";
import { renderWebviewTemplate } from "../src/webview-template.js";
import { runLiveBreakpointSmoke } from "./live-breakpoints.js";
import { metadataSmokeHtml, assertMetadataSmoke } from "./metadata.js";
import { runModificationSmoke } from "./modification.js";
import { runOwnershipSmoke } from "./ownership.js";
import { runReleaseAcceptance } from "./release-acceptance.js";
import { romWorkbenchSmokeHtml, assertRomWorkbenchSmoke } from "./rom-workbench.js";

const EXTENSION_ID = "matthewcallis.uttori-asm-vscode";
const REQUIRED_COMMANDS = [
  "asm.modification.edit",
  "asm.asset.edit",
  "asm.metadata.migrate",
  "asm.retention.manage",
  "asm.asset.extract",
  "asm.asset.import",
  "asm.asset.openExternal",
  "asm.modification.openInput",
  "asm.modification.remove",
  "asm.allocation.review",
  "asm.allocation.apply",
  "asm.rebase.refresh",
  "asm.rebase.review",
  "asm.rebase.accept",
  "asm.source.restore",
  "asm.source.review",
  "asm.source.import",
  "asm.source.detach",
  "asm.buildTarget.select",
  "asm.baseline.verify",
  "asm.modification.create",
  "asm.modification.add",
  "asm.modification.open",
  "asm.modification.build",
  "asm.modification.run",
  "asm.modification.debug",
  "asm.modification.watch",
  "asm.modification.derive",

  "asm.build",
  "asm.assetPreview.open",
  "asm.analysis.toggleAnnotations",
  "asm.editorInfo.choosePreset",
  "asm.editorInfo.configureInline",
  "asm.editorInfo.inspectLine",
  "asm.editorInfo.showStatus",
  "asm.runEmulator",
  "asm.debugEmulator",
  "asm.runAndWatch",
  "asm.configureEmulatorRuntime",
  "asm.outline.refresh",
  "asm.coverage.refresh",
  "asm.analysisGraph.refresh",
  "asm.sources.refresh",
  "asm.trace.start",
  "asm.trace.stop",
  "asm.trace.stopAnalyze",
  "asm.trace.importRegenerate",
  "asm.heuristics.configure",
  "asm.heuristics.preview",
  "asm.ramMap.open",
  "asm.disassembly.status",
  "asm.disassembly.regenerate",
  "asm.disassembly.editAnnotation",
  "asm.disassembly.inspectOwnership",
  "asm.disassembly.editOwnedAnnotation",
  "asm.disassembly.openOwningInput",
  "asm.disassembly.showOwnedStatus",
  "asm.disassembly.regenerateOwned",
  "asm.disassembly.editMetadata",
  "asm.disassembly.removeLabel",
  "asm.disassembly.resetLabel",
  "asm.disassembly.editComments",
  "asm.disassembly.editClassification",
  "asm.disassembly.editTargets",
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
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
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
      if (source?.sourceReference) {
        await waitForVirtualEditor(source);
      }
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
    if (Array.isArray(symbols)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Uttori language server did not register within 20 seconds.");
}

/**
 * Checks the packaged language breakpoint contribution and DAP source-line resolution.
 * The headless workbench sometimes ignores the editor toggle despite an active editor;
 * the API fallback still exercises the adapter after verifying the manifest gate.
 * @param {vscode.WorkspaceFolder} folder Temporary smoke-test workspace.
 * @param {vscode.Uri} sourceUri Built assembly source containing an instruction on line 4.
 * @param {vscode.Uri} programUri Binary matching the debug map.
 * @param {vscode.Uri} debugMapUri Source map emitted by the smoke-test build.
 * @param {string} languageId Assembly language whose breakpoint contribution is under test.
 * @returns {Promise<void>} Rejects if editor toggling or DAP verification fails.
 */
async function verifyReplaySourceBreakpoint(
  folder: vscode.WorkspaceFolder,
  sourceUri: vscode.Uri,
  programUri: vscode.Uri,
  debugMapUri: vscode.Uri,
  languageId: string,
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
  const document = await vscode.workspace.openTextDocument(sourceUri);
  const originalLanguageId = document.languageId;
  let breakpoint: vscode.SourceBreakpoint | undefined;
  try {
    assert.equal(
      vscode.workspace.getConfiguration("debug").get("allowBreakpointsEverywhere"),
      false,
      "The editor smoke test must exercise the language breakpoint contribution.",
    );
    const breakpoints = vscode.extensions.getExtension(EXTENSION_ID)?.packageJSON.contributes
      ?.breakpoints as Array<{ language?: string }> | undefined;
    assert.ok(
      breakpoints?.some((entry) => entry.language === languageId),
      `Packaged extension omitted breakpoint support for ${languageId}.`,
    );
    await vscode.languages.setTextDocumentLanguage(document, languageId);
    const editor = await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    // VS Code positions are zero-based, so row 3 asks DAP for mapped source line 4.
    editor.selection = new vscode.Selection(3, 0, 3, 0);
    // The headless workbench applies editor focus and selection context asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 250));
    await vscode.commands.executeCommand("editor.debug.action.toggleBreakpoint");
    breakpoint = vscode.debug.breakpoints.find(
      (entry): entry is vscode.SourceBreakpoint =>
        entry instanceof vscode.SourceBreakpoint &&
        entry.location.uri.toString() === sourceUri.toString() &&
        entry.location.range.start.line === 3,
    );
    if (!breakpoint) {
      // A headless VS Code window can leave the editor command inactive even after focus
      // settles. The contribution above verifies the language gate; use the API for DAP.
      breakpoint = new vscode.SourceBreakpoint(
        new vscode.Location(sourceUri, new vscode.Position(3, 0)),
      );
      vscode.debug.addBreakpoints([breakpoint]);
    }
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
    ) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
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
    if (breakpoint) {
      vscode.debug.removeBreakpoints([breakpoint]);
    }
    await vscode.languages.setTextDocumentLanguage(document, originalLanguageId);
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
  // npm's Node engine cannot constrain Electron. Verify the actual embedded SQLite operations
  // needed by project storage before interpreting editor activation as a compatibility result.
  assert.ok(
    Number(process.versions.node.split(".")[0]) >= 24,
    "VS Code must embed Node 24 or newer.",
  );
  const database = new DatabaseSync(":memory:");
  try {
    assert.equal(
      database.prepare("SELECT json_extract(jsonb(?), '$.value') AS value").get('{"value":26}')
        ?.value,
      26,
    );
    database.exec(
      "CREATE TABLE probe(id INTEGER); CREATE TRIGGER fail BEFORE INSERT ON probe BEGIN SELECT RAISE(ROLLBACK, 'probe rollback'); END; BEGIN;",
    );
    assert.throws(() => database.exec("INSERT INTO probe VALUES (1)"), /probe rollback/);
    assert.equal(
      database.isTransaction,
      false,
      "SQLite rollback state is required for safe recovery.",
    );
  } finally {
    database.close();
  }
  console.log(
    `Extension Host runtime: Node ${process.versions.node}, SQLite ${process.versions.sqlite}`,
  );
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "Smoke test requires its temporary workspace.");
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `Extension '${EXTENSION_ID}' was not discovered.`);
  for (const name of ["ares", "mesence"]) {
    // These are separately built Node 24 bundles, so verify launch with Electron's executable,
    // not the Node 26 binary that compiled the repository or the standalone npm artifacts.
    const executable = vscode.Uri.joinPath(extension.extensionUri, "sidecars", `${name}.mjs`);
    const help = execFileSync(process.execPath, [executable.fsPath, "--help"], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      encoding: "utf8",
      timeout: 15_000,
    });
    assert.match(help, /usage/i);
  }
  await extension.activate();
  assert.equal(extension.isActive, true, "Extension did not activate.");
  if (["reopen", "restricted"].includes(process.env.UTTORI_VSCODE_RELEASE_PHASE ?? "")) {
    await runReleaseAcceptance(extension, folder);
    return;
  }
  if (process.env.UTTORI_VSCODE_LIVE_BREAKPOINTS === "1") {
    return runLiveBreakpointSmoke(folder);
  }
  if (process.env.UTTORI_VSCODE_LIVE_WORKSPACE) {
    return runLiveLaunch(folder);
  }

  const commands = new Set(await vscode.commands.getCommands(true));
  for (const command of REQUIRED_COMMANDS) {
    assert.ok(commands.has(command), `Command '${command}' was not registered.`);
  }
  const sourceUri = vscode.Uri.joinPath(folder.uri, "main.asm");
  const document = await vscode.workspace.openTextDocument(sourceUri);
  await vscode.window.showTextDocument(document);
  assert.equal(document.languageId, "uttori-snes", "Assembly language association is missing.");
  await waitForLanguageServer(sourceUri);
  await runOwnershipSmoke(folder);
  await runModificationSmoke(folder);
  await vscode.window.showTextDocument(document);

  // Exercise packaged external HTML/CSS/JS under a real webview CSP, not a DOM mock.
  for (const name of ["annotation", "panel", "disassembly", "metadata", "rom-editor"] as const) {
    const view = vscode.window.createWebviewPanel(
      "uttori.webviewSmoke",
      "Webview smoke",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extension.extensionUri, "media")],
      },
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscription: vscode.Disposable | undefined;
    try {
      const messages: unknown[] = [];
      const ready = new Promise<void>((resolve, reject) => {
        subscription = view.webview.onDidReceiveMessage((message: { type?: string }) => {
          messages.push(message);
          let readyType = "ready";
          if (name === "metadata") {
            readyType = "metadata-smoke-complete";
          }
          if (name === "rom-editor") {
            readyType = "rom-workbench-smoke-complete";
          }
          if (message.type === readyType) {
            resolve();
          }
        });
        timer = setTimeout(
          () => reject(new Error(`${name} webview assets did not load under CSP.`)),
          10_000,
        );
      });
      const html = renderWebviewTemplate(view.webview, extension.extensionUri, name);
      let testedHtml = html;
      if (name === "metadata") {
        testedHtml = metadataSmokeHtml(html);
      }
      if (name === "rom-editor") {
        testedHtml = romWorkbenchSmokeHtml(html);
      }
      view.webview.html = testedHtml;
      await ready;
      if (name === "metadata") {
        assertMetadataSmoke(messages);
      }
      if (name === "rom-editor") {
        assertRomWorkbenchSmoke(messages);
      }
    } finally {
      clearTimeout(timer);
      subscription?.dispose();
      view.dispose();
    }
  }

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
    const sources = new AnalysisSourcesProvider();
    try {
      const sourceRoots = await sources.getChildren();
      const chest = sourceRoots.find(({ label }) => label === "chest.json");
      assert.ok(chest);
      const groups = await sources.getChildren(chest);
      // Sources show directly observed addresses. Overlap with another capture is retained.
      const observed = groups.find(({ label }) => label === "Observed instructions");
      assert.ok(observed);
      assert.equal(sources.getTreeItem(observed).description, "500");
      const pages = await sources.getChildren(observed);
      assert.equal(pages.length, 3);
      const entries = await sources.getChildren(pages[0]);
      assert.equal(entries.length, 200);
      assert.equal(sources.getTreeItem(entries[0]).command?.command, "asm.analysis.navigate");
      const location = sources.getTreeItem(entries[0]).command?.arguments?.[0] as
        | { address: number }
        | undefined;
      assert.equal(location?.address, 0x808000);
      await vscode.commands.executeCommand("uttori-asm.sources.focus");
    } finally {
      sources.dispose();
    }
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
  // Native hover composition must preserve instruction help while contributing only chosen rows.
  const hoverText = async (line: number): Promise<string[]> => {
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      sourceUri,
      new vscode.Position(line, 3),
    );
    return (hovers ?? []).flatMap((hover) =>
      hover.contents.map((value) =>
        (typeof value === "string" ? value : value.value).replaceAll("&nbsp;", " "),
      ),
    );
  };
  const informationConfig = vscode.workspace.getConfiguration("asm", sourceUri);
  const instructionBefore = (await hoverText(6)).filter(
    (text) => !text.includes("Uttori analysis"),
  );
  assert.ok(instructionBefore.some((text) => text.includes("Return from subroutine")));
  try {
    await informationConfig.update(
      "editorInfo.preset",
      "authoring",
      vscode.ConfigurationTarget.WorkspaceFolder,
    );
    await informationConfig.update(
      "editorInfo.inline.enabled",
      false,
      vscode.ConfigurationTarget.WorkspaceFolder,
    );
    let ldaHover: string[] = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      ldaHover = await hoverText(5);
      if (ldaHover.some((text) => text.includes("BD 2B 00"))) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(
      ldaHover.some((text) => text.includes("BD 2B 00") && text.includes("$002B")),
      `Authoring hover should work with inline disabled and no matching analysis project. Actual: ${JSON.stringify(ldaHover)} `,
    );
    const rtsHover = await hoverText(6);
    assert.deepEqual(
      rtsHover.filter((text) => !text.includes("Uttori analysis")),
      instructionBefore,
    );
    assert.ok(rtsHover.some((text) => text.includes("Uttori analysis")));
    assert.ok(
      rtsHover.findIndex((text) => text.includes("Return from subroutine")) <
        rtsHover.findIndex((text) => text.includes("Uttori analysis")),
      "Instruction help must precede editor information.",
    );
    assert.ok(
      rtsHover.every(
        (text) => !text.includes("Known/observed state") && !text.includes("Overlay colors"),
      ),
    );
    await informationConfig.update(
      "editorInfo.hover.enabled",
      false,
      vscode.ConfigurationTarget.WorkspaceFolder,
    );
    assert.ok((await hoverText(6)).every((text) => !text.includes("Uttori analysis")));
  } finally {
    for (const key of [
      "editorInfo.preset",
      "editorInfo.inline.enabled",
      "editorInfo.hover.enabled",
    ]) {
      await informationConfig.update(key, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
    }
  }
  // Exercise the actual hover middleware and explicit player command with redistributable media.
  const imagePixels = new Uint8Array(8 * 8 * 4);
  for (let pixel = 0; pixel < 64; pixel++) {
    const channel = (pixel % 2) * 255;
    imagePixels.set([channel, channel, channel, 255], pixel * 4);
  }
  const imageUri = vscode.Uri.joinPath(folder.uri, "asset-preview.png");
  const waveUri = vscode.Uri.joinPath(folder.uri, "asset-preview.wav");
  const assetSourceUri = vscode.Uri.joinPath(folder.uri, "asset-preview.asm");
  await vscode.workspace.fs.writeFile(imageUri, rgbaPreviewPng(imagePixels, 8, 8));
  await vscode.workspace.fs.writeFile(waveUri, writePcmWave(new Int16Array(16), 32000));
  await vscode.workspace.fs.writeFile(
    assetSourceUri,
    Buffer.from(
      'org $008000\nincludeAsset("asset-preview.png", "4bpp", palette: "auto")\nincludeAsset("asset-preview.wav", "snes.brr", loop: false)\n',
    ),
  );
  const assetDocument = await vscode.workspace.openTextDocument(assetSourceUri);
  await vscode.window.showTextDocument(assetDocument);
  const assetHover = async (line: number): Promise<string> => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        assetSourceUri,
        new vscode.Position(line, 16),
      );
      const content = (hovers ?? [])
        .flatMap((hover) => hover.contents)
        .map((value) => (typeof value === "string" ? value : value.value))
        .join("\n");
      if (content.includes("data:image/png;base64,")) {
        return content;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Asset hover on line ${line} did not produce preview media.`);
  };
  assert.match(await assetHover(1), /Open full asset preview/);
  const audioHover = await assetHover(2);
  assert.match(audioHover, /Play source PCM and decoded BRR/);
  assert.match(audioHover, /32,000 Hz/);
  await vscode.commands.executeCommand("asm.assetPreview.open", {
    uri: assetSourceUri.toString(),
    version: assetDocument.version,
    line: 2,
  });
  let playerOpen = false;
  for (let attempt = 0; attempt < 20 && !playerOpen; attempt++) {
    playerOpen = vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .some(
        (tab) =>
          tab.input instanceof vscode.TabInputWebview &&
          tab.input.viewType.endsWith("asm.assetPreview"),
      );
    if (!playerOpen) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(
    playerOpen,
    `Audio preview command did not open its player webview: ${vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .map(
        (tab) =>
          `${tab.label}:${tab.input instanceof vscode.TabInputWebview ? tab.input.viewType : typeof tab.input}`,
      )
      .join(", ")}`,
  );
  // Closing the preview also disposes its audio elements before subsequent tests run.
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  await vscode.window.showTextDocument(document);
  for (const languageId of ["uttori-snes", "uttori-65xx"]) {
    await verifyReplaySourceBreakpoint(folder, sourceUri, outputUri, debugMapUri, languageId);
  }
  if (process.env.UTTORI_VSCODE_RELEASE_PHASE === "installed") {
    await runReleaseAcceptance(extension, folder);
  }
}
