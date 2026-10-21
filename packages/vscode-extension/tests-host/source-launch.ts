import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { pngImporter, type IndexedImage } from "@uttori/asm-assets/image";
import { sourceContentHash, sourceGit } from "@uttori/asm-disassembler/source-project";
import * as vscode from "vscode";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isIndexedImage = (value: unknown): value is IndexedImage =>
  isRecord(value) &&
  value.kind === "indexed-image" &&
  typeof value.width === "number" &&
  typeof value.height === "number" &&
  value.indexes instanceof Uint8Array &&
  Array.isArray(value.palette);

import { paletteView, paletteWordEdit } from "../src/assets/palette-model.js";
import { readPngGuidance } from "../src/assets/png-guidance.js";

const builds = () =>
  vscode.commands.executeCommand<{ outputSha256: string }[]>("uttori.tests.builds");

/** Bound every asynchronous editor/backend transition and include the failing phase in diagnostics. */
async function until(
  test: () => boolean | Promise<boolean>,
  phase: string,
  timeout = 60_000,
): Promise<void> {
  const end = Date.now() + timeout;
  while (!(await test())) {
    assert.ok(Date.now() < end, `Timed out: ${phase}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Exercise the production task and Build/Run/Debug/Watch wiring with clone-local native ares state. */
export async function runSourceLaunchSmoke(folder: vscode.WorkspaceFolder): Promise<void> {
  const root = folder.uri.fsPath;
  assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.length, 0);
  const application = path.resolve(root, "../..");
  const pinned = path.join(application, "fixtures/external/ares/runtime");
  const runtime = await fs.mkdtemp(path.join(root, ".verification/editor-runtime-"));
  for (const resource of ["ares.app", "LICENSES", "patches"]) {
    await fs.symlink(path.join(pinned, resource), path.join(runtime, resource));
  }
  await fs.mkdir(path.join(runtime, "systems"));
  await fs.mkdir(path.join(runtime, "saves"));
  await fs.writeFile(
    path.join(runtime, "settings.bml"),
    [
      "Video",
      "  Driver: None",
      "  Blocking: false",
      "Audio",
      "  Mute: true",
      "  Blocking: false",
      "Paths",
      `  Home: ${runtime}/systems/`,
      `  Saves: ${runtime}/saves/`,
      "",
    ].join("\n"),
  );
  const png = vscode.Uri.joinPath(folder.uri, "disassembly/assets/images/enemy/rabite-frames.png");
  const palette = vscode.Uri.joinPath(folder.uri, "disassembly/assets/palettes/rom-palettes.json");
  const savedPng = await fs.readFile(png.fsPath);
  const savedPalette = await fs.readFile(palette.fsPath, "utf8");
  const index = (await sourceGit(root, ["write-tree"])).stdout;
  const otherRoot = path.join(runtime, "other-source-project");
  let otherWorktree = false;
  const checks: string[] = [];
  const report: {
    editor: string;
    runtime: string;
    checks: string[];
    success: boolean;
    builds?: { outputSha256: string }[];
    sessions?: {
      id: string;
      noDebug: vscode.DebugSession["configuration"]["noDebug"];
      outputSha256: vscode.DebugSession["configuration"]["outputSha256"];
    }[];
    error?: string;
    events?: [
      string,
      { event?: string; command?: string; success?: boolean; message?: string }[],
    ][];
  } = { editor: vscode.version, runtime, checks, success: false };
  const sessions: vscode.DebugSession[] = [];
  const events = new Map<
    string,
    { event?: string; command?: string; success?: boolean; message?: string }[]
  >();
  const tracker = vscode.debug.registerDebugAdapterTrackerFactory("uttori-asm", {
    createDebugAdapterTracker: (session) => {
      const messages: { event?: string; command?: string; success?: boolean; message?: string }[] =
        [];
      events.set(session.id, messages);
      return { onDidSendMessage: (message) => messages.push(message) };
    },
  });
  const started = vscode.debug.onDidStartDebugSession((session) => {
    if (session.type === "uttori-asm") {
      sessions.push(session);
    }
  });
  const ended = new Set<string>();
  const terminated = vscode.debug.onDidTerminateDebugSession((session) => ended.add(session.id));

  let watch = false;
  /** Stop only a session launched by this test, and wait for the adapter's complete disconnect. */
  async function stop(session: vscode.DebugSession): Promise<void> {
    if (!ended.has(session.id)) {
      await vscode.debug.stopDebugging(session);
      await until(() => ended.has(session.id), "native session termination");
    }
  }
  /** Native commands must launch the exact newly built ROM/map pair through the selected project. */
  async function launch(command: string, noDebug: boolean): Promise<vscode.DebugSession> {
    console.log(`Source launch: ${command}`);
    const count = sessions.length;
    await vscode.commands.executeCommand(command);
    await until(() => sessions.length > count, `${command} session`);
    const session = sessions.at(-1)!;
    assert.equal(Boolean(session.configuration.noDebug), noDebug);
    assert.ok(session.configuration.program.startsWith(path.join(root, ".uttori-local")));
    assert.equal(
      sourceContentHash(await fs.readFile(session.configuration.program)),
      session.configuration.outputSha256,
    );
    await until(
      () =>
        (events.get(session.id) ?? []).some(
          (message) => message.event === (noDebug ? "continued" : "stopped"),
        ),
      `${command} native execution`,
    );
    assert.equal(
      (events.get(session.id) ?? []).some(
        (message) => message.command === "launch" && message.success === false,
      ),
      false,
    );
    return session;
  }
  try {
    await vscode.commands.executeCommand("uttori.tests.runtime", folder.uri.toString(), {
      backend: "ares",
      runtimeManifest: path.join(pinned, "ares-runtime-manifest.json"),
      emulator: path.join(runtime, "ares.app/Contents/MacOS/ares"),
      runtimeDirectory: runtime,
      aresSystem: "Super Famicom",
      fastBoot: true,
    });
    await vscode.commands.executeCommand("asm.source.select", folder.uri);
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    const task = (await vscode.tasks.fetchTasks({ type: "uttori-source" })).find(
      (item) => item.definition.project === root,
    );
    assert.ok(task);
    let taskExit: number | undefined;
    const taskListener = vscode.tasks.onDidEndTaskProcess((event) => {
      if (event.execution.task.definition.project === root) {
        taskExit = event.exitCode;
      }
    });
    try {
      await vscode.tasks.executeTask(task);
      await until(() => taskExit !== undefined, "native build task");
      assert.equal(taskExit, 0);
    } finally {
      taskListener.dispose();
    }
    const built = await vscode.commands.executeCommand<{ ok: boolean; outputSha256: string }>(
      "asm.build",
    );
    assert.equal(built.ok, true);
    assert.equal(
      built.outputSha256,
      "6abc48cc519de82d50edc730ba9ad32bdadc1e26e62f7420c3b75ea7eb033622",
    );
    checks.push("native task and Build command use selected source with no open editor");
    const debug = await launch("asm.debugEmulator", false);
    const threads: unknown = await debug.customRequest("threads");
    if (!isRecord(threads) || !Array.isArray(threads.threads)) {
      assert.fail("threads response must list threads.");
    }
    const thread: unknown = threads.threads[0];
    if (!isRecord(thread) || typeof thread.id !== "number") {
      assert.fail("threads response is missing a numeric thread id.");
    }
    const stack: unknown = await debug.customRequest("stackTrace", {
      threadId: thread.id,
      startFrame: 0,
      levels: 1,
    });
    if (!isRecord(stack) || !Array.isArray(stack.stackFrames)) {
      assert.fail("stackTrace response must list frames.");
    }
    const frame: unknown = stack.stackFrames[0];
    if (!isRecord(frame) || typeof frame.instructionPointerReference !== "string") {
      assert.fail("stack frame is missing an instruction pointer.");
    }
    assert.ok(frame.instructionPointerReference);
    const previousStops = (events.get(debug.id) ?? []).filter(
      (event) => event.event === "stopped",
    ).length;
    await debug.customRequest("stepIn", {
      threadId: thread.id,
      granularity: "instruction",
    });
    await until(
      () =>
        (events.get(debug.id) ?? []).filter((event) => event.event === "stopped").length >
        previousStops,
      "native debugger instruction step",
    );
    await stop(debug);
    checks.push("Debug launches the exact ROM/map pair and steps the native CPU");
    const running = await launch("asm.runEmulator", true);
    await stop(running);
    checks.push("Run executes the selected build without debugger mode");
    // Watch must also work without any active text editor or configured asm.entryPoints.
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    watch = true;
    await launch("asm.runAndWatch", false);
    const initialSessions = sessions.length;
    const initialBuilds = (await builds()).length;
    await fs.writeFile(palette.fsPath, savedPalette);
    await until(
      async () => (await builds()).length > initialBuilds,
      "unchanged external asset save",
    );
    await new Promise((resolve) => setTimeout(resolve, 750));
    assert.equal(sessions.length, initialSessions, "Identical ROM/map must not restart the game.");
    const first = paletteView(savedPalette)[0];
    const word = (parseInt(first.words[0], 16) ^ 1).toString(16).padStart(4, "0").toUpperCase();
    const edit = paletteWordEdit(savedPalette, first.id, first.firstIndex, word);
    const document = await vscode.workspace.openTextDocument(palette);
    const patch = new vscode.WorkspaceEdit();
    patch.replace(
      palette,
      new vscode.Range(
        document.positionAt(edit.offset),
        document.positionAt(edit.offset + edit.length),
      ),
      edit.text,
    );
    assert.equal(await vscode.workspace.applyEdit(patch), true);
    assert.equal(await document.save(), true);
    await until(() => sessions.length > initialSessions, "palette save rebuild and launch");
    assert.notEqual(sessions.at(-1)!.configuration.outputSha256, built.outputSha256);
    checks.push("Watch rebuilds palette JSON saves and skips identical output reloads");
    const paletteSessions = sessions.length;
    const imported = pngImporter.import({ bytes: savedPng, mediaType: "image/png" });
    if (!isIndexedImage(imported.value)) {
      assert.fail("PNG import did not produce an indexed image.");
    }
    const original = imported.value;
    const region = (await readPngGuidance(png.fsPath, original))!.regions[0];
    const pixel = region.y * original.width + region.x;
    const firstSlot = region.paletteStart + 1;
    const paletteHash = sessions.at(-1)!.configuration.outputSha256;
    await vscode.commands.executeCommand("vscode.openWith", png, "uttori.indexedPng", {
      preview: false,
    });
    await until(
      async () => !!(await vscode.commands.executeCommand("uttori.tests.png", png.fsPath)),
      "production PNG editor",
    );
    const draft = await vscode.commands.executeCommand<{ dirty: boolean }>(
      "uttori.tests.png",
      png.fsPath,
      original.indexes[pixel] === firstSlot ? firstSlot + 1 : firstSlot,
    );
    assert.equal(draft.dirty, true);
    await vscode.commands.executeCommand("workbench.action.files.save");
    await until(() => sessions.length > paletteSessions, "native PNG save rebuild and launch");
    assert.notEqual(
      sessions.at(-1)!.configuration.outputSha256,
      paletteHash,
      "An encoded source pixel must change the ROM, not just its build-map identity.",
    );
    checks.push("Watch rebuilds saved binary custom-editor assets");
    // Select a genuine second checkout while Watch is active. A subsequent save in the old project
    // must neither build the new selection nor relaunch the old game through a queued event.
    await sourceGit(root, ["worktree", "add", "--detach", otherRoot, "HEAD"]);
    otherWorktree = true;
    await fs.mkdir(path.join(otherRoot, ".uttori-local"));
    await fs.writeFile(
      path.join(otherRoot, ".uttori-local/project.json"),
      JSON.stringify({
        format: "uttori-source-local",
        version: 1,
        rom: path.join(root, "Secret of Mana (USA).sfc"),
        evidence: path.join(root, "disassembly/analysis"),
      }),
    );
    const beforeSwitchBuilds = (await builds()).length;
    const beforeSwitchSessions = sessions.length;
    await vscode.commands.executeCommand("asm.source.select", vscode.Uri.file(otherRoot));
    watch = false;
    await fs.writeFile(palette.fsPath, savedPalette);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    assert.equal((await builds()).length, beforeSwitchBuilds);
    assert.equal(sessions.length, beforeSwitchSessions);
    checks.push(
      "Selecting another Git project cancels Watch; old-project saves neither build nor relaunch",
    );
    await vscode.commands.executeCommand("asm.source.select", folder.uri);
    report.success = true;
    report.builds = await builds();
    report.sessions = sessions.map((session) => ({
      id: session.id,
      noDebug: session.configuration.noDebug,
      outputSha256: session.configuration.outputSha256,
    }));
  } catch (error) {
    report.error = error instanceof Error ? error.stack : String(error);
    report.events = [...events];
    throw error;
  } finally {
    await fs.writeFile(
      path.join(root, `.verification/source-launch-${vscode.version}.json`),
      JSON.stringify(report, null, 2) + "\n",
    );
    if (watch) {
      await vscode.commands.executeCommand("asm.toggleWatch");
    }
    for (const session of sessions) {
      await stop(session);
    }
    // Native saves completed before restoring the test's exact original file bytes.
    await fs.writeFile(palette.fsPath, savedPalette);
    await fs.writeFile(png.fsPath, savedPng);
    if (otherWorktree) {
      await sourceGit(root, ["worktree", "remove", "--force", otherRoot]);
    }
    tracker.dispose();
    started.dispose();
    terminated.dispose();
    assert.deepEqual((await sourceGit(root, ["write-tree"])).stdout, index);
    assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.length, 0);
  }
  console.log("Source launch: task, Build, native Run/Debug and asset Watch passed.");
}
