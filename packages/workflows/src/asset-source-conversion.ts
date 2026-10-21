import fs from "node:fs";
import path from "node:path";

import type { IndexedDocument } from "@uttori/asm-assets/indexed-document";
import {
  indexedSourceCodecs,
  type AssetSourceCodecRegistry,
} from "@uttori/asm-assets/source-codecs";
import type { AssetEmissionInfo } from "@uttori/asm-core";
import {
  applySourceFileTransaction,
  assertSourcePath,
  sourceContentHash,
  parseSourceProject,
  type SourceFileChange,
} from "@uttori/asm-disassembler/source-project";

import type { AssetSourceHost } from "./asset-interchange/contracts.js";
import { savedAssetSourceHost } from "./asset-interchange/service.js";
import { editAssetCall, locateAssetCall } from "./asset-source-edits.js";
import type { SourceProjectInspection } from "./source.js";

/** Cursor coordinates identify one evaluated assembly statement, including continued calls and define-based paths. */
export interface AssetSourceConversionRequest {
  readonly directory: string;
  readonly file: string;
  /** One-based physical cursor line; the containing emitted statement is resolved from the current build. */
  readonly line: number;
  readonly representation: string;
  readonly destination?: string;
}

/** Native adapters supply mapping/resources; representation codecs only encode their shared document contract. */
export interface AssetConversionContext {
  readonly build: SourceProjectInspection;
  readonly selected: AssetEmissionInfo;
  readonly source: string;
  readonly destination: string;
  readonly codecs: AssetSourceCodecRegistry<IndexedDocument>;
  readonly representation: string;
  read(file: string): Uint8Array;
}

/** Precise option additions keyed by evaluated emission, plus source-sidecar creations/replacements. */
export interface AssetConversionCandidate {
  readonly bytes: Uint8Array;
  readonly changes: readonly SourceFileChange[];
  readonly updates: readonly {
    readonly emission: AssetEmissionInfo;
    readonly path?: string;
    readonly values: Readonly<Record<string, unknown>>;
  }[];
  /** Old authoring sources remain available when discovery cannot prove their full reference closure. */
  readonly retained?: readonly string[];
}

/** Extensible game/native adapter seam. Hosts may register new adapters without changing editor publication logic. */
export interface AssetSourceConversionAdapter {
  readonly id: string;
  supports(emission: AssetEmissionInfo): boolean;
  prepare(context: AssetConversionContext): Promise<AssetConversionCandidate>;
}

/** Complete validated source changes are reviewable and can be published through CLI transactions or native editor undo. */
export interface AssetSourceConversionPlan {
  readonly source: string;
  readonly destination: string;
  readonly outputSha256: string;
  readonly changes: readonly SourceFileChange[];
  readonly snapshots: readonly { readonly path: string; readonly sha256: string }[];
  readonly affected: readonly {
    readonly file: string;
    readonly line: number;
    readonly format: string;
  }[];
  readonly retained: readonly string[];
  /** Unassembled declarations or symlinks make the old source's complete reference set uncertain. */
  readonly unresolvedDeclarations: readonly string[];
  /** Discovery scope is rechecked before retirement, including newly created unassembled declarations. */
  readonly assemblyInventory: readonly string[];
}

/** Require a clean complete ROM oracle before and after any authoring representation switch. */
function assertBuild(build: SourceProjectInspection): void {
  if (build.diagnostics.length) {
    throw new Error(build.diagnostics.map((item) => item.message).join("\n"));
  }
}

/** A current build proves only its consumed calls. Unassembled source files conservatively retain the old input. */
export function assetSourceAssemblyInventory(root: string): string[] {
  // Editor URIs and native Git may spell the same macOS temporary root with different symlink prefixes.
  const absoluteRoot = fs.realpathSync(root);
  const project = parseSourceProject(
    JSON.parse(fs.readFileSync(path.join(absoluteRoot, ".uttori/project.json"), "utf8")),
  );
  const files: string[] = [];
  let visited = 0;
  const visit = (directory: string, depth = 0): void => {
    if (depth > 64) {
      throw new Error("Source conversion assembly discovery exceeds its directory depth budget.");
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (++visited > 65536) {
        throw new Error("Source conversion assembly discovery exceeds its file budget.");
      }
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        files.push(file);
      } else if (entry.isDirectory()) {
        visit(file, depth + 1);
      } else if (/\.(asm|s|inc)$/i.test(entry.name)) {
        files.push(file);
      }
    }
  };
  for (const sourceRoot of project.sourceRoots) {
    visit(path.resolve(absoluteRoot, sourceRoot));
  }
  return files.toSorted();
}

/** Source hosts, adapters and representation registries are injected independently for future editor/format support. */
export class AssetSourceConversionService {
  constructor(
    readonly adapters: readonly AssetSourceConversionAdapter[],
    readonly host: AssetSourceHost = savedAssetSourceHost,
    readonly codecs = indexedSourceCodecs(),
  ) {}

  /** Resolve the saved evaluated call; menus and execution share the same semantic context rules. */
  async resolve(
    request: Omit<AssetSourceConversionRequest, "representation" | "destination">,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    const build = await this.host.inspect(request.directory, undefined, signal);
    assertBuild(build);
    // Desktop URIs may use /var while native Git snapshots use /private/var on macOS.
    // Canonicalize the existing invocation file before comparing provider identities.
    const file = fs.realpathSync(path.resolve(build.root, request.file));
    const textBytes = build.snapshots.get(file);
    if (!textBytes) {
      throw new Error("The selected file is outside the current assembly context.");
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(textBytes);
    const offsets = text.split(/(?<=\n)/);
    if (!Number.isSafeInteger(request.line) || request.line < 1 || request.line > offsets.length) {
      throw new Error("Conversion has an invalid cursor line.");
    }
    const cursor = offsets.slice(0, request.line - 1).join("").length;
    const matches = build.mapping.assets.filter((emission) => {
      if (build.mapping.fileList[emission.fileIdx]?.name !== file || !emission.conversion) {
        return false;
      }
      const syntax = locateAssetCall(text, emission.line);
      return cursor >= offsets.slice(0, emission.line - 1).join("").length && cursor <= syntax.end;
    });
    if (matches.length !== 1) {
      throw new Error(
        "Asset conversion needs one unambiguous emitting include; repeated macro contexts require an explicit choice.",
      );
    }
    const selected = matches[0];
    const source = build.mapping.fileList[selected.assetFileIdx].name;
    const sourceBytes = build.snapshots.get(source);
    if (!sourceBytes) {
      throw new Error("Asset source snapshot is missing.");
    }
    const current = this.codecs.identify(sourceBytes, { path: source });
    return { build, selected, source, current };
  }

  async prepare(
    request: AssetSourceConversionRequest,
    signal?: AbortSignal,
  ): Promise<AssetSourceConversionPlan> {
    const { build, selected, source, current } = await this.resolve(request, signal);
    const projectFile = path.join(build.root, ".uttori/project.json");
    const projectBytes = fs.readFileSync(projectFile);
    const inventory = assetSourceAssemblyInventory(build.root);
    const target = this.codecs.get(request.representation);
    if (current.id === target.id) {
      throw new Error(`Asset already uses ${target.id}.`);
    }
    const destination = request.destination
      ? path.resolve(build.root, request.destination)
      : source.replace(/\.[^.]+$/, target.extensions[0]);
    const name = (absolute: string): string => {
      const relative = path.relative(build.root, absolute).split(path.sep).join("/");
      assertSourcePath(relative);
      return relative;
    };
    name(source);
    const destinationName = name(destination);
    if (fs.existsSync(destination)) {
      throw new Error(
        `Conversion destination already exists: ${destinationName}. Choose a different destination.`,
      );
    }
    const adapters = this.adapters.filter((adapter) => adapter.supports(selected));
    if (adapters.length !== 1) {
      throw new Error(`No unambiguous source conversion adapter for '${selected.format}'.`);
    }
    const candidate = await adapters[0].prepare({
      build,
      selected,
      source,
      destination,
      codecs: this.codecs,
      representation: target.id,
      read: (absolute) => {
        const bytes = build.snapshots.get(absolute);
        if (!bytes) {
          throw new Error(`Missing build resource snapshot: ${name(absolute)}.`);
        }
        return bytes.slice();
      },
    });
    signal?.throwIfAborted();
    let changes: SourceFileChange[] = [
      { path: destinationName, before: null, after: candidate.bytes },
      ...candidate.changes,
    ];
    const edits = new Map<
      string,
      { before: Uint8Array; text: string; updates: (typeof candidate.updates)[number][] }
    >();
    for (const update of candidate.updates) {
      const absolute = build.mapping.fileList[update.emission.fileIdx].name;
      const before = build.snapshots.get(absolute)!;
      const entry = edits.get(absolute) ?? {
        before,
        text: new TextDecoder().decode(before),
        updates: [],
      };
      if (entry.updates.some((existing) => existing.emission.line === update.emission.line)) {
        throw new Error("Conversion has repeated source emission at one call.");
      }
      entry.updates.push(update);
      edits.set(absolute, entry);
    }
    for (const [absolute, entry] of edits) {
      for (const update of entry.updates.toSorted((a, b) => b.emission.line - a.emission.line)) {
        entry.text = editAssetCall(entry.text, locateAssetCall(entry.text, update.emission.line), {
          path: update.path,
          values: update.values,
        });
      }
      changes.push({
        path: name(absolute),
        before: entry.before,
        after: new TextEncoder().encode(entry.text),
      });
    }
    const seen = new Set<string>();
    for (const change of changes) {
      assertSourcePath(change.path);
      if (seen.has(change.path)) {
        throw new Error(`Duplicate conversion change '${change.path}'.`);
      }
      seen.add(change.path);
    }
    // Preview creations/replacements first. Remaining active consumers can still resolve the old source;
    // its exact consumption tells us whether removal is safe, without guessing incbin/resource ownership.
    // Generation declarations are separately validated authoring metadata, not runtime assembly inputs.
    const overlays = new Map(
      changes
        .filter((item) => item.after !== null && item.path !== "asset-includes.json")
        .map((item) => [item.path, item.after]),
    );
    const after = await this.host.inspect(request.directory, overlays, signal);
    assertBuild(after);
    if (!Buffer.from(after.output).equals(Buffer.from(build.output))) {
      throw new Error(
        "Source conversion changed the complete current ROM; no files were published.",
      );
    }
    const retained = new Set(candidate.retained ?? []);
    const unresolvedDeclarations = inventory.filter((file) => !build.snapshots.has(file));
    const incompleteScope = unresolvedDeclarations.length > 0;
    changes = changes.filter((change) => {
      if (
        change.after === null &&
        (incompleteScope || after.snapshots.has(path.resolve(build.root, change.path)))
      ) {
        retained.add(change.path);
        return false;
      }
      return true;
    });
    const paths = [...new Map([...build.snapshots, [projectFile, projectBytes] as const])].map(
      ([absolute, bytes]) => ({
        path: absolute,
        sha256: sourceContentHash(bytes),
      }),
    );
    const plan: AssetSourceConversionPlan = {
      source: name(source),
      destination: destinationName,
      outputSha256: sourceContentHash(build.output),
      changes,
      snapshots: paths,
      affected: candidate.updates.map(({ emission }) => ({
        file: name(build.mapping.fileList[emission.fileIdx].name),
        line: emission.line,
        format: emission.format,
      })),
      retained: [...retained],
      unresolvedDeclarations: unresolvedDeclarations.map(name),
      assemblyInventory: inventory,
    };
    this.assertFresh(build.root, plan);
    return plan;
  }

  /** Absence and all build dependencies are guarded again immediately before publication. */
  assertFresh(root: string, plan: AssetSourceConversionPlan): void {
    if (
      JSON.stringify(assetSourceAssemblyInventory(root)) !== JSON.stringify(plan.assemblyInventory)
    ) {
      throw new Error("Assembly discovery changed during conversion; try again.");
    }
    for (const snapshot of plan.snapshots) {
      if (
        sourceContentHash(fs.readFileSync(path.resolve(root, snapshot.path))) !== snapshot.sha256
      ) {
        throw new Error(`Source changed during conversion: ${snapshot.path}.`);
      }
    }
    for (const change of plan.changes) {
      const file = path.join(root, change.path);
      const exists = fs.existsSync(file);
      if (
        (change.before === null && exists) ||
        (change.before !== null &&
          (!exists ||
            sourceContentHash(fs.readFileSync(file)) !== sourceContentHash(change.before)))
      ) {
        throw new Error(`Conversion has a stale or colliding source path: ${change.path}.`);
      }
    }
    const dirty =
      this.host
        .drafts?.()
        .filter(
          (draft) =>
            plan.snapshots.some(
              (snapshot) => path.resolve(root, snapshot.path) === path.resolve(root, draft.path),
            ) ||
            plan.changes.some(
              (change) => path.resolve(root, change.path) === path.resolve(root, draft.path),
            ),
        ) ?? [];
    if (dirty.length) {
      throw new Error(
        `Save relevant conversion drafts first: ${dirty.map((draft) => draft.path).join(", ")}. Drafts are preserved.`,
      );
    }
  }

  /** Coordinated recoverability uses the shared journal; clean conversions have no separate review/apply lifecycle. */
  async convert(
    request: AssetSourceConversionRequest,
    options: { signal?: AbortSignal; stageOnly?: boolean } = {},
  ) {
    const plan = await this.prepare(request, options.signal);
    const opened = await this.host.open(request.directory);
    const root = opened.repository.root;
    await this.host.beforePublish?.([
      ...new Set([
        ...plan.snapshots.map((snapshot) => path.resolve(root, snapshot.path)),
        ...plan.changes.map((change) => path.join(root, change.path)),
      ]),
    ]);
    const transaction = applySourceFileTransaction(opened.repository, plan.changes, {
      ...options,
      validate: () => this.assertFresh(root, plan),
    });
    if (!options.stageOnly) {
      const published = await this.host.inspect(request.directory, undefined, options.signal);
      assertBuild(published);
      if (sourceContentHash(published.output) !== plan.outputSha256) {
        throw new Error("Published conversion no longer matches its validated ROM.");
      }
      await this.host.completed?.();
    }
    return { ...plan, transaction: transaction?.id };
  }
}
