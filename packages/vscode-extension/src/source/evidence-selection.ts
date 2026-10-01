import path from "node:path";

import type { AnalysisProjectManifest } from "@uttori/asm-disassembler";
import { window, workspace } from "vscode";

import { findAnalysisProjectDirectories } from "../analysis/coverage-tree.js";
import { analysisWorker } from "../analysis/worker-client.js";

/** Select a store with the session's exact ROM identity before live evidence recording starts. */
export async function chooseLiveBusProject(romContentSha256: string): Promise<string | undefined> {
  if (!workspace.isTrusted) {
    throw new Error("Live bus analysis requires a trusted workspace.");
  }
  const choices = [];
  for (const directory of await findAnalysisProjectDirectories()) {
    const manifest = await analysisWorker().request<AnalysisProjectManifest>(directory, "manifest");
    if (manifest.rom.contentSha256 === romContentSha256) {
      choices.push({ label: path.basename(directory), description: directory, directory });
    }
  }
  if (choices.length === 1) {
    return choices[0].directory;
  }
  if (!choices.length) {
    return undefined;
  }
  return (await window.showQuickPick(choices, { title: "Choose the matching evidence project" }))
    ?.directory;
}
