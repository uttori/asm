import { test } from "../../../../tests/ava-helper.js";
import { fileChanges, normalizedSeeds } from "../../src/disassembly/maintenance-data.js";

const manifest = (files: readonly { path: string; sha256: string }[]) =>
  ({ files }) as Parameters<typeof fileChanges>[0];

test("normalized seeds keep unique 24-bit PCs and drop unknown evidence ids", (t) => {
  t.deepEqual(normalizedSeeds(undefined, { shards: { evidence: [] } }), []);
  t.deepEqual(
    normalizedSeeds(
      [
        { address: 0x8000, evidence: ["keep", "missing"] },
        { address: 0x8000, evidence: ["keep"] },
        { address: 0x8001 },
      ],
      { shards: { evidence: [{ id: "keep" } as never] } },
    ),
    [
      { id: "runtime-008000", address: 0x8000, kind: "observation", evidence: ["keep"] },
      { id: "runtime-008001", address: 0x8001, kind: "observation" },
    ],
  );
  t.throws(() => normalizedSeeds([{ address: -1 }], { shards: { evidence: [] } }), {
    message: /24-bit integer CPU addresses/,
  });
  t.throws(
    () =>
      normalizedSeeds(
        Array.from({ length: 100_001 }, (_, address) => ({ address })),
        { shards: { evidence: [] } },
      ),
    { message: /narrower window/ },
  );
});

test("fileChanges reports added, changed and removed generated paths in sorted order", (t) => {
  t.deepEqual(
    fileChanges(
      manifest([
        { path: "z.asm", sha256: "old" },
        { path: "keep.asm", sha256: "same" },
        { path: "gone.asm", sha256: "x" },
      ]),
      manifest([
        { path: "keep.asm", sha256: "same" },
        { path: "z.asm", sha256: "new" },
        { path: "a.asm", sha256: "added" },
      ]),
    ),
    {
      addedFiles: ["a.asm"],
      changedFiles: ["z.asm"],
      removedFiles: ["gone.asm"],
    },
  );
});
