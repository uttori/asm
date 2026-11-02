import { openAnalysisProjectStore } from "@uttori/asm-disassembler";

/**
 * Validated source catalog and manifest returned by the SQLite source projection, without
 * loading CFG or runtime shards.
 */
export type AnalysisSourceCatalogProjection = ReturnType<
  ReturnType<typeof openAnalysisProjectStore>["sourceCatalog"]
>;

/**
 * Read validated source identities without loading CFG or runtime history.
 * @param directory Native project directory.
 * @returns Catalog and authoritative manifest from one read snapshot.
 */
export const readAnalysisSourceCatalog = (directory: string): AnalysisSourceCatalogProjection => {
  const store = openAnalysisProjectStore(directory);
  try {
    return store.transaction(() => store.sourceCatalog(), false);
  } finally {
    store.close();
  }
};
