import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import { parseMesenSidecarArguments } from "../src/sidecar.js";

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

import { testSidecarLifecycle } from "../../../tests/helpers/sidecar-lifecycle-contract.js";
import * as mesenBackendModule from "../src/mesen-backend.js";
import { MesenProcessHost } from "../src/mesen-process-host.js";
import * as mesenHostModule from "../src/mesen-process-host.js";

testSidecarLifecycle({
  runExport: "runMesenSidecar",
  imports: { "./mesen-process-host.js": mesenHostModule, "./mesen-backend.js": mesenBackendModule },
  host: MesenProcessHost.prototype,
  manifest: {
    schemaVersion: 1,
    emulator: "MesenCE",
    upstreamRevision: "a".repeat(40),
    patchSha256: "b".repeat(64),
    executableSha256: "c".repeat(64),
    romSha256: "d".repeat(64),
    platform: "darwin",
    architecture: "arm64",
    buildConfiguration: "fixture",
    resources: [],
  },
  executableOption: "--mesen",
  entryPoint: "packages/debug-sidecar-mesence/src/sidecar.ts",
});


test("selected build ROM hash is explicit, normalized and validated", (t) => {
  const args = ["--manifest", "manifest.json", "--mesen", "emulator", "--rom", "modified.sfc", "--runtime-dir", "runtime"];
  t.is(parseMesenSidecarArguments([...args, "--rom-sha256", "A".repeat(64)]).romSha256, "a".repeat(64));
  t.throws(() => parseMesenSidecarArguments([...args, "--rom-sha256", "not-a-hash"]), { message: /64-digit SHA-256/ });
  t.is(parseMesenSidecarArguments(args).romSha256, undefined);
});
