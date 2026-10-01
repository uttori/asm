import fs from "node:fs/promises";
import path from "node:path";

import { readSourceProjectLocalInputs } from "@uttori/asm-disassembler";

/** Find source-project configuration above an include folder, stopping at the owning Git repository. */
export async function findSourceRoot(directory: string): Promise<string | undefined> {
  let current = path.resolve(directory);
  for (;;) {
    try {
      await fs.access(path.join(current, ".uttori/project.json"));
      return current;
    } catch {
      /* An include folder may inherit configuration from its repository root. */
    }
    try {
      await fs.access(path.join(current, ".git"));
      return undefined;
    } catch {
      /* Continue only while no repository boundary has been reached. */
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

/** Resolve a coverage action by its physical evidence store, never by a coincidentally matching record ID. */
export async function findEvidenceSourceRoot(
  evidenceDirectory: string,
  selected?: string,
): Promise<string | undefined> {
  const evidence = await fs.realpath(evidenceDirectory);
  const matches = async (root: string): Promise<boolean> =>
    (await fs.realpath(readSourceProjectLocalInputs(root).evidence)) === evidence;
  // Linked worktrees may bind a shared evidence store outside their own source tree.
  if (selected && (await matches(selected))) {
    return selected;
  }
  const root = await findSourceRoot(evidence);
  if (root && !(await matches(root))) {
    throw new Error(
      "This source project is bound to a different evidence store. Select the source project for this evidence first.",
    );
  }
  return root;
}
