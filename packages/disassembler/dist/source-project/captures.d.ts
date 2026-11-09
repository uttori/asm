import type { ImportReport } from "../model/project-types.js";
/** Historical input identity. Its filename and hashes do not imply the archive is still available. */
export interface SourceCaptureArchive {
    /** Portable archive basename; a discovery hint only, not part of the binding identity. */
    readonly name: string;
    /** Lowercase SHA-256 of the archive bytes. */
    readonly sha256: string;
    /** Archive length in bytes; always positive. */
    readonly bytes: number;
    /** Hash of the verified manifest, which binds every companion artifact by its own content hash. */
    readonly companionSha256?: string;
}
/** Canonical importer identity survives archive re-encoding and differs from the archive byte hash. */
export interface SourceCaptureIdentity {
    /** Canonical importer source hash; unique within a catalog. */
    readonly sha256: string;
    /** Portable basename of the imported source; absolute report paths are reduced to it. */
    readonly sourceName: string;
    /** Retention/index profile used for the import, such as `full` or `65816-analysis-v3`. */
    readonly profile: string;
    /** Graphics, bus or execution events observed by the importer, in that precedence. */
    readonly observedEvents: number;
    /** Events the producer reported dropped for instruction addresses. */
    readonly droppedEvents: number;
    /** Verified input fingerprints only. Imported evidence must remain available independently of these files. */
    readonly archives: readonly SourceCaptureArchive[];
}
/** Git-tracked import provenance contains identities only, never capture contents or required host paths. */
export interface SourceCaptureCatalog {
    /** Catalog format discriminator. */
    readonly format: "uttori-capture-catalog";
    /** Catalog schema version. */
    readonly version: 1;
    /** Original ROM identity; a catalog for another ROM is rejected. */
    readonly romSha256: string;
    /** Capture identities sorted by `sha256`; at most 10,000 entries. */
    readonly captures: readonly SourceCaptureIdentity[];
}
/** Validate before trusting a catalog from a branch, clone or external private-input bundle. */
export declare function parseSourceCaptureCatalog(value: unknown, romSha256: string): SourceCaptureCatalog;
/** Catalog absence is explicit during first import or extraction; malformed existing data never resets. */
export declare function readSourceCaptureCatalog(root: string, name: string, romSha256: string): {
    readonly catalog: SourceCaptureCatalog;
    readonly fileSha256?: string;
};
/** Extract durable import identities without changing or materializing normalized runtime evidence. */
export declare function reconcileSourceCaptureCatalog(catalog: SourceCaptureCatalog, reports: readonly ImportReport[], binding?: {
    readonly sourceSha256: string;
    readonly archive: SourceCaptureArchive;
}): SourceCaptureCatalog;
/** Save only against the read snapshot; evidence imports and Git-file writes are separate durable operations. */
export declare function writeSourceCaptureCatalog(root: string, name: string, catalog: SourceCaptureCatalog, expectedSha256?: string): void;
/** Streamed source archives have no default policy ceiling beyond exact JavaScript byte accounting. */
export declare const DEFAULT_SOURCE_CAPTURE_MAX_BYTES: number;
/** Stream archive identity with cancellation and an optional per-archive ceiling. Companion artifacts are separately verified by the importer. */
export declare function fingerprintSourceCapture(file: string, signal?: AbortSignal, maxBytes?: number): Promise<SourceCaptureArchive>;
//# sourceMappingURL=captures.d.ts.map