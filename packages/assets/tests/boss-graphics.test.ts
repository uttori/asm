import { test } from "../../../tests/ava-helper.js";
import { encodeBossGraphics, expandBossGraphics } from "../src/secret-of-mana/som-boss-graphics.js";

test("native boss mask encoding uses zero-initialized history within fixed spans", (t) => {
  // Independent native bytes: only output two needs a literal; later words reuse its plane byte.
  const planar = Uint8Array.of(0, 0, 1, 0, 1, 0, 1, 0);
  const native = Uint8Array.of(0x20, 1);
  t.deepEqual(expandBossGraphics(native, 8), { data: planar, consumed: 2 });
  t.deepEqual(encodeBossGraphics(planar), native);
  t.deepEqual(encodeBossGraphics(new Uint8Array(16)), Uint8Array.of(0, 0));
});
