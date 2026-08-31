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
export declare const usage = "Usage: uttori-asm <input> [output] [options]\n\nOptions:\n  --config <uttori-asm.config.json>\n  --plugin <module>              Repeatable; appended after configured plugins\n  --target <target-id>\n  --architecture <architecture-id>\n  --base-image <path>\n  --include-path <path>          Repeatable\n  --plugin-option <plugin:key=value>\n  --verbose\n  --help";
export declare const parseCliArguments: (argv: readonly string[]) => CliArguments;
export declare const runCli: (argv?: readonly string[]) => Promise<number>;
//# sourceMappingURL=index.d.ts.map