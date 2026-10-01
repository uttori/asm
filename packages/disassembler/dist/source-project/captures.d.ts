import type { ImportReport } from "../model/project-types.js";
/** Portable archive identity. The filename is a discovery hint, never a machine-specific location. */
export interface SourceCaptureArchive {
    readonly name: string;
    readonly sha256: string;
    readonly bytes: number;
    /** Hash of the verified manifest, which binds every companion artifact by its own content hash. */
    readonly companionSha256?: string;
}
/** Canonical importer identity survives archive re-encoding and differs from the archive byte hash. */
export interface SourceCaptureIdentity {
    readonly sha256: string;
    readonly sourceName: string;
    readonly profile: string;
    readonly observedEvents: number;
    readonly droppedEvents: number;
    /** Empty means retained evidence is required: this catalog cannot reconstruct that capture. */
    readonly archives: readonly SourceCaptureArchive[];
}
/** Git-tracked private-input inventory contains identities only, never capture contents or host paths. */
export interface SourceCaptureCatalog {
    readonly format: "uttori-capture-catalog";
    readonly version: 1;
    readonly romSha256: string;
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
/** Stream archive identity with cancellation. Companion artifacts are separately verified by the importer. */
export declare function fingerprintSourceCapture(file: string, signal?: AbortSignal, maxBytes?: number): Promise<SourceCaptureArchive>;
//# sourceMappingURL=captures.d.ts.map