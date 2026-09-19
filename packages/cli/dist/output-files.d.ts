/** Complete bytes prepared in memory before publishing a build artifact. */
interface OutputFile {
    readonly file: string;
    readonly contents: string | Uint8Array;
}
/**
 * Stage all artifacts before replacing destinations, then rename each file atomically. Parent
 * directories are created. Preparation failures leave existing artifacts intact; publication is
 * atomic per file, not across multiple files or sudden termination between renames. Temporary
 * siblings are removed on ordinary failures; forced process termination can leave them behind.
 * @param {readonly OutputFile[]} outputs Fully computed artifacts in publication order.
 * @param {readonly string[]} protectedFiles Existing inputs that must not become output destinations.
 */
export declare const publishOutputFiles: (outputs: readonly OutputFile[], protectedFiles: readonly string[]) => void;
export {};
//# sourceMappingURL=output-files.d.ts.map