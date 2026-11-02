import fs from "node:fs/promises";
import path from "node:path";

import {
  isSourceBuildCoverage,
  parseSourceProject,
  type SourceBuildSummary,
} from "@uttori/asm-disassembler/source-project";

import { changedBuildInputs, type SavedBuildInput } from "../source/build-inputs.js";

/** Saved conversion totals can render before the separate dependency check finishes. */
export interface BuildCoverageSnapshot {
  readonly summary: SourceBuildSummary;
  /** Filesystem publication time, in milliseconds since the Unix epoch. */
  readonly builtAt: number;
}

/** Unknown means verification was unavailable, never an assertion that the source is current. */
export interface BuildCoverageFreshness {
  readonly status: "checking" | "current" | "stale" | "unknown";
  readonly reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Bound metadata reads independently of debug-map and runtime-history size. */
async function readJson(file: string, limit: number): Promise<unknown> {
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > limit) {
    throw new Error("Build metadata exceeds its size budget.");
  }
  return JSON.parse(await fs.readFile(file, "utf8"));
}

/** Read only the small summary and project identity; legacy builds require an explicit rebuild. */
export async function readBuildCoverage(root: string): Promise<BuildCoverageSnapshot | undefined> {
  const file = path.join(root, ".uttori-local/builds/summary.json");
  let value: unknown;
  try {
    value = await readJson(file, 4096);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.inputSha256 !== "string" ||
    !/^[\da-f]{64}$/.test(value.inputSha256) ||
    (value.coverage !== undefined && !isSourceBuildCoverage(value.coverage))
  ) {
    throw new Error("Invalid build coverage summary. Build Current Source to replace it.");
  }
  if (!value.coverage) {
    return undefined;
  }
  const project = parseSourceProject(
    await readJson(path.join(root, ".uttori/project.json"), 65536),
  );
  if (project.romSha256 !== value.coverage.romSha256) {
    throw new Error(
      "Coverage belongs to a different original ROM. Build Current Source to update it.",
    );
  }
  return {
    summary: { version: 1, inputSha256: value.inputSha256, coverage: value.coverage },
    builtAt: (await fs.stat(file)).mtimeMs,
  };
}

/**
 * Verify saved dependency bytes in the background, including configuration controls. Timestamps,
 * research imports and runtime history cannot stand in for the source consumed by this build.
 * No ROM, debug map, plugin or analysis database is opened by this check.
 */
export async function checkBuildCoverageFreshness(
  root: string,
  summary: SourceBuildSummary,
): Promise<BuildCoverageFreshness> {
  try {
    const file = path.join(root, ".uttori-local/builds/current.json");
    const receipt = await readJson(file, 16 * 1024 * 1024);
    if (!isRecord(receipt) || receipt.inputSha256 !== summary.inputSha256) {
      return { status: "stale", reason: "A different build is selected. Refresh coverage." };
    }
    const coverage = receipt.coverage;
    const expected = summary.coverage;
    if (
      !isSourceBuildCoverage(coverage) ||
      !expected ||
      coverage.romSha256 !== expected.romSha256 ||
      coverage.totalBytes !== expected.totalBytes ||
      coverage.remainingBytes !== expected.remainingBytes ||
      coverage.convertedBytes !== expected.convertedBytes ||
      !Array.isArray(receipt.inputs) ||
      receipt.inputs.length > 65536 ||
      !receipt.inputs.every(
        (input): input is SavedBuildInput =>
          isRecord(input) &&
          typeof input.path === "string" &&
          typeof input.sha256 === "string" &&
          /^[\da-f]{64}$/.test(input.sha256),
      ) ||
      !receipt.inputs.some((input) => input.path === ".uttori/project.json")
    ) {
      return {
        status: "unknown",
        reason: "Build Current Source to record complete saved-input identities.",
      };
    }
    const changed = await changedBuildInputs(root, receipt.inputs);
    if (changed.length) {
      return {
        status: "stale",
        reason: `Saved inputs changed: ${changed.slice(0, 5).join(", ")}. Build Current Source to update coverage.`,
      };
    }
    // Publication can finish while dependencies are being checked. Never certify the older summary.
    const current = await readJson(file, 16 * 1024 * 1024);
    if (!isRecord(current) || current.inputSha256 !== summary.inputSha256) {
      return {
        status: "stale",
        reason: "The build changed during verification. Refresh coverage.",
      };
    }
    return {
      status: "current",
      reason: "Saved source and assets match the last successful build.",
    };
  } catch (error) {
    return { status: "unknown", reason: `Could not verify saved inputs: ${String(error)}` };
  }
}
