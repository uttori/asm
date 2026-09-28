import { type SourceExportManifest } from "./source-export.js";
/** Generated sidecar, included in the export's file-integrity manifest. */
export declare const SOURCE_OWNERSHIP_FILE = "source-ownership.json";
/** Persistent owner, rather than the spelling or line number of its generated presentation. */
export interface SourceOwner {
    readonly kind: "label" | "comment" | "function" | "region" | "instruction" | "data" | "asset" | "ram" | "structure" | "binding" | "field" | "constant" | "hardware";
    readonly id: string;
    readonly name?: string;
    /** Exact exported spelling, also used to resolve references in other generated files. */
    readonly symbol?: string;
    /** Relative user-owned input. Absent for native project records and immutable ROM bytes. */
    readonly inputPath?: string;
    readonly addressSpace?: string;
    readonly address?: number;
    /** Canonical emitted CPU address; the native address above can be a different bus alias. */
    readonly emittedAddress?: number;
    /** Headerless ROM byte interval, with exclusive end. Omitted for RAM and pure type definitions. */
    readonly outputStart?: number;
    readonly outputEnd?: number;
    readonly evidence?: readonly string[];
}
/** One generated presentation of an owner. Lines are one-based and inclusive. */
export interface SourceOwnershipEntry extends SourceOwner {
    readonly file: string;
    readonly startLine: number;
    readonly endLine: number;
}
/** Bound to both the original ROM and the exact analysis revision used to emit these locations. */
export interface SourceOwnershipMap {
    readonly format: "uttori-asm-source-ownership";
    readonly sourceProjectSha256: string;
    readonly romSha256: string;
    readonly entries: readonly SourceOwnershipEntry[];
}
/** Managed-file discovery result. Membership does not imply that current file bytes are valid. */
export interface ManagedSourceFile {
    readonly directory: string;
    readonly relative: string;
    readonly manifest: SourceExportManifest;
}
/**
 * Find the nearest owning manifest. An unlisted file inside an export remains user-owned.
 * @param {string} file Absolute or working-directory-relative source path.
 * @returns {ManagedSourceFile | undefined} Managed membership, or undefined for user-owned source. Invalid manifests throw.
 */
export declare const findManagedSourceFile: (file: string) => ManagedSourceFile | undefined;
/**
 * Load only a manifest-owned, hash-verified sidecar. Older exports legitimately have no map.
 * @param {ManagedSourceFile} managed Membership and generation identity from the current manifest.
 * @returns {SourceOwnershipMap | undefined} Verified map, or undefined for older exports; malformed or changed data throws.
 */
export declare const loadSourceOwnership: (managed: ManagedSourceFile) => SourceOwnershipMap | undefined;
/**
 * Resolve a token or line against a verified generation; retain ambiguity instead of guessing.
 * @param {SourceOwnershipMap} map Hash-verified export-time ownership metadata.
 * @param {string} file Export-relative source path using forward slashes.
 * @param {string} text Exact unchanged source text associated with this generation.
 * @param {number} line One-based source line.
 * @param {number} column Zero-based character offset on the line.
 * @returns {readonly SourceOwnershipEntry[]} Most specific owners, including all ambiguous matches.
 */
export declare const sourceOwnersAt: (map: SourceOwnershipMap, file: string, text: string, line: number, column: number) => readonly SourceOwnershipEntry[];
//# sourceMappingURL=source-ownership.d.ts.map