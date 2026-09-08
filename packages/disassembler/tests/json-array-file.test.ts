import { createHash } from "node:crypto";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "ava";
import { readObjectArrayFile } from "../src/json-array-file.js";

const withShard = (text: string, check: (file: string, hash: string) => void): void => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-shard-reader-"));
  try {
    const file = path.join(directory, "records.json");
    fs.writeFileSync(file, text);
    check(file, createHash("sha256").update(text).digest("hex"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

test("streaming shard reader preserves UTF-8, escapes, nested arrays and chunk boundaries", (t) => {
  const records = [
    {
      text: "x".repeat(65520) + '😀\\\"[]{}',
      nested: [{ list: [1, null, true, { text: "菜单" }] }],
    },
    { text: "z".repeat(150000) },
  ];
  withShard(JSON.stringify(records, null, 2), (file, hash) =>
    t.deepEqual(readObjectArrayFile(file, hash), records),
  );
  withShard(" \n[]\t", (file, hash) => t.deepEqual(readObjectArrayFile(file, hash), []));
});

test("streaming shard reader rejects invalid structure and mismatched hashes", (t) => {
  for (const text of [
    "",
    "{}",
    "[1]",
    "[null]",
    "[[]]",
    "[{},]",
    "[{} {}]",
    "[{}]{}",
    '[{"a":1]',
    '[{"a":"unfinished}]',
    '[{"a":NaN}]',
    '[{"a":1,}]',
  ]) {
    withShard(text, (file, hash) => t.throws(() => readObjectArrayFile(file, hash)));
  }
  withShard('[{"id":"valid"}]', (file) =>
    t.throws(() => readObjectArrayFile(file, "0".repeat(64)), { message: /SHA-256/ }),
  );
});

test("streaming shard reader bounds an individual record", (t) => {
  withShard(JSON.stringify([{ text: "x".repeat(32 * 1024 * 1024) }]), (file, hash) =>
    t.throws(() => readObjectArrayFile(file, hash), { message: /32 MiB/ }),
  );
});
