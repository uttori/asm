export interface AresSidecarArguments {
    readonly manifest: string;
    readonly executable: string;
    readonly rom: string;
    readonly runtimeDirectory: string;
    readonly system?: string;
    readonly fastBoot: boolean;
}
/**
 * Strict shell-independent parser for the production sidecar executable.
 * @param {readonly string[]} arguments_ Sidecar command-line arguments.
 * @returns {AresSidecarArguments} Validated and path-resolved launch inputs.
 */
export declare const parseAresSidecarArguments: (arguments_: readonly string[]) => AresSidecarArguments;
/**
 * Runs one authenticated stdio sidecar until shutdown, EOF, signal, or protocol failure.
 * @param {readonly string[]} arguments_ Sidecar command-line arguments.
 * @param {NodeJS.ProcessEnv} environment Environment containing the one-session token.
 * @returns {Promise<void>} Completion once stdio handlers and backend ownership are installed.
 */
export declare const runAresSidecar: (arguments_: readonly string[], environment?: NodeJS.ProcessEnv) => Promise<void>;
//# sourceMappingURL=sidecar.d.ts.map