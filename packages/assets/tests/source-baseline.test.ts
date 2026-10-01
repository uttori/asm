import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import {
  createAssetSourceBaseline,
  assertAssetSourceBaseline,
  parseAssetSourceBaseline,
} from "../src/node.js";

/** Keep dependency snapshots within an isolated test directory. */
function fixture() {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "source-baseline-test-")));
  const root = path.join(parent, "project");
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, "source.bin"), Uint8Array.of(1, 2));
  return { parent, root };
}

test("persisted baselines reject stale, missing, malformed and escaping dependencies", (t) => {
  const { parent, root } = fixture();
  try {
    const baseline = createAssetSourceBaseline(
      "other-game:codec-v2",
      new Map([["source.bin", Uint8Array.of(1, 2)]]),
    );
    const reopened = parseAssetSourceBaseline(JSON.parse(JSON.stringify(baseline)));
    t.notThrows(() => assertAssetSourceBaseline(root, reopened, baseline.identity));
    t.throws(() => assertAssetSourceBaseline(root, reopened, "wrong-game"), {
      message: /different project/,
    });
    fs.writeFileSync(path.join(root, "source.bin"), Uint8Array.of(2, 1));
    t.throws(() => assertAssetSourceBaseline(root, reopened, baseline.identity), {
      message: /Stale/,
    });
    fs.unlinkSync(path.join(root, "source.bin"));
    t.throws(() => assertAssetSourceBaseline(root, reopened, baseline.identity), {
      message: /Stale/,
    });
    t.throws(
      () =>
        parseAssetSourceBaseline({ ...baseline, files: [baseline.files[0], baseline.files[0]] }),
      { message: /Duplicate/ },
    );
    for (const name of ["../outside", "/absolute", "x/../y", "a\\b", "C:/x"]) {
      t.throws(() => createAssetSourceBaseline("x", new Map([[name, new Uint8Array()]])), {
        message: /relative/,
      });
    }
    fs.symlinkSync(path.join(parent, "unrelated"), path.join(root, "source.bin"));
    t.throws(() => assertAssetSourceBaseline(root, reopened, baseline.identity), {
      message: /Stale/,
    });
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
