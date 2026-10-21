import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import { savedAssetSourceHost } from "../src/asset-interchange/service.js";
import { executeAssetSourceOperation } from "../src/asset-source/operations.js";

test("menu prefilter avoids unrelated builds and retains labeled and continued call coordinates", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-menu-prefilter-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "main.asm");
  let inspections = 0;
  const host = {
    ...savedAssetSourceHost,
    inspect: async () => {
      inspections++;
      throw new Error("Inspected current source");
    },
  };
  fs.writeFileSync(file, 'incsrc "other.asm"\n; includeAsset("comment.png")\ndb 1\n');
  t.is(
    await executeAssetSourceOperation(
      { action: "asset-source-target", directory, file, line: 1 },
      { host },
    ),
    undefined,
  );
  t.is(inspections, 0);
  for (const text of [
    'Label: includeAsset("asset.png")',
    'includeAsset(\n  "asset.png",\n  { format: "native" }\n)',
  ]) {
    fs.writeFileSync(file, text);
    await t.throwsAsync(
      () =>
        executeAssetSourceOperation(
          { action: "asset-source-target", directory, file, line: text.split("\n").length },
          { host },
        ),
      { message: "Inspected current source" },
    );
  }
  t.is(inspections, 2);
});
