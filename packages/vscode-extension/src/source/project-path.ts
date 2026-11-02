import fs from "node:fs/promises";
import path from "node:path";

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
