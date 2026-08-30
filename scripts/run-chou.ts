import {
  assembleExternalFixture,
  assertAssembledMatchesManifest,
  assertSubmodulesClean,
  sha256,
} from "./external-fixtures.ts";
import { EXTERNAL_FIXTURES } from "../fixtures/fixture-manifest.ts";

function main(): void {
  const spec = EXTERNAL_FIXTURES.chou;
  const keep = process.argv.includes("--keep-worktree");
  const output = assembleExternalFixture("chou", { keepWorktree: keep });
  const digest = sha256(output);
  console.log(`${spec.displayName}: ${output.length} bytes ${digest}`);
  assertAssembledMatchesManifest("chou", output);
  assertSubmodulesClean();
  console.log("PASS");
}

main();
