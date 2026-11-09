import type { ImportReport } from "../model/project-types.js";
/** Newly decoded ROM interval, with its actual CPU identity for source/disassembly navigation. */
export interface CaptureAddedCode {
    /** Inclusive start and exclusive end in ROM-content bytes, excluding any copier header. */
    readonly start: number;
    /** Exclusive end in ROM-content bytes, greater than start. */
    readonly end: number;
    /** CPU address space of the interval's first byte. */
    readonly addressSpace: string;
    /** CPU address of start within addressSpace. */
    readonly address: number;
    /** Analysis record IDs that decoded this interval. */
    readonly recordIds: readonly string[];
}
/** Local generated report. Absence means a legacy import; pending reports await a successful analysis. */
export interface CaptureImportNotes {
    /** Report format marker. */
    readonly format: "uttori-capture-notes";
    /** Report schema version. */
    readonly version: 1;
    /** SHA-256 of the capture archive; also the report filename. */
    readonly sourceSha256: string;
    /** Capture basename only; directories are stripped to keep private paths out of reports. */
    readonly sourceName: string;
    /** First successful import time in Unix milliseconds; reimports retain it. */
    readonly importedAt: number;
    /** Human-readable import counts, warnings and unsupported-field losses. */
    readonly notes: readonly string[];
    /** Result of the first analysis after import; undefined while the report is pending. */
    readonly analysis?: {
        readonly status: "complete" | "incomplete";
        /** All captures awaiting this pass; new code cannot be attributed to one capture in isolation. */
        readonly sources: readonly string[];
        readonly addedCode: readonly CaptureAddedCode[];
    };
}
/** Validate bounded local report data before exposing it to worker IPC or editor commands. */
export declare function isCaptureImportNotes(value: unknown): value is CaptureImportNotes;
/** Missing reports are ordinary legacy imports. Malformed existing reports fail rather than resetting history. */
export declare function readCaptureImportNotes(directory: string, sha256: string): CaptureImportNotes | undefined;
/** Record the first successful import only; reimports retain the original analysis comparison. */
export declare function writeCaptureImportNotes(directory: string, report: ImportReport): void;
/** Snapshot pending identities before analysis so captures imported during a pass remain pending. */
export declare function pendingCaptureImportNotes(directory: string): CaptureImportNotes[];
/** Publish new-code links only after successful analysis; failures leave reports pending for retry. */
export declare function completeCaptureImportNotes(directory: string, pending: readonly CaptureImportNotes[], status: "complete" | "incomplete", addedCode: readonly CaptureAddedCode[]): void;
//# sourceMappingURL=capture-notes.d.ts.map