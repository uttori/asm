/** Read host metadata without activating plugins. Editor overrides resolve from the workspace; config paths resolve beside that config. */
export declare function resolveAssemblyBuildSelection(directory: string, configFile?: string, override?: string): Promise<{
    readonly manifest?: string;
    readonly configurationFile?: string;
    readonly configurationSha256?: string;
}>;
//# sourceMappingURL=build-selection.d.ts.map