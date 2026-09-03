import { type SnesMapper } from "@uttori/asm-plugin-snes";
export type CliCommand = "analyze" | "assemble" | "disassemble" | "evidence-import" | "evidence-report" | "export" | "mesen-labels-export" | "project-validate" | "verify-roundtrip";
export interface CliArguments {
    readonly command: CliCommand;
    readonly input?: string;
    readonly output?: string;
    readonly configFile?: string;
    readonly plugins: readonly string[];
    readonly target?: string;
    readonly architecture?: string;
    readonly baseImage?: string;
    readonly debug: boolean;
    readonly debugMap?: string;
    readonly includePaths: readonly string[];
    readonly pluginOptions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    readonly mapper?: SnesMapper;
    readonly headerSize?: 0 | 512;
    readonly dizraw?: string;
    readonly rom?: string;
    readonly mesenCdl?: string;
    readonly mesenTrace?: string;
    readonly traceMetadata?: string;
    readonly mesenLabels?: string;
    readonly entryPoints: readonly number[];
    readonly maxWorkItems?: number;
    readonly maxCallDepth?: number;
    readonly verbose: boolean;
    readonly force: boolean;
    readonly help: boolean;
}
export declare const usage: string;
/**
 * Parses the CLI arguments and returns a CliArguments object.
 * @param {readonly string[]} argv The CLI arguments.
 * @returns {CliArguments} The parsed CLI arguments.
 */
export declare const parseCliArguments: (argv: readonly string[]) => CliArguments;
/**
 * Runs the CLI.
 * @param {readonly string[]} argv The CLI arguments.
 * @returns {Promise<number>} The exit code.
 */
export declare const runCli: (argv?: readonly string[]) => Promise<number>;
//# sourceMappingURL=index.d.ts.map