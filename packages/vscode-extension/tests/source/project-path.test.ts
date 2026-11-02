import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import { findSourceRoot } from "../../src/source/project-path.js";

test("source discovery inherits the owning configuration and stops at nested repository boundaries", async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "uttori-source-root-")));
  t.teardown(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, ".uttori"));
  await fs.writeFile(path.join(root, ".uttori/project.json"), "{}");
  const include = path.join(root, "source", "banks");
  await fs.mkdir(include, { recursive: true });
  t.is(await findSourceRoot(include), root);
  await fs.writeFile(path.join(root, "source", ".git"), "gitdir: elsewhere");
  t.is(await findSourceRoot(include), undefined);
  await fs.mkdir(path.join(root, "source", ".uttori"));
  await fs.writeFile(path.join(root, "source", ".uttori/project.json"), "{}");
  t.is(await findSourceRoot(include), path.join(root, "source"));
});
