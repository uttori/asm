import fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { openAnalysisProjectStore } from "../project/project-store.js";
import {
  readResearchInputs,
  RESEARCH_INPUT_LIMIT_NAMES,
  type ResearchInputLimits,
  type ResearchSnapshot,
} from "../research-inputs/inputs.js";
import { sourceFilePublicationEpoch } from "./file-transaction.js";
import { sourceContentHash } from "./generation.js";
import { assertSourcePath, sourceRepository, type SourceRepository } from "./git.js";

/** Check runtime shape without widening typed readonly arrays to any[]. */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/**
 * Narrow untrusted project JSON to a plain object.
 * @param value Parsed JSON value.
 * @returns True for non-null, non-array objects.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Narrow a limit value to a safe integer; sign is checked by the caller.
 * @param value Untrusted limit value.
 * @returns True for a number that is a safe integer.
 */
function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/** Portable project contract. Machine-specific input locations belong to ignored local settings. */
export interface SourceProjectConfiguration {
  /** Configuration format discriminator. */
  readonly format: "uttori-source-project";
  /** Configuration schema version. */
  readonly version: 1;
  /** Project identity of word characters, dots and hyphens; scopes research and generation inputs. */
  readonly id: string;
  /** Non-empty source target descriptor ID that owns build, generation and capture policy. */
  readonly target: string;
  /** Headerless original ROM identity; a modified ROM starts a separate evidence lineage. */
  readonly romSha256: string;
  /** Non-empty repository-relative source directories. */
  readonly sourceRoots: readonly string[];
  /** Non-empty repository-relative directories holding Git-tracked research declarations. */
  readonly researchRoots: readonly string[];
  /** Repository-relative build configuration file. */
  readonly buildConfig: string;
  /** Repository-relative layout file. */
  readonly layout: string;
  /** Repository-relative capture catalog file. */
  readonly captures: string;
  /** Shared resource policy. Capture/analysis values use target defaults; research ceilings are opt-in. */
  readonly limits?: ResearchInputLimits & {
    /** Optional byte ceiling per archive, including each graphics companion; omitted limits allow streamed inputs of any safely counted size. */
    readonly captureBytes?: number;
    /** Positive static-analysis work-item budget; omitted uses the target default. */
    readonly analysisWorkItems?: number;
    /** Non-negative static-analysis call depth; omitted uses the target default. */
    readonly analysisCallDepth?: number;
  };
}

/** Local locations may be absolute for private input bundles. They never enter generated history. */
export interface SourceProjectLocalInputs {
  /** Local settings format discriminator. */
  readonly format: "uttori-source-local";
  /** Local settings schema version. */
  readonly version: 1;
  /** Original ROM path; resolved against the repository root when read. */
  readonly rom: string;
  /** Analysis evidence project directory; resolved against the repository root when read. */
  readonly evidence: string;
}

/** Selected repository plus validated, branch-specific tracked configuration and research. */
export interface SourceProject {
  /** Git repository and worktree state directories that own this project. */
  readonly repository: SourceRepository;
  /** Validated `.uttori/project.json`. */
  readonly configuration: SourceProjectConfiguration;
  /** Content hash of the canonical JSON configuration. */
  readonly configurationSha256: string;
  /** Research declarations read from `researchRoots` under the configured limits. */
  readonly research: ResearchSnapshot;
}

/**
 * Validate configuration identity, portable paths and work limits.
 * @param value Parsed `.uttori/project.json`.
 * @throws Error when any field is missing, malformed or outside its allowed range.
 */
function assertSourceProjectConfiguration(
  value: unknown,
): asserts value is SourceProjectConfiguration {
  if (!isRecord(value)) {
    throw new Error("Invalid Git source project configuration.");
  }
  const id = value.id;
  const target = value.target;
  const romSha256 = value.romSha256;
  const sourceRoots = value.sourceRoots;
  const researchRoots = value.researchRoots;
  if (
    value.format !== "uttori-source-project" ||
    value.version !== 1 ||
    typeof id !== "string" ||
    !/^[\w.-]+$/.test(id) ||
    typeof target !== "string" ||
    target === "" ||
    typeof romSha256 !== "string" ||
    !/^[\da-f]{64}$/.test(romSha256) ||
    !isUnknownArray(sourceRoots) ||
    sourceRoots.length === 0 ||
    !isUnknownArray(researchRoots) ||
    researchRoots.length === 0
  ) {
    throw new Error("Invalid Git source project configuration.");
  }
  for (const name of [
    ...sourceRoots,
    ...researchRoots,
    value.buildConfig,
    value.layout,
    value.captures,
  ]) {
    if (typeof name !== "string") {
      throw new Error("Source project paths must be strings.");
    }
    assertSourcePath(name);
  }
  if (value.limits !== undefined) {
    if (!isRecord(value.limits)) {
      throw new Error("Source work limits must be an object.");
    }
    for (const [name, limit] of Object.entries(value.limits)) {
      if (
        (name !== "captureBytes" &&
          name !== "analysisWorkItems" &&
          name !== "analysisCallDepth" &&
          !RESEARCH_INPUT_LIMIT_NAMES.some((field) => field === name)) ||
        !(isSafeInteger(limit) && limit >= (name === "analysisCallDepth" ? 0 : 1))
      ) {
        throw new Error(
          `Invalid source work limit limits.${name} in .uttori/project.json. Use a positive safe integer; analysisCallDepth also accepts zero. Supported fields: captureBytes, analysisWorkItems, analysisCallDepth, ${RESEARCH_INPUT_LIMIT_NAMES.join(", ")}.`,
        );
      }
    }
  }
}

/** Validate portable paths and identity before running any project-specific tool. */
export function parseSourceProject(value: unknown): SourceProjectConfiguration {
  assertSourceProjectConfiguration(value);
  return value;
}

/** Discover only the selected repository's project; nested repositories cannot inherit a parent's identity. */
export async function openSourceProject(directory: string): Promise<SourceProject> {
  const repository = await sourceRepository(directory);
  sourceFilePublicationEpoch(repository);
  const configuration = parseSourceProject(
    JSON.parse(fs.readFileSync(path.join(repository.root, ".uttori/project.json"), "utf8")),
  );
  const research = readResearchInputs(
    repository.root,
    configuration.researchRoots,
    { project: configuration.id, romSha256: configuration.romSha256 },
    undefined,
    configuration.limits,
  );
  return {
    repository,
    configuration,
    research,
    configurationSha256: sourceContentHash(canonicalJson(configuration)),
  };
}

/** Resolve private input locations without accepting them as tracked source configuration. */
export function sourceProjectLocalInputs(project: SourceProject): SourceProjectLocalInputs {
  return readSourceProjectLocalInputs(project.repository.root);
}

/**
 * Validate local bindings before resolving their paths.
 * @param value Parsed `.uttori-local/project.json`.
 * @throws Error asking the user to configure the ROM and evidence paths when invalid.
 */
function assertSourceProjectLocalInputs(value: unknown): asserts value is SourceProjectLocalInputs {
  if (
    !isRecord(value) ||
    value.format !== "uttori-source-local" ||
    value.version !== 1 ||
    typeof value.rom !== "string" ||
    value.rom === "" ||
    typeof value.evidence !== "string" ||
    value.evidence === ""
  ) {
    throw new Error(
      "Configure the local ROM and evidence paths before running this source project.",
    );
  }
}

/** Read only the local bindings; research queries do not need to spawn Git or load the ROM. */
export function readSourceProjectLocalInputs(root: string): SourceProjectLocalInputs {
  const local: unknown = JSON.parse(
    fs.readFileSync(path.join(root, ".uttori-local/project.json"), "utf8"),
  );
  assertSourceProjectLocalInputs(local);
  return {
    ...local,
    rom: path.resolve(root, local.rom),
    evidence: path.resolve(root, local.evidence),
  };
}

/** Refresh the rebuildable metadata index before research queries, imports, or pure generation. */
export function synchronizeSourceResearch(project: SourceProject): boolean {
  const local = sourceProjectLocalInputs(project);
  const store = openAnalysisProjectStore(local.evidence);
  try {
    const changed = store.transaction(() => store.synchronizeResearchInputs(project.research));
    if (changed) {
      store.writePointer(local.evidence);
    }
    return changed;
  } finally {
    store.close();
  }
}
