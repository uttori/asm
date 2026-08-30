import { test } from "./ava-helper.js";
import {
  EXTERNAL_FIXTURE_IDS,
  EXTERNAL_FIXTURES,
  LOCAL_ROM_DIR,
  SNES_ROM_FRAMEWORK,
} from "../fixtures/fixture-manifest.ts";

test("external fixture manifest pins paths, hashes, and setup independently of ROMs", (t) => {
  t.deepEqual([...EXTERNAL_FIXTURE_IDS], ["chou", "yoshi", "smrpg", "tmnt", "zelda"]);
  for (const id of EXTERNAL_FIXTURE_IDS) {
    const spec = EXTERNAL_FIXTURES[id];
    t.true(spec.submodulePath.startsWith("fixtures/external/"));
    t.true(spec.submoduleUrl.startsWith("https://"));
    t.is(spec.commit.length, 40);
    t.true(spec.expectedBytes > 0);
    t.is(spec.expectedSha256.length, 64);
    t.true(spec.setupInstructions.includes("git submodule update --init"));
    if (spec.localRom) {
      t.true(spec.setupInstructions.includes(LOCAL_ROM_DIR));
      t.is(spec.localRom.sha256.length, 64);
      t.true(spec.localRom.bytes > 0);
      t.false(spec.selfContained);
    } else {
      t.true(spec.selfContained);
    }
  }
  t.is(
    EXTERNAL_FIXTURES.chou.expectedSha256,
    "514cfb608ef9107739795623973f18ff3aea48eb6c7509e63f957edd10e52378",
  );
  t.is(EXTERNAL_FIXTURES.tmnt.frameworkVersion, "1.4.0");
  t.is(EXTERNAL_FIXTURES.tmnt.frameworkPath, SNES_ROM_FRAMEWORK.submodulePath);
  t.is(SNES_ROM_FRAMEWORK.commit, "ad99620d2695e59b6bc31923a6d05bbaf3f695ca");
  t.is(SNES_ROM_FRAMEWORK.submoduleUrl, "https://github.com/Yoshifanatic1/SNES-ROM-Framework.git");
});
