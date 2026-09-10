import { EXTERNAL_FIXTURES, type ExternalFixtureId } from "../../fixtures/fixture-manifest.ts";
import {
  assembleExternalFixture,
  assertAssembledMatchesManifest,
  assertSubmodulesClean,
  parseRequestedFixtures,
  sha256,
} from "../../scripts/external-fixtures.ts";
import { test } from "../ava-helper.js";

const requested = parseRequestedFixtures();

for (const id of requested) {
  const spec = EXTERNAL_FIXTURES[id as ExternalFixtureId];
  test.serial(`external ${spec.displayName} matches manifest hash`, (t) => {
    t.timeout(30 * 60_000);
    const output = assembleExternalFixture(spec.id);
    t.is(output.length, spec.expectedBytes);
    t.is(sha256(output), spec.expectedSha256);
    assertAssembledMatchesManifest(spec.id, output);
    assertSubmodulesClean();
  });
}
