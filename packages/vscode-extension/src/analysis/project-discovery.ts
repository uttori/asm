/** Evidence discovery follows the selected source worktree, including external private stores. */
import * as path from "node:path";

import { ANALYSIS_PROJECT_MANIFEST } from "@uttori/asm-disassembler";
import { readSourceProjectLocalInputs } from "@uttori/asm-disassembler/source-project";
import { workspace, type Disposable } from "vscode";

/** Skip dependency trees and local copies during automatic project discovery. */
export const ANALYSIS_PROJECT_EXCLUDE = "**/{node_modules,.git,Local Only}/**";

/** The selected source worktree owns evidence binding even when the database lives outside it. */
let selectedSourceRoot: (() => string | undefined) | undefined;

/** Bind all evidence discovery consumers to the active source target for this extension lifetime. */
export function initializeAnalysisProjectDiscovery(root: () => string | undefined): Disposable {
  selectedSourceRoot = root;
  return {
    dispose() {
      if (selectedSourceRoot === root) {
        selectedSourceRoot = undefined;
      }
    },
  };
}

/** Selected Git source root, independent of whether its evidence binding is currently available. */
export const selectedAnalysisSourceRoot = (): string | undefined => selectedSourceRoot?.();

/**
 * Resolves configured or discovered native analysis-project directories.
 * @returns Sorted absolute local project directories.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.findFiles
 */
export const findAnalysisProjectDirectories = async (): Promise<string[]> => {
  const source = selectedSourceRoot?.();
  if (source) {
    // A copied workspace setting can point at an absent or foreign database. Never override the
    // selected worktree's explicit local binding, or silently fall back when that binding is broken.
    return [readSourceProjectLocalInputs(source).evidence];
  }
  const configured = workspace.getConfiguration("asm").get<string>("analysisProject", "").trim();
  if (configured !== "") {
    const folders = workspace.workspaceFolders ?? [];
    const candidates = path.isAbsolute(configured)
      ? [configured]
      : folders.map(({ uri }) => path.resolve(uri.fsPath, configured));
    return [
      ...new Set(
        candidates.map((candidate) =>
          path.basename(candidate) === ANALYSIS_PROJECT_MANIFEST
            ? path.dirname(candidate)
            : candidate,
        ),
      ),
    ].toSorted();
  }
  const manifests = await workspace.findFiles(
    `**/${ANALYSIS_PROJECT_MANIFEST}`,
    ANALYSIS_PROJECT_EXCLUDE,
    32,
  );
  return [
    ...new Set(
      manifests.filter(({ scheme }) => scheme === "file").map(({ fsPath }) => path.dirname(fsPath)),
    ),
  ].toSorted();
};
