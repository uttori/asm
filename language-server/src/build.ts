/** Shared Build Binary helpers used by the language server and its tests. */
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
