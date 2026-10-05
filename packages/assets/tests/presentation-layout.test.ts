import { test } from "../../../tests/ava-helper.js";
import { planIndexedPresentation } from "../src/presentation-layout.js";

test("full-area landscapes and portraits retain native dimensions without an inventory gutter", (t) => {
  for (const [width, height] of [
    [4096, 1024],
    [1024, 4096],
    [2048, 2048],
  ]) {
    const layout = planIndexedPresentation(width, height, 8, 8, 65536);
    t.is(layout.width, width);
    t.is(layout.height, height);
    t.is(layout.capacity, 65536);
    t.is(layout.pages, 1);
  }
});

test("multiple view variants page without dropping inventory or assuming square eight-pixel tiles", (t) => {
  const variants = planIndexedPresentation(4096, 1024, 8, 8, 131072);
  t.is(variants.pages, 2);
  t.is(variants.width * variants.height, 4194304);
  const rectangular = planIndexedPresentation(9, 5, 3, 5, 3);
  t.true(rectangular.capacity >= 3);
  t.true(rectangular.columns * 3 <= rectangular.width);
  t.true(rectangular.rows * 5 <= rectangular.height);
  t.throws(() => planIndexedPresentation(4096, 1025, 8, 8, 1));
});
