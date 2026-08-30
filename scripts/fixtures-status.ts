import {
  EXTERNAL_FIXTURE_IDS,
  EXTERNAL_FIXTURES,
  LOCAL_ROM_DIR,
  SNES_ROM_FRAMEWORK,
} from "../fixtures/fixture-manifest.ts";
import {
  getAllFixtureStatuses,
  parseRequestedFixtures,
  type FixtureStatus,
} from "./external-fixtures.ts";

function submoduleLabel(status: FixtureStatus): string {
  if (status.issues.includes("uninitialized")) return "uninitialized";
  if (status.issues.includes("wrong-commit")) return "wrong-commit";
  return status.commit?.slice(0, 12) ?? "unknown";
}

function romLabel(status: FixtureStatus): string {
  const spec = EXTERNAL_FIXTURES[status.id];
  if (!spec.localRom) return "not-required";
  if (status.issues.includes("missing-rom")) return "missing";
  if (status.issues.includes("wrong-rom-hash")) return "wrong-hash";
  return "ok";
}

function main(): void {
  const requested = new Set(
    process.argv.includes("--all") ? [...EXTERNAL_FIXTURE_IDS] : parseRequestedFixtures(),
  );
  const statuses = getAllFixtureStatuses().filter((status) => requested.has(status.id));
  const rows = statuses.map((status) => {
    const spec = EXTERNAL_FIXTURES[status.id];
    return {
      fixture: status.id,
      submodule: submoduleLabel(status),
      rom: romLabel(status),
      dirty: status.issues.includes("dirty") ? "dirty" : "clean",
      assets: spec.extractedAssetSentinels.length > 0 ? "runtime" : "none",
      ready: status.ready ? "yes" : "no",
    };
  });
  console.log(`Local ROMs: ${LOCAL_ROM_DIR}`);
  console.log(
    `Framework: ${SNES_ROM_FRAMEWORK.submodulePath} V${SNES_ROM_FRAMEWORK.version} ${SNES_ROM_FRAMEWORK.commit}`,
  );
  console.table(rows);
  for (const status of statuses) {
    if (status.ready && status.issues.length === 0) continue;
    console.log(`\n[${status.id}] ${status.issues.join(", ") || "notes"}`);
    for (const detail of status.details) {
      console.log(`  ${detail}`);
    }
    if (!status.ready) {
      console.log(`  setup:\n${status.setupInstructions.replaceAll(/^/gm, "    ")}`);
    }
  }
  if (statuses.some((status) => !status.ready)) {
    process.exitCode = 1;
  }
}

main();
