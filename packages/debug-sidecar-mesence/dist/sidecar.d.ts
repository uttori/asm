export interface MesenSidecarArguments {
    readonly manifest: string;
    readonly executable: string;
    readonly rom: string;
    /** Explicit verified build identity; omitted retains the runtime manifest's original ROM pin. */
    readonly romSha256?: string;
    readonly runtimeDirectory: string;
}
/**
 * Strict shell-independent parser for the production MesenCE sidecar.
 * @param {readonly string[]} arguments_ Sidecar command-line arguments.
 * @returns {MesenSidecarArguments} Validated and path-resolved launch inputs.
 */
export declare const parseMesenSidecarArguments: (arguments_: readonly string[]) => MesenSidecarArguments;
/**
 * Runs one authenticated neutral sidecar until shutdown, EOF, signal, or protocol failure.
 * @param {readonly string[]} arguments_ Sidecar command-line arguments.
 * @param {NodeJS.ProcessEnv} environment Environment containing the neutral session token.
 * @returns {Promise<void>} Completion after installing protocol and lifecycle handlers.
 */
export declare const runMesenSidecar: (arguments_: readonly string[], environment?: NodeJS.ProcessEnv) => Promise<void>;
//# sourceMappingURL=sidecar.d.ts.map