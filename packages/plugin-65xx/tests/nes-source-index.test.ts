import { createHash } from "node:crypto";

import { test } from "../../../tests/ava-helper.js";
import { exportNesSource } from "../src/nes/source-export.js";
import { sourceExportFixture } from "./helpers/source-export-fixture.js";

const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

// Golden identities cover every emitted file, including ambiguous contexts and research labels.
for (const [count, expected] of [
  [1024, "db6e631c8e265539c38b4d3bb8ad41365ca791eafbb22390d731e6a446bb96d8"],
  [2048, "5b2699b4d9b9abf2247ce4691809ca104884e5841266760431b3b793f517dc70"],
  [4096, "e900746db0b444cb89277759739d2423a8a2831796d46cb2f2c2f1ddc48a1419"],
] as const) {
  test(`indexed NES export preserves labels and conflicting contexts at ${count} candidates`, (t) => {
    const { rom, nodes, labels } = sourceExportFixture(count);
    const result = exportNesSource(rom, nodes, hash(rom.bytes()), { labels });
    t.is(hash(JSON.stringify(result.files.map((file) => [file.path, hash(file.bytes)]))), expected);
    t.is(
      result.codeBytes,
      result.ranges.reduce((sum, range) => sum + range.end - range.start, 0),
    );
  });
}
