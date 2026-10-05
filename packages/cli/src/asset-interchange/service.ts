import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { decodeAsepriteDocument, encodeAsepriteDocument } from "@uttori/asm-assets/aseprite";
import { readIndexedOwnership } from "@uttori/asm-assets/indexed-ownership";
import {
  interchangeCapabilities,
  inspectTilemapInterchange,
  type TilemapInterchangeBaseline,
} from "@uttori/asm-assets/interchange";
import { ASSET_LIMITS, boundedSum } from "@uttori/asm-assets/limits";
import {
  inspectRasterInterchange,
  type RasterInterchangeBaseline,
} from "@uttori/asm-assets/raster-interchange";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  acquireSourceOperationLease,
  applySourceFileTransaction,
  assertNoSourceOperation,
  assertSourcePath,
  openSourceProject,
  syncDirectory,
  type SourceFileReplacement,
} from "@uttori/asm-disassembler";
import { fingerprintNodeToolchain } from "@uttori/asm-plugin-loader-node";

import { inspectSourceProject, type SourceProjectInspection } from "../source.js";
import type {
  AssetAdapterContext,
  AssetAdapterPlan,
  AssetExportManifest,
  AssetImportReview,
  AssetNativeEffect,
  AssetSourceAdapter,
  AssetSourceHost,
  AssetStructureCodec,
  AssetInterchangeBaseline,
} from "./contracts.js";
import {
  object,
  text,
  digest,
  locator,
  number,
  strings,
  bytes,
  capabilities,
  immutableReview,
  readAssetExportManifest,
} from "./public-records.js";
import {
  AssetRecordStore,
  assetDirectory,
  assetHash,
  assetPath,
  readAssetFile,
} from "./record-store.js";
export { readAssetExportManifest, readAssetImportReview } from "./public-records.js";

declare const UTTORI_SOURCE_BUNDLED: boolean;

/** One portable production codec; capability intersection is persisted with each export. */
export const asepriteStructureCodec: AssetStructureCodec = Object.freeze({
  id: "aseprite.indexed-structure",
  version: 2,
  fileBytes: ASSET_LIMITS.asepriteBytes,
  capabilities: {
    pixelEdits: true,
    paletteEdits: true,
    tileReferences: true,
    previewTimeline: true,
  },
  encode: encodeAsepriteDocument,
  decode: decodeAsepriteDocument,
});

/** Normal source loading/building shared by CLI and editor workers; optional hooks add host coordination. */
export const savedAssetSourceHost: AssetSourceHost = {
  async open(directory) {
    const project = await openSourceProject(directory);
    return { repository: project.repository, project: project.configuration.id };
  },
  inspect: inspectSourceProject,
};

type FileHash = { readonly path: string; readonly sha256: string };
/** Private container bytes are always structural Aseprite, independently of the exported presentation format. */
type StoredPresentation =
  | (Omit<TilemapInterchangeBaseline, "document"> & { readonly documentBytes: Uint8Array })
  | (Omit<RasterInterchangeBaseline, "document"> & { readonly documentBytes: Uint8Array });
interface Baseline<Selection, Bindings> {
  readonly format: "uttori-asset-baseline";
  readonly version: 2;
  readonly manifest: AssetExportManifest;
  readonly selection: Selection;
  readonly bindings: Bindings;
  readonly presentation: StoredPresentation;
  readonly dependencies: readonly FileHash[];
  readonly configuration: string;
  readonly toolchain: string;
  readonly implementation: string;
}

/** Representation normalization feeds the same owner deltas into adapter planning and source publication. */
function inspectPresentation(baseline: AssetInterchangeBaseline, after = baseline.document) {
  if (baseline.kind === "raster") {
    return inspectRasterInterchange(baseline, after);
  }
  return inspectTilemapInterchange(baseline, after);
}
interface ReviewedPlan {
  readonly format: "uttori-asset-reviewed-plan";
  readonly version: 2;
  readonly summary: AssetImportReview;
  readonly baselineSha256: string;
  readonly configuration: string;
  readonly toolchain: string;
  readonly implementation: string;
  readonly snapshots: readonly FileHash[];
  readonly files: readonly SourceFileReplacement[];
  readonly effects: readonly AssetNativeEffect[];
}

/** Source names are relative to the current selected checkout. No copied manifest can supply an absolute path. */
function sourceFile(root: string, name: string): string {
  assertSourcePath(name);
  let file = root;
  const parts = name.split("/");
  parts.forEach((part, index) => {
    file = path.join(file, part);
    const stat = fs.lstatSync(file);
    if (
      stat.isSymbolicLink() ||
      (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())
    ) {
      throw new Error(`Invalid asset source path: ${name}.`);
    }
  });
  return file;
}
function fileHashes(value: unknown): FileHash[] {
  if (!Array.isArray(value) || value.length > 65536) {
    throw new Error("Invalid asset dependency inventory.");
  }
  const seen = new Set<string>();
  return value.map((entry) => {
    const item = object(entry),
      name = text(item.path);
    assertSourcePath(name);
    if (seen.has(name)) {
      throw new Error(`Duplicate asset dependency: ${name}.`);
    }
    seen.add(name);
    return { path: name, sha256: digest(item.sha256) };
  });
}
function replacements(value: unknown): SourceFileReplacement[] {
  if (!Array.isArray(value) || value.length > 65536) {
    throw new Error("Invalid asset replacement inventory.");
  }
  const seen = new Set<string>();
  let total = 0;
  return value.map((entry) => {
    const item = object(entry),
      name = text(item.path);
    assertSourcePath(name);
    if (seen.has(name)) {
      throw new Error("Duplicate asset source replacement.");
    }
    seen.add(name);
    const before = Uint8Array.from(bytes(item.before)),
      after = Uint8Array.from(bytes(item.after));
    total = boundedSum(
      total,
      before.length + after.length,
      ASSET_LIMITS.decodedBytes,
      "Asset replacements",
    );
    return { path: name, before, after };
  });
}
function effects(value: unknown): AssetNativeEffect[] {
  if (!Array.isArray(value) || value.length > 65536) {
    throw new Error("Invalid native effect inventory.");
  }
  let total = 0;
  return value.map((entry) => {
    const item = object(entry),
      before = Uint8Array.from(bytes(item.before)),
      after = Uint8Array.from(bytes(item.after));
    if (!before.length || before.length !== after.length) {
      throw new Error("Native effects require a fixed nonempty extent.");
    }
    total = boundedSum(
      total,
      before.length + after.length,
      ASSET_LIMITS.decodedBytes,
      "Native effects",
    );
    return {
      resource: text(item.resource),
      offset: number(item.offset, Number.MAX_SAFE_INTEGER),
      before,
      after,
      consumers: strings(item.consumers),
    };
  });
}

function cleanBuild(build: SourceProjectInspection): void {
  if (build.diagnostics.length) {
    throw new Error(build.diagnostics.map((item) => item.message).join("\n"));
  }
}
function equal(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(b);
}

/** The independent host byte oracle permits only attributed replacements over the complete normal output. */
function expectedOutput(
  build: SourceProjectInspection,
  changes: readonly AssetNativeEffect[],
): Uint8Array {
  const expected = Uint8Array.from(build.output),
    sorted = changes.toSorted((a, b) => a.offset - b.offset);
  let end = 0;
  for (const effect of sorted) {
    if (
      effect.offset < end ||
      effect.offset > expected.length - effect.before.length ||
      !equal(expected.subarray(effect.offset, effect.offset + effect.before.length), effect.before)
    ) {
      throw new Error(
        `Native effect has overlapping, stale or unattributed extent: ${effect.resource}.`,
      );
    }
    expected.set(effect.after, effect.offset);
    end = effect.offset + effect.before.length;
  }
  return expected;
}

/** Exact consumed snapshots, plus non-assembly adapter declarations, detect changes around asynchronous work. */
function snapshots(build: SourceProjectInspection, dependencies: readonly FileHash[]): FileHash[] {
  const result = new Map<string, string>(dependencies.map((item) => [item.path, item.sha256]));
  for (const [file, data] of build.snapshots) {
    const name = path.relative(build.root, file).split(path.sep).join("/");
    assertSourcePath(name);
    const sha256 = assetHash(data),
      previous = result.get(name);
    if (previous !== undefined && previous !== sha256) {
      throw new Error(`Asset input changed during inspection: ${name}.`);
    }
    result.set(name, sha256);
  }
  return [...result]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([name, sha256]) => ({ path: name, sha256 }));
}
function assertFiles(root: string, files: readonly FileHash[]): void {
  for (const file of files) {
    if (assetHash(readAssetFile(sourceFile(root, file.path), 256 * 1024 * 1024)) !== file.sha256) {
      throw new Error(`Stale asset input: ${file.path}. Review/export again.`);
    }
  }
}
function reviewIdentity(
  value: Omit<ReviewedPlan, "summary">,
  summary: Omit<AssetImportReview, "id">,
): string {
  return assetHash(
    canonicalJson({
      ...summary,
      baseline: value.baselineSha256,
      configuration: value.configuration,
      toolchain: value.toolchain,
      implementation: value.implementation,
      snapshots: value.snapshots,
      effects: value.effects.map((item) => ({
        ...item,
        before: assetHash(item.before),
        after: assetHash(item.after),
      })),
    }),
  );
}

/** Saved-source lifecycle shared by command-line and editor hosts. Reviews persist exact plans, never guessed editor intent. */
export class AssetInterchangeService<Selection, Bindings> {
  constructor(
    readonly directory: string,
    readonly adapter: AssetSourceAdapter<Selection, Bindings>,
    readonly codec: AssetStructureCodec = asepriteStructureCodec,
    readonly host: AssetSourceHost = savedAssetSourceHost,
  ) {
    if (
      !Number.isSafeInteger(codec.fileBytes) ||
      codec.fileBytes < 1 ||
      codec.fileBytes > ASSET_LIMITS.pngBytes
    ) {
      throw new Error("Invalid codec file budget.");
    }
  }

  private implementation(): string {
    if (this.host.implementationIdentity) {
      return digest(this.host.implementationIdentity(this.adapter.module));
    }
    const file = fileURLToPath(import.meta.url);
    const bundles =
      typeof UTTORI_SOURCE_BUNDLED !== "undefined" && UTTORI_SOURCE_BUNDLED ? [file] : [];
    return fingerprintNodeToolchain([file, this.adapter.module], bundles).sha256;
  }
  private stores(root: string): { exports: AssetRecordStore; reviews: AssetRecordStore } {
    return {
      exports: new AssetRecordStore(path.join(root, ".uttori-local/asset-interchange/exports")),
      reviews: new AssetRecordStore(path.join(root, ".uttori-local/asset-interchange/reviews")),
    };
  }
  private context(
    project: string,
    build: SourceProjectInspection,
    signal?: AbortSignal,
    reads?: Set<string>,
  ): AssetAdapterContext {
    const captured = new Map(build.snapshots);
    return {
      project,
      build: { ...build, snapshots: captured },
      signal,
      read(name) {
        const file = sourceFile(build.root, name);
        reads?.add(name);
        let original = captured.get(file);
        // Research and unused alias declarations may not be assembly inputs; retain their first exact read too.
        if (!original) {
          original = readAssetFile(file, ASSET_LIMITS.decodedBytes);
          captured.set(file, original);
        }
        return Uint8Array.from(original);
      },
    };
  }
  private drafts(root: string, names: readonly string[], documents: readonly string[] = []): void {
    const paths = new Set([
      ...names.map((name) => path.resolve(root, name)),
      ...documents.map(assetPath),
    ]);
    // Editor providers may use absolute URIs converted to paths or project-relative saved-source names.
    const relevant =
      this.host
        .drafts?.()
        .filter((draft) => paths.has(assetPath(path.resolve(root, draft.path)))) ?? [];
    if (relevant.length) {
      throw new Error(
        `Save relevant asset drafts before interchange: ${relevant.map((draft) => draft.path + (draft.opaque ? " (opaque editor draft)" : "")).join(", ")}. Drafts are preserved.`,
      );
    }
  }
  private parseBaseline(value: unknown): Baseline<Selection, Bindings> {
    const input = object(value),
      view = object(input.presentation);
    if (
      input.format !== "uttori-asset-baseline" ||
      input.version !== 2 ||
      (view.kind !== "tilemap" && view.kind !== "raster")
    ) {
      throw new Error("Unsupported asset baseline; re-export is required.");
    }
    if (!Array.isArray(view.editablePaletteSlots) || view.editablePaletteSlots.length > 256) {
      throw new Error("Invalid palette authority.");
    }
    const common = {
      documentBytes: bytes(view.documentBytes),
      ownership: readIndexedOwnership(view.ownership),
      editablePaletteSlots: view.editablePaletteSlots.map((slot) => number(slot, 255)),
      capabilities: capabilities(view.capabilities),
    };
    let presentation: StoredPresentation;
    if (view.kind === "tilemap") {
      const nativeTransforms = strings(view.nativeTransforms, 3).map(
        (entry): "flipX" | "flipY" | "diagonal" => {
          if (entry !== "flipX" && entry !== "flipY" && entry !== "diagonal") {
            throw new Error("Invalid native transform policy.");
          }
          return entry;
        },
      );
      presentation = { ...common, kind: "tilemap", nativeTransforms };
    } else {
      if (!Array.isArray(view.placements) || view.placements.length > ASSET_LIMITS.owners) {
        throw new Error("Invalid private raster placement inventory.");
      }
      const placements = view.placements.map((candidate) => {
        const entry = object(candidate);
        return {
          view: text(entry.view),
          x: number(entry.x, ASSET_LIMITS.interchangeSide),
          y: number(entry.y, ASSET_LIMITS.interchangeSide),
        };
      });
      presentation = { ...common, kind: "raster", placements };
    }
    return {
      format: input.format,
      version: input.version,
      manifest: readAssetExportManifest(input.manifest),
      selection: this.adapter.readSelection(input.selection),
      bindings: this.adapter.readBindings(input.bindings),
      presentation,
      dependencies: fileHashes(input.dependencies),
      configuration: digest(input.configuration),
      toolchain: digest(input.toolchain),
      implementation: digest(input.implementation),
    };
  }
  private parseReview(value: unknown): ReviewedPlan {
    const input = object(value),
      summary = object(input.summary);
    if (
      input.format !== "uttori-asset-reviewed-plan" ||
      input.version !== 2 ||
      summary.format !== "uttori-asset-review" ||
      summary.version !== 2
    ) {
      throw new Error("Unsupported asset review; review again.");
    }
    const files = replacements(input.files),
      native = effects(input.effects);
    const result: ReviewedPlan = {
      format: input.format,
      version: input.version,
      baselineSha256: digest(input.baselineSha256),
      configuration: digest(input.configuration),
      toolchain: digest(input.toolchain),
      implementation: digest(input.implementation),
      snapshots: fileHashes(input.snapshots),
      files,
      effects: native,
      summary: {
        format: summary.format,
        version: summary.version,
        id: digest(summary.id),
        exportId: locator(summary.exportId),
        documentSha256: digest(summary.documentSha256),
        outputSha256: digest(summary.outputSha256),
        files: files.map((item) => ({
          path: item.path,
          before: assetHash(item.before),
          after: assetHash(item.after),
        })),
        effects: native.map((item) => ({
          resource: item.resource,
          offset: item.offset,
          size: item.before.length,
          consumers: item.consumers,
        })),
      },
    };
    const { id, ...withoutId } = result.summary;
    if (
      canonicalJson(result.summary) !== canonicalJson(summary) ||
      reviewIdentity(result, withoutId) !== id
    ) {
      throw new Error("Asset review plan hash mismatch.");
    }
    return result;
  }

  private async load(manifestValue: unknown, signal?: AbortSignal) {
    const manifest = readAssetExportManifest(manifestValue),
      project = await this.host.open(this.directory),
      stores = this.stores(project.repository.root);
    assertNoSourceOperation(project.repository);
    const stored = stores.exports.read(manifest.id, (value) => this.parseBaseline(value)),
      baseline = stored.value;
    if (
      canonicalJson(manifest) !== canonicalJson(baseline.manifest) ||
      manifest.project !== project.project ||
      manifest.adapter.id !== this.adapter.id ||
      manifest.adapter.version !== this.adapter.version ||
      manifest.codec.id !== this.codec.id ||
      manifest.codec.version !== this.codec.version ||
      baseline.implementation !== this.implementation()
    ) {
      throw new Error(
        "Asset export does not match this project's baseline or installed conversion contracts. Re-export is required.",
      );
    }
    this.drafts(
      project.repository.root,
      baseline.dependencies.map((item) => item.path),
    );
    assertFiles(project.repository.root, baseline.dependencies);
    const build = await this.host.inspect(this.directory, undefined, signal);
    cleanBuild(build);
    if (
      baseline.configuration !== build.configurationSha256 ||
      baseline.toolchain !== build.toolchainSha256
    ) {
      throw new Error("Stale asset configuration or toolchain; re-export is required.");
    }
    const document = await decodeAsepriteDocument(baseline.presentation.documentBytes, signal);
    const presentation: AssetInterchangeBaseline = { ...baseline.presentation, document };
    if (
      document.exportId !== manifest.id ||
      canonicalJson(presentation.capabilities) !== canonicalJson(manifest.capabilities) ||
      canonicalJson(presentation.capabilities) !==
        canonicalJson(
          interchangeCapabilities(
            presentation.capabilities,
            this.adapter.capabilities,
            this.codec.capabilities,
          ),
        )
    ) {
      throw new Error("Inconsistent private asset baseline.");
    }
    inspectPresentation(presentation, document);
    assertFiles(build.root, snapshots(build, baseline.dependencies));
    return { manifest, project, stores, baseline, baselineHash: stored.hash, build, presentation };
  }

  /** Publish artifacts first and the complete private record last. An interrupted export grants no partial authority. */
  async export(
    selectionValue: unknown,
    outputs: { readonly document: string; readonly manifest: string },
    signal?: AbortSignal,
  ): Promise<AssetExportManifest> {
    signal?.throwIfAborted();
    const project = await this.host.open(this.directory),
      lease = acquireSourceOperationLease(project.repository);
    const written: { file: string; hash: string }[] = [];
    try {
      assertNoSourceOperation(project.repository);
      const build = await this.host.inspect(this.directory, undefined, signal);
      cleanBuild(build);
      const id = randomUUID(),
        selection = this.adapter.readSelection(selectionValue),
        implementation = this.implementation();
      const adapterReads = new Set<string>(),
        context = this.context(project.project, build, signal, adapterReads);
      const exported = await this.adapter.export(context, selection, id);
      const prepared = this.codec.prepare?.(exported.baseline) ?? exported.baseline;
      const profile = interchangeCapabilities(
        prepared.capabilities,
        this.adapter.capabilities,
        this.codec.capabilities,
      );
      const presentation = { ...prepared, capabilities: profile };
      inspectPresentation(presentation);
      if (presentation.document.exportId !== id) {
        throw new Error("Adapter omitted export identity.");
      }
      // Every adapter read is a dependency even when the adapter forgets its explicit declaration.
      const names = [...new Set([...exported.dependencies, ...adapterReads])].toSorted();
      this.drafts(build.root, names, [outputs.document, outputs.manifest]);
      const dependencies = names.map((name) => ({
        path: name,
        sha256: assetHash(readAssetFile(sourceFile(build.root, name), 256 * 1024 * 1024)),
      }));
      const allInputs = snapshots(context.build, dependencies),
        payload = await this.codec.encode(presentation.document, signal);
      if (payload.length > this.codec.fileBytes) {
        throw new Error("Asset codec output exceeds file budget.");
      }
      const manifest: AssetExportManifest = {
        format: "uttori-asset-export",
        version: 2,
        id,
        project: project.project,
        asset: exported.asset,
        adapter: { id: this.adapter.id, version: this.adapter.version },
        codec: { id: this.codec.id, version: this.codec.version },
        capabilities: profile,
      };
      const { document: presentationDocument, ...presentationMetadata } = presentation;
      const baseline: Baseline<Selection, Bindings> = {
        format: "uttori-asset-baseline",
        version: 2,
        manifest,
        selection,
        bindings: this.adapter.readBindings(exported.bindings),
        presentation: {
          ...presentationMetadata,
          documentBytes: await encodeAsepriteDocument(presentationDocument, signal),
        },
        dependencies,
        configuration: build.configurationSha256,
        toolchain: build.toolchainSha256,
        implementation,
      };
      // Validate the serialized authority too; adapters do not bypass private-record schema checks.
      this.parseBaseline(baseline);
      this.drafts(build.root, names, [outputs.document, outputs.manifest]);
      assertFiles(build.root, allInputs);
      signal?.throwIfAborted();
      for (const [name, data] of [
        [outputs.document, payload],
        [outputs.manifest, new TextEncoder().encode(JSON.stringify(manifest, null, 2) + "\n")],
      ] as const) {
        const file = path.join(
            assetDirectory(path.dirname(path.resolve(name))),
            path.basename(name),
          ),
          fd = fs.openSync(file, "wx", 0o600);
        written.push({ file, hash: assetHash(data) });
        try {
          fs.writeFileSync(fd, data);
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        syncDirectory(path.dirname(file));
      }
      this.drafts(build.root, names, [outputs.document, outputs.manifest]);
      assertFiles(build.root, allInputs);
      if (implementation !== this.implementation()) {
        throw new Error("Installed asset implementation changed during export.");
      }
      this.stores(build.root).exports.publish(id, baseline, signal);
      return manifest;
    } catch (cause) {
      for (const item of written.toReversed()) {
        if (
          fs.existsSync(item.file) &&
          assetHash(readAssetFile(item.file, this.codec.fileBytes)) === item.hash
        ) {
          fs.unlinkSync(item.file);
        }
      }
      throw cause;
    } finally {
      lease.release();
    }
  }

  /** Decode and build once, then persist a stable exact plan. A review never writes selected source. */
  async review(
    manifestValue: unknown,
    documentFile: string,
    signal?: AbortSignal,
  ): Promise<AssetImportReview> {
    const loaded = await this.load(manifestValue, signal);
    this.drafts(loaded.build.root, [], [documentFile]);
    const input = readAssetFile(documentFile, this.codec.fileBytes),
      documentSha256 = assetHash(input);
    const after = await this.codec.decode(input, signal, loaded.presentation.document),
      changes = inspectPresentation(loaded.presentation, after);
    const context = this.context(loaded.project.project, loaded.build, signal);
    const proposed = await this.adapter.plan(
      context,
      loaded.baseline.selection,
      loaded.baseline.bindings,
      changes,
    );
    const plan: AssetAdapterPlan = {
      files: replacements(proposed.files),
      effects: effects(proposed.effects),
    };
    const names = [
      ...new Set([
        ...loaded.baseline.dependencies.map((item) => item.path),
        ...plan.files.map((item) => item.path),
      ]),
    ];
    this.drafts(loaded.build.root, names, [documentFile]);
    for (const file of plan.files) {
      if (
        !loaded.baseline.dependencies.some((entry) => entry.path === file.path) ||
        !equal(
          readAssetFile(sourceFile(loaded.build.root, file.path), ASSET_LIMITS.decodedBytes),
          file.before,
        )
      ) {
        throw new Error(`Adapter proposed an undeclared or stale source change: ${file.path}.`);
      }
    }
    const expected = expectedOutput(loaded.build, plan.effects),
      overlay = plan.files.length
        ? await this.host.inspect(
            this.directory,
            new Map(plan.files.map((item) => [item.path, item.after])),
            signal,
          )
        : loaded.build;
    cleanBuild(overlay);
    if (!equal(overlay.output, expected)) {
      throw new Error(
        "Asset overlay changes output outside attributed native effects, including derived/checksum policy.",
      );
    }
    await this.adapter.verify?.(context, plan, overlay);
    const inputSnapshots = snapshots(context.build, loaded.baseline.dependencies);
    const details: Omit<ReviewedPlan, "summary"> = {
      format: "uttori-asset-reviewed-plan",
      version: 2,
      baselineSha256: loaded.baselineHash,
      configuration: loaded.build.configurationSha256,
      toolchain: loaded.build.toolchainSha256,
      implementation: loaded.baseline.implementation,
      snapshots: inputSnapshots,
      files: plan.files,
      effects: plan.effects,
    };
    const summary: Omit<AssetImportReview, "id"> = {
      format: "uttori-asset-review",
      version: 2,
      exportId: loaded.manifest.id,
      documentSha256,
      outputSha256: assetHash(overlay.output),
      files: plan.files.map((item) => ({
        path: item.path,
        before: assetHash(item.before),
        after: assetHash(item.after),
      })),
      effects: plan.effects.map((item) => ({
        resource: item.resource,
        offset: item.offset,
        size: item.before.length,
        consumers: item.consumers,
      })),
    };
    const id = reviewIdentity(details, summary),
      result = { ...summary, id },
      persisted: ReviewedPlan = { ...details, summary: result };
    const lease = acquireSourceOperationLease(loaded.project.repository);
    try {
      assertNoSourceOperation(loaded.project.repository);
      this.drafts(
        loaded.build.root,
        inputSnapshots.map((item) => item.path),
        [documentFile],
      );
      assertFiles(loaded.build.root, inputSnapshots);
      if (
        assetHash(readAssetFile(documentFile, this.codec.fileBytes)) !== documentSha256 ||
        details.implementation !== this.implementation()
      ) {
        throw new Error("Document or installed asset implementation changed during review.");
      }
      if (fs.existsSync(path.join(loaded.stores.reviews.directory, id))) {
        loaded.stores.reviews.read(id, (value) => this.parseReview(value));
      } else {
        loaded.stores.reviews.publish(id, persisted, signal);
      }
    } finally {
      lease.release();
    }
    return immutableReview(result);
  }

  /** Apply the saved review, revalidating exact inputs and output. Never silently recompute a different native plan. */
  async apply(
    manifestValue: unknown,
    documentFile: string,
    reviewId: string,
    signal?: AbortSignal,
  ): Promise<{ readonly review: AssetImportReview; readonly transaction?: string }> {
    const loaded = await this.load(manifestValue, signal),
      stored = loaded.stores.reviews.read(digest(reviewId), (value) => this.parseReview(value)),
      reviewed = stored.value;
    if (
      reviewed.summary.id !== reviewId ||
      reviewed.summary.exportId !== loaded.manifest.id ||
      reviewed.baselineSha256 !== loaded.baselineHash ||
      reviewed.configuration !== loaded.build.configurationSha256 ||
      reviewed.toolchain !== loaded.build.toolchainSha256 ||
      reviewed.implementation !== this.implementation()
    ) {
      throw new Error("Stale or mismatched asset review. Review again.");
    }
    const names = reviewed.snapshots.map((item) => item.path);
    const validate = (): void => {
      signal?.throwIfAborted();
      this.drafts(loaded.build.root, names, [documentFile]);
      assertFiles(loaded.build.root, reviewed.snapshots);
      if (
        assetHash(readAssetFile(documentFile, this.codec.fileBytes)) !==
          reviewed.summary.documentSha256 ||
        reviewed.implementation !== this.implementation() ||
        loaded.stores.exports.read(loaded.manifest.id, (value) => this.parseBaseline(value))
          .hash !== reviewed.baselineSha256
      ) {
        throw new Error("Reviewed document, baseline or implementation changed. Review again.");
      }
    };
    validate();
    const overlay = reviewed.files.length
      ? await this.host.inspect(
          this.directory,
          new Map(reviewed.files.map((item) => [item.path, item.after])),
          signal,
        )
      : loaded.build;
    cleanBuild(overlay);
    if (
      !equal(overlay.output, expectedOutput(loaded.build, reviewed.effects)) ||
      assetHash(overlay.output) !== reviewed.summary.outputSha256 ||
      overlay.configurationSha256 !== reviewed.configuration ||
      overlay.toolchainSha256 !== reviewed.toolchain
    ) {
      throw new Error("Reviewed output changed. Review again.");
    }
    validate();
    // The editor can change while a worker builds. Its final acknowledgment checks live versions without moving source bytes over IPC.
    await this.host.beforePublish?.([
      ...names.map((name) => path.resolve(loaded.build.root, name)),
      path.resolve(documentFile),
    ]);
    validate();
    const transaction = applySourceFileTransaction(loaded.project.repository, reviewed.files, {
      signal,
      validate,
    });
    if (transaction) {
      const published = await this.host.inspect(this.directory, undefined, signal);
      cleanBuild(published);
      if (assetHash(published.output) !== reviewed.summary.outputSha256) {
        throw new Error(
          `Publication ${transaction.id} completed, but saved-source verification changed. Inspect current files before continuing.`,
        );
      }
      await this.host.completed?.();
    }
    return { review: immutableReview(reviewed.summary), transaction: transaction?.id };
  }
}
