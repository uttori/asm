export interface CliArguments {
    readonly input?: string;
    readonly output?: string;
    readonly configFile?: string;
    readonly plugins: readonly string[];
    readonly target?: string;
    readonly architecture?: string;
    readonly baseImage?: string;
    readonly includePaths: readonly string[];
    readonly pluginOptions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    readonly verbose: boolean;
    readonly help: boolean;
}
export declare const parseCliArguments: (argv: readonly string[]) => CliArguments;
export declare const runCli: (argv?: readonly string[]) => Promise<number>;
//# sourceMappingURL=cli.d.ts.map