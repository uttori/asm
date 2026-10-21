import { test } from "../../../tests/ava-helper.js";
import { readCaptureTargetPayload } from "../src/target-payload.js";

test("instruction codecs reject unknown identities and preserve owned register snapshots", (t) => {
  const state = { a: 1, x: 2, y: 3, s: 511, d: 0, db: 128, pb: 128, pc: 32768, p: 48, e: 0 };
  const payload = readCaptureTargetPayload("snes.65816", 1, state);
  state.a = 9;
  t.is(payload.codec, "snes.65816");
  t.is(payload.state.a, 1);
  t.true(Object.isFrozen(payload.state));
  t.throws(() => readCaptureTargetPayload("snes.65816", 2, state), { message: /codec\/version/ });
  t.throws(() => readCaptureTargetPayload("unknown", 1, state), { message: /codec\/version/ });
  t.throws(() => readCaptureTargetPayload("snes.65816", 1, { ...state, e: 2 }), {
    message: /register e/,
  });
  t.throws(() => readCaptureTargetPayload("snes.65816", 1, { ...state, extra: 1 }), {
    message: /Unknown/,
  });
});
