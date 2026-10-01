import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import { findEvidenceSourceRoot, findSourceRoot } from "../../src/source/project-path.js";

test("coverage actions resolve the owning source, linked worktree and physical evidence alias", async (t) => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "uttori-evidence-route-")),
  );
  t.teardown(() => fs.rm(root, { recursive: true, force: true }));
  /** Separate local bindings reproduce multi-root and shared-store worktrees without touching SQLite. */
  const project = async (name: string, evidence?: string): Promise<string> => {
    const directory = path.join(root, name);
    await fs.mkdir(path.join(directory, ".uttori"), { recursive: true });
    await fs.mkdir(path.join(directory, ".uttori-local"));
    await fs.mkdir(path.join(directory, "analysis"));
    await fs.writeFile(path.join(directory, ".uttori/project.json"), "{}");
    await fs.writeFile(
      path.join(directory, ".uttori-local/project.json"),
      JSON.stringify({
        format: "uttori-source-local",
        version: 1,
        rom: "original.sfc",
        evidence: evidence ?? "analysis",
      }),
    );
    return directory;
  };
  const first = await project("first"),
    second = await project("second");
  const evidence = path.join(first, "analysis");
  t.is(await findEvidenceSourceRoot(evidence, second), first);
  const linked = await project("linked worktree", evidence);
  t.is(await findEvidenceSourceRoot(evidence, linked), linked);
  const alias = path.join(root, "alias");
  await fs.symlink(evidence, alias);
  t.is(await findEvidenceSourceRoot(alias, linked), linked);
  const mismatch = await project("mismatch", path.join(second, "analysis"));
  await t.throwsAsync(findEvidenceSourceRoot(path.join(mismatch, "analysis"), first), {
    message: /different evidence store/,
  });
  await t.throwsAsync(findEvidenceSourceRoot(path.join(root, "missing"), first), {
    code: "ENOENT",
  });
  const nested = path.join(first, "nested", "analysis");
  await fs.mkdir(nested, { recursive: true });
  await fs.writeFile(path.join(first, "nested", ".git"), "gitdir: elsewhere");
  t.is(
    await findSourceRoot(nested),
    undefined,
    "Nested repositories cannot inherit the parent's source project.",
  );
});
