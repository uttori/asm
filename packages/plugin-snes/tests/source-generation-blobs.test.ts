import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { sourceGit, sourceRepository } from "@uttori/asm-disassembler/source-project";

import { test } from "../../../tests/ava-helper.js";
import { readGenerationBlobs } from "../src/disassembler/source-generation-blobs.js";

test("pristine blob batches preserve binary framing, duplicates, staging and cancellation", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-pristine-batch-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  await sourceGit(root, ["init"]);
  const repository = await sourceRepository(root);
  const content = new Map<string, Buffer>();
  for (let index = 0; index < 35; index++) {
    const bytes = Buffer.from([index, 0, 10, 255, 10, 0]);
    const object = (
      await sourceGit(root, ["hash-object", "-w", "--stdin"], { input: bytes })
    ).stdout
      .toString()
      .trim();
    content.set(object, bytes);
  }
  // Crossing the byte budget must split a batch even before the object-count limit.
  for (let index = 0; index < 2; index++) {
    const bytes = Buffer.alloc(9 * 1024 * 1024, index);
    const object = (
      await sourceGit(root, ["hash-object", "-w", "--stdin"], { input: bytes })
    ).stdout
      .toString()
      .trim();
    content.set(object, bytes);
  }
  const result = await readGenerationBlobs(repository, [...content.keys(), ...content.keys()]);
  t.is(result.size, content.size);
  for (const [object, bytes] of content) {
    t.deepEqual(result.get(object), bytes);
  }
  t.false(fs.existsSync(path.join(repository.gitDirectory, "index")));
  t.is((await readGenerationBlobs(repository, [])).size, 0);
  await t.throwsAsync(readGenerationBlobs(repository, ["0".repeat(40)]), {
    message: /Invalid.*blob/,
  });
  await t.throwsAsync(readGenerationBlobs(repository, ["HEAD"]));
  const abort = new AbortController();
  abort.abort();
  await t.throwsAsync(readGenerationBlobs(repository, [...content.keys()], abort.signal));
});
