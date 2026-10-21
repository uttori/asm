import { assetPath } from "@uttori/asm-workflows/asset-interchange/paths";

/** Editor state only: opaque tabs expose dirty state, while native text/binary documents expose monotonic versions. */
export interface AssetEditorVersion {
  readonly path: string;
  readonly version: number;
  readonly dirty: boolean;
  readonly opaque: boolean;
}

/** Compare live buffers without encoding/saving them. Newly opened dirty/opaque drafts cannot bypass a reviewed snapshot. */
export function assertAssetEditorVersions(
  before: readonly AssetEditorVersion[],
  current: readonly AssetEditorVersion[],
  relevant: readonly string[],
): void {
  // The worker canonicalizes OS aliases; the editor URI must identify the same saved file.
  const paths = new Set(relevant.map(assetPath)),
    originals = new Map(before.map((entry) => [assetPath(entry.path), entry]));
  for (const entry of current) {
    const file = assetPath(entry.path);
    if (!paths.has(file)) {
      continue;
    }
    const original = originals.get(file);
    if (
      entry.dirty ||
      (original && (entry.version !== original.version || entry.opaque !== original.opaque))
    ) {
      throw new Error(
        `Asset editor changed: ${entry.path}${entry.opaque ? " (opaque editor draft)" : ""}. Save relevant drafts and review again; drafts are preserved.`,
      );
    }
  }
}
