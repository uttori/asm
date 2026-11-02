import fs from "node:fs";
import path from "node:path";

import type { AssemblyLinkRecipe } from "@uttori/asm-core";
import { assertLinkRecipe } from "@uttori/asm-core/linker";

import { discoverProjectConfigurationPath } from "./configuration.js";

/** Resolve existing target/source layout after module production instead of duplicating it in the host manifest. */
export interface ModuleRecipeSelection {
  /** Discriminator selecting a recipe derived from the manifest's source modules. */
  readonly from: "modules";
  /** Target ID whose layout derives the recipe. */
  readonly target: string;
}

/** Recognize the exact data-only selector before activating plugins or interpreting portable recipe fields. */
export function isModuleRecipeSelection(value: unknown): value is ModuleRecipeSelection {
  return (
    isRecord(value) &&
    value.from === "modules" &&
    isText(value.target) &&
    Object.keys(value).every((key) => key === "from" || key === "target")
  );
}

/** Explicit opt-in build graph. All paths are relative to the manifest, including configuration and output. */
export interface AssemblyBuildManifest {
  /** Format discriminator; any other value is rejected. */
  readonly format: "uttori-build";
  /** Manifest schema version; only 1 is accepted. */
  readonly version: 1;
  /** Optional plugin configuration; absent configuration uses the selected target's bundled defaults. */
  readonly config?: string;
  /** Ordered independently assembled contributions. IDs must remain stable across builds. */
  readonly modules?: readonly {
    readonly id: string;
    readonly source: string;
    readonly sourceAdapter?: "asar" | "ca65";
  }[];
  /** Prebuilt serialized object files linked with the assembled modules. */
  readonly objects?: readonly string[];
  /** Library files passed to the linker. */
  readonly libraries?: readonly string[];
  /** Portable recipe, config-derived module layout, or a recipe JSON path relative to this manifest. */
  readonly recipe: AssemblyLinkRecipe | ModuleRecipeSelection | string;
  /** Immutable artifact sets and current.json live here; defaults to .uttori-build. */
  readonly outputDirectory?: string;
  /** Plain filename; defaults to program plus the target's output extension. */
  readonly outputName?: string;
  /** Optional complete original container for exactness verification before publication. */
  readonly original?: string;
}

/** Accepts a plain JSON object; arrays and null are rejected. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** Accepts a non-blank string without NUL bytes, usable as a path or identifier. */
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && !value.includes("\0");
/** Accepts at most 65536 path strings that each satisfy isText. */
const isPaths = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.length <= 65536 && value.every(isText);

/** Validate the host graph before loading plugins. The linker independently validates every recipe field. */
function assertBuildManifest(value: unknown): asserts value is AssemblyBuildManifest {
  if (!isRecord(value) || value.format !== "uttori-build" || value.version !== 1) {
    throw new Error("Build manifest requires format uttori-build and version 1.");
  }
  const allowed = new Set([
    "$schema",
    "format",
    "version",
    "config",
    "modules",
    "objects",
    "libraries",
    "recipe",
    "outputDirectory",
    "outputName",
    "original",
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown build manifest field '${key}'.`);
    }
  }
  for (const key of ["$schema", "config", "outputDirectory", "outputName", "original"]) {
    if (value[key] !== undefined && !isText(value[key])) {
      throw new Error(`Build ${key} must be a nonempty path or name.`);
    }
  }
  for (const key of ["objects", "libraries"]) {
    if (value[key] !== undefined && !isPaths(value[key])) {
      throw new Error(`Build ${key} must be an array of paths.`);
    }
  }
  if (
    typeof value.outputName === "string" &&
    (!/^[\w.-]+$/.test(value.outputName) || [".", "..", "build.json"].includes(value.outputName))
  ) {
    throw new Error("Build outputName must be a plain filename other than build.json.");
  }
  if (value.modules !== undefined) {
    if (!Array.isArray(value.modules) || value.modules.length > 65536) {
      throw new Error("Build modules must be an array.");
    }
    const ids = new Set<string>();
    for (const entry of value.modules as unknown[]) {
      if (
        !isRecord(entry) ||
        !isText(entry.id) ||
        !isText(entry.source) ||
        Object.keys(entry).some((key) => !["id", "source", "sourceAdapter"].includes(key)) ||
        (entry.sourceAdapter !== undefined &&
          entry.sourceAdapter !== "asar" &&
          entry.sourceAdapter !== "ca65")
      ) {
        throw new Error(
          "Each build module requires id, source and an optional supported sourceAdapter.",
        );
      }
      if (ids.has(entry.id)) {
        throw new Error(`Duplicate build module '${entry.id}'.`);
      }
      ids.add(entry.id);
    }
  }
  if (!isText(value.recipe) && !isRecord(value.recipe)) {
    throw new Error("Build recipe must be a portable recipe object or JSON path.");
  }
  if (typeof value.recipe !== "string") {
    if (isModuleRecipeSelection(value.recipe)) {
      if (!Array.isArray(value.modules) || !value.modules.length) {
        throw new Error("A module-derived recipe requires source modules.");
      }
    } else {
      assertLinkRecipe(value.recipe);
    }
  }
}

/** Return an owned host graph; external recipe files are validated after their snapshot is read. */
export function readAssemblyBuildManifest(value: unknown): AssemblyBuildManifest {
  assertBuildManifest(value);
  return structuredClone(value);
}

/** Data-only projection shared by module-aware indexing hosts; no plugin activation or assembly occurs. */
export function readAssemblyBuildConfiguration(manifestFile: string): {
  readonly directory: string;
  readonly configFile?: string;
  readonly target: string;
  readonly moduleRoots: Readonly<Record<string, import("@uttori/asm-core").AssemblyModuleOptions>>;
  readonly inputs: readonly string[];
} {
  const file = path.resolve(manifestFile);
  const directory = path.dirname(file);
  const manifest = readAssemblyBuildManifest(readBuildJson(file));
  const recipeFile =
    typeof manifest.recipe === "string" ? path.resolve(directory, manifest.recipe) : undefined;
  const recipe: unknown = recipeFile ? readBuildJson(recipeFile) : manifest.recipe;
  if (!isModuleRecipeSelection(recipe)) {
    assertLinkRecipe(recipe);
  }
  const configFile = discoverProjectConfigurationPath(directory, manifest.config);
  const moduleRoots: Record<string, import("@uttori/asm-core").AssemblyModuleOptions> = {};
  for (const module of manifest.modules ?? []) {
    const source = path.resolve(directory, module.source);
    // Repeated source with distinct module IDs has the same syntax/configuration; one root
    // analysis is sufficient, while the build driver still assembles every contribution.
    moduleRoots[source] ??= {
      id: module.id,
      ...(module.sourceAdapter ? { sourceAdapter: module.sourceAdapter } : {}),
    };
  }
  return {
    directory,
    configFile,
    target: recipe.target,
    moduleRoots,
    inputs: [file, ...(recipeFile ? [recipeFile] : []), ...(configFile ? [configFile] : [])],
  };
}

/** Bound data-only metadata before parsing, including a file that grows between stat and read. */
function readBuildJson(input: string): unknown {
  if (fs.statSync(input).size > 16 * 1024 * 1024) {
    throw new Error(`Build JSON exceeds 16 MiB: ${input}`);
  }
  const bytes = fs.readFileSync(input);
  if (bytes.length > 16 * 1024 * 1024) {
    throw new Error(`Build JSON exceeds 16 MiB: ${input}`);
  }
  return JSON.parse(bytes.toString("utf8"));
}
