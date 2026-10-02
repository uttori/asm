import assert from "node:assert/strict";
import fs from "node:fs";
import { Session } from "node:inspector/promises";
import path from "node:path";

import type { SourceResearchResult } from "@uttori/asm-cli/source";
import {
  sourceContentHash,
  sourceGit,
  readResearchInputs,
  parseSourceProject,
  type SourceMergePreview,
  type ProjectLabel,
} from "@uttori/asm-disassembler";
import type { PreparedSnesGeneration, SnesSourceBuild } from "@uttori/asm-plugin-snes";
import * as vscode from "vscode";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isProjectLabel = (value: unknown): value is ProjectLabel =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.addressSpace === "string" &&
  typeof value.address === "number" &&
  typeof value.name === "string" &&
  Array.isArray(value.evidence) &&
  (value.sourceName === undefined || typeof value.sourceName === "string");

/** Native undo can resolve before all document-change notifications reach the extension host. */
async function restored(document: vscode.TextDocument, expected: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (document.getText() !== expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(
    document.getText(),
    expected,
    `Native undo did not restore ${document.uri.toString()}`,
  );
}

/** Exercise real buffers, F2, native undo, tasks and background source commands in the seeded full clone. */
export async function runSourceWorkflowSmoke(folder: vscode.WorkspaceFolder): Promise<void> {
  const root = folder.uri.fsPath;
  if (process.env.UTTORI_VSCODE_TEST_VERSION) {
    assert.equal(
      vscode.version,
      process.env.UTTORI_VSCODE_TEST_VERSION,
      "The launched editor must match the requested release.",
    );
  }
  assert.ok(fs.existsSync(path.join(root, ".verification/seed.json")));
  assert.equal(
    vscode.workspace.textDocuments.some(
      (document) =>
        document.isDirty &&
        document.uri.scheme === "file" &&
        document.uri.fsPath.startsWith(root + path.sep),
    ),
    false,
    "The smoke test requires clean editor buffers.",
  );
  const initialTree = (await sourceGit(root, ["write-tree"])).stdout.toString();
  assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.length, 0);
  const checks: string[] = [];
  const timings: Record<string, number> = {};
  const report: {
    editor: string;
    node: string;
    started: string;
    checks: string[];
    timings: Record<string, number>;
    success: boolean;
    error?: string;
    phaseTimerDelayMs?: Record<string, { samples: number; maximum?: number; p95?: number }>;
    hostTimerDelayMs?: { samples: number; maximum?: number; p95?: number };
  } = {
    editor: vscode.version,
    node: process.versions.node,
    started: new Date().toISOString(),
    checks,
    timings,
    success: false,
  };
  const delays: number[] = [];
  const phaseDelays = new Map<string, number[]>();
  let activeCommand = "editor updates";
  let lastTick = performance.now();
  const heartbeat = setInterval(() => {
    const now = performance.now();
    const delay = Math.max(0, now - lastTick - 20);
    delays.push(delay);
    const samples = phaseDelays.get(activeCommand) ?? [];
    samples.push(delay);
    phaseDelays.set(activeCommand, samples);
    lastTick = now;
  }, 20);
  const snapshots = new Map<string, string>();
  let candidate: string | undefined;
  const profiler = process.env.UTTORI_VSCODE_PROFILE === "1" ? new Session() : undefined;
  if (profiler) {
    profiler.connect();
    await profiler.post("Profiler.enable");
    await profiler.post("Profiler.start");
  }

  /** Commands must return their public result; a reported UI error cannot masquerade as a passing assertion. */
  async function command<T>(name: string, ...args: unknown[]): Promise<T> {
    const started = performance.now();
    console.log(`Source workflow: ${name}`);
    activeCommand = name;
    try {
      return await vscode.commands.executeCommand<T>(name, ...args);
    } finally {
      timings[name] = performance.now() - started;
      activeCommand = "editor updates";
    }
  }

  try {
    await command("asm.source.select", folder.uri);
    const tasks = await vscode.tasks.fetchTasks({ type: "uttori-source" });
    assert.ok(tasks.some((task) => task.definition.project === root));
    checks.push("selected source project supplies a native build task");
    const sourceUri = vscode.Uri.joinPath(folder.uri, "disassembly/structs.asm");
    const document = await vscode.workspace.openTextDocument(sourceUri);
    await vscode.window.showTextDocument(document);
    assert.equal(document.languageId, "uttori-snes");
    const declarationLine = document
      .getText()
      .split("\n")
      .findIndex((line) => line.startsWith("struct ChestEffectHandlers "));
    assert.ok(declarationLine >= 0);
    let rename: vscode.WorkspaceEdit | undefined;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      rename = await command<vscode.WorkspaceEdit | undefined>(
        "vscode.executeDocumentRenameProvider",
        sourceUri,
        new vscode.Position(declarationLine, 10),
        "HostChestHandlers",
      );
      if (rename?.size) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(rename?.size, "Language server did not return the paired F2 edit.");
    for (const [uri] of rename.entries()) {
      const changed = await vscode.workspace.openTextDocument(uri);
      snapshots.set(uri.toString(), changed.getText());
    }
    assert.ok([...snapshots.keys()].some((uri) => uri.endsWith("struct-map.json")));
    assert.ok([...snapshots.keys()].some((uri) => uri.endsWith("layout.json")));
    assert.equal(await vscode.workspace.applyEdit(rename), true);
    const bank = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(folder.uri, "disassembly/banks/bank-008.asm"),
    );
    assert.match(bank.getText(), /JSR \(\(HostChestHandlers & \$FFFF\),x\)/);
    assert.equal(bank.isDirty, true);
    assert.equal(document.isDirty, true);
    await vscode.window.showTextDocument(document);
    await command("undo");
    for (const [uri, before] of snapshots) {
      const changedDocument = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
      await restored(changedDocument, before);
    }
    checks.push(
      "F2 changes source, indirect references, layout and research recipe; native undo restores all buffers",
    );
    const config = parseSourceProject(
      JSON.parse(fs.readFileSync(path.join(root, ".uttori/project.json"), "utf8")),
    );
    const research = readResearchInputs(root, config.researchRoots, {
      project: config.id,
      romSha256: config.romSha256,
    });
    const names = research.files.find((file) =>
      file.document.decisions.some(
        (item) =>
          item.collection === "labels" &&
          isProjectLabel(item.value) &&
          item.value.sourceName === "LocalRandomByte",
      ),
    );
    assert.ok(names);
    const labelDecision = names.document.decisions.find(
      (item) =>
        item.collection === "labels" &&
        isProjectLabel(item.value) &&
        item.value.sourceName === "LocalRandomByte",
    );
    if (!labelDecision || !isProjectLabel(labelDecision.value)) {
      assert.fail("LocalRandomByte label was not found.");
    }
    const symbol = labelDecision.value;
    const nameUri = vscode.Uri.file(path.join(root, names.path));
    const nameDocument = await vscode.workspace.openTextDocument(nameUri);
    snapshots.set(nameUri.toString(), nameDocument.getText());
    const aliased = await command<SourceResearchResult>("asm.source.editResearch", {
      symbolId: symbol.id,
      change: { kind: "aliases", aliases: ["HostRandomAlias"] },
    });
    assert.equal(aliased.kind, "edit");
    assert.match(nameDocument.getText(), /HostRandomAlias/);
    const aliasedText = nameDocument.getText();
    const suppressed = await command<SourceResearchResult>("asm.source.editResearch", {
      symbolId: symbol.id,
      change: { kind: "suppression", suppressed: true },
    });
    assert.equal(suppressed.kind, "edit");
    const savedResearch: unknown = JSON.parse(nameDocument.getText());
    if (!isRecord(savedResearch) || !Array.isArray(savedResearch.decisions)) {
      assert.fail("Research decisions must be an array.");
    }
    const decision = savedResearch.decisions.find(
      (item) => isRecord(item) && item.id === symbol.id,
    );
    if (!isRecord(decision) || !isRecord(decision.value)) {
      assert.fail(`Research decision ${symbol.id} is missing its label.`);
    }
    const changedSymbol = decision.value;
    assert.deepEqual(changedSymbol.aliases, ["HostRandomAlias"]);
    assert.equal(changedSymbol.suppressed, true);
    assert.equal(changedSymbol.analysisEntryPoint, symbol.analysisEntryPoint);
    await command("undo");
    await restored(nameDocument, aliasedText);
    assert.match(nameDocument.getText(), /HostRandomAlias/);
    await command("undo");
    await restored(nameDocument, snapshots.get(nameUri.toString())!);
    checks.push(
      "research aliases and suppression preserve identity/evidence, compose over unsaved files, and undo normally",
    );
    const analysisRecord = {
      id: "manual.host.cpu-state",
      addressSpace: "snes.cpu",
      start: 0xc8e2b5,
      end: 0xc8e2c0,
      architecture: "snes.65816",
      classification: "opcode" as const,
      state: { e: false, m: true, x: false },
      evidence: [],
    };
    const analysisHistory: string[] = [];
    for (const carry of [false, true]) {
      analysisHistory.push(nameDocument.getText());
      const result: SourceResearchResult = await command<SourceResearchResult>(
        "asm.source.editAnalysis",
        {
          kind: "put",
          collection: "annotations",
          path: names.path,
          expectedDocumentSha256: sourceContentHash(nameDocument.getText()),
          value: { ...analysisRecord, state: { ...analysisRecord.state, carry } },
          reason: `Native editor assumption check with carry ${carry}.`,
        },
      );
      assert.equal(result.kind, "edit");
    }
    analysisHistory.push(nameDocument.getText());
    const targets = await command<SourceResearchResult>("asm.source.editAnalysis", {
      kind: "put",
      collection: "analysis",
      path: names.path,
      expectedDocumentSha256: sourceContentHash(nameDocument.getText()),
      value: {
        id: "manual.host.targets",
        kind: "target-override",
        addressSpace: "snes.cpu",
        address: 0xc8e24d,
        targets: [0xc8e2b5],
        evidence: [],
      },
      reason: "Native editor indirect-target declaration check.",
    });
    assert.equal(targets.kind, "edit");
    assert.equal(nameDocument.isDirty, true);
    const decisions = JSON.parse(nameDocument.getText()).decisions;
    const assumption = decisions.find(
      (item: { id: string }) => item.id === analysisRecord.id,
    ).value;
    assert.equal(assumption.state.carry, true);
    assert.equal(assumption.evidence.length, 2);
    assert.deepEqual(
      decisions.find((item: { id: string }) => item.id === "manual.host.targets").value.targets,
      [0xc8e2b5],
    );
    for (let index = 0; index < 3; index++) {
      await command("undo");
      await restored(nameDocument, analysisHistory.pop()!);
    }
    assert.equal(nameDocument.getText(), snapshots.get(nameUri.toString()));
    assert.equal(nameDocument.isDirty, false);
    checks.push(
      "classifications, CPU assumptions and indirect targets compose as unsaved Git research; native undo restores every declaration and evidence record",
    );
    const recipeRenameCases = [
      {
        file: "ram-defines.asm",
        line: "RAM_PARTY_STAT_INDEX_WORK =",
        token: "RAM_PARTY_STAT_INDEX_WORK",
        name: "HostPartyStatIndex",
        recipe: "ram-map.json",
      },
      {
        file: "structs.asm",
        line: "LZ_COPY_TOKEN_FLAG =",
        token: "LZ_COPY_TOKEN_FLAG",
        name: "HOST_LZ_COPY_FLAG",
        recipe: "struct-map.json",
      },
      {
        file: "structs.asm",
        line: "struct BankPointer ",
        token: "BankPointer",
        name: "HostBankPointer",
        recipe: "struct-map.json",
      },
      {
        file: "structs.asm",
        line: "struct BankPointer ",
        token: "offset",
        name: "hostOffset",
        recipe: "struct-map.json",
        field: true,
      },
    ];
    for (const item of recipeRenameCases) {
      const uri = vscode.Uri.joinPath(folder.uri, `disassembly/${item.file}`);
      const sourceDocument = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(sourceDocument);
      const lines = sourceDocument.getText().split("\n");
      let line = lines.findIndex((text) => text.startsWith(item.line));
      assert.ok(line >= 0);
      if (item.field) {
        const memberLine = lines.findIndex(
          (text, index) => index > line && text.trimStart().startsWith(`.${item.token}:`),
        );
        assert.ok(memberLine > line);
        line = memberLine;
      }
      const column = lines[line].indexOf(item.token);
      assert.ok(column >= 0);
      const renamed = await command<vscode.WorkspaceEdit>(
        "vscode.executeDocumentRenameProvider",
        uri,
        new vscode.Position(line, column + 1),
        item.name,
      );
      assert.ok(renamed.size);
      const before = new Map<string, string>();
      for (const [changedUri, edits] of renamed.entries()) {
        const changedDocument = await vscode.workspace.openTextDocument(changedUri);
        if (changedUri.path.endsWith(".asm")) {
          for (const edit of edits) {
            assert.equal(
              changedDocument.getText(edit.range),
              item.token,
              `F2 selected the wrong physical token in ${changedUri.path}`,
            );
          }
        }
        before.set(changedUri.toString(), changedDocument.getText());
        if (!snapshots.has(changedUri.toString())) {
          snapshots.set(changedUri.toString(), changedDocument.getText());
        }
      }
      assert.ok([...before.keys()].some((key) => key.endsWith(`/${item.recipe}`)));
      assert.equal(await vscode.workspace.applyEdit(renamed), true);
      const recipeDocument = await vscode.workspace.openTextDocument(
        vscode.Uri.joinPath(folder.uri, `disassembly/${item.recipe}`),
      );
      assert.ok(recipeDocument.getText().includes(`"${item.name}"`));
      await vscode.window.showTextDocument(sourceDocument);
      await command("undo");
      for (const [changedUri, text] of before) {
        await restored(await vscode.workspace.openTextDocument(vscode.Uri.parse(changedUri)), text);
      }
    }
    checks.push(
      "native F2 pairs RAM, constants, reusable struct types and shared fields with their Git recipes; multi-file Undo restores them",
    );
    // Reports and emulator saves are not source inputs; background activity must not invalidate an
    // otherwise exact build while the worker independently checks all consumed authoring bytes.
    const reportNoise = path.join(root, ".verification/editor-background-write.txt");
    const cacheNoise = path.join(root, "disassembly/.uttori-asm/cache/editor-background-write.txt");
    fs.mkdirSync(path.dirname(cacheNoise), { recursive: true });
    const finderNoise = path.join(root, "disassembly/.DS_Store");
    const finderStat = fs.existsSync(finderNoise) ? fs.statSync(finderNoise) : undefined;
    const reportTimer = setInterval(() => {
      fs.writeFileSync(reportNoise, String(Date.now()));
      fs.writeFileSync(cacheNoise, String(Date.now()));
      // Finder updates must not invalidate an otherwise unchanged source build.
      if (finderStat) {
        fs.utimesSync(finderNoise, new Date(), new Date());
      }
    }, 100);
    let built: SnesSourceBuild;
    try {
      built = await command<SnesSourceBuild>("asm.source.build");
    } finally {
      clearInterval(reportTimer);
      if (finderStat) {
        fs.utimesSync(finderNoise, finderStat.atime, finderStat.mtime);
      }
      fs.rmSync(cacheNoise, { force: true });
      fs.rmSync(reportNoise, { force: true });
    }
    assert.ok(built.outputFile);
    assert.equal(
      sourceContentHash(fs.readFileSync(built.outputFile)),
      "6abc48cc519de82d50edc730ba9ad32bdadc1e26e62f7420c3b75ea7eb033622",
    );
    checks.push("background build produces the independently verified modified ROM");
    // Exercise normal F5 configuration resolution, including replacement of obsolete output paths.
    // A bounded replay tests F5 routing without synthesizing a full-game execution timeline.
    const replayFile = path.join(root, ".verification/f5-replay.json");
    fs.writeFileSync(
      replayFile,
      JSON.stringify({
        snapshots: [
          {
            threads: [{ id: 1, name: "CPU", architecture: "snes.65816" }],
            frames: [
              {
                id: 1,
                threadId: 1,
                name: "Entry",
                pc: { architecture: "snes.65816", addressSpace: "snes.cpu", address: 0xc00000 },
              },
            ],
            registers: { 1: [] },
            memory: [],
          },
        ],
      }),
    );
    let f5Session: vscode.DebugSession | undefined;
    const startedF5 = vscode.debug.onDidStartDebugSession((session) => {
      if (session.name === "Git source F5 verification") {
        f5Session = session;
      }
    });
    try {
      assert.equal(
        await vscode.debug.startDebugging(folder, {
          type: "uttori-asm",
          request: "launch",
          name: "Git source F5 verification",
          sourceProject: true,
          backend: "replay",
          replay: replayFile,
          program: "/obsolete-output.sfc",
          debugMap: "/obsolete-map.json",
        }),
        true,
      );
      assert.ok(f5Session);
      assert.equal(
        sourceContentHash(fs.readFileSync(f5Session.configuration.program)),
        built.verification.outputSha256,
      );
      assert.equal(f5Session.configuration.outputSha256, built.verification.outputSha256);
      assert.ok(f5Session.configuration.debugMap.startsWith(path.join(root, ".uttori-local")));
      checks.push("F5 builds the selected Git project and launches its matching verified ROM/map");
    } finally {
      startedF5.dispose();
      fs.rmSync(replayFile, { force: true });
      if (f5Session) {
        await vscode.debug.stopDebugging(f5Session);
      }
    }

    const layoutDocument = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(folder.uri, ".uttori/layout.json"),
    );
    const beforeLayout = layoutDocument.getText();
    const invalidLayout: unknown = JSON.parse(beforeLayout);
    if (!isRecord(invalidLayout) || !Array.isArray(invalidLayout.extents)) {
      assert.fail("Layout extents must be an array.");
    }
    const extent: unknown = invalidLayout.extents[0];
    if (!isRecord(extent) || typeof extent.size !== "number") {
      assert.fail("Layout extent is missing a numeric size.");
    }
    extent.size++;
    try {
      const invalid = new vscode.WorkspaceEdit();
      invalid.replace(
        layoutDocument.uri,
        new vscode.Range(
          layoutDocument.positionAt(0),
          layoutDocument.positionAt(beforeLayout.length),
        ),
        JSON.stringify(invalidLayout, null, 2) + "\n",
      );
      assert.equal(await vscode.workspace.applyEdit(invalid), true);
      assert.equal(await layoutDocument.save(), true);
      assert.equal(await command("asm.source.build"), undefined);
      const issue = vscode.languages
        .getDiagnostics()
        .flatMap(([uri, diagnostics]) => diagnostics.map((diagnostic) => ({ uri, diagnostic })))
        .find(
          ({ diagnostic }) =>
            diagnostic.source === "Uttori source" && diagnostic.code === "fixed-extent",
        );
      assert.ok(issue, "Failed layout validation must appear as a source-linked Problem.");
      await vscode.workspace.openTextDocument(issue.uri);
      const actions = await command<vscode.CodeAction[]>(
        "vscode.executeCodeActionProvider",
        issue.uri,
        issue.diagnostic.range,
        vscode.CodeActionKind.QuickFix.value,
      );
      assert.ok(
        actions.some((action) => action.command?.command === "asm.source.relocate"),
        `Missing relocation action: ${JSON.stringify(actions)}`,
      );
      const openLayout = actions.find(
        (action) => action.title === "Open layout and reference contracts",
      )?.command;
      assert.ok(openLayout, `Missing layout action: ${JSON.stringify(actions)}`);
      // VS Code translates built-in open commands when returning provider results.
      // Execute the returned command and verify its visible target instead of its wire spelling.
      await command(openLayout.command, ...(openLayout.arguments ?? []));
      assert.equal(vscode.window.activeTextEditor?.document.uri.fsPath, layoutDocument.uri.fsPath);
    } finally {
      // This deliberate failure saves only the owned clone's contract. Restore it
      // even when a Problems assertion fails; no test edit enters Git history.
      const restore = new vscode.WorkspaceEdit();
      restore.replace(
        layoutDocument.uri,
        new vscode.Range(
          layoutDocument.positionAt(0),
          layoutDocument.positionAt(layoutDocument.getText().length),
        ),
        beforeLayout,
      );
      assert.equal(await vscode.workspace.applyEdit(restore), true);
      assert.equal(await layoutDocument.save(), true);
    }
    assert.ok((await command<SnesSourceBuild>("asm.source.build")).outputFile);
    assert.equal(
      vscode.languages
        .getDiagnostics()
        .some(([, items]) => items.some((item) => item.source === "Uttori source")),
      false,
    );
    checks.push(
      "invalid fixed extent creates a source-linked Problem with relocation/layout quick fixes; restoring the contract clears it on build",
    );
    const prepared = await command<PreparedSnesGeneration>("asm.source.prepare");
    assert.ok(prepared.generation.commit);
    candidate = prepared.generation.commit;
    const comment = new vscode.WorkspaceEdit();
    comment.insert(bank.uri, new vscode.Position(0, 0), "; Unsaved native preview verification.\n");
    assert.equal(await vscode.workspace.applyEdit(comment), true);
    await vscode.window.showTextDocument(bank);
    const preview = await command<SourceMergePreview>("asm.source.preview");
    assert.ok(preview.sourceTree);
    assert.equal(bank.isDirty, true);
    assert.match(bank.getText(), /^; Unsaved native preview verification\./);
    assert.equal((await sourceGit(root, ["write-tree"])).stdout.toString(), initialTree);
    assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.length, 0);
    await command("undo");
    assert.equal(bank.isDirty, false);
    await command("asm.source.discard");
    candidate = undefined;
    checks.push(
      "unsaved preview preserves editor text, Git index and working tree; candidate discard changes no source",
    );
    report.success = true;
  } catch (error) {
    report.error = String(error);
    throw error;
  } finally {
    clearInterval(heartbeat);
    if (profiler) {
      const { profile } = await profiler.post("Profiler.stop");
      profiler.disconnect();
      fs.writeFileSync(
        path.join(root, `.verification/editor-${vscode.version}.cpuprofile`),
        JSON.stringify(profile),
      );
    }
    // Restore only buffers touched by this test. No save occurs, and pre-existing dirty buffers were
    // excluded by the clean-checkout precondition. Preserve any failure report before host shutdown.
    for (const [uri, before] of snapshots) {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
      if (document.getText() !== before) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          document.uri,
          new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
          before,
        );
        await vscode.workspace.applyEdit(edit);
      }
    }
    if (candidate) {
      await vscode.commands.executeCommand("asm.source.discard");
    }
    delays.sort((a, b) => a - b);
    report.phaseTimerDelayMs = Object.fromEntries(
      [...phaseDelays].map(([phase, samples]) => {
        samples.sort((a, b) => a - b);
        return [
          phase,
          {
            samples: samples.length,
            maximum: samples.at(-1),
            p95: samples[Math.floor(samples.length * 0.95)],
          },
        ];
      }),
    );
    report.hostTimerDelayMs = {
      samples: delays.length,
      maximum: delays.at(-1),
      p95: delays[Math.floor(delays.length * 0.95)],
    };
    fs.writeFileSync(
      path.join(root, `.verification/editor-${vscode.version}.json`),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  }
}
