import { test } from "../../../../tests/ava-helper.js";
import { compareByteImages } from "../../src/index.js";

test("ROM comparison reports equality, changed bytes and truncated images", (t) => {
  const bytes = new Uint8Array([1, 2]);
  t.true(compareByteImages(bytes, bytes.slice()).equal);
  t.like(compareByteImages(bytes, new Uint8Array([1, 3])), {
    equal: false,
    firstDifference: 1,
    expectedLength: 2,
    actualLength: 2,
  });
  t.like(compareByteImages(bytes, new Uint8Array([1])), {
    equal: false,
    firstDifference: 1,
    expectedLength: 2,
    actualLength: 1,
  });
});
