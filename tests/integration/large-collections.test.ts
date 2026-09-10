import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { test } from "../ava-helper.js";

for (const scenario of [
  "numeric-extrema",
  "data-expansion",
  "local-labels",
  "65816-evidence",
  "spc700-evidence",
  "annotation-details",
  "plugin-registration",
  "failed-debug-launch",
  "struct-notes",
]) {
  test.serial(`large collections preserve ${scenario}`, async (t) => {
    // AVA's larger worker stack masks native argument-count failures. Each child uses the
    // default Node stack, as the maintenance process does, and releases its stress-test heap.
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--import=tsx",
        fileURLToPath(new URL("../helpers/large-collections.ts", import.meta.url)),
        scenario,
      ],
      { timeout: 60_000 },
    );
    t.deepEqual(JSON.parse(stdout), { scenario, items: 131_072 });
  });
}
