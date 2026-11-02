import fs from "node:fs";
import path from "node:path";

import { readResearchInputs, type ResearchSnapshot } from "@uttori/asm-disassembler";
import {
  parseSourceProject,
  readSourceProjectLocalInputs,
} from "@uttori/asm-disassembler/source-project";

/** Saved authoring files for one evidence query. Unsaved edits remain editor documents until saved. */
export interface AnalysisResearchContext {
  /** Selected source worktree root for the evidence query. */
  readonly root: string;
  /** Saved research inputs hash bound to the query generation. */
  readonly snapshot: ResearchSnapshot;
}

/** Read bounded project metadata without loading an evidence database or invoking project plugins. */
function readConfiguration(file: string): unknown {
  if (fs.statSync(file).size > 1024 * 1024) {
    throw new Error(`Source project configuration exceeds 1 MiB: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Resolve the selected worktree first, including an external private evidence directory. Otherwise
 * discover an owning source project above the evidence store, stopping at a nested Git boundary.
 * Reading afresh on every worker request prevents terminal branch changes from reusing old names.
 */
export function analysisResearchContext(
  directory: string,
  preferredRoot?: string,
): AnalysisResearchContext | undefined {
  const evidence = fs.realpathSync(directory);
  const inspect = (root: string): AnalysisResearchContext | undefined => {
    const file = path.join(root, ".uttori/project.json");
    if (!fs.existsSync(file)) {
      return undefined;
    }
    const configuration = parseSourceProject(readConfiguration(file));
    const local = readSourceProjectLocalInputs(root);
    if (fs.realpathSync(local.evidence) !== evidence) {
      return undefined;
    }
    return {
      root,
      snapshot: readResearchInputs(
        root,
        configuration.researchRoots,
        { project: configuration.id, romSha256: configuration.romSha256 },
        undefined,
        configuration.limits,
      ),
    };
  };
  if (preferredRoot) {
    const selected = inspect(path.resolve(preferredRoot));
    if (selected) {
      return selected;
    }
  }
  for (let root = path.resolve(directory); ; root = path.dirname(root)) {
    const selected = inspect(root);
    if (selected) {
      return selected;
    }
    if (fs.existsSync(path.join(root, ".git")) || path.dirname(root) === root) {
      return undefined;
    }
  }
}
