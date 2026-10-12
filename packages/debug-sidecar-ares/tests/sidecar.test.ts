import path from "node:path";

import test from "ava";

import { AresProcessHost, parseAresRuntimeManifest } from "../src/ares-process-host.js";
import { parseAresSidecarArguments } from "../src/sidecar.js";
import { aresLiveManifest } from "./fixtures/ares-live-manifest.js";

test("ares sidecar arguments are strict, path-resolved, and shell-independent", (t) => {
  const parsed = parseAresSidecarArguments([
    "--manifest",
    "manifest.json",
    "--ares",
    "bin/ares-headless",
    "--rom",
    "game.sfc",
    "--runtime-dir",
    "runtime",
    "--save-dir",
    "project saves",
    "--system",
    "Super Famicom",
    "--no-fast-boot",
  ]);
  t.deepEqual(parsed, {
    manifest: path.resolve("manifest.json"),
    executable: path.resolve("bin/ares-headless"),
    rom: path.resolve("game.sfc"),
    runtimeDirectory: path.resolve("runtime"),
    saveDirectory: path.resolve("project saves"),
    system: "Super Famicom",
    fastBoot: false,
  });
  t.throws(() => parseAresSidecarArguments(["--unknown"]), { message: /Unknown/ });
  t.throws(() => parseAresSidecarArguments(["--manifest", "one", "--manifest", "two"]), {
    message: /Duplicate/,
  });
  t.throws(() => parseAresSidecarArguments([]), { message: /--manifest/ });
  t.throws(() => parseAresSidecarArguments(["--manifest", "--rom"]), {
    message: /requires a value/,
  });
  const defaults = parseAresSidecarArguments([
    "--manifest",
    "manifest.json",
    "--ares",
    "ares",
    "--rom",
    "rom",
    "--runtime-dir",
    "runtime",
  ]);
  t.true(defaults.fastBoot);
  t.false("system" in defaults);
});

test("ares runtime manifest parser normalizes, freezes, and rejects untrusted shapes", (t) => {
  const parsed = parseAresRuntimeManifest({
    ...aresLiveManifest,
    patchSha256: aresLiveManifest.patchSha256.toUpperCase(),
    resources: aresLiveManifest.resources.map((resource) => ({ ...resource })),
  });
  t.is(parsed.patchSha256, aresLiveManifest.patchSha256);
  t.true(Object.isFrozen(parsed));
  t.true(Object.isFrozen(parsed.resources));
  t.true(Object.isFrozen(parsed.resources[0]));
  t.throws(() => parseAresRuntimeManifest({ ...aresLiveManifest, resources: "invalid" }), {
    message: /resources must be an array/,
  });
  t.throws(
    () =>
      parseAresRuntimeManifest({
        ...aresLiveManifest,
        resources: [{ path: "Database\\native-only.bml", sha256: "a".repeat(64) }],
      }),
    { message: /normalized and relative/ },
  );
  t.throws(() => parseAresRuntimeManifest(null), { message: /must be an object/ });
  t.throws(() => parseAresRuntimeManifest([]), { message: /must be an object/ });
  t.throws(() => parseAresRuntimeManifest({ ...aresLiveManifest, schemaVersion: 2 }), {
    message: /Unsupported/,
  });
  t.throws(() => parseAresRuntimeManifest({ ...aresLiveManifest, emulator: "other" }), {
    message: /not for ares/,
  });
  t.throws(
    () =>
      parseAresRuntimeManifest({
        ...aresLiveManifest,
        resources: [aresLiveManifest.resources[0], aresLiveManifest.resources[0]],
      }),
    { message: /duplicate resource/ },
  );
  t.throws(() => parseAresRuntimeManifest({ ...aresLiveManifest, platform: 42 }), {
    message: /platform must be a non-empty string/,
  });
  t.throws(() => parseAresRuntimeManifest({ ...aresLiveManifest, upstreamRevision: "bad" }), {
    message: /40-digit git revision/,
  });
  t.throws(() => parseAresRuntimeManifest({ ...aresLiveManifest, forkRevision: "bad" }), {
    message: /40-digit git revision/,
  });
  t.throws(() => parseAresRuntimeManifest({ ...aresLiveManifest, headlessPatchSha256: "bad" }), {
    message: /64-digit SHA-256/,
  });
  t.throws(() => parseAresRuntimeManifest({ ...aresLiveManifest, patchSha256: "bad" }), {
    message: /64-digit SHA-256/,
  });
  t.throws(() => parseAresRuntimeManifest({ ...aresLiveManifest, buildConfiguration: "" }), {
    message: /build configuration must be a non-empty string/,
  });
  t.throws(() => parseAresRuntimeManifest({ ...aresLiveManifest, resources: [null] }), {
    message: /must be an object/,
  });
  t.throws(
    () =>
      parseAresRuntimeManifest({
        ...aresLiveManifest,
        resources: [{ path: "/absolute.bml", sha256: "a".repeat(64) }],
      }),
    { message: /normalized and relative/ },
  );
  t.throws(
    () =>
      parseAresRuntimeManifest({
        ...aresLiveManifest,
        resources: [{ path: ".", sha256: "a".repeat(64) }],
      }),
    { message: /normalized and relative/ },
  );
  t.throws(
    () =>
      parseAresRuntimeManifest({
        ...aresLiveManifest,
        resources: [{ path: "Database//duplicate-separator.bml", sha256: "a".repeat(64) }],
      }),
    { message: /normalized and relative/ },
  );
});

import { testSidecarLifecycle } from "../../../tests/helpers/sidecar-lifecycle-contract.js";
import * as aresHostModule from "../src/ares-process-host.js";
import * as aresBackendModule from "../src/ares-rsp-backend.js";

testSidecarLifecycle({
  runExport: "runAresSidecar",
  imports: { "./ares-process-host.js": aresHostModule, "./ares-rsp-backend.js": aresBackendModule },
  host: AresProcessHost.prototype,
  manifest: aresLiveManifest,
  executableOption: "--ares",
  entryPoint: "packages/debug-sidecar-ares/src/sidecar.ts",
});

test("selected build ROM hash is explicit, normalized and validated", (t) => {
  const args = [
    "--manifest",
    "manifest.json",
    "--ares",
    "emulator",
    "--rom",
    "modified.sfc",
    "--runtime-dir",
    "runtime",
  ];
  t.is(
    parseAresSidecarArguments([...args, "--rom-sha256", "A".repeat(64)]).romSha256,
    "a".repeat(64),
  );
  t.throws(() => parseAresSidecarArguments([...args, "--rom-sha256", "not-a-hash"]), {
    message: /64-digit SHA-256/,
  });
  t.is(parseAresSidecarArguments(args).romSha256, undefined);
});
