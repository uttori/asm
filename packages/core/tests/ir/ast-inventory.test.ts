import fs from "node:fs";

import { assemblerAstInventory } from "../../../../scripts/assembler-ast-inventory.js";
import { test } from "../../../../tests/ava-helper.js";

test("AST ledger enumerates every registered target, CPU, directive and alias without workload inference", async (t) => {
  const ledger = JSON.parse(fs.readFileSync("docs/assembler-ast-coverage.json", "utf8"));
  t.deepEqual(ledger, await assemblerAstInventory());
  t.is(new Set(ledger.rows.map((row: { key: string }) => row.key)).size, ledger.consumers);
  for (const row of ledger.rows) {
    t.true(fs.existsSync(row.sourceLocation), row.key);
    for (const fixture of [...row.positiveFixtures, ...row.negativeFixtures]) {
      t.true(fs.existsSync(fixture), fixture);
    }
    t.truthy(row.owner);
    t.regex(row.retirementMilestone, /^B\d+$/);
  }
});
