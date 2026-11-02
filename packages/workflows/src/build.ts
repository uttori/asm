import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { crc32 } from "node:zlib";

import {
  Assembler,
  NodeAssemblySnapshotProvider,
  type AssemblyLinkRecipe,
  type AssemblyModuleOptions,
} from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  artifactHash,
  assertLinkRecipe,
  encodeLibrary,
  encodeObject,
  linkObjects,
} from "@uttori/asm-core/linker";
import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
import { publishLinkedBuild } from "@uttori/asm-disassembler/source-project";
import plugin65xx from "@uttori/asm-plugin-65xx";
import {
  discoverProjectConfigurationPath,
  loadProjectEnvironment,
  type LoadProjectEnvironmentOptions,
  type LoadedProjectEnvironment,
} from "@uttori/asm-plugin-loader-node";
import { isModuleRecipeSelection } from "@uttori/asm-plugin-loader-node/build-configuration";
import snesPlugin from "@uttori/asm-plugin-snes";

import {
  readAssemblyBuildManifest,
  readAssemblyBuildOperation,
  type AssemblyBuildOperation,
  type AssemblyBuildResult,
  type AssemblyLinkedResult,
} from "./build-contracts.js";
import { sourceToolchain } from "./source-host.js";
import { mergeModuleRecipes } from "./source-recipes.js";

export * from "./build-contracts.js";

/** Hosts own plugin composition and exact executable identities. No environment survives one operation. */
export interface AssemblyBuildHost {
  readonly loadEnvironment: (
    options: LoadProjectEnvironmentOptions,
  ) => Promise<LoadedProjectEnvironment>;
  readonly fingerprint: (plugins: readonly string[]) => { readonly sha256: string };
}

/** Compose built-ins at an executable boundary; configured plugins still use the ordinary API/version checks. */
export function createAssemblyBuildHost(
  plugins: Iterable<readonly [string, AssemblerPlugin]> = [],
): AssemblyBuildHost {
  const bundledPlugins = new Map<string, AssemblerPlugin>([
    ["@uttori/asm-plugin-snes", snesPlugin],
    ["@uttori/asm-plugin-65xx", plugin65xx],
    ...plugins,
  ]);
  return {
    loadEnvironment: (options) => loadProjectEnvironment({ ...options, bundledPlugins }),
    fingerprint: sourceToolchain,
  };
}
const defaultBuildHost = createAssemblyBuildHost();

/** Cancellation and live editor checks stay local instead of crossing IPC as callbacks. */
export interface AssemblyBuildControls {
  readonly signal?: AbortSignal;
  readonly onProgress?: (message: string) => void;
  /** Called after validation and before any artifact is selected. Reject if saved inputs/editor versions changed. */
  readonly beforePublish?: (paths: readonly string[]) => void | Promise<void>;
}

/** Reject large JSON before parsing; binary object/archive budgets are independently enforced by their readers. */
function readJson(files: NodeAssemblySnapshotProvider, file: string): unknown {
  if ((files.stat(file).size ?? Infinity) > 16 * 1024 * 1024) {
    throw new Error(`Build JSON exceeds 16 MiB: ${file}`);
  }
  return JSON.parse(files.readTextFile(file));
}

/** Snapshot configuration before plugin activation so asynchronous loading cannot accept mixed file versions. */
async function loadEnvironment(
  root: string,
  config: string | undefined,
  target: string | undefined,
  files: NodeAssemblySnapshotProvider,
  host: AssemblyBuildHost,
): Promise<LoadedProjectEnvironment> {
  const configFile = discoverProjectConfigurationPath(root, config);
  if (configFile) {
    files.readFile(configFile);
  }
  let plugin = "@uttori/asm-plugin-snes";
  if (target?.startsWith("65xx.")) {
    plugin = "@uttori/asm-plugin-65xx";
  }
  return host.loadEnvironment({
    cwd: root,
    ...(configFile ? { configFile } : {}),
    defaults: { plugins: [{ module: plugin }], target: target ?? "snes.sfc" },
    ...(target ? { overrides: { target } } : {}),
  });
}

/** One session per module shares a build-wide immutable input view across includes, assets and passes. */
function assembleObject(
  source: string,
  id: string,
  loaded: LoadedProjectEnvironment,
  files: NodeAssemblySnapshotProvider,
  signal?: AbortSignal,
  sourceAdapter?: AssemblyModuleOptions["sourceAdapter"],
  recipes?: AssemblyLinkRecipe[],
): Uint8Array {
  signal?.throwIfAborted();
  const assembler = new Assembler({
    environment: loaded.environment,
    target: loaded.target,
    architecture: loaded.architecture,
    targetOptions: loaded.targetOptions,
    fileProvider: files,
    module: { id, ...(sourceAdapter ? { sourceAdapter } : {}) },
  });
  try {
    assembler.setIncludePaths([...new Set([path.dirname(source), ...loaded.includePaths])]);
    assembler.assembleSource(files.readTextFile(source), source);
    signal?.throwIfAborted();
    const object = encodeObject(assembler.getAssemblyModule());
    if (recipes) {
      const recipe = assembler.getLinkRecipe();
      if (recipe) {
        recipes.push(recipe);
      }
    }
    return object;
  } finally {
    assembler.dispose();
  }
}

/** Object/archive writes are atomic single-file replacements; inputs can never be output destinations. */
function assertOutputIsNotInput(file: string, files: NodeAssemblySnapshotProvider): void {
  if (files.snapshots.has(file)) {
    throw new Error(`Build output would overwrite an input: ${file}`);
  }
  // Following symlinks and comparing inodes also protects inputs referenced through another output name.
  if (fs.existsSync(file)) {
    const destination = fs.statSync(file);
    for (const input of files.snapshots.keys()) {
      const source = fs.statSync(input);
      if (source.dev === destination.dev && source.ino === destination.ino) {
        throw new Error(`Build output aliases an input: ${file}`);
      }
    }
  }
}

/** Stage beside the destination so a failed write cannot leave a truncated object/archive. */
function publishArtifact(
  file: string,
  bytes: Uint8Array,
  files: NodeAssemblySnapshotProvider,
): void {
  assertOutputIsNotInput(file, files);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, bytes, { flag: "wx" });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

/** Check saved input identities again after any asynchronous editor-version authorization. */
async function readyToPublish(
  files: NodeAssemblySnapshotProvider,
  controls: AssemblyBuildControls,
): Promise<void> {
  controls.signal?.throwIfAborted();
  files.assertUnchanged();
  await controls.beforePublish?.([...files.snapshots.keys()]);
  controls.signal?.throwIfAborted();
  files.assertUnchanged();
}

/**
 * Execute explicit object/library/link/composed operations for CLI and editor workers. Link reads only
 * serialized inputs; build-linked additionally assembles ordered modules. Nothing publishes on a failed check.
 */
export async function executeAssemblyBuildOperation(
  value: AssemblyBuildOperation,
  controls: AssemblyBuildControls = {},
  host: AssemblyBuildHost = defaultBuildHost,
): Promise<AssemblyBuildResult> {
  const operation = readAssemblyBuildOperation(value);
  controls.signal?.throwIfAborted();
  const root = path.resolve(operation.directory);
  const files = new NodeAssemblySnapshotProvider();
  if (operation.action === "library") {
    controls.onProgress?.("Indexing serialized library members.");
    const bytes = encodeLibrary(
      operation.objects.map((name) => ({
        name: path.basename(name),
        object: files.readFile(path.resolve(root, name)),
      })),
    );
    await readyToPublish(files, controls);
    const outputFile = path.resolve(root, operation.output);
    publishArtifact(outputFile, bytes, files);
    return { kind: "library", outputFile, sha256: artifactHash(bytes), bytes: bytes.length };
  }
  if (operation.action === "assemble-object") {
    const loaded = await loadEnvironment(root, operation.config, undefined, files, host);
    let bytes: Uint8Array;
    const recipes: AssemblyLinkRecipe[] = [];
    try {
      controls.onProgress?.(`Assembling module ${operation.module}.`);
      bytes = assembleObject(
        path.resolve(root, operation.source),
        operation.module,
        loaded,
        files,
        controls.signal,
        operation.sourceAdapter,
        recipes,
      );
    } finally {
      await loaded.dispose();
    }
    await readyToPublish(files, controls);
    const outputFile = path.resolve(root, operation.output);
    publishArtifact(outputFile, bytes, files);
    return {
      kind: "object",
      outputFile,
      sha256: artifactHash(bytes),
      bytes: bytes.length,
      ...(recipes[0] ? { linkRecipe: recipes[0] } : {}),
    };
  }
  return buildLinked(operation, root, files, controls, host);
}

/** All validation/disposal finishes before selecting an immutable linked artifact set. */
async function buildLinked(
  operation: Extract<AssemblyBuildOperation, { action: "link" | "build-linked" }>,
  directory: string,
  files: NodeAssemblySnapshotProvider,
  controls: AssemblyBuildControls,
  host: AssemblyBuildHost,
): Promise<AssemblyLinkedResult> {
  if (operation.selection) {
    const bytes = files.readFile(path.resolve(directory, operation.selection.file));
    if (artifactHash(bytes) !== operation.selection.sha256) {
      throw new Error("Build selection configuration changed. Rebuild with the current manifest.");
    }
  }
  const manifestFile = path.resolve(directory, operation.manifest);
  const root = path.dirname(manifestFile);
  const manifest = readAssemblyBuildManifest(readJson(files, manifestFile));
  if (operation.action === "link" && manifest.modules?.length) {
    throw new Error(
      "Link accepts serialized objects/libraries only. Use build for source modules.",
    );
  }
  const recipeValue =
    typeof manifest.recipe === "string"
      ? readJson(files, path.resolve(root, manifest.recipe))
      : manifest.recipe;
  // Reject malformed layout policy before activating any configured plugin.
  const fromModules = isModuleRecipeSelection(recipeValue);
  let recipe: AssemblyLinkRecipe | undefined;
  if (!isModuleRecipeSelection(recipeValue)) {
    assertLinkRecipe(recipeValue);
    recipe = recipeValue;
  }
  const recipeTarget = recipeValue.target;
  const serialized = (manifest.objects ?? []).map((name) =>
    files.readFile(path.resolve(root, name)),
  );
  const objects: Uint8Array[] = [];
  const libraries = (manifest.libraries ?? []).map((name) =>
    files.readFile(path.resolve(root, name)),
  );
  const original = manifest.original
    ? files.readFile(path.resolve(root, manifest.original))
    : undefined;
  const loaded = await loadEnvironment(root, manifest.config, recipeTarget, files, host);
  let result: ReturnType<typeof linkObjects>;
  let outputName: string;
  try {
    const target = loaded.environment.getTarget(loaded.target)!;
    if (!target.createLinkTarget) {
      throw new Error(
        `Target '${loaded.target}' does not provide a link policy. Update its plugin to support linking.`,
      );
    }
    const policy = target.createLinkTarget();
    if (policy.target !== recipeTarget) {
      throw new Error("Plugin link policy does not match the recipe target.");
    }
    const recipes: AssemblyLinkRecipe[] = [];
    for (const module of manifest.modules ?? []) {
      controls.onProgress?.(`Assembling module ${module.id}.`);
      objects.push(
        assembleObject(
          path.resolve(root, module.source),
          module.id,
          loaded,
          files,
          controls.signal,
          module.sourceAdapter,
          fromModules ? recipes : undefined,
        ),
      );
    }
    objects.push(...serialized);
    if (fromModules) {
      if (recipes.length !== manifest.modules?.length) {
        throw new Error("Every module must provide layout for a module-derived recipe.");
      }
      recipe = mergeModuleRecipes(recipes);
    }
    if (!recipe) {
      throw new Error("Link recipe was not resolved.");
    }
    const toolchain = host.fingerprint(
      loaded.configuration.plugins
        .filter((plugin) => !plugin.bundled)
        .map((plugin) => plugin.resolvedModule),
    );
    controls.onProgress?.("Resolving libraries, placing sections and applying relocations.");
    result = linkObjects({
      objects,
      libraries,
      recipe,
      target: policy,
      toolchainSha256: toolchain.sha256,
      signal: controls.signal,
    });
    outputName = manifest.outputName ?? `program${target.defaultOutputExtension}`;
  } finally {
    await loaded.dispose();
  }
  if (original && !Buffer.from(original).equals(result.output)) {
    throw new Error("Linked ROM differs from the original container; no artifacts were published.");
  }
  if (result.output.length === 0) {
    throw new Error("Linked ROM is empty; no artifacts were published.");
  }
  const inputs = [...files.snapshots]
    .map(([file, bytes]) => ({ path: file, sha256: artifactHash(bytes) }))
    .toSorted((a, b) => (a.path < b.path ? -1 : Number(a.path > b.path)));
  // Host graph/configuration changes invalidate the selected build even if emitted bytes happen to agree.
  const sources = [...result.debugMap.sources];
  const knownSources = new Set(sources.map((source) => path.resolve(source.path)));
  for (const [file, bytes] of files.snapshots) {
    if (!knownSources.has(file)) {
      sources.push({
        id: sources.length,
        path: file,
        size: bytes.length,
        crc32: crc32(bytes),
        sha256: artifactHash(bytes),
        kind: "resource",
      });
      knownSources.add(file);
    }
  }
  // Final-address editor information expires when the build graph, recipe or serialized inputs
  // change, just as it does for an included source or asset. Existing source IDs remain stable.
  const { fingerprint: _fingerprint, ...mapPayload } = result.debugMap;
  const payload = { ...mapPayload, sources };
  result = {
    ...result,
    debugMap: {
      ...payload,
      fingerprint: { algorithm: "sha256", value: artifactHash(canonicalJson(payload)) },
    },
    inputSha256: artifactHash(canonicalJson({ link: result.inputSha256, inputs })),
    dependencies: [
      ...result.dependencies,
      ...inputs.map((input) => ({ module: "<build>", ...input })),
    ],
  };
  const outputDirectory = path.resolve(root, manifest.outputDirectory ?? ".uttori-build");
  for (const name of ["current.json", "link-publication.lock"]) {
    assertOutputIsNotInput(path.join(outputDirectory, name), files);
  }
  let previous: unknown;
  try {
    const pointer = path.join(outputDirectory, "current.json");
    if (fs.statSync(pointer).size <= 1024 * 1024) {
      previous = JSON.parse(fs.readFileSync(pointer, "utf8"));
    }
  } catch {
    // The pointer is advisory for change reporting; publication validates any retained artifact set.
  }
  await readyToPublish(files, controls);
  const receipt = publishLinkedBuild(result, outputDirectory, outputName, controls.signal, recipe);
  const priorHashes =
    typeof previous === "object" && previous !== null && "hashes" in previous
      ? previous.hashes
      : undefined;
  const hashes = isRecord(priorHashes) ? priorHashes : {};
  return {
    kind: "linked",
    ...receipt,
    target: recipeTarget,
    architecture: loaded.architecture,
    outputSha256: result.debugMap.output.sha256,
    debugMapFingerprint: result.debugMap.fingerprint.value,
    outputSize: result.output.length,
    inputs,
    outputChanged: hashes[outputName] !== result.debugMap.output.sha256,
    debugMapChanged:
      hashes[`${outputName}.debug.json`] !== receipt.hashes[`${outputName}.debug.json`],
  };
}

/** Advisory prior receipts may be absent or malformed; only string-keyed objects can expose hashes. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
