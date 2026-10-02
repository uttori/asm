import * as path from "node:path";

import type { RomIdentity } from "@uttori/asm-disassembler";
import type { ExtensionContext } from "vscode";

/**
 * Remembered absolute ROM path with full-file/headerless hashes, copier-header byte count, and
 * an ISO timestamp for eviction order.
 */
interface RomBinding {
  readonly path: string;
  readonly fileSha256: string;
  readonly contentSha256: string;
  readonly headerSize: 0 | 512;
  readonly updatedAt: string;
}

/**
 * Machine-local ROM bindings indexed by headerless content SHA-256 so copier-header variants
 * share a lookup identity.
 */
type RomBindings = Readonly<Record<string, RomBinding>>;

/**
 * Versioned extension global-state key holding local ROM paths outside portable project
 * metadata.
 */
const ROM_BINDINGS_KEY = "snesProjectRomBindings.v1";
/** Maximum remembered content identities; adding a binding evicts the oldest others first. */
const MAX_ROM_BINDINGS = 32;

/**
 * Keeps `keepKey` and the newest remaining bindings, up to the stored cap.
 * @param {Record<string, RomBinding>} bindings All bindings including the just-written entry.
 * @param {string} keepKey Content identity that must be retained.
 * @returns {Record<string, RomBinding>} Bindings with at most 32 entries.
 */
const capRomBindings = (
  bindings: Record<string, RomBinding>,
  keepKey: string,
): Record<string, RomBinding> => {
  if (Object.keys(bindings).length <= MAX_ROM_BINDINGS) {
    return bindings;
  }
  const newestOthers = Object.entries(bindings)
    .filter(([key]) => key !== keepKey)
    .toSorted(([, left], [, right]) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_ROM_BINDINGS - 1);
  return {
    [keepKey]: bindings[keepKey],
    ...Object.fromEntries(newestOthers),
  };
};

/**
 * Returns the most recently remembered local ROM path for one content identity.
 * @param {ExtensionContext} context Extension machine-local storage.
 * @param {string} contentSha256 Headerless ROM content identity.
 * @returns {string | undefined} Remembered absolute path, when present.
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.globalState
 * @see https://code.visualstudio.com/api/references/vscode-api#Memento
 */
export const rememberedSnesRom = (
  context: ExtensionContext,
  contentSha256: string,
): string | undefined =>
  context.globalState.get<RomBindings>(ROM_BINDINGS_KEY, {})[contentSha256]?.path;

/**
 * Stores a bounded content-addressed ROM binding for later analysis/regeneration commands.
 * @param {ExtensionContext} context Extension machine-local storage.
 * @param {RomIdentity} identity Validated ROM file/content identity.
 * @param {string} romFile Local ROM path.
 * @returns {Promise<void>} Completion after extension storage is updated.
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.globalState
 * @see https://code.visualstudio.com/api/references/vscode-api#Memento
 */
export const rememberSnesRom = async (
  context: ExtensionContext,
  identity: RomIdentity,
  romFile: string,
): Promise<void> => {
  const { sha256, contentSha256, headerSize } = identity;
  const next = {
    ...context.globalState.get<RomBindings>(ROM_BINDINGS_KEY, {}),
    [contentSha256]: {
      path: path.resolve(romFile),
      fileSha256: sha256,
      contentSha256,
      headerSize,
      updatedAt: new Date().toISOString(),
    },
  } satisfies Record<string, RomBinding>;
  await context.globalState.update(ROM_BINDINGS_KEY, capRomBindings(next, contentSha256));
};
