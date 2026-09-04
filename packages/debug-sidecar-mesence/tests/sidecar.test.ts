import path from "node:path";

import { parseMesenSidecarArguments } from "../src/sidecar.js";
import { test } from "../../../tests/ava-helper.js";

test("Mesen sidecar parser resolves one complete explicit launch configuration", (t) => {
  t.deepEqual(
    parseMesenSidecarArguments([
      "--manifest",
      "manifest.json",
      "--mesen",
      "runtime/Mesen",
      "--rom",
      "game.sfc",
      "--runtime-dir",
      "runtime",
    ]),
    {
      manifest: path.resolve("manifest.json"),
      executable: path.resolve("runtime/Mesen"),
      rom: path.resolve("game.sfc"),
      runtimeDirectory: path.resolve("runtime"),
    },
  );
});

test("Mesen sidecar parser rejects unknown, duplicate, and incomplete options", (t) => {
  t.throws(() => parseMesenSidecarArguments(["--unknown"]), { message: /Unknown/ });
  t.throws(() => parseMesenSidecarArguments(["--rom", "one", "--rom", "two"]), {
    message: /Duplicate/,
  });
  t.throws(() => parseMesenSidecarArguments(["--manifest"]), { message: /requires a value/ });
  t.throws(() => parseMesenSidecarArguments([]), { message: /--manifest/ });
});
