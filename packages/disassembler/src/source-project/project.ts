import fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { openAnalysisProjectStore } from "../project/project-store.js";
import { readResearchInputs, type ResearchSnapshot } from "../research-inputs/inputs.js";
import { sourceContentHash } from "./generation.js";
import { assertSourcePath, sourceRepository, type SourceRepository } from "./git.js";

/** Check runtime shape without widening typed readonly arrays to any[]. */
const isArray = (value: unknown): boolean => Array.isArray(value);

/** Portable project contract. Machine-specific input locations belong to ignored local settings. */
export interface SourceProjectConfiguration {
  readonly format: "uttori-source-project";
  readonly version: 1;
  readonly id: string;
  readonly target: string;
  /** Headerless original ROM identity; a modified ROM starts a separate evidence lineage. */
  readonly romSha256: string;
  readonly sourceRoots: readonly string[];
  readonly researchRoots: readonly string[];
  readonly buildConfig: string;
  readonly layout: string;
  readonly captures: string;
  /** Explicit work budgets shared by headless commands and editor workers; omitted values use target defaults. */
  readonly limits?: {
    readonly captureBytes?: number;
    readonly analysisWorkItems?: number;
    readonly analysisCallDepth?: number;
  };
}

/** Local locations may be absolute for private input bundles. They never enter generated history. */
export interface SourceProjectLocalInputs {
  readonly format: "uttori-source-local";
  readonly version: 1;
  readonly rom: string;
  readonly evidence: string;
}

/** Selected repository plus validated, branch-specific tracked configuration and research. */
export interface SourceProject {
  readonly repository: SourceRepository;
  readonly configuration: SourceProjectConfiguration;
  readonly configurationSha256: string;
  readonly research: ResearchSnapshot;
}

/** Validate portable paths and identity before running any project-specific tool. */
export function parseSourceProject(value: unknown): SourceProjectConfiguration {
  const config = value as SourceProjectConfiguration;
  if (
    !config ||
    config.format !== "uttori-source-project" ||
    config.version !== 1 ||
    typeof config.id !== "string" ||
    !/^[\w.-]+$/.test(config.id) ||
    typeof config.target !== "string" ||
    !config.target ||
    typeof config.romSha256 !== "string" ||
    !/^[\da-f]{64}$/.test(config.romSha256) ||
    !isArray(config.sourceRoots) ||
    !config.sourceRoots.length ||
    !isArray(config.researchRoots) ||
    !config.researchRoots.length
  ) {
    throw new Error("Invalid Git source project configuration.");
  }
  for (const name of [
    ...config.sourceRoots,
    ...config.researchRoots,
    config.buildConfig,
    config.layout,
    config.captures,
  ]) {
    if (typeof name !== "string") {
      throw new Error("Source project paths must be strings.");
    }
    assertSourcePath(name);
  }
  if (config.limits !== undefined) {
    if (!config.limits || typeof config.limits !== "object" || Array.isArray(config.limits)) {
      throw new Error("Source work limits must be an object.");
    }
    for (const [name, limit] of Object.entries(config.limits)) {
      if (
        !["captureBytes", "analysisWorkItems", "analysisCallDepth"].includes(name) ||
        !Number.isSafeInteger(limit) ||
        limit < (name === "analysisCallDepth" ? 0 : 1)
      ) {
        throw new Error(
          `Invalid source work limit: ${name}. Use an integer within the supported range.`,
        );
      }
    }
  }
  return config;
}

/** Discover only the selected repository's project; nested repositories cannot inherit a parent's identity. */
export async function openSourceProject(directory: string): Promise<SourceProject> {
  const repository = await sourceRepository(directory);
  const configuration = parseSourceProject(
    JSON.parse(fs.readFileSync(path.join(repository.root, ".uttori/project.json"), "utf8")),
  );
  const research = readResearchInputs(repository.root, configuration.researchRoots, {
    project: configuration.id,
    romSha256: configuration.romSha256,
  });
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

/** Read only the local bindings; research queries do not need to spawn Git or load the ROM. */
export function readSourceProjectLocalInputs(root: string): SourceProjectLocalInputs {
  const local = JSON.parse(
    fs.readFileSync(path.join(root, ".uttori-local/project.json"), "utf8"),
  ) as SourceProjectLocalInputs;
  if (
    !local ||
    local.format !== "uttori-source-local" ||
    local.version !== 1 ||
    typeof local.rom !== "string" ||
    !local.rom ||
    typeof local.evidence !== "string" ||
    !local.evidence
  ) {
    throw new Error(
      "Configure the local ROM and evidence paths before running this source project.",
    );
  }
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
