import * as fs from "node:fs";
import path from "node:path";

import { Assembler, NodeAssemblyFileProvider, PluginError, createDebugMap } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
import {
  ANALYSIS_PROJECT_MANIFEST,
  RomImage,
  importRuntimeTraceIntoProject,
  openAnalysisProjectStore,
  loadAnalysisProjectView,
  compactAnalysisProject,
  DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH,
  DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS,
  DEFAULT_RUNTIME_TRACE_MAX_BYTES,
  type AnalysisStoragePolicy,
  validateProjectRom,
} from "@uttori/asm-disassembler";
import {
  loadProjectEnvironment,
  PROJECT_CONFIG_FILENAME,
  type PluginModuleRequest,
  type ProjectConfigurationOverrides,
} from "@uttori/asm-plugin-loader-node";
import snesPlugin, {
  SNES_MAPPERS,
  SNES_TARGET_ID,
  analyzeSnesProject,
  createSnesAnalysisProject,
  type SnesMapper,
} from "@uttori/asm-plugin-snes";

import { assetUsage, runAssetCli } from "./asset-interchange/cli.js";
import { publishOutputFiles } from "./output-files.js";
import { runSourceCli, sourceUsage } from "./source.js";
export { executeSourceOperation, type SourceAction, type SourceOperation } from "./source.js";

/** Explicit subcommands. An invocation without one defaults to assemble. */
export type CliCommand =
  | "analyze"
  | "assemble"
  | "disassemble"
  | "evidence-import"
  | "evidence-report"
  | "project-compact"
  | "project-storage"
  | "project-validate";

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
  /** Positive integer MiB limit. Undefined delegates to the shared 32 GiB import default. */
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

function isCliCommand(value: string): value is CliCommand {
  return Object.hasOwn(commandOptions, value);
}

function isSnesMapper(value: string): value is SnesMapper {
  return SNES_MAPPERS.some((mapper) => mapper === value);
}

/** Flags are command-specific so a misspelled workflow cannot silently ignore a requested policy. */
const commandOptions: Readonly<Record<CliCommand, readonly string[]>> = {
  assemble: [
    "--config",
    "--plugin",
    "--target",
    "--architecture",
    "--base-image",
    "--debug",
    "--debug-map",
    "--include-path",
    "--plugin-option",
    "--verbose",
  ],
  disassemble: ["--mapper", "--header-size", "--dizraw"],
  analyze: ["--rom", "--entry", "--max-work-items", "--max-call-depth"],
  "project-validate": ["--rom"],
  "project-compact": [],
  "project-storage": ["--cache-max-mib", "--storage-max-mib"],
  "evidence-import": [
    "--rom",
    "--instruction-trace",
    "--trace-max-mib",
    "--trace-index",
    "--cache-max-mib",
    "--storage-max-mib",
  ],
  "evidence-report": [],
};
const knownOptions = new Set(["--help", ...Object.values(commandOptions).flat()]);
const booleanOptions = new Set(["--help", "--verbose", "--debug"]);
const commandsWithOutput = new Set<CliCommand>(["assemble", "disassemble", "evidence-report"]);

/** Installed executable's help text. All flags are long options. -- ends option parsing. */
export const usage = `Usage: uttori-asm <input.asm> [output] [assemble-options]
  uttori-asm assemble <input.asm> [output] [assemble-options]
  uttori-asm disassemble <rom> [project-directory] [creation-options]
  uttori-asm analyze <project-directory> --rom <rom> [analysis-options]
  uttori-asm evidence-import <project-directory> --rom <rom> [evidence-options]
  uttori-asm evidence-report <project-directory> [report.json]
  uttori-asm project-validate <project-directory> [--rom <rom>]
  uttori-asm project-compact <project-directory>
  uttori-asm project-storage <project-directory> [storage-options]

Creation options (disassemble):
  --mapper <${SNES_MAPPERS.join("|")}>
  --header-size <0|512>
  --dizraw <path>              Import uncompressed DiztinGUIsh XML
  Defaults: <rom stem>.analysis. Copier header and mapper detected unless overridden.

ROM identity (analyze, evidence-import):
  --rom <path>                Required original ROM. Optional with project-validate

Evidence options (evidence-import):
  --instruction-trace <path>   Import a native explicit instruction recording
  --trace-max-mib <count>      Native trace import size limit in MiB (default 32768)
  --trace-index <mode>         full (default; retains all registers)

Analysis options (analyze):
  --entry <address>            Repeatable 24-bit CPU address ($hex/0xhex/decimal, quote $hex in shells)
  --max-work-items <count>     Positive work limit (default ${DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS})
  --max-call-depth <count>     Nonnegative call-context depth (default ${DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH})

Storage options (project-storage, budget options also accepted by evidence-import):
  --cache-max-mib <count>      Disposable projection budget (default 256)
  --storage-max-mib <count>    Project database publication ceiling (0 disables)

Assemble options:
  --config <uttori-asm.config.json>
  --plugin <module>            Repeatable. Appended after configured plugins
  --target <target-id>
  --architecture <architecture-id>
  --base-image <path>          Patch a copy, preserving unwritten bytes
  --debug                      Collect metadata and write <output>.debug.json
  --debug-map <path>           Collect metadata and write the map at this path
  --include-path <path>        Repeatable
  --plugin-option <plugin:key=value>
  --verbose
  --help                      Print usage (available for every command)

Use --flag=value or --flag value for valued options. Boolean flags take no value.
Use -- before positional paths beginning with --. Quote paths containing spaces.
Exit status: 0 success/help (including explicitly incomplete analysis), 1 failure.
Terminal signals retain Node's default termination behavior. No graceful cancellation is installed.`;

/**
 * Parse arguments without reading files or loading plugins. Unknown/inapplicable flags, boolean
 * values, invalid numeric limits, and excess positionals throw Error. Required input/ROM presence
 * is checked by runCli so a bare --help remains valid. -- treats all following strings as paths.
 * @param {readonly string[]} argv Tokens excluding the Node executable and script name. Not mutated.
 * @returns {CliArguments} New parsed object. List fields and the outer option map are shallow-frozen.
 */
export const parseCliArguments = (argv: readonly string[]): CliArguments => {
  const positional: string[] = [];
  const plugins: string[] = [];
  const includePaths: string[] = [];
  const pluginOptions: Record<string, Record<string, unknown>> = {};
  let command: CliCommand = "assemble";
  let startIndex = 0;
  const requestedCommand = argv.at(0);
  if (requestedCommand !== undefined && isCliCommand(requestedCommand)) {
    command = requestedCommand;
    startIndex = 1;
  }
  let configFile: string | undefined;
  let target: string | undefined;
  let architecture: string | undefined;
  let baseImage: string | undefined;
  let debugBuild = false;
  let debugMap: string | undefined;
  let mapper: SnesMapper | undefined;
  let headerSize: 0 | 512 | undefined;
  let dizraw: string | undefined;
  let rom: string | undefined;
  let instructionTrace: string | undefined;
  let traceMaxMiB: number | undefined;
  const storagePolicy: Partial<Record<keyof AnalysisStoragePolicy, number>> = {};
  let traceIndex: "full" | undefined;
  const entryPoints: number[] = [];
  let maxWorkItems: number | undefined;
  let maxCallDepth: number | undefined;
  let verbose = false;
  let help = false;
  const suppliedOptions = new Set<string>();

  const requireValue = (
    flag: string,
    inlineValue: string | undefined,
    index: number,
  ): [string, number] => {
    const nextIndex = index + 1;
    const nextArgument = nextIndex >= 0 && nextIndex < argv.length ? argv[nextIndex] : undefined;
    const value = inlineValue ?? nextArgument;
    if (
      value === undefined ||
      value === "" ||
      (inlineValue === undefined && value.startsWith("--"))
    ) {
      throw new Error(`${flag} requires a value.`);
    }
    return [value, inlineValue === undefined ? index + 1 : index];
  };

  for (let index = startIndex; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--") {
      positional.push(...argv.slice(index + 1));
      break;
    }
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const equals = argument.indexOf("=");
    const flag = equals < 0 ? argument : argument.slice(0, equals);
    const inlineValue = equals < 0 ? undefined : argument.slice(equals + 1);
    if (!knownOptions.has(flag)) {
      throw new Error(`Unknown option '${flag}'.`);
    }
    // A boolean flag with an explicit value must not silently enable the option.
    if (booleanOptions.has(flag) && inlineValue !== undefined) {
      throw new Error(`${flag} takes no value. Omit it to disable it.`);
    }
    suppliedOptions.add(flag);
    if (flag === "--help") {
      help = true;
      continue;
    }
    if (flag === "--verbose") {
      verbose = true;
      continue;
    }
    if (flag === "--debug") {
      debugBuild = true;
      continue;
    }
    const [value, consumedIndex] = requireValue(flag, inlineValue, index);
    index = consumedIndex;
    switch (flag) {
      case "--config":
        configFile = value;
        break;
      case "--plugin":
        plugins.push(value);
        break;
      case "--target":
        target = value;
        break;
      case "--architecture":
        architecture = value;
        break;
      case "--base-image":
        baseImage = value;
        break;
      case "--debug-map":
        debugBuild = true;
        debugMap = value;
        break;
      case "--include-path":
        includePaths.push(value);
        break;
      case "--mapper":
        if (!isSnesMapper(value)) {
          throw new Error(`--mapper must be one of: ${SNES_MAPPERS.join(", ")}.`);
        }
        mapper = value;
        break;
      case "--header-size":
        if (value === "0") {
          headerSize = 0;
        } else if (value === "512") {
          headerSize = 512;
        } else {
          throw new Error("--header-size must be 0 or 512.");
        }
        break;
      case "--dizraw":
        dizraw = value;
        break;
      case "--rom":
        rom = value;
        break;
      case "--instruction-trace":
        instructionTrace = value;
        break;
      case "--trace-max-mib":
        traceMaxMiB = Number(value);
        if (
          !Number.isSafeInteger(traceMaxMiB) ||
          traceMaxMiB < 1 ||
          !Number.isSafeInteger(traceMaxMiB * 1024 * 1024)
        ) {
          throw new Error(
            "--trace-max-mib must be a positive integer representing a safe byte limit.",
          );
        }
        break;
      case "--cache-max-mib":
      case "--storage-max-mib": {
        const keys: Record<string, keyof AnalysisStoragePolicy> = {
          "--cache-max-mib": "cacheMaxBytes",
          "--storage-max-mib": "databaseMaxBytes",
        };
        const amount = Number(value) * 1024 ** 2;
        if (!Number.isSafeInteger(amount) || amount < 0) {
          throw new Error(`${flag} requires a nonnegative safe integer limit.`);
        }
        storagePolicy[keys[flag]] = amount;
        break;
      }
      case "--trace-index":
        if (value !== "full") {
          throw new Error("--trace-index must be full.");
        }
        traceIndex = value;
        break;
      case "--entry": {
        const normalized = value.startsWith("$") ? `0x${value.slice(1)}` : value;
        const address = Number(normalized);
        if (!Number.isSafeInteger(address) || address < 0 || address > 0xffffff) {
          throw new Error("--entry must be a 24-bit $hex, 0xhex, or decimal address.");
        }
        entryPoints.push(address);
        break;
      }
      case "--max-work-items":
        maxWorkItems = Number(value);
        if (!Number.isSafeInteger(maxWorkItems) || maxWorkItems <= 0) {
          throw new Error("--max-work-items must be a positive integer.");
        }
        break;
      case "--max-call-depth":
        maxCallDepth = Number(value);
        if (!Number.isSafeInteger(maxCallDepth) || maxCallDepth < 0) {
          throw new Error("--max-call-depth must be a non-negative integer.");
        }
        break;
      case "--plugin-option": {
        const colon = value.indexOf(":");
        const equalsAt = value.indexOf("=", colon + 1);
        if (colon <= 0 || equalsAt <= colon + 1) {
          throw new Error("--plugin-option must use <plugin:key=value> syntax.");
        }
        const plugin = value.slice(0, colon);
        const key = value.slice(colon + 1, equalsAt);
        const rawValue = value.slice(equalsAt + 1);
        let optionValue: unknown = rawValue;
        // Accept JSON values while preserving unquoted strings as written.
        try {
          optionValue = JSON.parse(rawValue);
        } catch {
          // Non-JSON plugin options remain strings.
        }
        pluginOptions[plugin] = {
          ...pluginOptions[plugin],
          [key]: optionValue,
        };
        break;
      }
      default:
        throw new Error(`Unknown option '${flag}'.`);
    }
  }
  for (const flag of suppliedOptions) {
    if (flag !== "--help" && !commandOptions[command].includes(flag)) {
      throw new Error(`Option '${flag}' is not supported by '${command}'.`);
    }
  }
  const positionalLimit = commandsWithOutput.has(command) ? 2 : 1;
  if (positional.length > positionalLimit) {
    throw new Error(`Unexpected positional argument '${positional[positionalLimit]}'.`);
  }
  return {
    command,
    input: positional[0],
    output: positional[1],
    configFile,
    plugins: Object.freeze(plugins),
    target,
    architecture,
    baseImage,
    debug: debugBuild,
    debugMap,
    includePaths: Object.freeze(includePaths),
    pluginOptions: Object.freeze(pluginOptions),
    mapper,
    headerSize,
    dizraw,
    rom,
    instructionTrace,
    traceMaxMiB,
    traceIndex,
    ...(Object.keys(storagePolicy).length ? { storagePolicy } : {}),
    entryPoints: Object.freeze(entryPoints),
    maxWorkItems,
    maxCallDepth,
    verbose,
    help,
  };
};

/**
 * Returns the default output path for a given input file and extension.
 * @param {string} inputFile The input file.
 * @param {string} extension The extension.
 * @returns {string} The default output path.
 */
const defaultOutputPath = (inputFile: string, extension: string): string => {
  const parsed = path.parse(inputFile);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
};

/**
 * Formats a failure message for a given error.
 * @param {unknown} error The error.
 * @returns {string} The formatted failure message.
 */
function stringifyCaught(value: unknown): string | undefined {
  return JSON.stringify(value);
}

const formatFailure = (error: unknown): string => {
  if (error instanceof PluginError) {
    const context = [
      error.pluginId ? `plugin=${error.pluginId}` : undefined,
      error.pluginModule ? `module=${error.pluginModule}` : undefined,
      error.targetId ? `target=${error.targetId}` : undefined,
    ].filter(Boolean);
    return `${error.code}: ${error.message}${context.length > 0 ? ` (${context.join(", ")})` : ""}`;
  }
  return error instanceof Error ? error.message : (stringifyCaught(error) ?? "Unknown error");
};

/**
 * Creates an analysis project from a ROM file.
 * @param {CliArguments} parsed The parsed CLI arguments.
 * @param {string} cwd The current working directory.
 * @returns {number} The exit code.
 */
const createAnalysisProject = (parsed: CliArguments, cwd: string): number => {
  const inputFile = path.resolve(cwd, parsed.input!);
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: ROM file '${inputFile}' not found.`);
    return 1;
  }
  const outputDirectory = parsed.output
    ? path.resolve(cwd, parsed.output)
    : defaultOutputPath(inputFile, ".analysis");
  if (fs.existsSync(path.join(outputDirectory, ANALYSIS_PROJECT_MANIFEST))) {
    console.error(
      `Project creation failed: '${outputDirectory}' already contains an analysis project.`,
    );
    return 1;
  }
  try {
    const result = createSnesAnalysisProject({
      romFile: inputFile,
      projectDirectory: outputDirectory,
      ...(parsed.mapper === undefined ? {} : { mapper: parsed.mapper }),
      ...(parsed.headerSize === undefined ? {} : { headerSize: parsed.headerSize }),
      ...(parsed.dizraw === undefined ? {} : { dizRawFile: path.resolve(cwd, parsed.dizraw) }),
    });
    console.log(`Success: Analysis project written to '${outputDirectory}'.`);
    if (result.importReport) {
      console.log(
        `Import: ${result.importReport.imported.metadataBytes} metadata bytes. ${result.importReport.unsupported.length} unsupported field group(s).`,
      );
    }
    return 0;
  } catch (error) {
    console.error(`Project creation failed: ${formatFailure(error)}`);
    return 1;
  }
};

/**
 * Validates a project's analysis and ROM identity.
 * @param {CliArguments} parsed The parsed CLI arguments.
 * @param {string} cwd The current working directory.
 * @returns {number} The exit code.
 */
const validateProject = (parsed: CliArguments, cwd: string): number => {
  const directory = path.resolve(cwd, parsed.input!);
  try {
    // The loader validates each runtime fact before passing it to this sink. Validation should
    // neither retain millions of facts nor reload the entire project to check its ROM identity.
    const loaded = loadAnalysisProjectView(directory, () => ({
      push: () => undefined,
      finish: () => [],
    }));
    const rom = parsed.rom
      ? RomImage.load(path.resolve(cwd, parsed.rom), { headerSize: loaded.manifest.rom.headerSize })
      : undefined;
    if (rom) {
      validateProjectRom(loaded.manifest, rom);
    }
    console.log(
      `Success: Analysis project '${directory}' is valid${rom ? " and its ROM identity matches" : ""}.`,
    );
    return 0;
  } catch (error) {
    console.error(`Project validation failed: ${formatFailure(error)}`);
    return 1;
  }
};

/**
 * Imports a native instruction recording into a verified project.
 * The shared disk importer streams the capture without loading prior runtime history.
 * @param {CliArguments} parsed Parsed command-line arguments.
 * @param {string} cwd Current working directory.
 * @returns {number} Process exit code.
 */
const importProjectEvidence = async (parsed: CliArguments, cwd: string): Promise<number> => {
  const directory = path.resolve(cwd, parsed.input!);
  if (!parsed.rom) {
    console.error("Evidence import failed: --rom is required so project identity can be verified.");
    return 1;
  }
  if (!parsed.instructionTrace) {
    console.error("Evidence import failed: provide --instruction-trace.");
    return 1;
  }
  try {
    const store = openAnalysisProjectStore(directory);
    const manifest = (() => {
      try {
        return store.transaction(() => store.manifest(), false);
      } finally {
        store.close();
      }
    })();
    const rom = RomImage.load(path.resolve(cwd, parsed.rom), {
      headerSize: manifest.rom.headerSize,
    });
    validateProjectRom(manifest, rom);
    if (!isSnesMapper(manifest.mapping.mapper)) {
      throw new Error(`Unsupported SNES mapper '${manifest.mapping.mapper}'.`);
    }
    const filename = path.resolve(cwd, parsed.instructionTrace);
    const result = await importRuntimeTraceIntoProject(
      filename,
      directory,
      {
        projectRomContentSha256: manifest.rom.contentSha256,
        sourceName: path.basename(filename),
        indexMode: parsed.traceIndex,
      },
      {
        maxBytes: (parsed.traceMaxMiB ?? DEFAULT_RUNTIME_TRACE_MAX_BYTES / 1024 ** 2) * 1024 ** 2,
        onStage: (stage) => console.log(stage),
        storagePolicy: parsed.storagePolicy,
      },
    );
    console.log(`Storage: ${JSON.stringify(result.storage)}`);
    for (const warning of result.warnings) {
      console.warn(warning);
    }
    const action = result.changed ? "updated" : "no-op reimport for";
    console.log(
      `Success: ${action} '${directory}'. ${result.added.runtime} new runtime record(s).`,
    );
    console.log(
      `Import: ${result.report.format}: ${Object.values(result.report.imported).reduce((sum, count) => sum + count, 0)} normalized item(s), ${result.report.unsupported.reduce((sum, item) => sum + item.count, 0)} unsupported.`,
    );
    return 0;
  } catch (error) {
    console.error(`Evidence import failed: ${formatFailure(error)}`);
    return 1;
  }
};

/**
 * Prints or writes deterministic runtime conflict and explanation diagnostics.
 * @param {CliArguments} parsed Parsed command-line arguments.
 * @param {string} cwd Current working directory.
 * @returns {number} Process exit code.
 */
const reportProjectEvidence = (parsed: CliArguments, cwd: string): number => {
  const directory = path.resolve(cwd, parsed.input!);
  try {
    const store = openAnalysisProjectStore(directory);
    const inspection = (() => {
      try {
        return store.transaction(() => store.inspectEvidence(), false);
      } finally {
        store.close();
      }
    })();
    const text = canonicalJson(inspection);
    if (parsed.output) {
      const output = path.resolve(cwd, parsed.output);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, text);
      console.log(`Success: Evidence report written to '${output}'.`);
    } else {
      console.log(text.trimEnd());
    }
    return 0;
  } catch (error) {
    console.error(`Evidence report failed: ${formatFailure(error)}`);
    return 1;
  }
};

/**
 * Analyzes a project's 65816 code.
 * @param {CliArguments} parsed The parsed CLI arguments.
 * @param {string} cwd The current working directory.
 * @returns {number} The exit code.
 */
const analyzeProject = (parsed: CliArguments, cwd: string): number => {
  const directory = path.resolve(cwd, parsed.input!);
  if (!parsed.rom) {
    console.error("Analysis failed: --rom is required so project identity can be verified.");
    return 1;
  }
  try {
    const result = analyzeSnesProject({
      projectDirectory: directory,
      romFile: path.resolve(cwd, parsed.rom),
      entryPoints: parsed.entryPoints.map((address) => ({
        id: `cli-${address.toString(16).padStart(6, "0")}`,
        address,
      })),
      ...(parsed.maxWorkItems === undefined ? {} : { maxWorkItems: parsed.maxWorkItems }),
      ...(parsed.maxCallDepth === undefined ? {} : { maxCallDepth: parsed.maxCallDepth }),
    });
    console.log(
      `Success: ${result.status} 65816 analysis wrote ${result.instructions} instruction(s), ${result.functions} function candidate(s), ${result.conflicts} conflict(s), and ${result.unresolved} unresolved flow(s).`,
    );
    console.log(
      `Runtime evidence: ${result.runtimeSeeds} observed PC(s) seeded as code. ${result.omittedRuntimeSeeds} omitted by the safety bound. Captured instruction variants: ${result.capturedInstructions}. Observed PCs without code: ${result.runtimePcsWithoutCode}.`,
    );
    if (result.status === "incomplete") {
      console.log(
        `Incomplete: ${result.incompleteReasons.map((reason) => reason.message).join(" ")}`,
      );
    }
    return 0;
  } catch (error) {
    console.error(`Analysis failed: ${formatFailure(error)}`);
    return 1;
  }
};

/**
 * Assembles a source file into a binary output.
 * @param {CliArguments} parsed The parsed CLI arguments.
 * @param {string} cwd The current working directory.
 * @returns {Promise<number>} The exit code.
 */
const assemble = async (parsed: CliArguments, cwd: string): Promise<number> => {
  const inputFile = path.resolve(cwd, parsed.input!);
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file '${inputFile}' not found.`);
    return 1;
  }
  const explicitConfig = parsed.configFile
    ? path.resolve(cwd, parsed.configFile)
    : path.resolve(cwd, PROJECT_CONFIG_FILENAME);
  const hasProjectConfiguration = fs.existsSync(explicitConfig);
  const pluginModules: PluginModuleRequest[] = parsed.plugins.map((module) => ({ module }));
  const overrides: ProjectConfigurationOverrides = {
    ...(parsed.target === undefined ? {} : { target: parsed.target }),
    ...(parsed.architecture === undefined ? {} : { architecture: parsed.architecture }),
    ...(parsed.includePaths.length === 0 ? {} : { includePaths: parsed.includePaths }),
    ...(Object.keys(parsed.pluginOptions).length === 0
      ? {}
      : { pluginOptions: parsed.pluginOptions }),
  };
  const useSnesHostDefault = !hasProjectConfiguration && pluginModules.length === 0;
  const bundledPlugins = new Map<string, AssemblerPlugin>([
    ["@uttori/asm-plugin-snes", snesPlugin],
  ]);

  let loaded: Awaited<ReturnType<typeof loadProjectEnvironment>> | undefined;
  let assembler: Assembler | undefined;
  try {
    loaded = await loadProjectEnvironment({
      cwd,
      ...(parsed.configFile === undefined ? {} : { configFile: parsed.configFile }),
      pluginModules,
      bundledPlugins,
      overrides,
      ...(useSnesHostDefault
        ? {
            defaults: {
              plugins: [{ module: "@uttori/asm-plugin-snes" }],
              target: SNES_TARGET_ID,
              includePaths: ["./"],
            },
          }
        : {}),
    });
    const fileProvider = new NodeAssemblyFileProvider();
    const baseImage = parsed.baseImage
      ? fileProvider.readFile(path.resolve(cwd, parsed.baseImage))
      : undefined;
    assembler = new Assembler({
      environment: loaded.environment,
      target: loaded.target,
      architecture: loaded.architecture,
      targetOptions: loaded.targetOptions,
      baseImage,
      fileProvider,
      collectSourceMetadata: parsed.debug,
    });
    // The core base image supplies reads. CLI patching also preserves every unwritten byte.
    // A growable array lets source directives extend the image beyond its original length.
    if (baseImage) {
      assembler.outputBytes = Array.from(baseImage);
    }
    assembler.setIncludePaths([...new Set([path.dirname(inputFile), ...loaded.includePaths])]);
    assembler.setCurrentFile(inputFile);

    if (parsed.verbose) {
      console.log(
        `Plugins: ${loaded.configuration.plugins.map((plugin) => plugin.pluginId).join(", ")}`,
      );
      console.log(`Target: ${loaded.target}`);
      console.log(`Architecture: ${loaded.architecture}`);
    }

    const source = fileProvider.readTextFile(inputFile);
    assembler.assembleProgram(assembler.buildProgramModel(source, inputFile, 0));
    const extension = loaded.environment.getTarget(loaded.target)!.defaultOutputExtension;
    const outputFile = parsed.output
      ? path.resolve(cwd, parsed.output)
      : defaultOutputPath(inputFile, extension);
    const output = assembler.getBinaryOutput();
    const outputs: Array<{ file: string; contents: string | Uint8Array }> = [
      { file: outputFile, contents: output },
    ];
    let debugMapFile: string | undefined;
    if (parsed.debug) {
      // Includes containing only constants and binary inputs still determine the emitted bytes.
      // Record them so editor snapshots from CLI builds expire when those dependencies change.
      if (loaded.configuration.configFile) {
        fileProvider.readFiles.add(loaded.configuration.configFile);
      }
      for (const dependency of fileProvider.readFiles) {
        const snapshot = assembler.assetAssembly.snapshot(dependency);
        if (snapshot) {
          assembler.addressToLineMapping.registerDependencySnapshot(dependency, snapshot);
        } else {
          assembler.addressToLineMapping.getFileIndex(dependency);
        }
      }
      debugMapFile = parsed.debugMap
        ? path.resolve(cwd, parsed.debugMap)
        : `${outputFile}.debug.json`;
      const debugMap = createDebugMap({
        target: loaded.target,
        output,
        mapping: assembler.addressToLineMapping,
        dependencyKinds: assembler.assetAssembly.dependencies,
        sourceRoot: path.dirname(inputFile),
      });
      outputs.push({ file: debugMapFile, contents: canonicalJson(debugMap) });
    }
    publishOutputFiles(outputs, [inputFile, loaded.configuration.configFile ?? explicitConfig]);
    console.log(`Success: Output written to '${outputFile}'.`);
    if (debugMapFile) {
      console.log(`Debug map: '${debugMapFile}'.`);
    }
    return 0;
  } catch (error) {
    console.error(`Compilation failed: ${formatFailure(error)}`);
    return 1;
  } finally {
    // Session cleanup can throw too. The owned plugin environment still needs disposal.
    try {
      assembler?.dispose();
    } finally {
      await loaded?.dispose();
    }
  }
};

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
export const runCli = async (argv: readonly string[] = process.argv.slice(2)): Promise<number> => {
  if (argv[0] === "asset") {
    return runAssetCli(argv.slice(1));
  }
  if (argv[0] === "source") {
    return runSourceCli(argv.slice(1));
  }
  let parsed: CliArguments;
  try {
    parsed = parseCliArguments(argv);
  } catch (error) {
    console.error(`Error: ${formatFailure(error)}\n\n${usage}`);
    return 1;
  }
  if (parsed.help) {
    console.log(`${usage}\n\n${sourceUsage}\n\n${assetUsage}`);
    return 0;
  }
  if (!parsed.input) {
    console.error(usage);
    return 1;
  }
  try {
    return await runCommand(parsed, process.cwd());
  } catch (error) {
    // Include failures from async finally/disposal in the same exit-code contract as command errors.
    console.error(`Command failed: ${formatFailure(error)}`);
    return 1;
  }
};

/**
 * Dispatch a validated invocation. Unexpected failures are reported by runCli's outer boundary.
 * @param {CliArguments} parsed Parsed options with a required input already checked.
 * @param {string} cwd Invocation working directory, captured before asynchronous work.
 * @returns {Promise<number>} Command status after its owned resources are released.
 */
const runCommand = async (parsed: CliArguments, cwd: string): Promise<number> => {
  if (parsed.command === "disassemble") {
    return createAnalysisProject(parsed, cwd);
  }
  if (parsed.command === "evidence-import") {
    return importProjectEvidence(parsed, cwd);
  }
  if (parsed.command === "evidence-report") {
    return reportProjectEvidence(parsed, cwd);
  }
  if (parsed.command === "analyze") {
    return analyzeProject(parsed, cwd);
  }
  if (parsed.command === "project-validate") {
    return validateProject(parsed, cwd);
  }

  if (parsed.command === "project-storage") {
    let store: ReturnType<typeof openAnalysisProjectStore> | undefined;
    try {
      store = openAnalysisProjectStore(path.resolve(cwd, parsed.input!));
      const active = store;
      store.transaction(() => {
        if (parsed.storagePolicy) {
          active.setStoragePolicy(parsed.storagePolicy);
        }
      });
      const maintenance = store.maintainStorage();
      console.log(
        JSON.stringify(
          {
            policy: store.storagePolicy(),
            storage: { ...store.storageSnapshot(), optionalCacheBytes: store.storageCacheBytes() },
            captures: store.captureCatalog(),
            maintenance,
          },
          null,
          2,
        ),
      );
      return 0;
    } catch (error) {
      console.error(`Storage maintenance failed: ${formatFailure(error)}`);
      return 1;
    } finally {
      store?.close();
    }
  }

  if (parsed.command === "project-compact") {
    try {
      const result = compactAnalysisProject(path.resolve(cwd, parsed.input!));
      console.log(
        `Success: compacted analysis storage. Freed ${(result.maintenance.removedBytes / 1024 / 1024).toFixed(1)} MiB.`,
      );
      return result.maintenance.warnings.length ? 1 : 0;
    } catch (error) {
      console.error(`Project compaction failed: ${formatFailure(error)}`);
      return 1;
    }
  }
  return assemble(parsed, cwd);
};

// Node resolves npm bin symlinks and platform path aliases before identifying the entry module.
// Comparing argv paths to import.meta.url would silently skip CLI execution in those installs.
if (import.meta.main) {
  process.exitCode = await runCli();
}
