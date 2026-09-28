import type { AssetSourceBaseline } from "./source-baseline.js";
/** An isolated complete source generation, with the live generation's persistent baseline. */
export interface AssetSourceStage {
    readonly directory: string;
    readonly baseline: AssetSourceBaseline;
    /** Host-declared external directories retained in place across publication; never copied or replaced. */
    readonly excludedDirectories: readonly string[];
}
/**
 * Copy a complete source generation beside its live root. New assets and exporter-generated
 * files may be created freely inside this isolated directory. The caller owns stage cleanup.
 * @param {string} root Existing real directory with no symlinks/special files.
 * @param {string} identity Host-selected project and adapter revision identity.
 * @param {readonly string[]} excludedDirectories External directories retained from the live generation; never inferred from game names.
 * @returns {AssetSourceStage} Isolated writable tree and original complete baseline.
 */
export declare function createAssetSourceStage(root: string, identity: string, excludedDirectories?: readonly string[]): AssetSourceStage;
/**
 * Validate and publish a whole source generation, retaining the previous tree as recovery data.
 * The host must check generated manifests and assemble inside validate; failure leaves live
 * sources untouched. Offline operation is required: two directory renames are not crash-atomic
 * or atomic to concurrent readers. On failure, restore the previous tree if its path is free.
 * @param {string} root Live source directory, a sibling of the stage.
 * @param {AssetSourceStage} stage Complete staged generation including newly created files.
 * @param {string} identity Expected project/adapter identity independent of persisted metadata.
 * @param {(directory: string) => Promise<void> | void} validate Required host-specific integrity and build gates.
 * @returns {Promise<string>} Previous generation directory retained for explicit cleanup or recovery.
 */
export declare function publishAssetSourceStage(root: string, stage: AssetSourceStage, identity: string, validate: (directory: string) => Promise<void> | void): Promise<string>;
//# sourceMappingURL=source-stage.d.ts.map