/** Path-resolved launch inputs for the ares production sidecar executable. */
export interface AresSidecarArguments {
    /** Absolute path to the versioned ares runtime manifest JSON. */
    readonly manifest: string;
    /** Absolute path to the separately installed ares executable. */
    readonly executable: string;
    /** Absolute path to the SNES ROM matching the build or manifest pin. */
    readonly rom: string;
    /** Explicit verified build identity; omitted retains the runtime manifest's original ROM pin. */
    readonly romSha256?: string;
    /** Portable root containing bin, resources, settings, and default saves. */
    readonly runtimeDirectory: string;
    /** Optional persistent SRAM/state root, resolved independently of the runtime. */
    readonly saveDirectory?: string;
    /** Ares system name passed through to the frontend, when overridden. */
    readonly system?: string;
    /** Whether ares fast-boot is enabled for this launch. */
    readonly fastBoot: boolean;
}
/**
 * Strict shell-independent parser for the production sidecar executable.
 * @param arguments_ Sidecar command-line arguments.
 * @returns Validated and path-resolved launch inputs.
 */
export declare const parseAresSidecarArguments: (arguments_: readonly string[]) => AresSidecarArguments;
/**
 * Runs one authenticated stdio sidecar until shutdown, EOF, signal, or protocol failure.
 * @param arguments_ Sidecar command-line arguments.
 * @param environment Environment containing the one-session token.
 * @returns Completion once stdio handlers and backend ownership are installed.
 */
export declare const runAresSidecar: (arguments_: readonly string[], environment?: NodeJS.ProcessEnv) => Promise<void>;
//# sourceMappingURL=sidecar.d.ts.map