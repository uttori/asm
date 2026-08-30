import { spawnSync } from "node:child_process";
import {
  assertParentWorktreeClean,
  assertSubmodulesClean,
  getFixtureStatus,
  parseRequestedFixtures,
  PROJECT_ROOT,
} from "./external-fixtures.ts";

function main(): void {
  const requested = parseRequestedFixtures();
  const failures: string[] = [];
  for (const id of requested) {
    const status = getFixtureStatus(id);
    if (!status.ready || status.issues.includes("dirty")) {
      failures.push(
        `${id}: ${status.issues.join(", ") || "not ready"}\n${status.details.join("\n")}\n${status.setupInstructions}`,
      );
    }
  }
  if (failures.length > 0) {
    throw new Error(`Strict preflight failed:\n\n${failures.join("\n\n")}`);
  }

  const env = { ...process.env, UTTORI_EXTERNAL_FIXTURES: requested.join(",") };
  const result = spawnSync("npm", ["run", "test:external"], {
    cwd: PROJECT_ROOT,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  assertSubmodulesClean();
  assertParentWorktreeClean();
  console.log("ci:external: requested fixtures passed and worktrees are clean.");
}

main();
