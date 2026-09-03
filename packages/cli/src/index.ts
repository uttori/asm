import * as fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Assembler, PluginError, canonicalDebugMapJson, createDebugMap } from "@uttori/asm-core";
import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_MANIFEST,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  SOURCE_EXPORT_MANIFEST,
  RomImage,
  canonicalJson,
  compareByteImages,
  inspectRuntimeEvidence,
  loadAnalysisProject,
  loadSourceExportManifest,
  sourceExportSha256,
  mergeRuntimeEvidence,
  validateAnalysisProject,
  validateSourceExportFiles,
  writeAnalysisProject,
  type AnalysisProject,
  type AnalysisProjectShards,
  type AnalysisTargetOverrideRecord,
  type AnalysisTargetSetRecord,
  type ProjectMapping,
} from "@uttori/asm-disassembler";
import {
  loadProjectEnvironment,
  PROJECT_CONFIG_FILENAME,
  type PluginModuleRequest,
  type ProjectConfigurationOverrides,
} from "@uttori/asm-plugin-loader-node";
import snesPlugin, {
  SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR,
  SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR,
  SNES_CPU_ADDRESS_SPACE,
  SNES_FILE_ADDRESS_SPACE,
  SNES_MAPPERS,
  SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR,
  SNES_TARGET_ID,
  SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR,
  analyzeSnes65816,
  createSnesAddressContext,
  detectSnesRom,
  exportSnes65816Source,
  exportMesenLabels,
  identifySnesFileOffset,
  importDizRaw,
  importMesen65816Trace,
  importMesenLabels,
  importMesenSnesCdl,
  type MesenTraceCaptureMetadata,
  type SnesMapper,
} from "@uttori/asm-plugin-snes";

export type CliCommand =
  | "analyze"
  | "assemble"
  | "disassemble"
  | "evidence-import"
  | "evidence-report"
  | "export"
  | "mesen-labels-export"
  | "project-validate"
  | "verify-roundtrip";

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

export const usage = `Usage: uttori-asm <input.asm> [output] [assemble-options]
  uttori-asm assemble <input.asm> [output] [assemble-options]
  uttori-asm disassemble <rom> [project-directory] [project-options]
  uttori-asm analyze <project-directory> --rom <rom> [analysis-options]
  uttori-asm evidence-import <project-directory> --rom <rom> [evidence-options]
  uttori-asm evidence-report <project-directory> [report.json]
  uttori-asm export <project-directory> [source-directory] --rom <rom> [--force]
  uttori-asm mesen-labels-export <project-directory> [labels.mlb] --rom <rom>
  uttori-asm verify-roundtrip <source-directory> --rom <rom>
  uttori-asm project-validate <project-directory> [--rom <rom>]

Project options:
  --mapper <${SNES_MAPPERS.join("|")}>
  --header-size <0|512>
  --dizraw <path>              Import uncompressed DiztinGUIsh XML
  --rom <path>                 ROM to hash-check during project validation
  --mesen-cdl <path>           Import verified MesenCE CDLv2 coverage
  --mesen-trace <path>         Import MesenCE default 65816 text trace
  --trace-metadata <path>      Required JSON identity sidecar for --mesen-trace
  --mesen-labels <path>        Import MesenCE label text
  --entry <address>            Repeatable 65816 CPU entry point ($/0x/decimal)
  --max-work-items <count>     Deterministic analysis work limit
  --max-call-depth <count>     Bounded call-context depth
  --force                      Replace modified generated files during export

Assemble options:
  --config <uttori-asm.config.json>
  --plugin <module>            Repeatable; appended after configured plugins
  --target <target-id>
  --architecture <architecture-id>
  --base-image <path>
  --debug                      Collect metadata and write <output>.debug.json
  --debug-map <path>           Collect metadata and write the map at this path
  --include-path <path>        Repeatable
  --plugin-option <plugin:key=value>
  --verbose
  --help`;

const parseOptionValue = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

/**
 * Splits an option into a flag and an inline value.
 * @param {string} argument The option to split.
 * @returns {{ flag: string; inlineValue?: string }} An object with the flag and inline value.
 */
const splitOption = (argument: string): { flag: string; inlineValue?: string } => {
  const equals = argument.indexOf("=");
  return equals < 0
    ? { flag: argument }
    : { flag: argument.slice(0, equals), inlineValue: argument.slice(equals + 1) };
};

/**
 * Parses the CLI arguments and returns a CliArguments object.
 * @param {readonly string[]} argv The CLI arguments.
 * @returns {CliArguments} The parsed CLI arguments.
 */
export const parseCliArguments = (argv: readonly string[]): CliArguments => {
  const positional: string[] = [];
  const plugins: string[] = [];
  const includePaths: string[] = [];
  const pluginOptions: Record<string, Record<string, unknown>> = {};
  let command: CliCommand = "assemble";
  let startIndex = 0;
  if (
    argv[0] === "analyze" ||
    argv[0] === "assemble" ||
    argv[0] === "disassemble" ||
    argv[0] === "evidence-import" ||
    argv[0] === "evidence-report" ||
    argv[0] === "export" ||
    argv[0] === "mesen-labels-export" ||
    argv[0] === "project-validate" ||
    argv[0] === "verify-roundtrip"
  ) {
    command = argv[0];
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
  let mesenCdl: string | undefined;
  let mesenTrace: string | undefined;
  let traceMetadata: string | undefined;
  let mesenLabels: string | undefined;
  const entryPoints: number[] = [];
  let maxWorkItems: number | undefined;
  let maxCallDepth: number | undefined;
  let verbose = false;
  let force = false;
  let help = false;

  const requireValue = (
    flag: string,
    inlineValue: string | undefined,
    index: number,
  ): [string, number] => {
    const value = inlineValue ?? argv[index + 1];
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
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const { flag, inlineValue } = splitOption(argument);
    if (flag === "--help") {
      help = true;
      continue;
    }
    if (flag === "--verbose") {
      verbose = true;
      continue;
    }
    if (flag === "--force") {
      force = true;
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
        if (!SNES_MAPPERS.includes(value as SnesMapper)) {
          throw new Error(`--mapper must be one of: ${SNES_MAPPERS.join(", ")}.`);
        }
        mapper = value as SnesMapper;
        break;
      case "--header-size":
        if (value !== "0" && value !== "512") {
          throw new Error("--header-size must be 0 or 512.");
        }
        headerSize = Number(value) as 0 | 512;
        break;
      case "--dizraw":
        dizraw = value;
        break;
      case "--rom":
        rom = value;
        break;
      case "--mesen-cdl":
        mesenCdl = value;
        break;
      case "--mesen-trace":
        mesenTrace = value;
        break;
      case "--trace-metadata":
        traceMetadata = value;
        break;
      case "--mesen-labels":
        mesenLabels = value;
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
        const equals = value.indexOf("=", colon + 1);
        if (colon <= 0 || equals <= colon + 1) {
          throw new Error("--plugin-option must use <plugin:key=value> syntax.");
        }
        const plugin = value.slice(0, colon);
        const key = value.slice(colon + 1, equals);
        pluginOptions[plugin] = {
          ...(pluginOptions[plugin] ?? {}),
          [key]: parseOptionValue(value.slice(equals + 1)),
        };
        break;
      }
      default:
        throw new Error(`Unknown option '${flag}'.`);
    }
  }
  if (positional.length > 2) {
    throw new Error(`Unexpected positional argument '${positional[2]}'.`);
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
    mesenCdl,
    mesenTrace,
    traceMetadata,
    mesenLabels,
    entryPoints: Object.freeze(entryPoints),
    maxWorkItems,
    maxCallDepth,
    verbose,
    force,
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
const formatFailure = (error: unknown): string => {
  if (error instanceof PluginError) {
    const context = [
      error.pluginId ? `plugin=${error.pluginId}` : undefined,
      error.pluginModule ? `module=${error.pluginModule}` : undefined,
      error.targetId ? `target=${error.targetId}` : undefined,
    ].filter(Boolean);
    return `${error.code}: ${error.message}${context.length > 0 ? ` (${context.join(", ")})` : ""}`;
  }
  return error instanceof Error ? error.message : (JSON.stringify(error) ?? "Unknown error");
};

/**
 * Returns an empty set of analysis project shards.
 * @returns {AnalysisProjectShards} The empty set of analysis project shards.
 */
const emptyShards = (): AnalysisProjectShards => ({
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  runtime: [],
  evidence: [],
  imports: [],
});

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
    const rom = RomImage.load(inputFile, {
      ...(parsed.headerSize === undefined ? {} : { headerSize: parsed.headerSize }),
    });
    const detection = detectSnesRom(rom, {
      ...(parsed.mapper === undefined ? {} : { mapper: parsed.mapper }),
      ...(parsed.headerSize === undefined ? {} : { headerSize: parsed.headerSize }),
    });
    if (detection.status === "ambiguous" || detection.mapper === undefined) {
      throw new Error(detection.message ?? "SNES mapper detection is ambiguous.");
    }

    let shards = emptyShards();
    let importedMapping: ProjectMapping | undefined;
    if (parsed.dizraw) {
      const dizrawFile = path.resolve(cwd, parsed.dizraw);
      if (path.extname(dizrawFile).toLowerCase() !== ".dizraw") {
        throw new Error(
          "Only uncompressed .dizraw imports are supported; .diz is intentionally unsupported.",
        );
      }
      const imported = importDizRaw(fs.readFileSync(dizrawFile, "utf8"), {
        sourceName: path.basename(dizrawFile),
        expectedRomSize: rom.length,
      });
      if (parsed.mapper === undefined && imported.mapping.mapper !== detection.mapper) {
        throw new Error(
          `.dizraw mapper '${imported.mapping.mapper}' conflicts with detected mapper '${detection.mapper}'; pass --mapper to resolve it explicitly.`,
        );
      }
      const mapperWarnings =
        parsed.mapper && parsed.mapper !== imported.mapping.mapper
          ? [
              ...imported.report.warnings,
              `Explicit mapper '${parsed.mapper}' overrides imported mapper '${imported.mapping.mapper}'.`,
            ]
          : imported.report.warnings;
      const report = { ...imported.report, warnings: mapperWarnings };
      shards = { ...imported.shards, imports: [report] };
      importedMapping = imported.mapping;
    }

    const mapper = parsed.mapper ?? detection.mapper;
    let mappingSource: ProjectMapping["source"] = "detected";
    if (parsed.mapper) mappingSource = "override";
    else if (importedMapping) mappingSource = "import";
    const mappingSpeed = importedMapping?.speed ?? detection.speed;
    const mapping: ProjectMapping = {
      mapper,
      ...(mappingSpeed ? { speed: mappingSpeed } : {}),
      ...(detection.headerOffset === undefined ? {} : { headerOffset: detection.headerOffset }),
      source: mappingSource,
      candidates: detection.candidates,
    };
    const project: AnalysisProject = {
      manifest: {
        format: ANALYSIS_PROJECT_FORMAT,
        schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
        target: SNES_TARGET_ID,
        rom: rom.identity,
        mapping,
        addressSpaces: [
          { id: SNES_FILE_ADDRESS_SPACE, name: "ROM file offset", addressBits: 24, kind: "file" },
          { id: SNES_CPU_ADDRESS_SPACE, name: "SNES CPU bus", addressBits: 24, kind: "cpu" },
          SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR,
          SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR,
          SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR,
          SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR,
        ],
      },
      shards,
    };
    writeAnalysisProject(outputDirectory, project);
    console.log(`Success: Analysis project written to '${outputDirectory}'.`);
    if (shards.imports[0]) {
      console.log(
        `Import: ${shards.imports[0].imported.metadataBytes ?? 0} metadata bytes; ${shards.imports[0].unsupported.length} unsupported field group(s).`,
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
    const loaded = loadAnalysisProject(directory);
    const rom = parsed.rom
      ? RomImage.load(path.resolve(cwd, parsed.rom), { headerSize: loaded.manifest.rom.headerSize })
      : undefined;
    validateAnalysisProject(directory, rom);
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
 * Imports one or more offline MesenCE evidence artifacts into a verified native project.
 * @param {CliArguments} parsed Parsed command-line arguments.
 * @param {string} cwd Current working directory.
 * @returns {number} Process exit code.
 */
const importProjectEvidence = (parsed: CliArguments, cwd: string): number => {
  const directory = path.resolve(cwd, parsed.input!);
  if (!parsed.rom) {
    console.error("Evidence import failed: --rom is required so project identity can be verified.");
    return 1;
  }
  if (!parsed.mesenCdl && !parsed.mesenTrace && !parsed.mesenLabels) {
    console.error("Evidence import failed: provide --mesen-cdl, --mesen-trace, or --mesen-labels.");
    return 1;
  }
  if (parsed.mesenTrace && !parsed.traceMetadata) {
    console.error("Evidence import failed: --trace-metadata is required with --mesen-trace.");
    return 1;
  }
  try {
    const loaded = loadAnalysisProject(directory);
    const rom = RomImage.load(path.resolve(cwd, parsed.rom), {
      headerSize: loaded.manifest.rom.headerSize,
    });
    validateAnalysisProject(directory, rom);
    if (!SNES_MAPPERS.includes(loaded.manifest.mapping.mapper as SnesMapper)) {
      throw new Error(`Unsupported SNES mapper '${loaded.manifest.mapping.mapper}'.`);
    }
    const mapper = loaded.manifest.mapping.mapper as SnesMapper;
    let shards = loaded.shards;
    let changed = false;
    let conflictCount = 0;
    let explanationCount = 0;
    const reports: string[] = [];
    const merge = (result: ReturnType<typeof importMesenSnesCdl>): void => {
      const merged = mergeRuntimeEvidence(shards, result.batch);
      shards = merged.shards;
      changed ||= merged.changed;
      conflictCount = merged.conflicts.length;
      explanationCount = merged.explanations.length;
      reports.push(
        `${result.report.format}: ${Object.values(result.report.imported).reduce((sum, count) => sum + count, 0)} normalized item(s), ${result.report.unsupported.reduce((sum, item) => sum + item.count, 0)} unsupported`,
      );
    };
    const projectContext = (sourceName: string) => ({
      sourceName,
      projectRomContentSha256: loaded.manifest.rom.contentSha256,
      projectMapper: mapper,
    });
    if (parsed.mesenCdl) {
      const filename = path.resolve(cwd, parsed.mesenCdl);
      merge(
        importMesenSnesCdl(
          fs.readFileSync(filename),
          rom,
          mapper,
          projectContext(path.basename(filename)),
        ),
      );
    }
    if (parsed.mesenTrace) {
      const filename = path.resolve(cwd, parsed.mesenTrace);
      const metadata = JSON.parse(
        fs.readFileSync(path.resolve(cwd, parsed.traceMetadata!), "utf8"),
      ) as MesenTraceCaptureMetadata;
      merge(
        importMesen65816Trace(
          fs.readFileSync(filename, "utf8"),
          metadata,
          rom,
          mapper,
          projectContext(path.basename(filename)),
        ),
      );
    }
    if (parsed.mesenLabels) {
      const filename = path.resolve(cwd, parsed.mesenLabels);
      merge(
        importMesenLabels(
          fs.readFileSync(filename, "utf8"),
          rom,
          mapper,
          projectContext(path.basename(filename)),
        ),
      );
    }
    if (changed) {
      const { shards: ignoredShards, ...manifest } = loaded.manifest;
      void ignoredShards;
      writeAnalysisProject(directory, { manifest, shards });
    }
    console.log(
      `Success: ${changed ? "updated" : "no-op reimport for"} '${directory}'; ${conflictCount} conflict(s), ${explanationCount} explanation(s).`,
    );
    for (const report of reports) console.log(`Import: ${report}.`);
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
    const loaded = loadAnalysisProject(directory);
    const inspection = inspectRuntimeEvidence(loaded.shards);
    const text = canonicalJson({
      runtimeRecords: loaded.shards.runtime.length,
      conflicts: inspection.conflicts,
      explanations: inspection.explanations,
    });
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
 * Exports native project labels and comments in MesenCE label-file syntax.
 * @param {CliArguments} parsed Parsed command-line arguments.
 * @param {string} cwd Current working directory.
 * @returns {number} Process exit code.
 */
const exportProjectMesenLabels = (parsed: CliArguments, cwd: string): number => {
  const directory = path.resolve(cwd, parsed.input!);
  if (!parsed.rom) {
    console.error(
      "Mesen label export failed: --rom is required so project identity can be verified.",
    );
    return 1;
  }
  try {
    const loaded = loadAnalysisProject(directory);
    const rom = RomImage.load(path.resolve(cwd, parsed.rom), {
      headerSize: loaded.manifest.rom.headerSize,
    });
    validateAnalysisProject(directory, rom);
    if (!SNES_MAPPERS.includes(loaded.manifest.mapping.mapper as SnesMapper)) {
      throw new Error(`Unsupported SNES mapper '${loaded.manifest.mapping.mapper}'.`);
    }
    const output = parsed.output
      ? path.resolve(cwd, parsed.output)
      : defaultOutputPath(directory, ".mlb");
    const result = exportMesenLabels(
      loaded.shards.labels,
      loaded.shards.comments,
      rom,
      loaded.manifest.mapping.mapper as SnesMapper,
      path.basename(output),
    );
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, result.text);
    console.log(
      `Success: Exported ${result.report.imported.labels ?? 0} MesenCE label row(s) to '${output}'; ${result.report.unsupported.reduce((sum, item) => sum + item.count, 0)} loss item(s).`,
    );
    return 0;
  } catch (error) {
    console.error(`Mesen label export failed: ${formatFailure(error)}`);
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
    const loaded = loadAnalysisProject(directory);
    const rom = RomImage.load(path.resolve(cwd, parsed.rom), {
      headerSize: loaded.manifest.rom.headerSize,
    });
    validateAnalysisProject(directory, rom);
    if (!SNES_MAPPERS.includes(loaded.manifest.mapping.mapper as SnesMapper)) {
      throw new Error(`Unsupported SNES mapper '${loaded.manifest.mapping.mapper}'.`);
    }
    const editableRecords = loaded.shards.analysis.filter(
      (record): record is AnalysisTargetOverrideRecord | AnalysisTargetSetRecord =>
        record.kind === "target-override" || record.kind === "target-set",
    );
    const targetOverrides = editableRecords.filter(
      (record): record is AnalysisTargetOverrideRecord => record.kind === "target-override",
    );
    const targetSets = editableRecords.filter(
      (record): record is AnalysisTargetSetRecord => record.kind === "target-set",
    );
    const result = analyzeSnes65816(rom, loaded.manifest.mapping.mapper as SnesMapper, {
      annotations: loaded.shards.annotations,
      labels: loaded.shards.labels,
      evidence: loaded.shards.evidence,
      entryPoints: parsed.entryPoints.map((address) => ({
        id: `cli-${address.toString(16).padStart(6, "0")}`,
        address,
      })),
      targetOverrides,
      targetSets,
      ...(parsed.maxWorkItems === undefined ? {} : { maxWorkItems: parsed.maxWorkItems }),
      ...(parsed.maxCallDepth === undefined ? {} : { maxCallDepth: parsed.maxCallDepth }),
    });
    const annotations = [
      ...loaded.shards.annotations.filter(
        (annotation) => !annotation.id.startsWith("static:65816:"),
      ),
      ...result.annotations,
    ];
    const evidence = [
      ...loaded.shards.evidence.filter(
        (record) =>
          record.sourceId !== "snes.65816.static-v1" && !record.id.startsWith("detector:vector:"),
      ),
      ...result.evidenceRecords,
    ];
    const { shards: ignoredShards, ...manifest } = loaded.manifest;
    void ignoredShards;
    writeAnalysisProject(directory, {
      manifest,
      shards: {
        ...loaded.shards,
        analysis: [...editableRecords, ...result.records],
        annotations,
        evidence,
      },
    });
    console.log(
      `Success: ${result.status} 65816 analysis wrote ${result.nodes.length} instruction(s), ${result.functions.length} function candidate(s), ${result.conflicts.length} conflict(s), and ${result.unresolved.length} unresolved flow(s).`,
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
 * Exports a project's native 65816 source.
 * @param {CliArguments} parsed The parsed CLI arguments.
 * @param {string} cwd The current working directory.
 * @returns {number} The exit code.
 */
const exportProjectSource = (parsed: CliArguments, cwd: string): number => {
  const projectDirectory = path.resolve(cwd, parsed.input!);
  if (!parsed.rom) {
    console.error("Export failed: --rom is required so project identity can be verified.");
    return 1;
  }
  try {
    const loaded = loadAnalysisProject(projectDirectory);
    const rom = RomImage.load(path.resolve(cwd, parsed.rom), {
      headerSize: loaded.manifest.rom.headerSize,
    });
    validateAnalysisProject(projectDirectory, rom);
    if (!SNES_MAPPERS.includes(loaded.manifest.mapping.mapper as SnesMapper)) {
      throw new Error(`Unsupported SNES mapper '${loaded.manifest.mapping.mapper}'.`);
    }
    const outputDirectory = parsed.output
      ? path.resolve(cwd, parsed.output)
      : defaultOutputPath(projectDirectory, ".source");
    const projectManifest = fs.readFileSync(path.join(projectDirectory, ANALYSIS_PROJECT_MANIFEST));
    const manifest = exportSnes65816Source(loaded, rom, outputDirectory, {
      force: parsed.force,
      sourceProjectSha256: sourceExportSha256(projectManifest),
    });
    const codeBytes = manifest.spans
      .filter((span) => span.role === "code")
      .reduce((total, span) => total + span.end - span.start, 0);
    console.log(
      `Success: Exported ${manifest.files.length} generated file(s) covering ${rom.length} content byte(s); ${codeBytes} byte(s) emitted as native 65816 source.`,
    );
    console.log(`Manifest: '${path.join(outputDirectory, SOURCE_EXPORT_MANIFEST)}'.`);
    return 0;
  } catch (error) {
    console.error(`Export failed: ${formatFailure(error)}`);
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
    const baseImage = parsed.baseImage
      ? new Uint8Array(fs.readFileSync(path.resolve(cwd, parsed.baseImage)))
      : undefined;
    assembler = new Assembler({
      environment: loaded.environment,
      target: loaded.target,
      architecture: loaded.architecture,
      targetOptions: loaded.targetOptions,
      baseImage,
      collectSourceMetadata: parsed.debug,
    });
    assembler.setIncludePaths([...new Set([path.dirname(inputFile), ...loaded.includePaths])]);
    assembler.setCurrentFile(inputFile);

    if (parsed.verbose) {
      console.log(
        `Plugins: ${loaded.configuration.plugins.map((plugin) => plugin.pluginId).join(", ")}`,
      );
      console.log(`Target: ${loaded.target}`);
      console.log(`Architecture: ${loaded.architecture}`);
    }

    const source = fs.readFileSync(inputFile, "utf8");
    assembler.assembleProgram(assembler.buildProgramModel(source, inputFile, 0));
    const extension = loaded.environment.getTarget(loaded.target)!.defaultOutputExtension;
    const outputFile = parsed.output
      ? path.resolve(cwd, parsed.output)
      : defaultOutputPath(inputFile, extension);
    const output = assembler.getBinaryOutput();
    fs.writeFileSync(outputFile, Buffer.from(output));
    console.log(`Success: Output written to '${outputFile}'.`);
    if (parsed.debug) {
      const debugMapFile = parsed.debugMap
        ? path.resolve(cwd, parsed.debugMap)
        : `${outputFile}.debug.json`;
      const debugMap = createDebugMap({
        target: loaded.target,
        output,
        mapping: assembler.addressToLineMapping,
        sourceRoot: path.dirname(inputFile),
      });
      fs.writeFileSync(debugMapFile, canonicalDebugMapJson(debugMap));
      console.log(`Debug map: '${debugMapFile}'.`);
    }
    return 0;
  } catch (error) {
    console.error(`Compilation failed: ${formatFailure(error)}`);
    return 1;
  } finally {
    assembler?.dispose();
    await loaded?.dispose();
  }
};

/**
 * Verifies that a source export round-trips byte-for-byte.
 * @param {CliArguments} parsed The parsed CLI arguments.
 * @param {string} cwd The current working directory.
 * @returns {Promise<number>} The exit code.
 */
const verifyRoundTrip = async (parsed: CliArguments, cwd: string): Promise<number> => {
  const directory = path.resolve(cwd, parsed.input!);
  if (!parsed.rom) {
    console.error("Round-trip verification failed: --rom is required.");
    return 1;
  }
  try {
    const manifest = loadSourceExportManifest(directory);
    validateSourceExportFiles(directory, manifest);
    const rom = RomImage.load(path.resolve(cwd, parsed.rom), {
      headerSize: manifest.rom.headerSize,
    });
    if (
      rom.identity.sha256 !== manifest.rom.sha256 ||
      rom.identity.contentSha256 !== manifest.rom.contentSha256
    ) {
      throw new Error(
        `ROM identity mismatch: export expects ${manifest.rom.sha256}, received ${rom.identity.sha256}.`,
      );
    }
    const contentOutput = path.join(directory, manifest.contentOutput);
    const finalOutput = path.join(directory, manifest.finalOutput);
    fs.mkdirSync(path.dirname(contentOutput), { recursive: true });
    const exitCode = await runCli([
      "assemble",
      path.join(directory, manifest.entrySource),
      contentOutput,
      "--config",
      path.join(directory, manifest.buildConfiguration),
    ]);
    if (exitCode !== 0) throw new Error("Generated native source did not assemble successfully.");
    const content = fs.readFileSync(contentOutput);
    const final =
      manifest.rom.headerSize === 0
        ? content
        : Buffer.concat([
            fs.readFileSync(
              path.join(
                directory,
                manifest.spans.find((span) => span.role === "copier-header")!.file,
              ),
            ),
            content,
          ]);
    fs.writeFileSync(finalOutput, final);
    const comparison = compareByteImages(rom.fileBytes(), final);
    if (!comparison.equal) {
      const difference = comparison.firstDifference ?? 0;
      const contentOffset = difference - manifest.rom.headerSize;
      const identity =
        contentOffset < 0
          ? undefined
          : identifySnesFileOffset(
              contentOffset,
              createSnesAddressContext(manifest.mapper as SnesMapper),
              manifest.rom.contentSize,
            );
      const addressDetail =
        contentOffset < 0
          ? "copier header"
          : `content offset $${contentOffset.toString(16).toUpperCase().padStart(6, "0")}${identity ? ` / CPU $${identity.canonicalCpuAddress.toString(16).toUpperCase().padStart(6, "0")}` : ""}`;
      console.error(
        `Round-trip mismatch: expected ${comparison.expectedLength} byte(s) / ${comparison.expectedSha256}, received ${comparison.actualLength} byte(s) / ${comparison.actualSha256}; first difference at file offset $${difference.toString(16).toUpperCase().padStart(6, "0")} (${addressDetail}).`,
      );
      return 1;
    }
    console.log(
      `Success: Round trip is byte-identical (${comparison.actualLength} byte(s), SHA-256 ${comparison.actualSha256}).`,
    );
    return 0;
  } catch (error) {
    console.error(`Round-trip verification failed: ${formatFailure(error)}`);
    return 1;
  }
};

/**
 * Runs the CLI.
 * @param {readonly string[]} argv The CLI arguments.
 * @returns {Promise<number>} The exit code.
 */
export const runCli = async (argv: readonly string[] = process.argv.slice(2)): Promise<number> => {
  let parsed: CliArguments;
  try {
    parsed = parseCliArguments(argv);
  } catch (error) {
    console.error(`Error: ${formatFailure(error)}\n\n${usage}`);
    return 1;
  }
  if (parsed.help) {
    console.log(usage);
    return 0;
  }
  if (!parsed.input) {
    console.error(usage);
    return 1;
  }
  const cwd = process.cwd();
  if (parsed.command === "disassemble") return createAnalysisProject(parsed, cwd);
  if (parsed.command === "evidence-import") return importProjectEvidence(parsed, cwd);
  if (parsed.command === "evidence-report") return reportProjectEvidence(parsed, cwd);
  if (parsed.command === "analyze") return analyzeProject(parsed, cwd);
  if (parsed.command === "export") return exportProjectSource(parsed, cwd);
  if (parsed.command === "mesen-labels-export") return exportProjectMesenLabels(parsed, cwd);
  if (parsed.command === "project-validate") return validateProject(parsed, cwd);
  if (parsed.command === "verify-roundtrip") return verifyRoundTrip(parsed, cwd);
  return assemble(parsed, cwd);
};

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (entryPoint === import.meta.url) {
  process.exitCode = await runCli();
}
