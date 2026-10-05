import fs from "node:fs";
import path from "node:path";

import type { AssemblerEnvironment } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  RomImage,
  openAnalysisProjectStore,
  validateProjectRom,
  assertSourcePath,
  sourceGit,
  retainSourceGeneration,
  sourceContentHash,
  verifySourceGeneration,
  createSourceInputSnapshot,
  createSourceScratch,
  type SourceRepository,
  type SourceGeneration,
  type SourceGenerationFile,
  type SourceGenerationInputs,
} from "@uttori/asm-disassembler";

import { lostCodeRanges } from "./code-preservation.js";
import { buildSnesSource, type SnesSourceBuild } from "./source-build.js";
import { exportSnes65816Source } from "./source-export.js";

/** Original assets come from immutable Git objects or original ROM bytes, never live working files. */
export interface PrepareSnesGenerationOptions {
  readonly repository: SourceRepository;
  readonly parent: string;
  readonly evidenceDirectory: string;
  readonly romFile: string;
  /** Exact source projection prefix in this project repository, such as disassembly. */
  readonly sourceRoot: string;
  readonly inputs: SourceGenerationInputs;
  /** Explicit authoring maps/configuration, already captured by the caller. Paths are source-root relative. */
  readonly recipes: readonly SourceGenerationFile[];
  /** Exact research/configuration/catalog and evidence-manifest bytes retained in generation history. */
  readonly inputFiles: readonly SourceGenerationFile[];
  /** Repository-relative pristine inputs; the complete generation must still rebuild the original ROM. */
  readonly pristineAssets: readonly {
    readonly path: string;
    readonly sha256: string;
    /** Half-open, headerless original-ROM file offsets. This admits new binary inputs without trusting edited working files. */
    readonly romRange?: { readonly start: number; readonly end: number };
    /** Explicit immutable blob for a newly decoded/reviewed original asset; SHA-256 guards its bytes. */
    readonly originalBlob?: string;
  }[];
  /** Git-reviewed exceptions for withdrawing previously emitted code; reasons remain in the input receipt. */
  readonly codeWithdrawals?: readonly {
    readonly start: number;
    readonly end: number;
    readonly reason: string;
  }[];
  readonly signal?: AbortSignal;
  /** Host owns trusted plugin loading and disposal, keeping Node module loading out of the target layer. */
  readonly loadEnvironment: (configuration: string) => Promise<{
    readonly environment: AssemblerEnvironment;
    readonly includePaths: readonly string[];
    readonly targetOptions: Readonly<Record<string, unknown>>;
    dispose(): Promise<void>;
  }>;
}

/** Candidate and exact build proof; temporary source and build folders are reclaimed before returning. */
export interface PreparedSnesGeneration {
  readonly generation: SourceGeneration;
  readonly verification: SnesSourceBuild["verification"];
  readonly codeBytes: number;
  readonly files: number;
  readonly withdrawnCode: readonly { readonly start: number; readonly end: number }[];
}

/** Exact render options include recipe contents and the pristine-asset selection, not host paths. */
export function snesGenerationOptionsHash(
  options: Pick<
    PrepareSnesGenerationOptions,
    "sourceRoot" | "recipes" | "pristineAssets" | "codeWithdrawals"
  >,
): string {
  return sourceContentHash(
    canonicalJson({
      sourceRoot: options.sourceRoot,
      recipes: options.recipes
        .map((file) => ({ path: file.path, sha256: sourceContentHash(file.bytes) }))
        .toSorted((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))),
      pristineAssets: [...options.pristineAssets].toSorted((a, b) =>
        Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)),
      ),
      codeWithdrawals: options.codeWithdrawals ?? [],
    }),
  );
}

/**
 * Accepts a JSON object. Arrays and null are not coverage contracts.
 * @param {unknown} value Parsed JSON.
 * @returns {boolean} True when `value` is a non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Accepts one half-open ROM interval from a coverage contract.
 * @param {unknown} value Candidate range.
 * @returns {boolean} True when start and end are numbers.
 */
function isCodeRange(value: unknown): value is { start: number; end: number } {
  return isRecord(value) && typeof value.start === "number" && typeof value.end === "number";
}

/**
 * Accepts the accepted generation's code coverage contract.
 * @param {unknown} value Parsed `source-code.json`.
 * @returns {boolean} True for format `uttori-source-code` version 1 with numeric ranges.
 */
function isSourceCodeContract(value: unknown): value is {
  format: string;
  version: number;
  romSha256: string;
  ranges: { start: number; end: number }[];
} {
  return (
    isRecord(value) &&
    value.format === "uttori-source-code" &&
    value.version === 1 &&
    typeof value.romSha256 === "string" &&
    Array.isArray(value.ranges) &&
    value.ranges.every(isCodeRange)
  );
}

/**
 * Render one pinned analysis snapshot in an owned temporary directory, verify the original ROM,
 * then retain only its immutable Git payload. No evidence/capture directory is copied and the
 * source checkout/index remain untouched. Failed candidates never acquire a retained Git ref.
 */
export async function prepareSnesGeneration(
  options: PrepareSnesGenerationOptions,
): Promise<PreparedSnesGeneration> {
  assertSourcePath(options.sourceRoot);
  options.signal?.throwIfAborted();
  if (snesGenerationOptionsHash(options) !== options.inputs.optionsSha256) {
    throw new Error("Generation recipe identity changed.");
  }
  const prior = await verifySourceGeneration(options.repository, options.parent);
  if (
    prior.descriptor.inputs.project !== options.inputs.project ||
    prior.descriptor.inputs.romSha256 !== options.inputs.romSha256
  ) {
    throw new Error("Prepare regeneration from the accepted project/ROM lineage.");
  }
  const scratch = createSourceScratch(options.repository, "prepare");
  const temporary = scratch.directory;
  const source = path.join(temporary, options.sourceRoot);
  const generated = new Map<string, SourceGenerationFile>();
  const write = (file: SourceGenerationFile): void => {
    assertSourcePath(file.path);
    if (generated.has(file.path)) {
      throw new Error(`Duplicate generation output: ${file.path}`);
    }
    const target = path.join(temporary, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.bytes);
    generated.set(file.path, file);
  };
  let openedStore: ReturnType<typeof openAnalysisProjectStore> | undefined;
  try {
    const store = openAnalysisProjectStore(options.evidenceDirectory);
    openedStore = store;
    const recipeNames = new Set<string>();
    for (const recipe of options.recipes) {
      if (
        ![
          "ram-map.json",
          "struct-map.json",
          "asset-includes.json",
          "uttori-asm.config.json",
        ].includes(recipe.path) ||
        recipeNames.has(recipe.path)
      ) {
        throw new Error(`Unknown or repeated source recipe: ${recipe.path}`);
      }
      recipeNames.add(recipe.path);
      const target = path.join(source, recipe.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, recipe.bytes);
    }
    if (!recipeNames.has("ram-map.json") || !recipeNames.has("uttori-asm.config.json")) {
      throw new Error("Generation requires explicit RAM map and build configuration.");
    }
    // SQL keeps the complete runtime history out of JS. The iterator is consumed while this
    // snapshot is open so another evidence import cannot mix instruction variants into the render.
    store.prepareAnnotationQueries();
    const { manifest, rom } = store.transaction(() => {
      const project = store.sourceExportView();
      if (
        sourceContentHash(canonicalJson(project.manifest)) !== options.inputs.evidenceSha256 ||
        store.researchInputsIdentity() !== options.inputs.researchSha256
      ) {
        throw new Error(
          "Evidence or indexed research changed before pure rendering. Prepare a fresh input snapshot.",
        );
      }
      const loadedRom = RomImage.load(options.romFile, {
        headerSize: project.manifest.rom.headerSize,
      });
      validateProjectRom(project.manifest, loadedRom);
      if (loadedRom.identity.contentSha256 !== options.inputs.romSha256) {
        throw new Error("Generation ROM content identity changed.");
      }
      const exportedManifest = exportSnes65816Source(project, loadedRom, source, {
        sourceProjectSha256: sourceContentHash(canonicalJson(project.manifest)),
        instructionGroups: store.instructionExportGroups(),
        emitFile: (file) => {
          options.signal?.throwIfAborted();
          // Reports are disposable diagnostics, not editable source or merge inputs.
          if (file.path === "annotation-report.json") {
            return;
          }
          write({ path: `${options.sourceRoot}/${file.path}`, bytes: file.bytes });
        },
      });
      return { manifest: exportedManifest, rom: loadedRom };
    }, false);
    const priorFiles = new Map(prior.files.map((file) => [file.path, file]));
    const priorCode = priorFiles.get(`${options.sourceRoot}/source-code.json`);
    if (!priorCode) {
      throw new Error(
        "Adopt a verified source baseline with a code coverage contract before regeneration.",
      );
    }
    let withdrawnCode: readonly { start: number; end: number }[];
    {
      const code: unknown = JSON.parse(
        (
          await sourceGit(options.repository.root, ["cat-file", "blob", priorCode.blob])
        ).stdout.toString("utf8"),
      );
      if (!isSourceCodeContract(code) || code.romSha256 !== rom.identity.contentSha256) {
        throw new Error("Accepted generation has an invalid code coverage contract.");
      }
      withdrawnCode = lostCodeRanges(
        code.ranges,
        manifest.spans.filter((span) => span.role === "code"),
      );
      const approvals = options.codeWithdrawals ?? [];
      for (const approval of approvals) {
        if (
          !Number.isSafeInteger(approval.start) ||
          !Number.isSafeInteger(approval.end) ||
          approval.start < 0 ||
          approval.end > rom.length ||
          approval.end <= approval.start ||
          typeof approval.reason !== "string" ||
          !approval.reason.trim()
        ) {
          throw new Error("Code withdrawal needs a bounded ROM interval and a research reason.");
        }
      }
      const unresolved = lostCodeRanges(withdrawnCode, approvals);
      if (unresolved.length) {
        throw new Error(
          `Generation withdraws previously emitted code at $${unresolved[0].start.toString(16)}. Resolve the evidence or record reviewed intervals and reasons in codeWithdrawals.`,
        );
      }
    }
    for (const asset of options.pristineAssets) {
      const name = asset.path;
      assertSourcePath(name);
      if (!name.startsWith(`${options.sourceRoot}/assets/`)) {
        throw new Error(`Pristine asset is outside this source projection: ${name}`);
      }
      let bytes: Uint8Array;
      if (asset.originalBlob !== undefined) {
        if (asset.romRange || !/^(?:[\da-f]{40}|[\da-f]{64})$/.test(asset.originalBlob)) {
          throw new Error(`Invalid original asset blob declaration for ${name}.`);
        }
        // Admission pins reviewed bytes, not a path that an editor can mutate during preparation.
        // The full original-ROM build below must succeed before any candidate is retained.
        bytes = (
          await sourceGit(options.repository.root, ["cat-file", "blob", asset.originalBlob], {
            signal: options.signal,
          })
        ).stdout;
      } else if (asset.romRange) {
        const { start, end } = asset.romRange;
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          end <= start ||
          end > rom.length
        ) {
          throw new Error(`Invalid original ROM extraction for ${name}.`);
        }
        bytes = rom.read(start, end - start)!;
      } else {
        const priorFile = priorFiles.get(name);
        if (!priorFile || priorFile.sha256 !== asset.sha256) {
          throw new Error(
            `Asset needs original-ROM extraction and verification before adoption: ${name}`,
          );
        }
        bytes = (
          await sourceGit(options.repository.root, ["cat-file", "blob", priorFile.blob], {
            signal: options.signal,
          })
        ).stdout;
      }
      // Every admission route verifies immutable inputs. Working source edits are
      // merged separately; no mutable PNG, stream or resource path is reread here.
      if (sourceContentHash(bytes) !== asset.sha256) {
        throw new Error(`Pristine asset content does not match its declared identity: ${name}`);
      }
      write({ path: name, bytes });
    }
    // Configuration is a build input on both histories. Research maps remain owned by the source
    // branch and are retained there through the explicit checkpoint required before applying.
    const configuration = options.recipes.find((file) => file.path === "uttori-asm.config.json")!;
    write({ path: `${options.sourceRoot}/${configuration.path}`, bytes: configuration.bytes });
    const loaded = await options.loadEnvironment(path.join(source, configuration.path));
    let build: SnesSourceBuild;
    try {
      build = buildSnesSource({
        root: temporary,
        entrySource: `${options.sourceRoot}/main.asm`,
        environment: loaded.environment,
        includePaths: loaded.includePaths,
        targetOptions: { ...loaded.targetOptions, checksumEnabled: false, checksumMode: "asar" },
        expectedSize: rom.length,
        originalContent: rom.read(0, rom.length)!,
        rawBlocks: {
          directory: `${options.sourceRoot}/assets/raw`,
          original: rom.read(0, rom.length)!,
          blockSize: 0x1000,
        },
        outputDirectory: path.join(temporary, "build"),
        toolchainSha256: options.inputs.toolchainSha256,
        configurationSha256: sourceContentHash(configuration.bytes),
        signal: options.signal,
      });
    } finally {
      await loaded.dispose();
    }
    const generation = await retainSourceGeneration(options.repository, {
      files: [...generated.values(), createSourceInputSnapshot(options.inputFiles)],
      inputs: options.inputs,
      parent: options.parent,
      signal: options.signal,
    });
    return {
      generation,
      verification: build.verification,
      files: generated.size,
      codeBytes: manifest.spans
        .filter((span) => span.role === "code")
        .reduce((sum, span) => sum + span.end - span.start, 0),
      withdrawnCode,
    };
  } finally {
    try {
      openedStore?.close();
    } finally {
      scratch.dispose();
    }
  }
}
