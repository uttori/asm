import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  sourceGit,
  sourceRepository,
  sourceContentHash,
} from "@uttori/asm-disassembler/source-project";
import type { PreparedSnesGeneration, SnesSourceBuild } from "@uttori/asm-plugin-snes/disassembler";
import * as vscode from "vscode";

import type { SourceHomeProjection } from "../src/project/home-model.js";

/** Inspect the production Home snapshot through the disposable test entry, never a shipped command. */
async function sourceProjection(): Promise<SourceHomeProjection> {
  const projection =
    await vscode.commands.executeCommand<SourceHomeProjection>("uttori.tests.sourceTree");
  assert.ok(projection);
  return projection;
}

async function treeCommands(): Promise<string[]> {
  return (await sourceProjection()).commands;
}

/** Real-host prepare/preview/apply/finish with the full edited game and repeated/stale commands. */
export async function runSourceLifecycleSmoke(folder: vscode.WorkspaceFolder): Promise<void> {
  const clone = folder.uri.fsPath;
  assert.ok(fs.existsSync(path.join(clone, ".uttori/generation.json")));
  assert.equal((await sourceGit(clone, ["status", "--porcelain"])).stdout.length, 0);
  const parent = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "uttori-native-lifecycle-")),
  );
  const root = path.join(parent, "source project");
  const branch = `codex/native-lifecycle-${Date.now()}`;
  const checks: string[] = [];
  const report = {
    editor: vscode.version,
    root,
    branch,
    checks,
    outputSha256: "",
    success: false,
    error: "",
  };
  let added = false;
  let completed = false;
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
      fs.realpathSync(path.join(clone, "node_modules/@uttori")),
      path.join(root, "node_modules/@uttori"),
      "dir",
    );
    await vscode.commands.executeCommand("asm.source.select", vscode.Uri.file(root));
    const before = await vscode.commands.executeCommand<SnesSourceBuild | undefined>(
      "asm.source.build",
    );
    assert.ok(before);
    const expectedOutputSha256 = sourceContentHash(fs.readFileSync(before.outputFile));
    report.outputSha256 = expectedOutputSha256;
    const relative = "disassembly/banks/bank-008.asm";
    const file = path.join(root, relative);
    const savedBytes = fs.readFileSync(file);
    await vscode.commands.executeCommand("uttori.tests.buildMutation", relative);
    assert.ok(await vscode.commands.executeCommand("asm.source.build"));
    const built = await sourceProjection();
    assert.equal(built.build, "verified");
    checks.push(
      "Unchanged saved-file notification during build is accepted by consumed-byte hashes",
    );
    const published = await vscode.commands.executeCommand<unknown[]>("uttori.tests.builds");
    await vscode.commands.executeCommand(
      "uttori.tests.buildMutation",
      relative,
      "\n; Build input changed.\n",
    );
    assert.equal(await vscode.commands.executeCommand("asm.source.build"), undefined);
    assert.deepEqual(await vscode.commands.executeCommand("uttori.tests.builds"), published);
    fs.writeFileSync(file, savedBytes);
    assert.ok(await vscode.commands.executeCommand("asm.source.build"));
    checks.push(
      "Changed consumed source rejects build publication; restoring saved bytes rebuilds successfully",
    );
    const researchComment = "\n; Research retained through the regeneration lifecycle.\n";
    fs.appendFileSync(file, researchComment);
    // The private evidence store may have newer imports than this committed source clone.
    // Reconcile only the clone's tracked catalog before preparing; no evidence import is rerun.
    if ((await treeCommands()).includes("asm.source.catalog")) {
      assert.ok(await vscode.commands.executeCommand("asm.source.catalog"));
      checks.push("Outdated capture catalog offers and executes a native editor recovery action");
    }
    if (!(await treeCommands()).includes("asm.source.prepare")) {
      assert.ok((await treeCommands()).includes("asm.source.analyze"));
      assert.ok(await vscode.commands.executeCommand("asm.source.analyze"));
      checks.push("Changed evidence requires Analyze before Prepare becomes available");
    }
    console.log("Source lifecycle: prepare full Secret of Mana generation");
    const prepared = await vscode.commands.executeCommand<PreparedSnesGeneration | undefined>(
      "asm.source.prepare",
    );
    assert.ok(prepared, "Prepare reported an error instead of a generation.");
    assert.ok(prepared.generation.commit);
    assert.equal(
      prepared.verification.outputSha256,
      "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f",
    );
    assert.ok(!(await treeCommands()).includes("asm.source.apply"));
    const preparedHome = await sourceProjection();
    assert.equal(preparedHome.incoming.previewed, false);
    assert.equal(preparedHome.incoming.collapsed, false);
    assert.equal(preparedHome.incoming.shown, preparedHome.incoming.total);
    assert.ok(preparedHome.candidate);
    checks.push("Apply is hidden until a preview exists; pure generation matches the original ROM");
    const checkpoint = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString();
    console.log("Source lifecycle: preview and rejected Apply without a checkpoint");
    const preview = await vscode.commands.executeCommand<{ conflicts: unknown[] }>(
      "asm.source.preview",
    );
    assert.ok(preview);
    assert.deepEqual(preview.conflicts, []);
    assert.ok(!(await treeCommands()).includes("asm.source.apply"));
    assert.ok((await treeCommands()).includes("workbench.view.scm"));
    // Native commands catch failures and display them. Assert both their missing result and the
    // unchanged Git state, then require a concrete success result from the repaired path.
    assert.equal(await vscode.commands.executeCommand("asm.source.apply"), undefined);
    assert.equal((await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString(), checkpoint);
    checks.push("Apply rejects uncommitted source without changing Git history");
    await sourceGit(root, ["add", relative, ".uttori/captures.json"]);
    await sourceGit(root, ["commit", "-m", "Checkpoint lifecycle research"]);
    const repository = await sourceRepository(root);
    const previewFile = path.join(repository.stateDirectory, "preview.json");
    fs.unlinkSync(previewFile);
    assert.equal(await vscode.commands.executeCommand("asm.source.apply"), undefined);
    assert.ok(await vscode.commands.executeCommand("asm.source.preview"));
    console.log("Source lifecycle: Apply after Git Checkpoint and Finish");
    const applied = await vscode.commands.executeCommand<{ phase: string } | undefined>(
      "asm.source.apply",
    );
    assert.equal(applied?.phase, "merging", "Apply did not start the reviewed Git merge.");
    assert.ok(!(await treeCommands()).includes("asm.source.apply"));
    const aborted = await vscode.commands.executeCommand<{ phase: string } | undefined>(
      "asm.source.abort",
    );
    assert.equal(aborted?.phase, "checkpoint");
    assert.ok((await treeCommands()).includes("asm.source.preview"));
    assert.ok(!(await treeCommands()).includes("asm.source.finish"));
    assert.ok(await vscode.commands.executeCommand("asm.source.preview"));
    const resumed = await vscode.commands.executeCommand<{ phase: string } | undefined>(
      "asm.source.apply",
    );
    assert.equal(resumed?.phase, "merging");
    checks.push(
      "Abort returns to Preview; reviewed regeneration can be applied again from the checkpoint",
    );
    const finished = await vscode.commands.executeCommand<{ phase: string } | undefined>(
      "asm.source.finish",
    );
    assert.equal(finished?.phase, "verified", "Finish did not validate and commit the merge.");
    assert.equal(fs.existsSync(previewFile), false);
    checks.push(
      "Deleted preview is recoverable; reviewed Apply and Finish both return successful states",
    );
    const after = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString();
    const integratedSource = fs.readFileSync(file);
    // New evidence legitimately changes generated instructions. Preserve the authored comment,
    // then pin the integrated bytes when checking repeated/stale commands for unintended edits.
    assert.ok(integratedSource.toString().includes(researchComment));
    console.log("Source lifecycle: repeated Apply and restored stale editor state");
    const refs = (await sourceGit(root, ["show-ref"])).stdout.toString();
    assert.ok(!(await treeCommands()).includes("asm.source.preview"));
    assert.ok(!(await treeCommands()).includes("asm.source.apply"));
    assert.equal(await vscode.commands.executeCommand("asm.source.apply"), undefined);
    // Restoring the old persisted candidate exercises the same reconciliation used on reload,
    // including a merge completed outside this controller's in-memory lifetime.
    await vscode.commands.executeCommand(
      "uttori.tests.sourceCandidate",
      root,
      prepared.generation.commit,
    );
    await vscode.commands.executeCommand("asm.source.select", vscode.Uri.file(root));
    assert.ok(!(await treeCommands()).includes("asm.source.apply"));
    assert.ok(!(await treeCommands()).includes("asm.source.preview"));
    assert.equal(await vscode.commands.executeCommand("asm.source.apply"), undefined);
    assert.equal((await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString(), after);
    assert.equal((await sourceGit(root, ["show-ref"])).stdout.toString(), refs);
    assert.equal(fs.existsSync(previewFile), false);
    assert.deepEqual(fs.readFileSync(file), integratedSource);
    assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.length, 0);
    checks.push(
      "Finish retires the candidate; repeated Apply and restored stale state preserve history and refs",
    );
    const build = await vscode.commands.executeCommand<SnesSourceBuild | undefined>(
      "asm.source.build",
    );
    assert.ok(build);
    assert.equal(sourceContentHash(fs.readFileSync(build.outputFile)), expectedOutputSha256);
    checks.push(
      "Full edited game and research comment survive regeneration with the expected ROM hash",
    );
    completed = true;
    report.success = true;
  } catch (error) {
    report.error = String(error);
    throw error;
  } finally {
    fs.writeFileSync(
      path.join(clone, ".verification/native-source-lifecycle.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    // Preserve failed worktrees for inspection, including their journal and merge conflict state.
    await vscode.commands.executeCommand("asm.source.select", vscode.Uri.file(clone));
    if (added && completed) {
      await sourceGit(clone, ["worktree", "remove", root]);
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }
}
