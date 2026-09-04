import {
  DEBUG_BACKEND_CONFORMANCE_SCENARIOS,
  DEBUG_BACKEND_CONFORMANCE_VERSION,
  ReplayDebugBackend,
  runDebugBackendConformance,
} from "../src/index.js";
import { test } from "../../../tests/ava-helper.js";
import {
  conformanceAddress,
  debugConformanceFixture,
  debugConformanceScript,
} from "./fixtures/debug-conformance-fixture.js";

test("frozen conformance scenarios pass against the replay backend", async (t) => {
  const report = await runDebugBackendConformance({
    backend: "replay",
    createBackend: () => new ReplayDebugBackend(debugConformanceScript),
    fixture: debugConformanceFixture,
  });
  t.is(report.version, DEBUG_BACKEND_CONFORMANCE_VERSION);
  t.true(report.passed);
  t.deepEqual(
    report.scenarios.map(({ id, status }) => ({ id, status })),
    DEBUG_BACKEND_CONFORMANCE_SCENARIOS.map((id) => ({ id, status: "pass" })),
  );
});

test("conformance failures are deterministic and identify the scenario", async (t) => {
  const report = await runDebugBackendConformance({
    backend: "replay-bad-fixture",
    createBackend: () => new ReplayDebugBackend(debugConformanceScript),
    fixture: { ...debugConformanceFixture, steppedAddress: conformanceAddress(0x8080ff) },
  });
  t.false(report.passed);
  t.deepEqual(
    report.scenarios.filter(({ status }) => status === "fail"),
    [
      {
        id: "exact-instruction-step",
        status: "fail",
        error:
          "Stepped PC: expected snes.65816/snes.address-space/8080ff, received snes.65816/snes.address-space/808001.",
      },
    ],
  );
});
