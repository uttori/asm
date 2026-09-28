import { type SourcePublicationState } from "./source-generation.js";
/** Hash missing files distinctly from empty files.
 * @param {string} file Regular file to read.
 * @returns {string | null} Exact digest or absence.
 */
export declare function optionalFileHash(file: string): string | null;
/** Publish a verified sibling candidate while retaining the previous complete generation.
 * Caller holds the project/source lease and SQLite write transaction, and has rechecked inputs.
 * Every changed path is journaled before the first replacement; manifest is replaced last.
 * @param {string} root Visible export directory.
 * @param {string} previous Retained exact previous tree, verified against the original ROM.
 * @param {string} candidate Verified candidate tree at the same directory depth.
 * @param {string} romSha256 Actual verified full-ROM digest.
 * @param {(index: number) => void} [checkpoint] Fault-injection boundary after each replacement.
 * @returns {SourcePublicationState} Durable verified outcome.
 */
export declare function publishSourceGeneration(root: string, previous: string, candidate: string, romSha256: string, checkpoint?: (index: number) => void): SourcePublicationState;
/** Reconcile interrupted replacement under the same publication lease used by writers.
 * Complete candidates are acknowledged; partial candidates roll back to verified previous files.
 * Unknown external bytes block recovery without overwriting either the edit or retained versions.
 * @param {string} root Visible export root.
 * @returns {SourcePublicationState | undefined} Reconciled journal or previous terminal outcome.
 */
export declare function recoverSourceGeneration(root: string): SourcePublicationState | undefined;
//# sourceMappingURL=source-publication.d.ts.map