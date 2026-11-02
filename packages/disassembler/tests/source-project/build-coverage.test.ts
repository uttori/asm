import { AddressToLineMapping } from "@uttori/asm-core";

import { test } from "../../../../tests/ava-helper.js";
import {
  sourceBuildCoverage,
  isSourceBuildCoverage,
} from "../../src/source-project/build-coverage.js";

test("conversion counts original input slices once across relocation, repeats and partially used blocks", (t) => {
  const mapping = new AddressToLineMapping();
  const original = new Uint8Array(10);
  const raw = { directory: "assets/raw", original, blockSize: 4 };
  for (const name of ["000000", "000004", "000008"]) {
    mapping.registerDependencySnapshot(`/project/assets/raw/${name}.bin`, new Uint8Array(4));
  }
  mapping.registerDependencySnapshot("/project/assets/known.bin", Uint8Array.of(1));
  const include = (
    assetFileIdx: number,
    inputStart: number,
    inputEnd: number,
    outputOffset: number,
  ) => {
    mapping.assets.push({
      fileIdx: 0,
      assetFileIdx,
      line: 1,
      format: "raw",
      part: "bytes",
      address: outputOffset,
      outputOffset,
      size: inputEnd - inputStart,
      inputStart,
      inputEnd,
      transforms: [],
    });
  };
  include(0, 1, 3, 100);
  include(0, 2, 4, 200);
  include(0, 1, 3, 300);
  include(2, 0, 2, 400);
  include(3, 0, 1, 500);
  const result = sourceBuildCoverage(mapping, "/project", raw);
  t.like(result, { totalBytes: 10, remainingBytes: 5, convertedBytes: 5 });
  t.true(isSourceBuildCoverage(result));
  // Full retained block files, unused blocks and new output capacity do not affect conversion.
  mapping.assets = [];
  t.like(sourceBuildCoverage(mapping, "/project", raw), { remainingBytes: 0, convertedBytes: 10 });
});

test("coverage rejects missing or out-of-bounds original slices and inconsistent summaries", (t) => {
  const mapping = new AddressToLineMapping();
  mapping.registerDependencySnapshot("/project/raw/000000.bin", Uint8Array.of(1, 2));
  const asset = {
    fileIdx: 0,
    assetFileIdx: 0,
    line: 1,
    format: "raw",
    part: "bytes",
    address: 0,
    size: 1,
    transforms: [],
  };
  const raw = { directory: "raw", original: Uint8Array.of(1, 2), blockSize: 4 };
  mapping.assets.push(asset);
  t.throws(() => sourceBuildCoverage(mapping, "/project", raw), { message: /exact, bounded/ });
  mapping.assets = [{ ...asset, inputStart: 2, inputEnd: 3 }];
  t.throws(() => sourceBuildCoverage(mapping, "/project", raw), { message: /exact, bounded/ });
  t.throws(() => sourceBuildCoverage(mapping, "/project", { ...raw, blockSize: 0 }));
  t.false(
    isSourceBuildCoverage({
      romSha256: "a".repeat(64),
      totalBytes: 2,
      remainingBytes: 2,
      convertedBytes: 1,
    }),
  );
  t.false(
    isSourceBuildCoverage({
      romSha256: "a".repeat(64),
      totalBytes: NaN,
      remainingBytes: 0,
      convertedBytes: 0,
    }),
  );
});
