import { test } from "../../../tests/ava-helper.js";
import {
  applyMapperSelection,
  calculateHeaderChecksum,
  encodeSuperFxMoveShortAddress,
  getChecksumHeaderOffset,
  shouldAutoCloseSpcblock,
  shouldEnableSpcInlineCompat,
  shouldUseNoromAddressing,
} from "../src/asar/compatibility.js";

test("compatibility profile owns mapper checksum policy", t => {
  const state = { mapper: "lorom", checksumEnabled: true };
  applyMapperSelection(state, "norom");

  t.deepEqual(state, { mapper: "norom", checksumEnabled: false });
  t.is(getChecksumHeaderOffset("lorom"), 0x7FC0);
  t.is(getChecksumHeaderOffset("hirom"), 0xFFC0);
  t.true(shouldEnableSpcInlineCompat("spc700-inline"));
  t.false(shouldEnableSpcInlineCompat("spc700"));
  t.false(shouldEnableSpcInlineCompat("spc700-raw"));
  t.true(shouldUseNoromAddressing("spc700-raw"));
  t.false(shouldUseNoromAddressing("spc700"));
  t.false(shouldUseNoromAddressing("spc700-inline"));
  t.true(shouldAutoCloseSpcblock(true, true));
  t.false(shouldAutoCloseSpcblock(true, false));
});

test("ASAR checksum mode mirrors a non-power-of-two tail", t => {
  const rom = new Uint8Array([1, 2, 3, 4, 5, 6]);
  t.is(calculateHeaderChecksum(rom, "simple"), 21);
  t.is(calculateHeaderChecksum(rom, "asar"), 32);
});

test("Super FX auto-MOVE short address is hardware-correct unless Asar mode is selected", t => {
  t.is(encodeSuperFxMoveShortAddress(0x40), 0x20);
  t.is(encodeSuperFxMoveShortAddress(0x40, "hardware"), 0x20);
  t.is(encodeSuperFxMoveShortAddress(0x40, "asar"), 0x40);
  t.is(encodeSuperFxMoveShortAddress(0x00), 0x00);
  t.is(encodeSuperFxMoveShortAddress(0x00, "asar"), 0x00);
});
