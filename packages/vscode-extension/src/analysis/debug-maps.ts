/** Shared, conservative debug-map discovery for native analysis presentation. */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  DEBUG_MAP_FORMAT,
  DEBUG_MAP_SCHEMA_VERSION,
  debugMapRangesForAddress,
  validateDebugMap,
  type DebugMap,
  type DebugMapRange,
  type DebugMapSource,
} from "@uttori/asm-core/debug-map";
import { Uri, debug, workspace } from "vscode";

import { findSourceRoot } from "../source/project-path.js";

/**
 * Workspace-search glob that omits dependencies, Git internals, and local-only copies from
 * automatic debug-map discovery.
 */
const DEBUG_MAP_EXCLUDE = "**/{node_modules,.git,Local Only}/**";

/** Exact project identity a debug map must describe before it can be used. */
export interface AnalysisDebugMapIdentity {
  /** Analysis target id the map must describe. */
  readonly target: string;
  /** Expected ROM content hash for identity matching. */
  readonly romContentSha256: string;
  /** Expected ROM byte length for identity matching. */
  readonly romContentSize: number;
}

/** Qualified analysis location, optionally carrying explicit mirrored output offsets. */
export interface AnalysisDebugMapLocation {
  /** Address space containing the qualified location. */
  readonly addressSpace: string;
  /** Address within the space used for navigation. */
  readonly address: number;
  /** Explicit mirrored ROM offsets when known. */
  readonly outputOffsets: readonly number[];
  /** Architecture hints narrowing disassembly selection. */
  readonly architectureHints: readonly string[];
}

/** Valid current map plus roots that may resolve its portable source names. */
export interface AnalysisDebugMapCandidate {
  /** Absolute path to the accepted debug map file. */
  readonly file: string;
  /** Validated map payload matching the requested identity. */
  readonly map: DebugMap;
  /** Source roots that can resolve portable paths in the map. */
  readonly sourceRoots: readonly string[];
}

/**
 * Deduplicate path or identity strings and sort them with the host locale comparison for
 * repeatable candidate ordering.
 * @param values Candidate identity strings, possibly repeated.
 * @returns Unique strings sorted with localeCompare.
 */
const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].toSorted((left, right) => left.localeCompare(right));

/** Narrow JSON payloads to plain objects before map validation. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A stored map must be inspectable by validateDebugMap; format and fingerprint stay its job. */
export function isStoredDebugMap(value: unknown): value is Parameters<typeof validateDebugMap>[0] {
  return (
    isRecord(value) &&
    isRecord(value.fingerprint) &&
    typeof value.fingerprint.algorithm === "string" &&
    typeof value.fingerprint.value === "string" &&
    isRecord(value.output) &&
    typeof value.output.size === "number" &&
    typeof value.output.sha256 === "string" &&
    typeof value.target === "string" &&
    Array.isArray(value.sources) &&
    Array.isArray(value.ranges) &&
    (value.instructions === undefined || Array.isArray(value.instructions)) &&
    (value.assets === undefined || Array.isArray(value.assets))
  );
}

/** validateDebugMap reports mismatches; this admits only a map whose identity fields are current. */
export function isAcceptedDebugMap(map: Parameters<typeof validateDebugMap>[0]): map is DebugMap {
  return (
    map.format === DEBUG_MAP_FORMAT &&
    map.schemaVersion === DEBUG_MAP_SCHEMA_VERSION &&
    map.fingerprint.algorithm === "sha256"
  );
}

/** Distinguish a single identity argument from an identity list overload. */
function isIdentityList(
  value: AnalysisDebugMapIdentity | readonly AnalysisDebugMapIdentity[],
): value is readonly AnalysisDebugMapIdentity[] {
  return Array.isArray(value);
}

/**
 * Resolve a configured relative path against its workspace root, falling back to the process
 * directory when no root exists.
 * @param value Absolute or workspace-relative configured filename.
 * @param root Owning workspace root, if available.
 * @returns Absolute path resolved against root or process.cwd().
 */
const resolvedConfigurationPath = (value: string, root: string | undefined): string =>
  path.isAbsolute(value) ? value : path.resolve(root ?? process.cwd(), value);

/**
 * SHA-256 for an exact current source file.
 * @param file Absolute source filename.
 * @returns Lowercase SHA-256 digest.
 */
export const analysisSourceSha256 = (file: string): string =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/**
 * Enumerate deduplicated candidate source paths from map roots, the map directory, and workspace
 * folders.
 * An absolute map path is authoritative; callers still verify the source bytes before
 * navigation.
 * @param source Portable source identity from the map.
 * @param candidate Map filename and candidate source roots.
 * @returns Deduplicated candidate paths to hash-check before use.
 */
const sourcePaths = (
  source: DebugMapSource,
  candidate: AnalysisDebugMapCandidate,
): readonly string[] => {
  if (path.isAbsolute(source.path)) {
    return [source.path];
  }
  return sortedUnique([
    ...candidate.sourceRoots.map((root) => path.resolve(root, source.path)),
    path.resolve(path.dirname(candidate.file), source.path),
    ...(workspace.workspaceFolders ?? []).map(({ uri }) => path.resolve(uri.fsPath, source.path)),
  ]);
};

/**
 * Resolves a portable map source only when its current bytes still match the map.
 * @param source Portable debug-map source identity.
 * @param candidate Map and candidate source roots.
 * @param [expectedFile] Only resolve this editor's source, avoiding unrelated file reads.
 * @returns Exact current source path, when one exists.
 */
export const currentAnalysisSourcePath = (
  source: DebugMapSource,
  candidate: AnalysisDebugMapCandidate,
  expectedFile?: string,
): string | undefined =>
  sourcePaths(source, candidate).find((file) => {
    if (expectedFile !== undefined && path.resolve(file) !== expectedFile) {
      return false;
    }
    try {
      return fs.statSync(file).isFile() && analysisSourceSha256(file) === source.sha256;
    } catch {
      return false;
    }
  });

/**
 * Finds bounded workspace debug maps whose target and ROM output identity exactly match.
 * @param identity One or more native analysis project target and ROM identities.
 * @returns Valid matching debug-map candidates.
 */
export const findAnalysisDebugMapCandidates = async (
  identity: AnalysisDebugMapIdentity | readonly AnalysisDebugMapIdentity[],
): Promise<readonly AnalysisDebugMapCandidate[]> => {
  const identities = isIdentityList(identity) ? identity : [identity];
  const candidates: AnalysisDebugMapCandidate[] = [];
  for (const descriptor of await discoverAnalysisDebugMapFiles()) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(descriptor.file, "utf8"));
      if (!isStoredDebugMap(parsed)) {
        continue;
      }
      if (
        validateDebugMap(parsed).length > 0 ||
        !isAcceptedDebugMap(parsed) ||
        !identities.some(
          (candidate) =>
            parsed.target === candidate.target &&
            parsed.output.sha256 === candidate.romContentSha256 &&
            parsed.output.size === candidate.romContentSize,
        )
      ) {
        continue;
      }
      candidates.push({ ...descriptor, map: parsed });
    } catch {
      // Unrelated or malformed maps are not candidates.
    }
  }
  return candidates;
};

/**
 * Discover portable map filenames without parsing or hashing on the UI thread.
 * @returns Map paths and source roots.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.findFiles
 */
export const discoverAnalysisDebugMapFiles = async (): Promise<
  readonly {
    file: string;
    sourceRoots: readonly string[];
  }[]
> => {
  const active = debug.activeDebugSession;
  const configuredMap =
    active?.type === "uttori-asm" && typeof active.configuration.debugMap === "string"
      ? resolvedConfigurationPath(active.configuration.debugMap, active.workspaceFolder?.uri.fsPath)
      : undefined;
  const configuredRoot =
    active?.type === "uttori-asm" && typeof active.configuration.sourceRoot === "string"
      ? resolvedConfigurationPath(
          active.configuration.sourceRoot,
          active.workspaceFolder?.uri.fsPath,
        )
      : active?.workspaceFolder?.uri.fsPath;
  const discovered = await workspace.findFiles("**/*.debug.json", DEBUG_MAP_EXCLUDE, 64);
  const sourceRoots = [
    ...new Set(
      (
        await Promise.all(
          (workspace.workspaceFolders ?? []).map(({ uri }) => findSourceRoot(uri.fsPath)),
        )
      ).filter((root): root is string => !!root),
    ),
  ];
  const selected: string[] = [];
  for (const root of sourceRoots) {
    try {
      const directory = path.join(root, ".uttori-local/builds");
      const receiptFile = path.join(directory, "current.json");
      if ((await fs.promises.stat(receiptFile)).size > 1024 * 1024) {
        continue;
      }
      const receipt: unknown = JSON.parse(await fs.promises.readFile(receiptFile, "utf8"));
      if (
        !isRecord(receipt) ||
        typeof receipt.inputSha256 !== "string" ||
        typeof receipt.debugMapFile !== "string" ||
        !/^[\da-f]{64}$/.test(receipt.inputSha256)
      ) {
        continue;
      }
      const file = path.join(directory, receipt.inputSha256, "program.sfc.debug.json");
      if (receipt.debugMapFile === file) {
        selected.push(file);
      }
    } catch {
      /* A new project has no successful build until the user builds once. */
    }
  }
  const files = sortedUnique([
    ...(configuredMap ? [configuredMap] : []),
    ...selected,
    ...discovered
      .filter(
        ({ scheme, fsPath }) =>
          scheme === "file" && !sourceRoots.some((root) => fsPath.startsWith(root + path.sep)),
      )
      .map(({ fsPath }) => fsPath),
  ]);
  return files.map((file) => {
    const containingWorkspace = workspace.getWorkspaceFolder(Uri.file(file));
    const ancestors: string[] = [];
    if (containingWorkspace) {
      const root = containingWorkspace.uri.fsPath;
      for (
        let directory = path.dirname(file);
        directory !== root && directory.startsWith(`${root}${path.sep}`);
        directory = path.dirname(directory)
      ) {
        ancestors.push(directory);
      }
    }
    return {
      file,
      sourceRoots: sortedUnique([
        ...(file === configuredMap && configuredRoot ? [configuredRoot] : []),
        ...sourceRoots.filter((root) => file.startsWith(root + path.sep)),
        ...(workspace.workspaceFolders ?? []).map(({ uri }) => uri.fsPath),
        ...ancestors,
      ]),
    };
  });
};

/**
 * Resolves logical and explicit-output mirror identities without mapper inference.
 * @param map Exact ROM-matched debug map.
 * @param location Native analysis instruction identity.
 * @returns Matching architecture-compatible source ranges.
 */
export const analysisDebugMapRanges = (
  map: DebugMap,
  location: AnalysisDebugMapLocation,
): readonly DebugMapRange[] => {
  const ranges = [
    ...debugMapRangesForAddress(map, location.addressSpace, location.address),
    ...location.outputOffsets.flatMap((outputOffset) =>
      debugMapRangesForAddress(map, location.addressSpace, location.address, { outputOffset }),
    ),
  ];
  const unique = new Map(
    ranges.map((range) => [
      [
        range.architecture,
        range.addressSpace,
        range.start,
        range.end,
        range.outputStart ?? "",
        range.sourceId,
        range.line,
      ].join(":"),
      range,
    ]),
  );
  const hints = new Set(location.architectureHints);
  return [...unique.values()].filter((range) => hints.size === 0 || hints.has(range.architecture));
};
