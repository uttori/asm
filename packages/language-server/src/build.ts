/** Shared Build Binary helpers used by the language server and its tests. */
import fs from "node:fs";
import path from "node:path";

/** Minimal logging sink for build progress and user-actionable failures. */
export type BuildLogger = {
  /**
   * Records build progress, timings, or artifact paths.
   * @param {string} message Human-readable log text.
   */
  info(message: string): void;
  /**
   * Reports a condition that permits the build to continue.
   * @param {string} message Human-readable warning text.
   */
  warn(message: string): void;
  /**
   * Reports a build failure without prescribing how the sink displays it.
   * @param {string} message Human-readable failure text.
   */
  error(message: string): void;
};

/** Source selection and explanation returned before any assembly or filesystem validation. */
export type ResolvedBuildEntry = {
  /** Absolute path selected for assembly; existence is checked by the caller. */
  file: string;
  /** Human-readable selection rationale for the build log. */
  reason: string;
  /** Whether file is one of the configured project roots rather than an unconfigured active file. */
  usedEntryPoint: boolean;
  /** Absolute active-editor path, retained even when a different project root was selected. */
  requestedFile?: string;
};

/** Artifact destinations and byte comparisons after a successful pair commit. */
export interface BuildArtifactPairResult {
  /** Absolute destination of the assembled binary. */
  readonly outputPath: string;
  /** Absolute sidecar path, formed by appending .debug.json to outputPath. */
  readonly debugMapPath: string;
  /** Binary bytes differed from disk or the binary was absent; does not indicate a write count. */
  readonly outputChanged: boolean;
  /** Debug-map bytes differed from disk or the sidecar was absent. */
  readonly debugMapChanged: boolean;
}

/** Process-local suffix paired with the PID to distinguish successive artifact staging files. */
let temporaryArtifactSequence = 0;

/**
 * Compares bytes without treating an absent destination as an I/O failure.
 * @param {string} file Destination to inspect.
 * @param {Uint8Array} content Proposed contents.
 * @returns {boolean} True only when the destination exists and all bytes match.
 * @throws {Error} Reading fails for a reason other than a missing file.
 */
const sameFileContent = (file: string, content: Uint8Array): boolean => {
  try {
    return Buffer.from(content).equals(fs.readFileSync(file));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

/**
 * Writes an exclusive temporary sibling for a later same-filesystem rename.
 * @param {string} file Final destination whose parent directory already exists.
 * @param {Uint8Array} content Complete artifact bytes to stage.
 * @returns {string} Temporary path owned by the caller, which must rename or remove it.
 * @throws {Error} The staging path already exists or the write fails.
 */
const stageArtifact = (file: string, content: Uint8Array): string => {
  temporaryArtifactSequence += 1;
  // Stage beside the destination so the later rename stays on the same filesystem.
  const staged = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${temporaryArtifactSequence}.tmp`,
  );
  fs.writeFileSync(staged, content, { flag: "wx" });
  return staged;
};

/**
 * Commits the binary and its identity-bearing debug map only after both are fully staged.
 * Each rename is atomic. Readers that race the two renames see either a valid pair or an
 * identity mismatch that the debugger rejects. A failed second rename attempts to restore
 * the prior binary. If both contents match disk, no files are rewritten; otherwise both are staged.
 * @param {string} outputPath Destination binary.
 * @param {Uint8Array} output Exact binary bytes.
 * @param {string} debugMapJson Canonical debug-map JSON fingerprinting `output`.
 * @returns {BuildArtifactPairResult} Paths and content-change state.
 * @throws {Error} Reading, staging, renaming, rollback, or temporary-file cleanup fails.
 */
export function commitBuildArtifactPair(
  outputPath: string,
  output: Uint8Array,
  debugMapJson: string,
): BuildArtifactPairResult {
  const resolvedOutput = path.resolve(outputPath);
  const debugMapPath = `${resolvedOutput}.debug.json`;
  const mapBytes = Buffer.from(debugMapJson, "utf8");
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });

  const outputChanged = !sameFileContent(resolvedOutput, output);
  const debugMapChanged = !sameFileContent(debugMapPath, mapBytes);
  if (!outputChanged && !debugMapChanged) {
    return { outputPath: resolvedOutput, debugMapPath, outputChanged, debugMapChanged };
  }

  const oldOutput = fs.existsSync(resolvedOutput) ? fs.readFileSync(resolvedOutput) : undefined;
  const stagedOutput = stageArtifact(resolvedOutput, output);
  let stagedMap: string | undefined;
  let outputCommitted = false;
  try {
    stagedMap = stageArtifact(debugMapPath, mapBytes);
    fs.renameSync(stagedOutput, resolvedOutput);
    outputCommitted = true;
    fs.renameSync(stagedMap, debugMapPath);
    stagedMap = undefined;
  } catch (error) {
    if (outputCommitted) {
      // The sidecar still has its old identity; restore the matching binary, or remove a new one.
      if (oldOutput) {
        const rollback = stageArtifact(resolvedOutput, oldOutput);
        fs.renameSync(rollback, resolvedOutput);
      } else if (fs.existsSync(resolvedOutput)) {
        fs.unlinkSync(resolvedOutput);
      }
    }
    throw error;
  } finally {
    if (fs.existsSync(stagedOutput)) {
      fs.unlinkSync(stagedOutput);
    }
    if (stagedMap && fs.existsSync(stagedMap)) {
      fs.unlinkSync(stagedMap);
    }
  }
  return { outputPath: resolvedOutput, debugMapPath, outputChanged, debugMapChanged };
}

/**
 * Chooses the source file to assemble. Project entry points win over the
 * active editor buffer so building an include does not overwrite the ROM
 * with an empty or partial image.
 * @param {string | undefined} requestedFile Active editor path, if any.
 * @param {readonly string[]} entryPoints Project entry points (absolute or workspace-relative).
 * @param {string} workspaceRoot Workspace folder used to resolve relative entries.
 * @returns {ResolvedBuildEntry} The file to assemble and why it was chosen.
 * @throws {Error} Neither an active file nor a configured entry point is available.
 */
export function resolveBuildEntry(
  requestedFile: string | undefined,
  entryPoints: readonly string[],
  workspaceRoot: string,
): ResolvedBuildEntry {
  const resolvedEntries = [
    ...new Set(
      entryPoints.map((entry) =>
        path.isAbsolute(entry) ? path.normalize(entry) : path.resolve(workspaceRoot, entry),
      ),
    ),
  ];
  if (requestedFile) {
    const requested = path.resolve(requestedFile);
    if (resolvedEntries.some((entry) => entry === requested)) {
      return {
        file: requested,
        reason: "active file is a project entry point",
        usedEntryPoint: true,
        requestedFile: requested,
      };
    }
    if (resolvedEntries.length > 0) {
      return {
        file: resolvedEntries[0],
        reason: `active file ${path.basename(requested)} is not a project entry point. Using ${path.basename(resolvedEntries[0])}`,
        usedEntryPoint: true,
        requestedFile: requested,
      };
    }
    return {
      file: requested,
      reason: "no project entry points configured. Using active file",
      usedEntryPoint: false,
      requestedFile: requested,
    };
  }
  if (resolvedEntries.length > 0) {
    return {
      file: resolvedEntries[0],
      reason: `no active editor. Using first project entry point ${path.basename(resolvedEntries[0])}`,
      usedEntryPoint: true,
    };
  }
  throw new Error("Open a source file or set asm.entryPoints before building.");
}

/**
 * Explains a 0-byte assembly result.
 * @param {string} file The file that was assembled.
 * @param {boolean} usedEntryPoint Whether a project entry point was used.
 * @returns {string} Human-readable failure message.
 */
export function emptyOutputMessage(file: string, usedEntryPoint: boolean): string {
  const base = path.basename(file);
  if (usedEntryPoint) {
    return (
      `Assembly produced 0 bytes for ${base}. Writes to unmapped addresses are skipped. ` +
      "the root file likely never set a mapper/org, or every store landed outside ROM."
    );
  }
  return (
    `Assembly produced 0 bytes for ${base}. Include files assembled alone have no mapper/org, ` +
    "so ROM writes are dropped. Set asm.entryPoints to the project root (for example Chou.asm) " +
    "and run Build Binary again."
  );
}

/**
 * Formats a duration in milliseconds for build logs.
 * @param {number} startedAt Epoch milliseconds when the step began.
 * @returns {string} Compact duration string.
 */
export function formatElapsed(startedAt: number): string {
  return `${Date.now() - startedAt}ms`;
}
