import { SourceOperationError, type SourceResultMap } from "./source-results.js";
export {
  SourceOperationError,
  type SourceFailureCode,
  type SourceResultMap,
} from "./source-results.js";
import { readSourceOperation, type SourceOperation, type SourceAction } from "./source-requests.js";
export {
  readSourceOperation,
  type SourceOperation,
  type SourceAction,
  type SourceRequestMap,
} from "./source-requests.js";
import { builtinSourceTargets } from "./source-builtins.js";
import { defaultSourceHost, type SourceWorkflowHost } from "./source-host.js";
export { createSourceWorkflowHost, type SourceWorkflowHost } from "./source-host.js";
export type { SourceTargetDescriptor } from "./source-target.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  openAnalysisProjectStore,
  readResearchInputs,
  openRuntimeCaptureSource,
  importRuntimeTraceSourceIntoProject,
  importRuntimeBusTraceSourceIntoProject,
  pendingCaptureImportNotes,
  completeCaptureImportNotes,
  writeCaptureImportNotes,
} from "@uttori/asm-disassembler";
import {
  type SourceGenerationOptions,
  openSourceProject,
  sourceProjectLocalInputs,
  synchronizeSourceResearch,
  sourceContentHash,
  pinSourceCandidate,
  prepareSourceGeneration,
  acceptedSourceGeneration,
  verifySourceGeneration,
  sourceGit,
  sourceStatus,
  sourceMergeStatus,
  previewSourceGeneration,
  applySourceGeneration,
  finishSourceGeneration,
  abortSourceGeneration,
  discardSourceGeneration,
  pruneSourceScratch,
  pruneSourcePins,
  assertSourcePath,
  assertSourceObjectId,
  type SourceProject,
  type SourceGeneration,
  type SourceMergePreview,
  readSourceCaptureCatalog,
  reconcileSourceCaptureCatalog,
  writeSourceCaptureCatalog,
  fingerprintSourceCapture,
  DEFAULT_SOURCE_CAPTURE_MAX_BYTES,
} from "@uttori/asm-disassembler/source-project";

import { importSourceCaptures } from "./source-capture-imports.js";
import { createSourceMergeProgress } from "./source-progress.js";
import { prepareSourceResearch } from "./source-research.js";
import type { SourceTargetDescriptor, SourceProjectInspection } from "./source-target.js";
export type {
  SourceCaptureImportBatchResult,
  SourceCaptureImportSummary,
} from "./source-capture-imports.js";
export type {
  SourceResearchRequest,
  SourceResearchResult,
  SourceResearchSymbol,
} from "./source-research.js";

/** Immutable semantic assets are identified by original content, independent of working asset edits. */
interface GenerationRecipe {
  readonly format: string;
  readonly version: 1;
  readonly sourceRoot: string;
  readonly recipes: readonly string[];
  readonly pristineAssets: SourceGenerationOptions["pristineAssets"];
  readonly codeWithdrawals?: readonly {
    readonly start: number;
    readonly end: number;
    readonly reason: string;
  }[];
}

/** Read compact contracts with explicit size limits before parsing untrusted workspace JSON. */
function readJson(file: string): unknown {
  if (fs.statSync(file).size > 8 * 1024 * 1024) {
    throw new Error(`Project contract is too large: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Non-authoritative cache: a torn write must not replace the last complete preview. */
function savePreview(project: SourceProject, preview: SourceMergePreview): void {
  const directory = project.repository.stateDirectory;
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, `preview-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, canonicalJson(preview));
    fs.renameSync(temporary, path.join(directory, "preview.json"));
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

/** A retained Git object supplies its descriptor and tree; callers cannot fabricate its payload. */
async function candidateGeneration(
  project: SourceProject,
  commit: string,
): Promise<SourceGeneration> {
  assertSourceObjectId(commit);
  const { descriptor } = await verifySourceGeneration(project.repository, commit);
  const tree = (await sourceGit(project.repository.root, ["rev-parse", `${commit}^{tree}`])).stdout
    .toString("utf8")
    .trim();
  const ref = await pinSourceCandidate(project.repository, commit);
  return { commit, tree, ref, descriptor };
}

function sourceActionName(action: SourceAction): string {
  return action;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item): item is string => typeof item === "string");
}

function assertSourceMergePreview(value: unknown): asserts value is SourceMergePreview {
  if (
    !isRecord(value) ||
    typeof value.head !== "string" ||
    typeof value.sourceTree !== "string" ||
    typeof value.candidate !== "string" ||
    typeof value.base !== "string" ||
    typeof value.resultTree !== "string" ||
    !isStringArray(value.conflicts) ||
    typeof value.messages !== "string" ||
    (value.ref !== undefined && typeof value.ref !== "string")
  ) {
    throw new Error("Saved generation preview is incomplete. Prepare the generation again.");
  }
}

function isPristineAsset(value: unknown): value is GenerationRecipe["pristineAssets"][number] {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    typeof value.path === "string" &&
    "sha256" in value &&
    typeof value.sha256 === "string"
  );
}

function assertGenerationRecipe(value: unknown): asserts value is GenerationRecipe {
  if (
    typeof value !== "object" ||
    value === null ||
    !("format" in value) ||
    typeof value.format !== "string" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("sourceRoot" in value) ||
    typeof value.sourceRoot !== "string" ||
    !("recipes" in value) ||
    !isUnknownArray(value.recipes) ||
    !("pristineAssets" in value) ||
    !isUnknownArray(value.pristineAssets)
  ) {
    throw new Error("Invalid SNES generation input contract.");
  }
  for (const file of value.recipes) {
    if (typeof file !== "string") {
      throw new Error("Generation recipe paths must be strings.");
    }
  }
  for (const asset of value.pristineAssets) {
    if (!isPristineAsset(asset)) {
      throw new Error("Invalid SNES generation input contract.");
    }
  }
}

/** Validate target recipe selection without scanning the editable source for original asset values. */
function generationRecipe(project: SourceProject): GenerationRecipe {
  const recipe = readJson(path.join(project.repository.root, ".uttori/generation-inputs.json"));
  assertGenerationRecipe(recipe);
  if (!project.configuration.sourceRoots.includes(recipe.sourceRoot)) {
    throw new Error("Invalid SNES generation input contract.");
  }
  for (const file of recipe.recipes) {
    assertSourcePath(file);
  }
  for (const asset of recipe.pristineAssets) {
    assertSourcePath(asset.path);
    if (!/^[\da-f]{64}$/.test(asset.sha256)) {
      throw new Error("Pristine assets require original content hashes.");
    }
    if (
      asset.romRange &&
      (!Number.isSafeInteger(asset.romRange.start) ||
        !Number.isSafeInteger(asset.romRange.end) ||
        asset.romRange.start < 0 ||
        asset.romRange.end <= asset.romRange.start)
    ) {
      throw new Error("Pristine ROM assets require a bounded, half-open original file range.");
    }
    if (
      asset.originalBlob !== undefined &&
      (asset.romRange ||
        typeof asset.originalBlob !== "string" ||
        !/^(?:[\da-f]{40}|[\da-f]{64})$/.test(asset.originalBlob))
    ) {
      throw new Error("Pristine assets require one immutable original blob or ROM extraction.");
    }
  }
  if (
    new Set(recipe.pristineAssets.map((asset) => asset.path)).size !== recipe.pristineAssets.length
  ) {
    throw new Error("Repeated pristine asset declaration.");
  }
  return recipe;
}

/** Resolve one complete generation snapshot. The target rechecks the evidence identity inside its read transaction. */
async function generationInputs(project: SourceProject, host: SourceWorkflowHost) {
  const local = sourceProjectLocalInputs(project);
  const captureSnapshot = readSourceCaptureCatalog(
    project.repository.root,
    project.configuration.captures,
    project.configuration.romSha256,
  );
  if (!captureSnapshot.fileSha256) {
    throw new Error(
      "Run source catalog to record retained evidence identities before preparing a generation.",
    );
  }
  const recipe = generationRecipe(project);
  const target = sourceTarget(host, project.configuration.target);
  if (recipe.format !== target.recipeFormat) {
    throw new Error("Generation recipe does not match the selected target.");
  }
  const parent = await acceptedSourceGeneration(
    project.repository,
    (await sourceMergeStatus(project.repository)).head,
  );
  const prior = await verifySourceGeneration(project.repository, parent);
  const priorFiles = new Map(prior.files.map((file) => [file.path, file.sha256]));
  for (const asset of recipe.pristineAssets) {
    if (!asset.romRange && !asset.originalBlob && priorFiles.get(asset.path) !== asset.sha256) {
      throw new Error(`Pristine asset identity changed: ${asset.path}`);
    }
  }
  const recipes = recipe.recipes.map((name) => ({
    path: name,
    bytes: fs.readFileSync(path.join(project.repository.root, recipe.sourceRoot, name)),
  }));
  const inputFiles = [
    ...recipes.map((file) => ({ ...file, path: `${recipe.sourceRoot}/${file.path}` })),
    ...project.research.files.map((file) => {
      const bytes = fs.readFileSync(path.join(project.repository.root, file.path));
      if (sourceContentHash(bytes) !== file.sha256) {
        throw new Error(`Research input changed while capturing generation: ${file.path}`);
      }
      return { path: file.path, bytes };
    }),
    { path: ".uttori/project.json", bytes: Buffer.from(canonicalJson(project.configuration)) },
    { path: ".uttori/generation-inputs.json", bytes: Buffer.from(canonicalJson(recipe)) },
    {
      path: project.configuration.captures,
      bytes: Buffer.from(canonicalJson(captureSnapshot.catalog)),
    },
  ];
  const configFile = path.join(project.repository.root, project.configuration.buildConfig);
  const loaded = await host.loadEnvironment(configFile);
  let toolchain;
  try {
    toolchain = host.fingerprint(
      loaded.configuration.plugins
        .filter((plugin) => !plugin.bundled)
        .map((plugin) => plugin.resolvedModule),
    );
  } finally {
    await loaded.dispose();
  }
  inputFiles.push({
    path: ".uttori/toolchain-snapshot.json",
    bytes: Buffer.from(canonicalJson(toolchain)),
  });
  const store = openAnalysisProjectStore(local.evidence);
  let evidenceSha256: string;
  try {
    const reconciled = reconcileSourceCaptureCatalog(
      captureSnapshot.catalog,
      store.loadTable("imports"),
    );
    if (canonicalJson(reconciled) !== canonicalJson(captureSnapshot.catalog)) {
      throw new Error(
        "The capture catalog is missing retained evidence identities. Refresh it with source catalog.",
      );
    }
    const manifest = Buffer.from(canonicalJson(store.manifest()));
    evidenceSha256 = sourceContentHash(manifest);
    inputFiles.push({ path: ".uttori/evidence-snapshot.json", bytes: manifest });
  } finally {
    store.close();
  }
  const render = {
    sourceRoot: recipe.sourceRoot,
    recipes,
    pristineAssets: recipe.pristineAssets,
    codeWithdrawals: recipe.codeWithdrawals ?? [],
  };
  return {
    ...render,
    inputFiles,
    repository: project.repository,
    parent,
    evidenceDirectory: local.evidence,
    romFile: local.rom,
    inputs: {
      project: project.configuration.id,
      romSha256: project.configuration.romSha256,
      evidenceSha256,
      researchSha256: project.research.hash,
      captureCatalogSha256: sourceContentHash(canonicalJson(captureSnapshot.catalog)),
      toolchainSha256: toolchain.sha256,
      optionsSha256: target.generationOptionsHash(render),
    },
    loadEnvironment: host.loadEnvironment,
  };
}

/** Capability lookup is complete before work begins; duplicate IDs cannot silently override a target. */
function sourceTarget(host: SourceWorkflowHost, id: string): SourceTargetDescriptor {
  const targets = host.targets ?? builtinSourceTargets;
  if (new Set(targets.map((target) => target.id)).size !== targets.length) {
    throw new Error("Duplicate source target registration.");
  }
  const target = targets.find((descriptor) => descriptor.id === id);
  if (!target) {
    throw new Error(`Unsupported source target: ${id}.`);
  }
  return target;
}
const buildProject = (project: SourceProject, host: SourceWorkflowHost, signal?: AbortSignal) =>
  sourceTarget(host, project.configuration.target).build(project, host, signal);
export type { SourceProjectInspection } from "./source-target.js";
/** Inspect using the selected target and the host's exact plugin registration. */
export async function inspectSourceProject(
  directory: string,
  overlays?: ReadonlyMap<string, Uint8Array | null>,
  signal?: AbortSignal,
  host: SourceWorkflowHost = defaultSourceHost,
): Promise<SourceProjectInspection> {
  const project = await openSourceProject(directory);
  return sourceTarget(host, project.configuration.target).inspect(project, host, overlays, signal);
}
/** Execute one explicit operation. Long-running callers use a worker so the editor stays responsive. */
export function executeSourceOperation<Action extends SourceAction>(
  operation: SourceOperation<Action>,
  host?: SourceWorkflowHost,
): Promise<SourceResultMap[Action]>;
export async function executeSourceOperation(
  operation: SourceOperation,
  host: SourceWorkflowHost = defaultSourceHost,
): Promise<unknown> {
  readSourceOperation(operation);
  operation.signal?.throwIfAborted();
  if (operation.captures !== undefined) {
    if (operation.action !== "import" || operation.capture !== undefined) {
      throw new Error(
        "A capture queue is only valid for import and cannot be combined with capture.",
      );
    }
    return importSourceCaptures(
      operation.captures,
      (capture, onProgress) =>
        executeSourceOperation(
          {
            action: "import",
            directory: operation.directory,
            signal: operation.signal,
            capture,
            recoverPartial: operation.recoverPartial,
            onProgress,
          },
          host,
        ),
      operation,
    );
  }
  if (operation.action === "init") {
    if (!operation.rom) {
      throw new Error("Initialization requires an original ROM path.");
    }
    const handle = fs.openSync(operation.rom, "r");
    const prefix = Buffer.alloc(4);
    try {
      fs.readSync(handle, prefix, 0, 4, 0);
    } finally {
      fs.closeSync(handle);
    }
    const matches = (host.targets ?? builtinSourceTargets).filter((target) =>
      target.matchesRom(prefix),
    );
    if (matches.length !== 1) {
      throw new Error("Initialization requires exactly one matching source target.");
    }
    const initialize = matches[0].initialize;
    return initialize({
      directory: operation.directory,
      rom: operation.rom,
      dizRawFile: operation.dizRawFile,
      mapper: operation.mapper,
      signal: operation.signal,
      onProgress: operation.onProgress,
      toolchainSha256: host.fingerprint([]).sha256,
      loadEnvironment: host.loadEnvironment,
    });
  }
  operation.onProgress?.("Reading selected source project.");
  const project = await openSourceProject(operation.directory);
  const target = sourceTarget(host, project.configuration.target);
  if (
    (operation.action === "expand" && !target.expand) ||
    (operation.action === "relocate" && !target.relocate) ||
    (operation.action === "graphics" && !target.graphics)
  ) {
    throw new SourceOperationError(
      "unsupported",
      `Source target ${target.id} does not support ${operation.action}.`,
    );
  }
  const repository = project.repository;
  if (operation.action === "clean") {
    return { scratch: pruneSourceScratch(repository), pins: await pruneSourcePins(repository) };
  }
  if (operation.action === "research") {
    return prepareSourceResearch(project, operation.research, operation.overlays);
  }
  if (operation.action === "status") {
    const status = await sourceMergeStatus(repository);
    let candidateAccepted = false;
    let candidateStale = false;
    if (operation.candidate) {
      assertSourceObjectId(operation.candidate);
      const accepted = await acceptedSourceGeneration(repository, status.head);
      candidateAccepted = accepted === operation.candidate;
      if (!candidateAccepted) {
        // Editor selections survive external merges and branch switches. Compare the immutable
        // candidate parent with this checkout's accepted generation before offering Preview.
        const ancestry = await sourceGit(
          repository.root,
          ["rev-list", "--parents", "-n", "1", operation.candidate],
          { acceptedCodes: [0, 128] },
        );
        const parents = ancestry.stdout.toString("utf8").trim().split(" ");
        candidateStale = ancestry.code !== 0 || parents.length !== 2 || parents[1] !== accepted;
      }
    }
    let analysisReady = false;
    let analysisReason: string | undefined;
    let catalogReady: boolean | undefined;
    let catalogReason: string | undefined;
    // Status reads the selected research/evidence identities; it must not analyze or regenerate
    // merely because the tree refreshed. Missing local evidence still permits source/Git inspection.
    try {
      const store = openAnalysisProjectStore(sourceProjectLocalInputs(project).evidence);
      try {
        const snapshot = readSourceCaptureCatalog(
          repository.root,
          project.configuration.captures,
          project.configuration.romSha256,
        );
        const reconciled = reconcileSourceCaptureCatalog(
          snapshot.catalog,
          store.loadTable("imports"),
        );
        catalogReady =
          Boolean(snapshot.fileSha256) &&
          canonicalJson(reconciled) === canonicalJson(snapshot.catalog);
        if (!catalogReady) {
          catalogReason =
            "Refresh Capture Catalog to record the retained evidence identities before preparing.";
        }
        if (!store.researchInputsAreCurrent(project.research.hash)) {
          analysisReason =
            "Selected research changed. Analyze Evidence before preparing a generation.";
        } else {
          store.assertCurrentAnalysis();
          analysisReady = true;
        }
      } finally {
        store.close();
      }
    } catch (error) {
      analysisReason = error instanceof Error ? error.message : String(error);
    }
    const working = await sourceStatus(repository);
    return {
      ...status,
      dirty: working.length > 0,
      unstaged:
        (await sourceGit(repository.root, ["diff", "--name-only"])).stdout.length > 0 ||
        working
          .toString()
          .split("\0")
          .some((entry) => entry.startsWith("?? ")),
      candidateAccepted,
      candidateStale,
      analysisReady,
      analysisReason,
      catalogReady,
      catalogReason,
    };
  }
  if (operation.action === "abort") {
    return abortSourceGeneration(repository);
  }
  if (operation.action === "discard") {
    if (!operation.candidate) {
      throw new Error("Discard requires the generation commit to release.");
    }
    await discardSourceGeneration(repository, operation.candidate);
    return { discarded: operation.candidate };
  }
  if (operation.action === "preview") {
    operation.onProgress?.("Snapshotting source and computing the native Git preview.");
    if (!operation.candidate) {
      throw new Error("Preview requires a retained generation commit.");
    }
    const preview = await previewSourceGeneration(
      repository,
      operation.candidate,
      operation.overlays,
    );
    savePreview(project, preview);
    return preview;
  }
  if (operation.action === "index") {
    return { changed: synchronizeSourceResearch(project), researchSha256: project.research.hash };
  }
  if (operation.action === "build") {
    operation.onProgress?.("Assembling and checking source, layout, and asset consumption.");
    return buildProject(project, host, operation.signal);
  }
  if (operation.action === "expand") {
    return target.expand!(project, host, operation);
  }
  if (operation.action === "relocate") {
    return target.relocate!(project, host, operation);
  }
  if (operation.action === "graphics") {
    return target.graphics!(project, operation);
  }
  if (operation.action === "catalog") {
    const snapshot = readSourceCaptureCatalog(
      repository.root,
      project.configuration.captures,
      project.configuration.romSha256,
    );
    const store = openAnalysisProjectStore(sourceProjectLocalInputs(project).evidence);
    try {
      const catalog = reconcileSourceCaptureCatalog(snapshot.catalog, store.loadTable("imports"));
      writeSourceCaptureCatalog(
        repository.root,
        project.configuration.captures,
        catalog,
        snapshot.fileSha256,
      );
      return {
        captures: catalog.captures.length,
        // Archive hashes record the verified import input, not an available reconstruction source.
        // Every capture relies on its imported evidence after users remove temporary recordings.
        retainedEvidenceRequired: catalog.captures.length,
      };
    } finally {
      store.close();
    }
  }
  synchronizeSourceResearch(project);
  const researchOptions = {
    research: project.research,
    assertResearchCurrent: () => {
      const current = readResearchInputs(
        repository.root,
        project.configuration.researchRoots,
        { project: project.configuration.id, romSha256: project.configuration.romSha256 },
        undefined,
        project.configuration.limits,
      );
      if (current.hash !== project.research.hash) {
        throw new Error(
          "Research changed during the operation. Retry with the current branch inputs.",
        );
      }
    },
  };
  if (operation.action === "analyze") {
    const local = sourceProjectLocalInputs(project);
    const pendingNotes = pendingCaptureImportNotes(local.evidence);
    const analyze = target.analyze;
    const result = analyze({
      projectDirectory: local.evidence,
      romFile: local.rom,
      signal: operation.signal,
      maxWorkItems: project.configuration.limits?.analysisWorkItems,
      maxCallDepth: project.configuration.limits?.analysisCallDepth,
      onProgress: (progress) => operation.onProgress?.(progress.message),
      ...researchOptions,
    });
    completeCaptureImportNotes(local.evidence, pendingNotes, result.status, result.addedCode);
    return result;
  }
  if (operation.action === "import") {
    if (!operation.capture) {
      throw new Error("Import requires a capture archive path.");
    }
    const capture = path.resolve(operation.capture);
    // Keep the source identity in every phase, including single-file imports from runtime capture.
    const onProgress = (message: string): void =>
      operation.onProgress?.(`Import ${capture}: ${message}`);
    try {
      onProgress("Starting capture import.");
      const local = sourceProjectLocalInputs(project);
      // One resolved budget covers the primary archive and each companion, including provenance hashing.
      // Otherwise a successful evidence scan can fail later at an independent fingerprinting default.
      const maxCaptureBytes =
        project.configuration.limits?.captureBytes ?? DEFAULT_SOURCE_CAPTURE_MAX_BYTES;
      const catalogSnapshot = readSourceCaptureCatalog(
        repository.root,
        project.configuration.captures,
        project.configuration.romSha256,
      );
      const archive = await fingerprintSourceCapture(capture, operation.signal, maxCaptureBytes);
      let graphicsResult;
      const graphicsBindings: {
        sourceSha256: string;
        archive: Awaited<ReturnType<typeof fingerprintSourceCapture>>;
      }[] = [];

      if (target.importPrimary) {
        graphicsResult = await target.importPrimary({
          project,
          capture,
          ...researchOptions,
          signal: operation.signal,
          maxBytes: maxCaptureBytes,
        });
        if (graphicsResult?.report) {
          onProgress(`Verified target evidence saved to ${graphicsResult.report}`);
        }
      }
      onProgress(
        `Archive fingerprinted: ${archive.bytes.toLocaleString("en-US")} bytes; SHA-256 ${archive.sha256}.`,
      );
      let nextReadProgress = performance.now() + 1000;
      const selected = graphicsResult
        ? undefined
        : await openRuntimeCaptureSource(capture, {
            signal: operation.signal,
            maxBytes: maxCaptureBytes,
            recoverPartial: operation.recoverPartial,
            onProgress: (read, total) => {
              const now = performance.now();
              if (now >= nextReadProgress || read === total) {
                onProgress(
                  `Validated ${read.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} archive bytes.`,
                );
                nextReadProgress = now + 1000;
              }
            },
          });
      onProgress(`Selected ${selected?.kind ?? "NES graphics"} importer.`);
      if (
        selected?.kind === "instructions" &&
        !target.companionArchive &&
        !operation.recoverPartial
      ) {
        const retained = catalogSnapshot.catalog.captures.find(
          (entry) =>
            (entry.profile === "full" || entry.profile === "65816-analysis-v3") &&
            entry.archives.some(
              (prior) =>
                prior.sha256 === archive.sha256 &&
                prior.bytes === archive.bytes &&
                prior.companionSha256 === archive.companionSha256,
            ),
        );
        if (retained) {
          const store = openAnalysisProjectStore(local.evidence);
          try {
            const receipt = store.captureReceipt(retained.sha256);
            const report = store
              .loadTable("imports")
              .find((entry) => entry.sourceSha256 === retained.sha256);
            // A portable catalog alone cannot prove that this checkout still has the imported
            // evidence. Require its atomic native receipt and provenance before skipping the work.
            if (
              receipt?.profile === retained.profile &&
              report &&
              // A recovered prefix uses full fact indexing but has never validated a terminal.
              !Object.hasOwn(report.imported, "recoveredChunks") &&
              !Object.hasOwn(report.imported, "recoveredEvents") &&
              receipt.observed_events === retained.observedEvents &&
              receipt.dropped_events === retained.droppedEvents
            ) {
              await selected.source.verifyRetained?.();
              researchOptions.assertResearchCurrent();
              onProgress(
                "Import completed; matching archive is already validated and committed. Decoding, indexing and merge skipped.",
              );
              return {
                sourceSha256: retained.sha256,
                changed: false,
                added: { runtime: 0, evidence: 0 },
                observedEvents: retained.observedEvents,
                droppedEvents: retained.droppedEvents,
                warnings: report.warnings,
              };
            }
          } finally {
            store.close();
          }
        }
      }
      const context = {
        projectRomContentSha256: project.configuration.romSha256,
        sourceName: path.basename(capture),
      };
      const options = {
        signal: operation.signal,
        onStage: onProgress,
        onMergeProgress: createSourceMergeProgress(onProgress),
        ...researchOptions,
      };
      let result;
      if (graphicsResult) {
        result = graphicsResult;
      } else if (selected?.kind === "instructions") {
        result = await importRuntimeTraceSourceIntoProject(
          selected.source,
          local.evidence,
          { ...context, indexMode: "analysis" },
          {
            ...options,
            storageStatistics: false,
            recoverPartial: operation.recoverPartial,
            validatedIndex: {
              directory: path.join(repository.root, ".uttori-local/validated-traces"),
              identity: canonicalJson({ archive, toolchain: host.fingerprint([]).sha256 }),
              verify: async () => {
                if (
                  canonicalJson(
                    await fingerprintSourceCapture(capture, operation.signal, maxCaptureBytes),
                  ) !== canonicalJson(archive)
                ) {
                  throw new Error("Capture archive or companion changed while indexing.");
                }
              },
            },
          },
        );
      } else {
        result = await importRuntimeBusTraceSourceIntoProject(
          selected!.source,
          local.evidence,
          context,
          options,
        );
      }
      if (
        target.importPrimary &&
        target.companionArchive &&
        selected?.kind === "instructions" &&
        fs.existsSync(`${capture}.context/manifest.json`)
      ) {
        // The instruction importer has verified this companion's hashes and boundary.
        // Publish its independent graphics evidence as well; retry remains idempotent.
        try {
          assertSourcePath(target.companionArchive);
          const graphics = await target.importPrimary({
            project,
            capture: path.join(`${capture}.context`, target.companionArchive),
            ...researchOptions,
            signal: operation.signal,
            maxBytes: maxCaptureBytes,
          });
          if (!graphics) {
            throw new Error("NES instruction context requires NES graphics evidence.");
          }
          const graphicsArchive = await fingerprintSourceCapture(
            path.join(`${capture}.context`, target.companionArchive),
            operation.signal,
            maxCaptureBytes,
          );
          if (graphicsArchive.sha256 !== graphics.sourceSha256) {
            throw new Error("Graphics companion changed during import.");
          }
          graphicsBindings.push({ sourceSha256: graphics.sourceSha256, archive: graphicsArchive });
          // The CPU capture can be an exact retry while its newly supported graphics projection is new.
          result = {
            ...result,
            changed: result.changed || graphics.changed,
            added: {
              runtime: result.added.runtime + graphics.added.runtime,
              evidence: result.added.evidence + graphics.added.evidence,
            },
          };
          onProgress(`Verified companion PPU evidence saved to ${graphics.report}`);
        } catch (error) {
          throw new SourceOperationError(
            "committed-with-warning",
            `CPU evidence import committed; graphics companion import failed. Retry this import: ${String(error)}`,
            { cause: error },
          );
        }
      }
      // Evidence is already committed. A failed Git-file update must report that durable outcome;
      // retrying the import is idempotent and can complete the missing portable archive binding.
      try {
        onProgress("Recording verified archive identity in the Git capture catalog.");
        if (
          canonicalJson(
            await fingerprintSourceCapture(capture, operation.signal, maxCaptureBytes),
          ) !== canonicalJson(archive)
        ) {
          throw new Error("Capture archive or companion changed during import.");
        }
        const store = openAnalysisProjectStore(local.evidence);
        try {
          const reports = store.loadTable("imports");
          const report = reports.find((entry) => entry.sourceSha256 === result.sourceSha256);
          if (report) {
            writeCaptureImportNotes(local.evidence, report);
          }
          let catalog = reconcileSourceCaptureCatalog(catalogSnapshot.catalog, reports, {
            sourceSha256: result.sourceSha256,
            archive,
          });
          for (const binding of graphicsBindings) {
            catalog = reconcileSourceCaptureCatalog(catalog, reports, binding);
          }
          writeSourceCaptureCatalog(
            repository.root,
            project.configuration.captures,
            catalog,
            catalogSnapshot.fileSha256,
          );
        } finally {
          store.close();
        }
      } catch (error) {
        throw new SourceOperationError(
          "committed-with-warning",
          `Evidence import committed; portable catalog update failed. Retry this import to finish recording its archive: ${String(error)}`,
          { cause: error },
        );
      }
      onProgress(
        `Import completed; ${result.observedEvents.toLocaleString("en-US")} observed events, ${result.droppedEvents.toLocaleString("en-US")} dropped events; added ${result.added.runtime.toLocaleString("en-US")} runtime records and ${result.added.evidence.toLocaleString("en-US")} evidence records. Source SHA-256 ${result.sourceSha256}.`,
      );
      for (const warning of result.warnings) {
        onProgress(`Warning: ${warning}`);
      }
      return result;
    } catch (error) {
      if (error instanceof SourceOperationError) {
        throw error;
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Import ${capture} failed: ${detail}`, { cause: error });
    }
  }
  if (operation.action === "prepare") {
    operation.onProgress?.(
      "Capturing inputs and verifying a pure generation against the original ROM.",
    );
    return prepareSourceGeneration(
      repository,
      async () => {
        operation.onProgress?.("Capturing immutable generation inputs.");
        const prepared = await target.prepare({
          ...(await generationInputs(project, host)),
          signal: operation.signal,
          onProgress: operation.onProgress,
        });
        operation.onProgress?.("Verifying the retained generation and replacing candidate pins.");
        return prepared;
      },
      operation.signal,
    );
  }
  if (operation.action === "apply") {
    if (!operation.candidate) {
      throw new Error("Apply requires the previewed generation commit.");
    }
    assertSourceObjectId(operation.candidate);
    const status = await sourceMergeStatus(repository);
    // Finish releases the preview and candidate pins. A repeated Apply must return the current
    // state without repinning or revalidating historical inputs against subsequent edits.
    if ((await acceptedSourceGeneration(repository, status.head)) === operation.candidate) {
      operation.onProgress?.("This generation is already integrated. No merge was applied.");
      return status;
    }
    let preview: unknown;
    try {
      preview = readJson(path.join(repository.stateDirectory, "preview.json"));
    } catch (error) {
      // A private preview is disposable, but applying an unreviewed merge is never a fallback.
      if (isRecord(error) && error.code === "ENOENT") {
        throw new Error("Preview this generation with current edits before applying it.", {
          cause: error,
        });
      }
      throw error;
    }
    assertSourceMergePreview(preview);
    const candidate = await candidateGeneration(project, operation.candidate);
    const current = await generationInputs(project, host);
    if (canonicalJson(current.inputs) !== canonicalJson(candidate.descriptor.inputs)) {
      throw new Error("Generation inputs changed since preparation. Prepare and preview again.");
    }
    return applySourceGeneration(repository, candidate, preview);
  }
  if (sourceActionName(operation.action) !== "finish") {
    throw new Error(`Unknown source action: ${sourceActionName(operation.action)}`);
  }
  return finishSourceGeneration(repository, {
    message: operation.message ?? "Integrate regenerated source",
    onProgress: operation.onProgress,
    validate: async () => (await buildProject(project, host, operation.signal)).verification,
  });
}
