import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { sourceGit, sourceContentHash } from "@uttori/asm-disassembler";
import type { SnesSourceBuild } from "@uttori/asm-plugin-snes";
import * as vscode from "vscode";

/** Minimal stable built-in Git extension API used only by the native acceptance fixture. */
interface GitRepository {
  readonly rootUri: vscode.Uri;
  readonly state: { readonly mergeChanges: readonly { readonly uri: vscode.Uri }[] };
  status(): Promise<void>;
}
interface GitApi {
  readonly repositories: readonly GitRepository[];
  openRepository(uri: vscode.Uri): Promise<GitRepository | null>;
}

/** Poll an observable editor state; timeouts fail instead of assuming a command completed. */
async function until(predicate: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 30000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(predicate(), description);
}

/** Native SCM/merge UI in a full linked clone, with a second root and external branch changes. */
export async function runSourceGitUiSmoke(folder: vscode.WorkspaceFolder): Promise<void> {
  const clone = folder.uri.fsPath;
  assert.ok(fs.existsSync(path.join(clone, ".verification/seed.json")));
  assert.equal((await sourceGit(clone, ["status", "--porcelain"])).stdout.length, 0);
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "uttori-native-git-")));
  const root = path.join(parent, "project with spaces");
  const stamp = Date.now();
  const branch = `codex/native-source-${stamp}`;
  const incoming = `codex/native-incoming-${stamp}`;
  const relative = "disassembly/banks/bank-008.asm";
  const uri = vscode.Uri.file(path.join(root, relative));
  const report: Record<string, unknown> = {
    editor: vscode.version,
    branch,
    incoming,
    success: false,
    checks: [],
  };
  const checks = report.checks as string[];
  let added = false;
  let inWorkspace = false;
  try {
    await sourceGit(clone, ["worktree", "add", "-b", branch, root, "HEAD"]);
    added = true;
    fs.mkdirSync(path.join(root, ".uttori-local"));
    fs.writeFileSync(
      path.join(root, ".uttori-local/project.json"),
      JSON.stringify({
        format: "uttori-source-local",
        version: 1,
        evidence: path.join(clone, "disassembly/analysis"),
        rom: path.join(clone, "Secret of Mana (USA).sfc"),
      }),
    );
    fs.mkdirSync(path.join(root, "node_modules"));
    fs.symlinkSync(
      path.resolve(clone, "../../node_modules/@uttori"),
      path.join(root, "node_modules/@uttori"),
      "dir",
    );
    assert.equal(
      vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders!.length, 0, {
        uri: vscode.Uri.file(root),
        name: "Second source project",
      }),
      true,
    );
    inWorkspace = true;
    await until(
      () => !!vscode.workspace.workspaceFolders?.some((item) => item.uri.fsPath === root),
      "Second workspace folder did not appear.",
    );
    await vscode.commands.executeCommand("asm.source.select", vscode.Uri.file(root));
    const before = await vscode.commands.executeCommand<SnesSourceBuild>("asm.source.build");
    assert.ok(
      before?.outputFile.startsWith(root + path.sep),
      "Build must use the selected nested source root.",
    );
    assert.equal(
      sourceContentHash(fs.readFileSync(before.outputFile)),
      "6abc48cc519de82d50edc730ba9ad32bdadc1e26e62f7420c3b75ea7eb033622",
    );
    checks.push("full linked worktree builds from a second workspace root with spaces");
    const original = fs.readFileSync(uri.fsPath, "utf8");
    await sourceGit(root, ["switch", "-c", incoming]);
    fs.writeFileSync(uri.fsPath, original + "\n; Native incoming branch research.\n");
    await sourceGit(root, ["add", relative]);
    await sourceGit(root, ["commit", "-m", "Native incoming research comment"]);
    await sourceGit(root, ["switch", branch]);
    fs.writeFileSync(uri.fsPath, original + "\n; Native current branch research.\n");
    await sourceGit(root, ["add", relative]);
    await sourceGit(root, ["commit", "-m", "Native current research comment"]);
    await sourceGit(root, ["merge", "--no-ff", "--no-commit", incoming], { acceptedCodes: [1] });
    const stages = await sourceGit(root, ["ls-files", "-u", "--", relative]);
    assert.equal(stages.stdout.toString().trim().split("\n").length, 3);
    const extension = vscode.extensions.getExtension<{ getAPI(version: 1): GitApi }>("vscode.git");
    assert.ok(extension);
    await extension.activate();
    const git = extension.exports.getAPI(1);
    const repository = await git.openRepository(vscode.Uri.file(root));
    assert.ok(repository);
    await repository.status();
    await until(
      () => repository.state.mergeChanges.some((item) => item.uri.fsPath === uri.fsPath),
      "Native SCM did not expose the conflict.",
    );
    await vscode.commands.executeCommand("workbench.view.scm");
    await vscode.commands.executeCommand("git.openMergeEditor", uri);
    // Git owns the merge editor entry point and its index-stage mapping. Production
    // code does not call the private merge editor API or depend on its tab class.
    type MergeInput = {
      base?: vscode.Uri;
      input1?: vscode.Uri;
      input2?: vscode.Uri;
      result?: vscode.Uri;
    };
    const mergeTab = () =>
      vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .find((tab) => (tab.input as MergeInput | undefined)?.result?.fsPath === uri.fsPath);
    await until(() => !!mergeTab(), "Native Git did not open a three-way merge tab.");
    const input = mergeTab()!.input as Required<MergeInput>;
    const base = await vscode.workspace.openTextDocument(input.base);
    const first = await vscode.workspace.openTextDocument(input.input1);
    const second = await vscode.workspace.openTextDocument(input.input2);
    assert.equal(base.getText(), original);
    assert.ok(
      [first.getText(), second.getText()].some((text) =>
        text.endsWith("; Native incoming branch research.\n"),
      ),
    );
    assert.ok(
      [first.getText(), second.getText()].some((text) =>
        text.endsWith("; Native current branch research.\n"),
      ),
    );
    checks.push("native SCM exposes all three real index stages in the merge editor");
    const available = await vscode.commands.getCommands(true);
    assert.ok(available.includes("mergeEditor.acceptAllCombination"));
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    // The Git command opens a tab before its merge model has finished loading.
    // An early action returns undefined; require the native model's success receipt.
    let accepted = false;
    const readyBy = Date.now() + 30000;
    while (!accepted && Date.now() < readyBy) {
      const result = await vscode.commands.executeCommand<{ success: boolean } | undefined>(
        "mergeEditor.acceptAllCombination",
      );
      accepted = result?.success === true;
      if (!accepted) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    assert.ok(accepted, "Native merge model never became ready.");
    await vscode.commands.executeCommand("git.acceptMerge");
    await repository.status();
    await until(
      () => !repository.state.mergeChanges.length,
      "Native Complete Merge did not stage the resolved result.",
    );
    assert.equal((await sourceGit(root, ["ls-files", "-u"])).stdout.length, 0);
    const resolved = fs.readFileSync(uri.fsPath, "utf8");
    assert.ok(resolved.includes("; Native incoming branch research.\n"));
    assert.ok(resolved.includes("; Native current branch research.\n"));
    assert.equal(resolved.includes("<<<<<<<"), false);
    await sourceGit(root, [
      "commit",
      "-m",
      "Resolve research comments through native merge editor",
    ]);
    checks.push(
      "native Accept Combination and Complete Merge save and stage both intended comments",
    );
    await vscode.commands.executeCommand("asm.source.refresh");
    const after = await vscode.commands.executeCommand<SnesSourceBuild>("asm.source.build");
    assert.ok(after?.outputFile);
    assert.deepEqual(fs.readFileSync(after.outputFile), fs.readFileSync(before.outputFile));
    await sourceGit(root, ["switch", incoming]);
    await vscode.commands.executeCommand("asm.source.refresh");
    const switched = await vscode.commands.executeCommand<SnesSourceBuild>("asm.source.build");
    assert.ok(switched?.outputFile);
    assert.deepEqual(fs.readFileSync(switched.outputFile), fs.readFileSync(before.outputFile));
    checks.push("external branch switch refreshes source inputs and keeps exact full-ROM builds");
    report.success = true;
    console.log(
      "Native Git UI: merge stages, native resolution, multi-root and branch switching passed.",
    );
  } catch (error) {
    report.error = String(error);
    throw error;
  } finally {
    // Persist the diagnosis before any UI cleanup can raise its own dialog.
    fs.writeFileSync(
      path.join(clone, ".verification", `native-git-ui-${vscode.version}.json`),
      JSON.stringify(report, null, 2) + "\n",
    );
    if (report.success) {
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      await vscode.commands.executeCommand("asm.source.select", folder.uri);
    }
    if (inWorkspace && report.success) {
      const index =
        vscode.workspace.workspaceFolders?.findIndex((item) => item.uri.fsPath === root) ?? -1;
      if (index >= 0) {
        vscode.workspace.updateWorkspaceFolders(index, 1);
      }
    }
    if (added && report.success) {
      await sourceGit(clone, ["worktree", "remove", "--force", root]);
      fs.rmSync(parent, { recursive: true });
    } else if (added) {
      console.log(`Retained native Git verification worktree: ${root}`);
    }
  }
}
