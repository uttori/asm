import { test } from "../../../../tests/ava-helper.js";
import {
  createSourceInputSnapshot,
  readSourceInputSnapshot,
} from "../../src/source-project/input-snapshot.js";

test("input snapshots retain exact recipe bytes in a deterministic inspectable payload", (t) => {
  const files = [
    {
      path: "source/struct-map.json",
      bytes: Buffer.from('{\r\n  "name": "RenamedTable"\r\n}\r\n'),
    },
    {
      path: ".uttori/research/bank-c8.json",
      bytes: Buffer.from('{"comment":"原位置 → new placement"}\n'),
    },
  ];
  const snapshot = createSourceInputSnapshot(files);
  t.deepEqual(snapshot, createSourceInputSnapshot([...files].toReversed()));
  const restored = readSourceInputSnapshot(snapshot.bytes);
  for (const file of files) {
    t.deepEqual(restored.find((entry) => entry.path === file.path)?.bytes, file.bytes);
  }
});

test("input snapshots reject tampering, path ambiguity and executable or oversized inputs", (t) => {
  const file = { path: "research/input.json", bytes: Buffer.from("{}\n") };
  const snapshot = createSourceInputSnapshot([file]);
  const value = JSON.parse(Buffer.from(snapshot.bytes).toString());
  value.files[0].base64 = Buffer.from("changed").toString("base64");
  t.throws(() => readSourceInputSnapshot(Buffer.from(JSON.stringify(value))), {
    message: /content changed/,
  });
  for (const files of [
    [file, { ...file, path: "Research/input.json" }],
    [{ ...file, path: "../escape.json" }],
    [{ ...file, executable: true }],
    [{ ...file, bytes: new Uint8Array(41 * 1024 * 1024) }],
  ]) {
    t.throws(() => createSourceInputSnapshot(files));
  }
});
