import { type AnalysisStoragePolicy } from "@uttori/asm-disassembler/storage";
import { type SnesMapper } from "@uttori/asm-plugin-snes/disassembler";
/** Explicit subcommands. An invocation without one defaults to assemble. */
export type CliCommand = "analyze" | "assemble" | "disassemble" | "evidence-import" | "evidence-report" | "project-compact" | "project-storage" | "project-validate";
/** Parsed values only: no filesystem access, configuration loading, or path resolution has occurred. */
export interface CliArguments {
    /** Subcommand selected from the first positional token. */
    readonly command: CliCommand;
    /** First positional path: source file, project directory, or capture, depending on command. */
    readonly input?: string;
    /** Optional second positional argument. Its default and meaning depend on command/target. */
    readonly output?: string;
    /** Path to the JSON config; relative paths resolve from the current working directory. */
    readonly configFile?: string;
    /** Plugin modules from `--plugin`. An empty list lets the command's default plugins load. */
    readonly plugins: readonly string[];
    /** Target contribution ID or alias. Undefined uses the config or the SNES default. */
    readonly target?: string;
    /** Architecture ID or alias within the target. Undefined uses the target default. */
    readonly architecture?: string;
    /** Path to initial patch bytes. Source may extend them and target finalization still applies. */
    readonly baseImage?: string;
    /** Enabled by either --debug or --debug-map. Source metadata is otherwise not collected. */
    readonly debug: boolean;
    /** Optional debug-map output path. Written only when debug collection is enabled. */
    readonly debugMap?: string;
    /** Include directories from `--include-path`, replacing any configured list. */
    readonly includePaths: readonly string[];
    /** Values are JSON-decoded when possible. Repeated plugin/key assignments keep the last value. */
    readonly pluginOptions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    /** SNES mapper for `source init`. Undefined lets the initializer detect it from the ROM. */
    readonly mapper?: SnesMapper;
    /** Copier-header bytes. Undefined requests automatic detection during creation. */
    readonly headerSize?: 0 | 512;
    /** Optional DiztinGUIsh research file imported during `source init`. */
    readonly dizraw?: string;
    /** Original ROM path for capture or source commands that bind one. */
    readonly rom?: string;
    /** Instruction-trace capture path for evidence-import. */
    readonly instructionTrace?: string;
    /** Positive integer MiB limit. Undefined delegates to the shared 32 GiB import default. */
    readonly traceMaxMiB?: number;
    /** Trace index density. `full` retains every sample; `analysis` keeps the compact form. */
    readonly traceIndex?: "full" | "analysis";
    /** Optional storage-policy overrides for project-compact. Unset fields keep the stored policy. */
    readonly storagePolicy?: Partial<AnalysisStoragePolicy>;
    /** Explicitly consolidate SNES register snapshots before physical compaction. */
    readonly analysisOnly?: boolean;
    /** Repeatable 24-bit SNES CPU bus addresses, not ROM file offsets. */
    readonly entryPoints: readonly number[];
    /** Positive work-item limit. Undefined delegates to {@link DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS}. */
    readonly maxWorkItems?: number;
    /** Nonnegative call-context depth. Undefined delegates to {@link DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH}. */
    readonly maxCallDepth?: number;
    /** When true, progress is written to stderr. */
    readonly verbose: boolean;
    /** When true, print usage and exit without running a command. */
    readonly help: boolean;
}
/** Installed executable's help text. All flags are long options. -- ends option parsing. */
export declare const usage: string;
/**
 * Parse arguments without reading files or loading plugins. Unknown/inapplicable flags, boolean
 * values, invalid numeric limits, and excess positionals throw Error. Required input/ROM presence
 * is checked by runCli so a bare --help remains valid. -- treats all following strings as paths.
 * @param argv Tokens excluding the Node executable and script name. Not mutated.
 * @returns New parsed object. List fields and the outer option map are shallow-frozen.
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
 * @param [argv] Argument tokens, defaulting to process.argv.slice(2). Not mutated.
 * @returns 0 for success/help (including incomplete analysis), 1 for reported failure.
 */
export declare const runCli: (argv?: readonly string[]) => Promise<number>;
//# sourceMappingURL=index.d.ts.map