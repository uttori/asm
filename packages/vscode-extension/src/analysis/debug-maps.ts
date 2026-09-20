/** Shared, conservative debug-map discovery for native analysis presentation. */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  debugMapRangesForAddress,
  validateDebugMap,
  type DebugMap,
  type DebugMapRange,
  type DebugMapSource,
} from "@uttori/asm-core/debug-map";
import { Uri, debug, workspace } from "vscode";

/**
 * Workspace-search glob that omits dependencies, Git internals, and local-only copies from
 * automatic debug-map discovery.
 */
const DEBUG_MAP_EXCLUDE = "**/{node_modules,.git,Local Only}/**";

/** Exact project identity a debug map must describe before it can be used. */
export interface AnalysisDebugMapIdentity {
  readonly target: string;
  readonly romContentSha256: string;
  readonly romContentSize: number;
}

/** Qualified analysis location, optionally carrying explicit mirrored output offsets. */
export interface AnalysisDebugMapLocation {
  readonly addressSpace: string;
  readonly address: number;
  readonly outputOffsets: readonly number[];
  readonly architectureHints: readonly string[];
}

/** Valid current map plus roots that may resolve its portable source names. */
export interface AnalysisDebugMapCandidate {
  readonly file: string;
  readonly map: DebugMap;
  readonly sourceRoots: readonly string[];
}

/**
 * Deduplicate path or identity strings and sort them with the host locale comparison for
 * repeatable candidate ordering.
 * @param {readonly string[]} values Candidate identity strings, possibly repeated.
 * @returns {readonly string[]} Unique strings sorted with localeCompare.
 */
const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

/**
 * Resolve a configured relative path against its workspace root, falling back to the process
 * directory when no root exists.
 * @param {string} value Absolute or workspace-relative configured filename.
 * @param {string | undefined} root Owning workspace root, if available.
 * @returns {string} Absolute path resolved against root or process.cwd().
 */
const resolvedConfigurationPath = (value: string, root: string | undefined): string =>
  path.isAbsolute(value) ? value : path.resolve(root ?? process.cwd(), value);

/**
 * SHA-256 for an exact current source file.
 * @param {string} file Absolute source filename.
 * @returns {string} Lowercase SHA-256 digest.
 */
export const analysisSourceSha256 = (file: string): string =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/**
 * Enumerate deduplicated candidate source paths from map roots, the map directory, and workspace
 * folders.
 * An absolute map path is authoritative; callers still verify the source bytes before
 * navigation.
 * @param {DebugMapSource} source Portable source identity from the map.
 * @param {AnalysisDebugMapCandidate} candidate Map filename and candidate source roots.
 * @returns {readonly string[]} Deduplicated candidate paths to hash-check before use.
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
 * @param {DebugMapSource} source Portable debug-map source identity.
 * @param {AnalysisDebugMapCandidate} candidate Map and candidate source roots.
 * @param {string} [expectedFile] Only resolve this editor's source, avoiding unrelated file reads.
 * @returns {string | undefined} Exact current source path, when one exists.
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
 * @param {AnalysisDebugMapIdentity | readonly AnalysisDebugMapIdentity[]} identity One or more native analysis project target and ROM identities.
 * @returns {Promise<readonly AnalysisDebugMapCandidate[]>} Valid matching debug-map candidates.
 */
export const findAnalysisDebugMapCandidates = async (
  identity: AnalysisDebugMapIdentity | readonly AnalysisDebugMapIdentity[],
): Promise<readonly AnalysisDebugMapCandidate[]> => {
  const identities: readonly AnalysisDebugMapIdentity[] = Array.isArray(identity)
    ? identity
    : [identity as AnalysisDebugMapIdentity];
  const candidates: AnalysisDebugMapCandidate[] = [];
  for (const descriptor of await discoverAnalysisDebugMapFiles()) {
    try {
      const map = JSON.parse(fs.readFileSync(descriptor.file, "utf8")) as DebugMap;
      if (
        validateDebugMap(map).length > 0 ||
        !identities.some(
          (candidate) =>
            map.target === candidate.target &&
            map.output.sha256 === candidate.romContentSha256 &&
            map.output.size === candidate.romContentSize,
        )
      ) {
        continue;
      }
      candidates.push({ ...descriptor, map });
    } catch {
      // Unrelated or malformed maps are not candidates.
    }
  }
  return candidates;
};

/**
 * Discover portable map filenames without parsing or hashing on the UI thread.
 * @returns {Promise<readonly { file: string; sourceRoots: readonly string[] }[]>} Map paths and source roots.
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
  const files = sortedUnique([
    ...(configuredMap ? [configuredMap] : []),
    ...discovered.filter(({ scheme }) => scheme === "file").map(({ fsPath }) => fsPath),
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
        ...(workspace.workspaceFolders ?? []).map(({ uri }) => uri.fsPath),
        ...ancestors,
      ]),
    };
  });
};

/**
 * Resolves logical and explicit-output mirror identities without mapper inference.
 * @param {DebugMap} map Exact ROM-matched debug map.
 * @param {AnalysisDebugMapLocation} location Native analysis instruction identity.
 * @returns {readonly DebugMapRange[]} Matching architecture-compatible source ranges.
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
