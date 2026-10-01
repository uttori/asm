import { type AnalysisStoragePolicy } from "@uttori/asm-disassembler";
import { type SnesMapper } from "@uttori/asm-plugin-snes";
export { executeSourceOperation, type SourceAction, type SourceOperation } from "./source.js";
/** Explicit subcommands. An invocation without one defaults to assemble. */
export type CliCommand = "analyze" | "assemble" | "disassemble" | "evidence-import" | "evidence-report" | "project-compact" | "project-storage" | "project-validate";
/** Parsed values only: no filesystem access, configuration loading, or path resolution has occurred. */
export interface CliArguments {
    readonly command: CliCommand;
    readonly input?: string;
    /** Optional second positional argument. Its default and meaning depend on command/target. */
    readonly output?: string;
    readonly configFile?: string;
    readonly plugins: readonly string[];
    readonly target?: string;
    readonly architecture?: string;
    /** Path to initial patch bytes. Source may extend them and target finalization still applies. */
    readonly baseImage?: string;
    /** Enabled by either --debug or --debug-map. Source metadata is otherwise not collected. */
    readonly debug: boolean;
    readonly debugMap?: string;
    readonly includePaths: readonly string[];
    /** Values are JSON-decoded when possible. Repeated plugin/key assignments keep the last value. */
    readonly pluginOptions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    readonly mapper?: SnesMapper;
    /** Copier-header bytes. Undefined requests automatic detection during creation. */
    readonly headerSize?: 0 | 512;
    readonly dizraw?: string;
    readonly rom?: string;
    readonly instructionTrace?: string;
    /** Positive integer MiB limit. Undefined delegates to the import default of 2048. */
    readonly traceMaxMiB?: number;
    readonly traceIndex?: "full";
    readonly storagePolicy?: Partial<AnalysisStoragePolicy>;
    /** Repeatable 24-bit SNES CPU bus addresses, not ROM file offsets. */
    readonly entryPoints: readonly number[];
    /** Positive work-item limit. Undefined delegates to {@link DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS}. */
    readonly maxWorkItems?: number;
    /** Nonnegative call-context depth. Undefined delegates to {@link DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH}. */
    readonly maxCallDepth?: number;
    readonly verbose: boolean;
    readonly help: boolean;
}
/** Installed executable's help text. All flags are long options. -- ends option parsing. */
export declare const usage: string;
/**
 * Parse arguments without reading files or loading plugins. Unknown/inapplicable flags, boolean
 * values, invalid numeric limits, and excess positionals throw Error. Required input/ROM presence
 * is checked by runCli so a bare --help remains valid. -- treats all following strings as paths.
 * @param {readonly string[]} argv Tokens excluding the Node executable and script name. Not mutated.
 * @returns {CliArguments} New parsed object. List fields and the outer option map are shallow-frozen.
 */
export declare const parseCliArguments: (argv: readonly string[]) => CliArguments;
/**
 * Run one invocation using process.cwd(), the real filesystem, and the process console. Status/help
 * goes to stdout. Errors/warnings go to stderr. Output is human-readable, not a stable JSON protocol.
 * Owns and disposes its assembler/plugin environment. Failures including cleanup return 1. Plugins
 * execute trusted code in-process. The host must serialize calls if it changes cwd or intercepts console.
 * No AbortSignal or signal handlers are installed: terminal termination can skip cleanup. Use the
 * underlying libraries for cooperative cancellation or structured results. This function neither
 * calls process.exit nor sets process.exitCode. The executable wrapper sets the returned status.
 * @param {readonly string[]} [argv] Argument tokens, defaulting to process.argv.slice(2). Not mutated.
 * @returns {Promise<number>} 0 for success/help (including incomplete analysis), 1 for reported failure.
 */
export declare const runCli: (argv?: readonly string[]) => Promise<number>;
//# sourceMappingURL=index.d.ts.map