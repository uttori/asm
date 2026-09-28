import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assetSourcePath } from "@uttori/asm-assets/node";
import {
  acquireFileLease,
  durableReplace,
  loadSourceExportManifest,
  sourceExportSha256,
  validateSourceExportFiles,
  RomImage,
} from "@uttori/asm-disassembler";

import {
  buildModifiedRom,
  createRomModificationProject,
  loadRomModificationProject,
  modificationOwnedPath,
  type ModificationOperationOptions,
  type RomModificationProject,
} from "./modification-project.js";

/** Each conflict preserves base/new/owned bytes and the stable replacement owner at a file offset. */
export interface RebaseConflict {
  readonly id: string;
  readonly offset: number;
  readonly size: number;
  readonly reason: string;
  readonly base: string;
  readonly incoming: string;
  readonly owned: string;
}
/** A rebase creates a new owned project. The original project, captures and last successful build stay intact. */
export interface RomRebaseReview {
  readonly format: "uttori-rom-rebase-review";
  readonly originalManifest: string;
  readonly originalSha256: string;
  readonly candidateManifest: string;
  readonly candidateSha256: string;
  /** Candidate files manually reconciled since the initial fork; original versions remain under .old-owned/inputs. */
  readonly editedInputs?: readonly string[];
  readonly originalInputHashes: Readonly<Record<string, string>>;
  readonly candidateBuild?: { readonly outputPath: string; readonly changedBytes: number };
  readonly buildError?: string;
  readonly inputHashes: Readonly<Record<string, string>>;
  readonly conflicts: readonly RebaseConflict[];
  /** User resolves each conflict explicitly; absent entries block acceptance. */
  readonly resolutions: Readonly<Record<string, "keep-owned" | "take-baseline">>;
  readonly baseRom: string;
  readonly ownedRom: string;
  readonly newRom: string;
}

/** Copy regular owned files while rejecting symlink dependencies and retaining empty subdirectories.
 * @param {string} from Existing owned inputs root.
 * @param {string} to New copied inputs root.
 */
function copyInputs(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new Error("Rebase cannot copy symbolic-link inputs.");
    }
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyInputs(source, target);
    } else if (entry.isFile()) {
      durableReplace(target, fs.readFileSync(source));
    } else {
      throw new Error("Rebase inputs must be regular files.");
    }
  }
}

/** Snapshot hashes of every owned input so acceptance cannot silently adopt edits made after review.
 * @param {string} root Owning modification directory.
 * @param {string} prefix Relative subtree, defaulting to inputs/.
 * @returns {Record<string, string>} Project-relative input hashes.
 */
function inputHashes(root: string, prefix = "inputs"): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    const file = modificationOwnedPath(root, relative);
    if (entry.isDirectory()) {
      Object.assign(result, inputHashes(root, relative));
    } else if (entry.isFile()) {
      result[relative] = sourceExportSha256(fs.readFileSync(file));
    } else {
      throw new Error("Rebase input must be a regular file.");
    }
  }
  return result;
}

/** Assemble a retained generation in a scratch owned project. Plugin paths still resolve from the original config.
 * @param {object} options Existing project, host services and scratch directory under its review folder.
 * @returns {Promise<object>} Verified old owned output, independently of newer or externally edited live source.
 */
export async function buildRetainedModification(
  options: ModificationOperationOptions & { directory: string },
): Promise<Awaited<ReturnType<typeof buildModifiedRom>>> {
  const original = loadRomModificationProject(options.manifestFile);
  const root = path.dirname(path.resolve(options.manifestFile));
  if (!original.baseline.snapshotDirectory) {
    throw new Error(
      "This older project has no retained baseline. Create a fresh project from a verified generation; preserve this project's inputs for manual reconciliation.",
    );
  }
  const snapshot = modificationOwnedPath(root, original.baseline.snapshotDirectory);
  const source = path.join(snapshot, "source");
  const manifest = loadSourceExportManifest(source);
  if (
    sourceExportSha256(fs.readFileSync(path.join(source, "generated-files.json"))) !==
    original.baseline.manifestSha256
  ) {
    throw new Error("Retained baseline manifest changed.");
  }
  validateSourceExportFiles(source, manifest);
  fs.mkdirSync(options.directory);
  copyInputs(path.join(root, "inputs"), path.join(options.directory, "inputs"));
  durableReplace(
    path.join(options.directory, "baseline-interface.asm"),
    fs.readFileSync(path.join(snapshot, "baseline-interface.asm")),
  );
  const file = path.join(options.directory, "modification.json");
  durableReplace(
    file,
    JSON.stringify(
      {
        ...original,
        baseline: {
          ...original.baseline,
          sourceDirectory: source,
          romFile: path.join(snapshot, "baseline.sfc"),
        },
      },
      null,
      2,
    ),
  );
  const loadEnvironment = options.loadEnvironment;
  return buildModifiedRom({
    ...options,
    manifestFile: file,
    loadEnvironment: loadEnvironment
      ? () =>
          loadEnvironment(
            path.resolve(root, original.baseline.sourceDirectory, manifest.buildConfiguration),
          )
      : undefined,
  });
}

/** Prepare a three-way fork against an independently verified new baseline. No old pins are rewritten.
 * @param {object} options Original project, new baseline/ROM and new destination directory.
 * @returns {Promise<string>} Review JSON path. Accept requires explicit conflict decisions and a successful candidate build.
 */
export async function reviewRomRebase(
  options: ModificationOperationOptions & {
    sourceDirectory: string;
    romFile: string;
    directory: string;
  },
): Promise<string> {
  const file = path.resolve(options.manifestFile);
  const lease = acquireFileLease(path.join(path.dirname(file), ".build.lock"));
  try {
    const original = loadRomModificationProject(file);
    const originalInputHashes = inputHashes(path.dirname(file));
    const originalSha256 = sourceExportSha256(fs.readFileSync(file));
    const next = loadSourceExportManifest(options.sourceDirectory);
    if (
      next.mapper !== original.baseline.mapper ||
      next.rom.headerSize !== original.baseline.rom.headerSize
    ) {
      throw new Error(
        "Mapper/copier-header changes require a new project and manual address mappings.",
      );
    }
    const candidateManifest = await createRomModificationProject(options);
    const root = path.dirname(candidateManifest);
    copyInputs(path.join(path.dirname(file), "inputs"), path.join(root, "inputs"));
    const owned = await buildRetainedModification({
      ...options,
      directory: path.join(root, ".old-owned"),
    });
    const oldRoot = modificationOwnedPath(path.dirname(file), original.baseline.snapshotDirectory!);
    const base = RomImage.load(path.join(oldRoot, "baseline.sfc"), {
      headerSize: original.baseline.rom.headerSize,
    });
    const incoming = RomImage.load(options.romFile, { headerSize: next.rom.headerSize });
    const oldOutput = fs.readFileSync(owned.outputPath);
    const fresh = loadRomModificationProject(candidateManifest);
    const size = Math.max(next.rom.contentSize, original.expansion?.size ?? 0);
    const incomingBytes = Buffer.alloc(size, original.expansion?.fill ?? 0);
    incomingBytes.set(incoming.read(0, incoming.length)!);
    const oldInterface = fs.readFileSync(path.join(oldRoot, "baseline-interface.asm"));
    const newInterface = fs.readFileSync(path.join(root, "baseline-interface.asm"));
    const interfaceChanged = !oldInterface.equals(newInterface);
    const conflicts: RebaseConflict[] = [];
    const replacements = original.replacements.map((entry) => {
      const length = entry.expected.length / 2;
      if (entry.offset + length > incomingBytes.length) {
        throw new Error(
          `New baseline is too short for ${entry.id}; choose an explicit relocation first.`,
        );
      }
      const before = Buffer.from(entry.expected, "hex");
      const after = incomingBytes.subarray(entry.offset, entry.offset + length);
      const authored = oldOutput.subarray(entry.offset, entry.offset + length);
      // A changed interface may alter assembly operands even when the bytes at this allocation are unchanged.
      const symbolRisk = interfaceChanged && entry.kind === "assembly";
      const byteConflict = !before.equals(after) && !authored.equals(after);
      if (symbolRisk || byteConflict) {
        conflicts.push({
          id: entry.id,
          offset: entry.offset,
          size: length,
          reason: symbolRisk
            ? "Baseline symbols/types changed; review this assembly owner's operands and the byte comparison."
            : "Both the baseline and this owner changed these bytes.",
          base: before.toString("hex"),
          incoming: after.toString("hex"),
          owned: authored.toString("hex"),
        });
      }
      return { ...entry, expected: after.toString("hex") };
    });
    const candidate: RomModificationProject = {
      ...fresh,
      replacements,
      ...(size > next.rom.contentSize
        ? { expansion: { size, fill: original.expansion?.fill ?? 0 } }
        : {}),
    };
    durableReplace(candidateManifest, JSON.stringify(candidate, null, 2) + "\n");
    loadRomModificationProject(candidateManifest);
    durableReplace(path.join(root, ".rebase-candidate.json"), fs.readFileSync(candidateManifest));
    const baseRom = path.join(root, "rebase-base.sfc");
    const ownedRom = path.join(root, "rebase-owned.sfc");
    const newRom = path.join(root, "rebase-incoming.sfc");
    durableReplace(baseRom, base.read(0, base.length)!);
    durableReplace(ownedRom, oldOutput);
    durableReplace(newRom, incomingBytes);
    let candidateBuild: RomRebaseReview["candidateBuild"];
    let buildError: string | undefined;
    try {
      const result = await buildModifiedRom({ ...options, manifestFile: candidateManifest });
      candidateBuild = { outputPath: result.outputPath, changedBytes: result.changedBytes };
    } catch (error) {
      options.signal?.throwIfAborted();
      buildError = error instanceof Error ? error.message : String(error);
    }
    if (
      JSON.stringify(inputHashes(path.dirname(file))) !== JSON.stringify(originalInputHashes) ||
      sourceExportSha256(fs.readFileSync(file)) !== originalSha256
    ) {
      throw new Error(
        "Original modification changed while preparing rebase. Preserved draft needs a fresh review.",
      );
    }
    const review: RomRebaseReview = {
      format: "uttori-rom-rebase-review",
      originalManifest: file,
      originalSha256,
      candidateManifest,
      candidateSha256: sourceExportSha256(fs.readFileSync(candidateManifest)),
      originalInputHashes,
      candidateBuild,
      buildError,
      inputHashes: inputHashes(root),
      conflicts,
      resolutions: {},
      baseRom,
      ownedRom,
      newRom,
    };
    const reviewFile = path.join(root, "rebase-review.json");
    durableReplace(reviewFile, JSON.stringify(review, null, 2) + "\n");
    // Keep a trusted copy separate from the editable resolutions document.
    durableReplace(path.join(root, ".rebase-review.json"), JSON.stringify(review));
    return reviewFile;
  } finally {
    lease.release();
  }
}

/** Accept only the reviewed fork, after validating all conflict choices and rebuilding its exact inputs.
 * @param {object} options Review JSON with user-filled resolutions; other fields remain pinned to the retained review.
 * @returns {Promise<object>} New manifest and verified output; the host may now explicitly select this target.
 */
export async function acceptRomRebase(
  options: Omit<ModificationOperationOptions, "manifestFile"> & { reviewFile: string },
): Promise<{ manifestFile: string; build: Awaited<ReturnType<typeof buildModifiedRom>> }> {
  const root = path.dirname(path.resolve(options.reviewFile));
  const review = JSON.parse(
    fs.readFileSync(path.join(root, ".rebase-review.json"), "utf8"),
  ) as RomRebaseReview;
  const edited = JSON.parse(fs.readFileSync(options.reviewFile, "utf8")) as RomRebaseReview;
  if (
    review.format !== "uttori-rom-rebase-review" ||
    path.resolve(review.candidateManifest) !== path.join(root, "modification.json")
  ) {
    throw new Error("Invalid rebase review.");
  }
  const file = review.candidateManifest;
  const originalCandidate = path.join(root, ".rebase-candidate.json");
  if (sourceExportSha256(fs.readFileSync(originalCandidate)) !== review.candidateSha256) {
    throw new Error("Retained rebase candidate changed.");
  }
  const candidate = loadRomModificationProject(originalCandidate);
  const removed = new Set(
    review.conflicts
      .filter((entry) => edited.resolutions?.[entry.id] === "take-baseline")
      .map((entry) => entry.id),
  );
  const accepted =
    JSON.stringify(
      {
        ...candidate,
        replacements: candidate.replacements.filter((entry) => !removed.has(entry.id)),
      },
      null,
      2,
    ) + "\n";
  const assertReview = (): void => {
    if (
      sourceExportSha256(fs.readFileSync(review.originalManifest)) !== review.originalSha256 ||
      // A retry may observe the final manifest before its acceptance receipt was flushed.
      ![review.candidateSha256, sourceExportSha256(accepted)].includes(
        sourceExportSha256(fs.readFileSync(file)),
      ) ||
      JSON.stringify(inputHashes(root)) !== JSON.stringify(review.inputHashes) ||
      JSON.stringify(inputHashes(path.dirname(review.originalManifest))) !==
        JSON.stringify(review.originalInputHashes)
    ) {
      throw new Error(
        "Rebase inputs changed after review. Prepare a new review; this draft is retained.",
      );
    }
  };
  assertReview();
  for (const conflict of review.conflicts) {
    if (!["keep-owned", "take-baseline"].includes(edited.resolutions?.[conflict.id])) {
      throw new Error(
        `Resolve ${conflict.id} at ROM offset 0x${conflict.offset.toString(16)} with keep-owned or take-baseline.`,
      );
    }
  }
  // Validate decisions through a separate manifest. A failed build must leave the review retryable.
  const proposed = path.join(root, `.accept-${randomUUID()}.json`);
  durableReplace(proposed, accepted);
  const build = await buildModifiedRom({ ...options, manifestFile: proposed });
  const lease = acquireFileLease(path.join(root, ".build.lock"));
  try {
    assertReview();
    durableReplace(file, accepted);
    durableReplace(
      path.join(root, "rebase-accepted.json"),
      JSON.stringify({ review, resolutions: edited.resolutions, build }, null, 2),
    );
  } finally {
    lease.release();
  }
  return { manifestFile: file, build };
}

/** Create a fully user-owned source tree in a new directory, with provenance but no generated manifest.
 * @param {object} options Verified baseline, ROM and fresh destination. Generated files are copied, never edited in place.
 * @returns {Promise<string>} New assembly entry path. Analysis databases and runtime captures remain with their original ROM.
 */
export async function detachRomSource(
  options: Omit<ModificationOperationOptions, "manifestFile"> & {
    sourceDirectory: string;
    romFile: string;
    directory: string;
    draft?: { readonly reviewFile: string; readonly sha256: string };
  },
): Promise<string> {
  // Creating a verified modification project supplies a complete retained baseline before ownership changes.
  const temp = path.join(path.dirname(options.directory), `.detach-${randomUUID()}`);
  let draft: import("./source-reconciliation.js").SourceEditReview | undefined;
  let verifiedSource = options.sourceDirectory;
  let verifiedRom = options.romFile;
  if (options.draft) {
    const bytes = fs.readFileSync(options.draft.reviewFile);
    if (sourceExportSha256(bytes) !== options.draft.sha256) {
      throw new Error("Source draft review changed.");
    }
    draft = JSON.parse(
      bytes.toString("utf8"),
    ) as import("./source-reconciliation.js").SourceEditReview;
    if (
      draft.format !== "uttori-source-edit-review" ||
      sourceExportSha256(fs.readFileSync(draft.draftFile)) !== draft.sourceSha256
    ) {
      throw new Error("Invalid retained source draft.");
    }
    const old = loadRomModificationProject(draft.manifestFile);
    const root = path.dirname(draft.manifestFile);
    if (
      path.resolve(root, old.baseline.sourceDirectory) !== path.resolve(options.sourceDirectory) ||
      !old.baseline.snapshotDirectory
    ) {
      throw new Error("Draft belongs to another source project.");
    }
    const snapshot = modificationOwnedPath(root, old.baseline.snapshotDirectory);
    verifiedSource = path.join(snapshot, "source");
    verifiedRom = path.join(snapshot, "baseline.sfc");
    if (
      sourceExportSha256(fs.readFileSync(path.join(verifiedSource, "generated-files.json"))) !==
      old.baseline.manifestSha256
    ) {
      throw new Error("Retained baseline generation changed.");
    }
  }
  const configName = loadSourceExportManifest(verifiedSource).buildConfiguration;
  const load = options.loadEnvironment;
  await createRomModificationProject({
    ...options,
    sourceDirectory: verifiedSource,
    romFile: verifiedRom,
    directory: temp,
    loadEnvironment: load ? () => load(path.join(options.sourceDirectory, configName)) : undefined,
  });
  const project = loadRomModificationProject(path.join(temp, "modification.json"));
  const source = path.join(temp, project.baseline.snapshotDirectory!, "source");
  const manifest = loadSourceExportManifest(source);
  if (fs.existsSync(options.directory)) {
    throw new Error("Detached destination already exists.");
  }
  fs.mkdirSync(options.directory);
  for (const name of new Set([
    ...manifest.files.map((entry) => entry.path),
    ...(manifest.inputs ?? []).map((entry) => entry.path),
  ])) {
    if (name === manifest.ownershipFile) {
      continue;
    }
    const destination = path.join(options.directory, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    durableReplace(destination, fs.readFileSync(assetSourcePath(source, name)));
  }
  if (draft) {
    const declared = manifest.files.find((entry) => entry.path === draft.relative);
    if (!declared || declared.sha256 !== draft.baselineSha256) {
      throw new Error("Draft baseline does not match the detached source.");
    }
    // Ownership is now manual in this new directory. The preserved edit may intentionally fail assembly.
    durableReplace(
      assetSourcePath(options.directory, draft.relative),
      fs.readFileSync(draft.draftFile),
    );
  }
  const configFile = path.join(options.directory, manifest.buildConfiguration);
  const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as {
    plugins?: (string | { module?: string })[];
  };
  // Plugin modules are external dependencies, not ROM assets. Anchor relative specs to the original config.
  if (config.plugins) {
    config.plugins = config.plugins.map((plugin) => {
      if (typeof plugin === "string") {
        return plugin.startsWith(".") ? path.resolve(options.sourceDirectory, plugin) : plugin;
      }
      if (plugin.module?.startsWith(".")) {
        return { ...plugin, module: path.resolve(options.sourceDirectory, plugin.module) };
      }
      return plugin;
    });
  }
  durableReplace(configFile, JSON.stringify(config, null, 2) + "\n");
  durableReplace(
    path.join(options.directory, "detached-source.json"),
    JSON.stringify(
      {
        format: "uttori-detached-source",
        ownership: "manual",
        draft: draft?.draftFile,
        buildStatus: draft ? "Unverified edited source" : "Verified baseline copy",
        originalSource: path.resolve(options.sourceDirectory),
        baseline: project.baseline,
        retainedBaseline: temp,
        note: "All assembly and assets here are user-owned. Regeneration does not target this directory. Plugin dependencies still use their original locations.",
      },
      null,
      2,
    ),
  );
  return path.join(options.directory, manifest.entrySource);
}

/** Rebuild manually reconciled candidate inputs and issue a fresh review without losing earlier versions.
 * @param {object} options Existing review file, its exact digest and trusted build services.
 * @returns {Promise<string>} Updated public review path. Acceptance still needs explicit conflict decisions.
 */
export async function refreshRomRebaseReview(
  options: Omit<ModificationOperationOptions, "manifestFile"> & {
    reviewFile: string;
    reviewSha256: string;
  },
): Promise<string> {
  const root = path.dirname(path.resolve(options.reviewFile));
  const publicBytes = fs.readFileSync(options.reviewFile);
  if (sourceExportSha256(publicBytes) !== options.reviewSha256) {
    throw new Error("Rebase review changed before refresh.");
  }
  const review = JSON.parse(
    fs.readFileSync(path.join(root, ".rebase-review.json"), "utf8"),
  ) as RomRebaseReview;
  const edited = JSON.parse(publicBytes.toString("utf8")) as RomRebaseReview;
  if (
    review.format !== "uttori-rom-rebase-review" ||
    review.candidateManifest !== path.join(root, "modification.json")
  ) {
    throw new Error("Invalid rebase review.");
  }
  if (
    sourceExportSha256(fs.readFileSync(review.originalManifest)) !== review.originalSha256 ||
    sourceExportSha256(fs.readFileSync(review.candidateManifest)) !== review.candidateSha256 ||
    JSON.stringify(inputHashes(path.dirname(review.originalManifest))) !==
      JSON.stringify(review.originalInputHashes)
  ) {
    throw new Error(
      "Rebase placement or original inputs changed. Prepare a new fork; this candidate is retained.",
    );
  }
  const hashes = inputHashes(root);
  let candidateBuild: RomRebaseReview["candidateBuild"];
  let buildError: string | undefined;
  try {
    const result = await buildModifiedRom({ ...options, manifestFile: review.candidateManifest });
    candidateBuild = { outputPath: result.outputPath, changedBytes: result.changedBytes };
  } catch (error) {
    options.signal?.throwIfAborted();
    buildError = error instanceof Error ? error.message : String(error);
  }
  const lease = acquireFileLease(path.join(root, ".build.lock"));
  try {
    if (
      JSON.stringify(inputHashes(root)) !== JSON.stringify(hashes) ||
      !fs.readFileSync(options.reviewFile).equals(publicBytes)
    ) {
      throw new Error("Candidate changed during review refresh. Refresh again.");
    }
    const history = path.join(root, ".rebase-reviews", sourceExportSha256(publicBytes));
    fs.mkdirSync(history, { recursive: true });
    durableReplace(path.join(history, "review.json"), publicBytes);
    // Retain each reviewed candidate input version, including edits that later fail to build.
    copyInputs(path.join(root, "inputs"), path.join(history, "inputs"));
    const next: RomRebaseReview = {
      ...review,
      candidateBuild,
      buildError,
      inputHashes: hashes,
      editedInputs: [
        ...new Set([...Object.keys(hashes), ...Object.keys(review.originalInputHashes)]),
      ].filter((name) => hashes[name] !== review.originalInputHashes[name]),
      resolutions: edited.resolutions ?? {},
    };
    durableReplace(path.join(root, ".rebase-review.json"), JSON.stringify(next));
    durableReplace(options.reviewFile, JSON.stringify(next, null, 2) + "\n");
    return options.reviewFile;
  } finally {
    lease.release();
  }
}
