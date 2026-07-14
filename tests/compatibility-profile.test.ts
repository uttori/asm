import { test } from "./ava-helper.js";
import {
  applyMapperSelection,
  calculateHeaderChecksum,
  getChecksumHeaderOffset,
  shouldAutoCloseSpcblock,
  shouldEnableSpcInlineCompat,
} from "../src/compatibility/asar-compatibility-profile.js";

test("compatibility profile owns mapper checksum policy", t => {
  const state = { mapper: "lorom", checksumFixEnabled: true };
  applyMapperSelection(state, "norom");

  t.deepEqual(state, { mapper: "norom", checksumFixEnabled: false });
  t.is(getChecksumHeaderOffset("lorom"), 0x7FC0);
  t.is(getChecksumHeaderOffset("hirom"), 0xFFC0);
  t.true(shouldEnableSpcInlineCompat("spc700-inline"));
  t.false(shouldEnableSpcInlineCompat("spc700"));
  t.true(shouldAutoCloseSpcblock(true, true));
  t.false(shouldAutoCloseSpcblock(true, false));
});

test("ASAR checksum mode mirrors a non-power-of-two tail", t => {
  const rom = new Uint8Array([1, 2, 3, 4, 5, 6]);
  t.is(calculateHeaderChecksum(rom, "simple"), 21);
  t.is(calculateHeaderChecksum(rom, "asar"), 32);
});
