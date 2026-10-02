import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { canonicalEquals } from "@uttori/asm-core/canonical-json";
import { verifyCaptureContext, type CaptureRecovery } from "@uttori/asm-debug-adapter";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A present companion is part of the import's integrity boundary. Bind its verified artifacts to
 * the primary archive's exact session and terminal count; a different capture of the same ROM
 * is insufficient. Bare captures remain valid when no companion was recorded.
 */
export async function verifyRuntimeCaptureCompanion(
  file: string,
  recovery: CaptureRecovery,
  signal?: AbortSignal,
): Promise<void> {
  const directory = `${file}.context`;
  const stat = await lstat(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  });
  if (!stat) {
    return;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Capture companion must be a regular directory.");
  }
  const manifestFile = path.join(directory, "manifest.json");
  if ((await lstat(manifestFile)).size > 1048576) {
    throw new Error("Capture companion manifest exceeds its size budget.");
  }
  const before = await readFile(manifestFile, "utf8");
  const manifest: unknown = JSON.parse(before);
  if (!isRecord(manifest)) {
    throw new Error(
      "Capture companion does not match this archive's scope, session, or final event boundary.",
    );
  }
  const boundaries = isRecord(manifest.boundaries) ? manifest.boundaries : undefined;
  const end = boundaries && isRecord(boundaries.end) ? boundaries.end : undefined;
  if (
    !recovery.complete ||
    manifest.archive !== path.basename(file) ||
    manifest.scope !== recovery.header.scope ||
    boundaries?.session !== recovery.header.session ||
    end?.eventThrough !== recovery.eventThrough
  ) {
    throw new Error(
      "Capture companion does not match this archive's scope, session, or final event boundary.",
    );
  }
  await verifyCaptureContext(directory, recovery.header, signal);
  const boundaryArtifact: unknown = JSON.parse(
    await readFile(path.join(directory, "boundaries.json"), "utf8"),
  );
  if (
    !canonicalEquals(boundaryArtifact, manifest.boundaries) ||
    (await readFile(manifestFile, "utf8")) !== before
  ) {
    throw new Error("Capture companion changed or its manifest and boundary artifact disagree.");
  }
}
