import type { CaptureFileMetadata } from "./capture-file.js";
/** Verify the entire companion before feeding a save state to native code. Every
 * path is a flat, regular artifact, and every byte is bound to the recording's identity.
 * Producer revisions authenticate the companion, not the build currently loading it.
 * @param {string} directory Companion directory selected by the user.
 * @param {Pick<CaptureFileMetadata, "romContentSha256" | "romFileSha256" | "producer">} identity Required ROM and recorded producer identity; the running build may differ.
 */
export declare const verifyCaptureContext: (directory: string, identity: Pick<CaptureFileMetadata, "romContentSha256" | "romFileSha256" | "producer">, signal?: AbortSignal) => Promise<void>;
//# sourceMappingURL=capture-context.d.ts.map