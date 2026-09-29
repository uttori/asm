/** Worker-only source verification and compact annotation projections. No VS Code dependency. */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { canonicalEquals } from "@uttori/asm-core/canonical-json";
import { validateDebugMap, type DebugMap, type DebugMapSource } from "@uttori/asm-core/debug-map";
import {
  applyDisassemblyAnnotationEdit,
  commitAnalysisProjectAnnotationUpdate,
  openAnalysisProjectStore,
  assertAnalysisProjectRevision,
  RomImage,
  validateProjectRom,
  validateSourceExportInputs,
  findManagedSourceFile,
  loadSourceOwnership,
  sourceOwnersAt,
  type AnalysisProjectSnapshot,
  type InstructionExportRecord,
  type AnalysisProjectRevision,
  type DisassemblyAnnotationEditRequest,
  type DisassemblyAnnotationInverse,
  type ProjectComment,
  type ProjectLabel,
} from "@uttori/asm-disassembler";
import {
  exportSnes65816Source,
  SNES_MAPPERS,
  loadSnesRamMap,
  snesSourceLabelNames,
  type ExportSnesProjectResult,
  type SnesMapper,
} from "@uttori/asm-plugin-snes";

import {
  annotationLocationsForSource,
  annotationReferenceAt,
  namedAnnotationLocations,
  type DisassemblyAnnotationLocation,
  type AnnotationNodeLookup,
} from "./annotation-location.js";
import type { ResolvedTarget } from "./maintenance-data.js";

/**
 * Candidate debug-map filename and local roots under which its portable source paths may
 * resolve.
 */
export interface AnnotationMapFile {
  readonly file: string;
  readonly sourceRoots: readonly string[];
}
/**
 * Worker lookup request containing map candidates and optional current-editor identity; source
 * line is one-based and column is a zero-based UTF-16 offset.
 */
export interface AnnotationLookup {
  readonly maps: readonly AnnotationMapFile[];
  readonly source?: {
    readonly file: string;
    readonly sha256: string;
    readonly line: number;
    readonly column: number;
  };
}
/**
 * Editable metadata for one exact native location, including whether instruction-specific
 * comments are supported.
 */
export interface AnnotationDetails {
  readonly location: DisassemblyAnnotationLocation;
  readonly label?: ProjectLabel;
  readonly inlineComments: readonly ProjectComment[];
  readonly hasInstruction: boolean;
}
/**
 * Resolved edit choices and the project revision they came from, with optional source identity
 * used to guard later saving.
 */
export interface AnnotationLookupResult {
  readonly revision: AnalysisProjectRevision;
  readonly choices: readonly AnnotationDetails[];
  readonly sourceFile?: string;
  readonly sourceHash?: string;
  readonly sourceDirectory?: string;
}
/**
 * Optimistic save request carrying the lookup revision and optional source hash/path guards
 * against intervening edits.
 */
export interface AnnotationSave {
  readonly revision: AnalysisProjectRevision;
  readonly request: DisassemblyAnnotationEditRequest;
  readonly sourceFile?: string;
  readonly sourceHash?: string;
  readonly sourceDirectory?: string;
}

/** Revision of a saved label/comment edit. Intervening project writes invalidate source refresh. */
export interface AnnotationRefresh {
  /** Authoritative manifest SHA-256 after saving, including the publication counter. */
  readonly after: string;
}

/** Undo data plus a guarded opportunity to reuse analysis when refreshing generated source. */
export interface AnnotationSaveResult extends DisassemblyAnnotationInverse {
  readonly refresh: AnnotationRefresh;
}

/** Paths and saved revision only. Project records stay in the annotation worker. */
export interface AnnotationRefreshInput {
  readonly target: ResolvedTarget;
  readonly receipt: AnnotationRefresh;
}

/**
 * Render a small validated metadata view with SQL-backed instruction groups.
 * Callers must verify the rebuilt ROM and recheck the revision before reporting completion.
 * @param {AnalysisProjectSnapshot} snapshot Validated metadata and authoritative read revision.
 * @param {AnnotationRefreshInput} input Saved revision, verified source paths and ROM binding.
 * @param {Iterable} [instructionGroups] Complete ordered instruction groups from the same SQL read snapshot.
 * @returns {ExportSnesProjectResult | undefined} Export result. Undefined requires full regeneration.
 */
export const refreshDisassemblyAnnotation = (
  snapshot: AnalysisProjectSnapshot,
  input: AnnotationRefreshInput,
  instructionGroups?: Iterable<readonly InstructionExportRecord[]>,
): ExportSnesProjectResult | undefined => {
  const { target, receipt } = input;
  if (snapshot.revision.manifestSha256 !== receipt.after) {
    return undefined;
  }
  if (snapshot.manifest.target !== "snes.sfc") {
    throw new Error("Annotation source refresh requires a SNES project.");
  }
  if (!SNES_MAPPERS.includes(snapshot.manifest.mapping.mapper as SnesMapper)) {
    throw new Error(`Unsupported SNES mapper '${snapshot.manifest.mapping.mapper}'.`);
  }
  const store = openAnalysisProjectStore(target.projectDirectory);
  try {
    store.transaction(() => assertAnalysisProjectRevision(store, snapshot.revision), false);
  } finally {
    store.close();
  }
  try {
    validateSourceExportInputs(target.sourceDirectory, target.sourceManifest);
  } catch {
    // RAM/structure changes can affect interpretation. Apply them through full regeneration.
    return undefined;
  }
  const rom = RomImage.load(target.romFile, { headerSize: snapshot.manifest.rom.headerSize });
  validateProjectRom(snapshot.manifest, rom);
  // Names/comments do not change decoding. Consume the SQL cursor inside its read snapshot.
  // source export still checks generated-file hashes and prevents loss of known code.
  const manifest = exportSnes65816Source(snapshot, rom, target.sourceDirectory, {
    sourceProjectSha256: receipt.after,
    instructionGroups,
  });
  return {
    sourceDirectory: target.sourceDirectory,
    manifest,
    codeBytes: manifest.spans.reduce(
      (total, span) => total + (span.role === "code" ? span.end - span.start : 0),
      0,
    ),
  };
};

/**
 * Compute a lowercase SHA-256 digest of source bytes or UTF-8 text for exact source-identity
 * checks.
 * @param {string | Buffer} bytes Raw source bytes or text encoded as UTF-8.
 * @returns {string} Lowercase SHA-256 source digest.
 */
const hash = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
/**
 * Validated debug maps keyed by filename and filesystem signature; the worker clears the cache
 * when inserting at its 64-entry limit.
 */
const maps = new Map<string, { signature: string; map: DebugMap }>();
/**
 * Detect replacements and edits without parsing or fingerprinting unchanged maps.
 * @param {string} file Local filename.
 * @returns {string} Filesystem identity and change timestamps.
 */
export const annotationFileSignature = (file: string): string => {
  const stat = fs.statSync(file, { bigint: true });
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
};
/**
 * Reuse an unchanged validated debug map or read and validate a replacement.
 * Reject maps whose filesystem signature changes during loading; parsing, validation, and I/O
 * failures propagate.
 * @param {string} file Local debug-map filename.
 * @returns {DebugMap} Validated cached/current map; I/O, validation, or concurrent-change errors throw.
 */
const readMap = (file: string): DebugMap => {
  const signature = annotationFileSignature(file);
  const cached = maps.get(file);
  if (cached?.signature === signature) {
    return cached.map;
  }
  const map = JSON.parse(fs.readFileSync(file, "utf8")) as DebugMap;
  if (validateDebugMap(map).length) {
    throw new Error("Invalid debug map.");
  }
  if (annotationFileSignature(file) !== signature) {
    throw new Error("Debug map changed while loading.");
  }
  if (maps.size >= 64) {
    maps.clear();
  }
  maps.set(file, { signature, map });
  return map;
};
/**
 * Try portable source roots until file bytes match the recorded SHA-256, optionally requiring an
 * exact editor path.
 * Unreadable or mismatched candidates are skipped; return undefined when none verifies.
 * @param {DebugMapSource} source Map source identity including its SHA-256.
 * @param {AnnotationMapFile} candidate Map location and candidate source roots.
 * @param {string} [expectedFile] Optional exact editor path that must match.
 * @returns {object} Verified filename and UTF-8 text, or undefined when no candidate matches.
 */
const readSource = (
  source: DebugMapSource,
  candidate: AnnotationMapFile,
  expectedFile?: string,
): { file: string; text: string } | undefined => {
  const files = path.isAbsolute(source.path)
    ? [source.path]
    : [
        ...candidate.sourceRoots.map((root) => path.resolve(root, source.path)),
        path.resolve(path.dirname(candidate.file), source.path),
      ];
  for (const file of new Set(files)) {
    if (expectedFile && file !== expectedFile) {
      continue;
    }
    try {
      const bytes = fs.readFileSync(file);
      if (hash(bytes) === source.sha256) {
        return { file, text: bytes.toString("utf8") };
      }
    } catch {
      /* A portable source may resolve under another root. */
    }
  }
  return undefined;
};

/**
 * Resolve an edit form from names/comments and the selected instruction boundaries.
 * SQLite callers supply a node lookup inside their read transaction so unrelated CFG data stays on disk.
 * @param {AnalysisProjectSnapshot} snapshot Validated editing metadata and its optimistic revision.
 * @param {AnnotationLookup} input Debug-map files and optional hash-checked source selection.
 * @param {AnnotationNodeLookup} [readNodes] Indexed boundary lookup. Omitted callers supply full CFG metadata.
 * @returns {AnnotationLookupResult} Editable choices tied to the source and project revision.
 */
export const lookupDisassemblyAnnotation = (
  snapshot: AnalysisProjectSnapshot,
  input: AnnotationLookup,
  readNodes?: AnnotationNodeLookup,
): AnnotationLookupResult => {
  const fileSpaces = snapshot.manifest.addressSpaces
    .filter(({ kind }) => kind === "file")
    .map(({ id }) => id);
  let locations: readonly DisassemblyAnnotationLocation[];
  let sourceHash: string | undefined;
  let sourceDirectory: string | undefined;
  if (input.source) {
    const found: DisassemblyAnnotationLocation[] = [];
    const managed = findManagedSourceFile(input.source.file);
    const ownership = managed && loadSourceOwnership(managed);
    if (managed && ownership) {
      // Export-time owners cover data without CFG nodes; source and ROM guards still apply before
      // trusting their locations. The legacy debug-map path below serves exports without this map.
      const current = fs.readFileSync(input.source.file, "utf8");
      const recorded = managed.manifest.files.find((file) => file.path === managed.relative)!;
      if (
        managed.manifest.rom.contentSha256 !== snapshot.manifest.rom.contentSha256 ||
        managed.manifest.target !== snapshot.manifest.target ||
        managed.manifest.mapper !== snapshot.manifest.mapping.mapper ||
        hash(current) !== recorded.sha256 ||
        input.source.sha256 !== recorded.sha256
      ) {
        throw new Error(
          "Generated source or ROM identity changed. Inspect Disassembly Ownership before editing.",
        );
      }
      sourceHash = recorded.sha256;
      sourceDirectory = managed.directory;
      for (const owner of sourceOwnersAt(
        ownership,
        managed.relative,
        current,
        input.source.line,
        input.source.column,
      )) {
        if (
          !["label", "function", "instruction", "data"].includes(owner.kind) ||
          owner.address === undefined ||
          !owner.addressSpace
        ) {
          continue;
        }
        if (owner.kind === "label") {
          // A saved rename may change spelling while old source is visible. Match the native ID
          // and location so the form cannot accidentally select another record with the old name.
          const label = snapshot.shards.labels.find((record) => record.id === owner.id);
          if (
            !label ||
            label.address !== owner.address ||
            label.addressSpace !== owner.addressSpace
          ) {
            throw new Error(
              "The owning label changed after generation. Regenerate source before editing this location.",
            );
          }
          found.push({
            labelId: label.id,
            addressSpace: label.addressSpace,
            address: label.address,
            name: label.sourceName ?? owner.symbol,
          });
        } else {
          found.push({
            addressSpace: owner.addressSpace,
            address: owner.address,
            name: owner.symbol,
          });
        }
      }
      if (!found.length) {
        throw new Error(
          "This item is owned by a map, asset, or standalone comment. Use Inspect Disassembly Ownership to open its owner.",
        );
      }
    }
    for (const candidate of ownership ? [] : input.maps) {
      let map: DebugMap;
      try {
        map = readMap(candidate.file);
      } catch {
        continue;
      }
      if (
        map.target !== snapshot.manifest.target ||
        map.output.sha256 !== snapshot.manifest.rom.contentSha256 ||
        map.output.size !== snapshot.manifest.rom.contentSize
      ) {
        continue;
      }
      for (const source of map.sources) {
        if (source.sha256 !== input.source.sha256) {
          continue;
        }
        const current = readSource(source, candidate, input.source.file);
        if (!current) {
          continue;
        }
        sourceHash = source.sha256;
        const texts = new Map([[source.id, current.text]]);
        if (annotationReferenceAt(current.text, input.source.line, input.source.column)) {
          for (const other of map.sources) {
            if (other.id === source.id) {
              continue;
            }
            const resolved = readSource(other, candidate);
            if (resolved) {
              texts.set(other.id, resolved.text);
            }
          }
        }
        // Preserve large macro/generated-source mappings without expanding call arguments.
        for (const location of annotationLocationsForSource(
          map,
          source.id,
          current.text,
          input.source.line,
          input.source.column,
          snapshot.shards,
          texts,
          fileSpaces,
          readNodes,
        )) {
          found.push(location);
        }
      }
    }
    locations = [
      ...new Map(
        found.map((location) => [
          `${location.addressSpace}:${location.address}:${location.labelId ?? ""}`,
          location,
        ]),
      ).values(),
    ];
    if (!sourceHash || !locations.length) {
      throw new Error(
        "No exact current ROM/source mapping exists at the cursor. Run Analyze and Regenerate Disassembly, then select a label or instruction.",
      );
    }
    for (let directory = path.dirname(input.source.file); ; directory = path.dirname(directory)) {
      if (fs.existsSync(path.join(directory, "generated-files.json"))) {
        sourceDirectory = directory;
        break;
      }
      if (path.dirname(directory) === directory) {
        break;
      }
    }
  } else {
    locations = namedAnnotationLocations(snapshot.shards);
  }
  if (!locations.length) {
    throw new Error(
      "No native labels or function candidates exist. Open generated source to annotate an instruction.",
    );
  }
  const labels = new Map(snapshot.shards.labels.map((label) => [label.id, label]));
  const comments = new Map<string, ProjectComment[]>();
  for (const comment of snapshot.shards.comments) {
    if (comment.placement !== "inline-instruction") {
      continue;
    }
    const key = `${comment.addressSpace}:${comment.address}`;
    const list = comments.get(key) ?? [];
    list.push(comment);
    comments.set(key, list);
  }
  const instructions = new Set<string>();
  for (const record of snapshot.shards.analysis) {
    if (record.kind !== "cfg-node") {
      continue;
    }
    instructions.add(`${record.addressSpace}:${record.address}`);
    if (record.fileOffset !== undefined) {
      for (const space of fileSpaces) {
        instructions.add(`${space}:${record.fileOffset}`);
      }
    }
  }
  return {
    revision: snapshot.revision,
    sourceFile: input.source?.file,
    sourceHash,
    sourceDirectory,
    choices: locations.map((location) => ({
      location,
      label: location.labelId ? labels.get(location.labelId) : undefined,
      inlineComments: comments.get(`${location.addressSpace}:${location.address}`) ?? [],
      hasInstruction: readNodes
        ? readNodes({
            addressSpace: location.addressSpace,
            start: location.address,
            ...(fileSpaces.includes(location.addressSpace)
              ? { outputStart: location.address }
              : {}),
          }).length > 0
        : instructions.has(`${location.addressSpace}:${location.address}`),
    })),
  };
};

/**
 * Keep validation and optimistic publication off the extension host.
 * @param {string} directory Native project directory.
 * @param {AnalysisProjectSnapshot} snapshot Current validated snapshot.
 * @param {AnnotationSave} input Expected revision, source identity and edit.
 * @returns {object} Undo record and the already-validated committed snapshot.
 */
export const saveDisassemblyAnnotation = (
  directory: string,
  snapshot: AnalysisProjectSnapshot,
  input: AnnotationSave,
): { inverse: DisassemblyAnnotationInverse; snapshot: AnalysisProjectSnapshot } => {
  if (!canonicalEquals(snapshot.revision, input.revision)) {
    throw new Error(
      "The analysis project changed while this form was open. Reopen the annotation and retry.",
    );
  }
  if (input.sourceFile && hash(fs.readFileSync(input.sourceFile)) !== input.sourceHash) {
    throw new Error(
      "The source changed while this form was open. Reopen the annotation from current generated source.",
    );
  }
  const applied = applyDisassemblyAnnotationEdit(snapshot, input.request);
  if (snapshot.manifest.target === "snes.sfc") {
    snesSourceLabelNames(
      applied.project.shards,
      snapshot.manifest.mapping.mapper as SnesMapper,
      snapshot.manifest.rom.contentSize,
      input.sourceDirectory
        ? loadSnesRamMap(input.sourceDirectory).variables.map(({ name }) => name)
        : [],
    );
  }
  const { labels, comments, evidence } = applied.project.shards;
  const committed = commitAnalysisProjectAnnotationUpdate(directory, snapshot.revision, {
    labels,
    comments,
    evidence,
  });
  return { inverse: applied.inverse, snapshot: { ...committed, shards: applied.project.shards } };
};
