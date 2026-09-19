/** Shared Build Binary helpers used by the language server and its tests. */
import fs from "node:fs";
import path from "node:path";

export type BuildLogger = {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

export type ResolvedBuildEntry = {
  file: string;
  reason: string;
  usedEntryPoint: boolean;
  requestedFile?: string;
};

export interface BuildArtifactPairResult {
  readonly outputPath: string;
  readonly debugMapPath: string;
  readonly outputChanged: boolean;
  readonly debugMapChanged: boolean;
}

let temporaryArtifactSequence = 0;

const sameFileContent = (file: string, content: Uint8Array): boolean => {
  try {
    return Buffer.from(content).equals(fs.readFileSync(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

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
 * Each rename is atomic; readers that race the two renames see either a valid pair or an
 * identity mismatch that the debugger rejects. A failed second rename restores the prior pair.
 * @param {string} outputPath Destination binary.
 * @param {Uint8Array} output Exact binary bytes.
 * @param {string} debugMapJson Canonical debug-map JSON fingerprinting `output`.
 * @returns {BuildArtifactPairResult} Paths and content-change state.
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
        reason: `active file ${path.basename(requested)} is not a project entry point; using ${path.basename(resolvedEntries[0])}`,
        usedEntryPoint: true,
        requestedFile: requested,
      };
    }
    return {
      file: requested,
      reason: "no project entry points configured; using active file",
      usedEntryPoint: false,
      requestedFile: requested,
    };
  }
  if (resolvedEntries.length > 0) {
    return {
      file: resolvedEntries[0],
      reason: `no active editor; using first project entry point ${path.basename(resolvedEntries[0])}`,
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
      `Assembly produced 0 bytes for ${base}. Writes to unmapped addresses are skipped; ` +
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
