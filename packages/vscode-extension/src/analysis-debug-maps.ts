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

const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const resolvedConfigurationPath = (value: string, root: string | undefined): string =>
  path.isAbsolute(value) ? value : path.resolve(root ?? process.cwd(), value);

/**
 * SHA-256 for an exact current source file.
 * @param {string} file Absolute source filename.
 * @returns {string} Lowercase SHA-256 digest.
 */
export const analysisSourceSha256 = (file: string): string =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const sourcePaths = (
  source: DebugMapSource,
  candidate: AnalysisDebugMapCandidate,
): readonly string[] => {
  if (path.isAbsolute(source.path)) return [source.path];
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
 * @returns {string | undefined} Exact current source path, when one exists.
 */
export const currentAnalysisSourcePath = (
  source: DebugMapSource,
  candidate: AnalysisDebugMapCandidate,
): string | undefined =>
  sourcePaths(source, candidate).find((file) => {
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
  const candidates: AnalysisDebugMapCandidate[] = [];
  for (const file of files) {
    try {
      const map = JSON.parse(fs.readFileSync(file, "utf8")) as DebugMap;
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
      const containingWorkspace = workspace.getWorkspaceFolder(Uri.file(file));
      candidates.push({
        file,
        map,
        sourceRoots: sortedUnique([
          ...(file === configuredMap && configuredRoot ? [configuredRoot] : []),
          ...(containingWorkspace ? [containingWorkspace.uri.fsPath] : []),
        ]),
      });
    } catch {
      // Unrelated or malformed *.debug.json files are not presentation candidates.
    }
  }
  return candidates;
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
