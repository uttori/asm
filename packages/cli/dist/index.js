import * as fs from "node:fs";
import path from "node:path";
import { Assembler, NodeAssemblyFileProvider, PluginError, canonicalDebugMapJson, createDebugMap, } from "@uttori/asm-core";
import { ANALYSIS_PROJECT_MANIFEST, SOURCE_EXPORT_MANIFEST, RomImage, canonicalJson, compareByteImages, importRuntimeTraceIntoProject, openAnalysisProjectStore, loadAnalysisProjectView, loadSourceExportManifest, findManagedSourceFile, sourceGenerationIdentity, assertSourceGeneration, validateSourceExportFiles, validateSourceExportInputs, compactAnalysisProject, DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH, DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS, validateProjectRom, } from "@uttori/asm-disassembler";
import { loadProjectEnvironment, PROJECT_CONFIG_FILENAME, } from "@uttori/asm-plugin-loader-node";
import snesPlugin, { SNES_MAPPERS, SNES_TARGET_ID, analyzeSnesProject, createSnesAnalysisProject, createSnesAddressContext, exportSnesProject, identifySnesFileOffset, } from "@uttori/asm-plugin-snes";
import { publishOutputFiles } from "./output-files.js";
/** Flags are command-specific so a misspelled workflow cannot silently ignore a requested policy. */
const commandOptions = {
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
    export: [
        "--rom",
        "--force",
        "--allow-code-regression",
        "--struct-line-width",
        "--comment-line-width",
        "--no-wrap-comments",
    ],
    "verify-roundtrip": ["--rom"],
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
const booleanOptions = new Set([
    "--help",
    "--verbose",
    "--force",
    "--allow-code-regression",
    "--debug",
    "--no-wrap-comments",
]);
const commandsWithOutput = new Set([
    "assemble",
    "disassemble",
    "export",
    "evidence-report",
]);
/** Installed executable's help text. All flags are long options. -- ends option parsing. */
export const usage = `Usage: uttori-asm <input.asm> [output] [assemble-options]
  uttori-asm assemble <input.asm> [output] [assemble-options]
  uttori-asm disassemble <rom> [project-directory] [creation-options]
  uttori-asm analyze <project-directory> --rom <rom> [analysis-options]
  uttori-asm evidence-import <project-directory> --rom <rom> [evidence-options]
  uttori-asm evidence-report <project-directory> [report.json]
  uttori-asm export <project-directory> [source-directory] --rom <rom> [--force] [--allow-code-regression]
  uttori-asm verify-roundtrip <source-directory> --rom <rom>
  uttori-asm project-validate <project-directory> [--rom <rom>]
  uttori-asm project-compact <project-directory>
  uttori-asm project-storage <project-directory> [storage-options]

Creation options (disassemble):
  --mapper <${SNES_MAPPERS.join("|")}>
  --header-size <0|512>
  --dizraw <path>              Import uncompressed DiztinGUIsh XML
  Defaults: <rom stem>.analysis. Copier header and mapper detected unless overridden.

ROM identity (analyze, export, verify-roundtrip, evidence-import):
  --rom <path>                Required original ROM. Optional with project-validate

Evidence options (evidence-import):
  --instruction-trace <path>   Import a native explicit instruction recording
  --trace-max-mib <count>      Native trace import size limit in MiB (default 2048)
  --trace-index <mode>         65816-analysis (native SNES default), full, or 65816-disassembly

Analysis options (analyze):
  --entry <address>            Repeatable 24-bit CPU address ($hex/0xhex/decimal, quote $hex in shells)
  --max-work-items <count>     Positive work limit (default ${DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS})
  --max-call-depth <count>     Nonnegative call-context depth (default ${DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH})

Export options (export):
  --struct-line-width <count> Preferred dataStruct width, at least 40 (default 100)
  --comment-line-width <count> Preferred comment width, at least 20 (default 100)
  --no-wrap-comments          Disable generated assembly comment wrapping
  --force                     Replace modified generated files
  --allow-code-regression      Allow previously exported code to become raw bytes
  Default destination: <project stem>.source

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
export const parseCliArguments = (argv) => {
    const positional = [];
    const plugins = [];
    const includePaths = [];
    const pluginOptions = {};
    let command = "assemble";
    let startIndex = 0;
    if (Object.hasOwn(commandOptions, argv[0] ?? "")) {
        command = argv[0];
        startIndex = 1;
    }
    let configFile;
    let target;
    let architecture;
    let baseImage;
    let debugBuild = false;
    let debugMap;
    let mapper;
    let headerSize;
    let dizraw;
    let rom;
    let instructionTrace;
    let traceMaxMiB;
    const storagePolicy = {};
    let traceIndex;
    const entryPoints = [];
    let maxWorkItems;
    let structLineWidth;
    let commentLineWidth;
    let wrapComments;
    let maxCallDepth;
    let verbose = false;
    let force = false;
    let allowCodeRegression = false;
    let help = false;
    const suppliedOptions = new Set();
    const requireValue = (flag, inlineValue, index) => {
        const value = inlineValue ?? argv[index + 1];
        if (value === undefined ||
            value === "" ||
            (inlineValue === undefined && value.startsWith("--"))) {
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
        // In particular, --force=false must never turn a user's refusal into overwrite permission.
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
        if (flag === "--force") {
            force = true;
            continue;
        }
        if (flag === "--allow-code-regression") {
            allowCodeRegression = true;
            continue;
        }
        if (flag === "--no-wrap-comments") {
            wrapComments = false;
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
                if (!SNES_MAPPERS.includes(value)) {
                    throw new Error(`--mapper must be one of: ${SNES_MAPPERS.join(", ")}.`);
                }
                mapper = value;
                break;
            case "--header-size":
                if (value !== "0" && value !== "512") {
                    throw new Error("--header-size must be 0 or 512.");
                }
                headerSize = Number(value);
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
                if (!Number.isSafeInteger(traceMaxMiB) ||
                    traceMaxMiB < 1 ||
                    !Number.isSafeInteger(traceMaxMiB * 1024 * 1024)) {
                    throw new Error("--trace-max-mib must be a positive integer representing a safe byte limit.");
                }
                break;
            case "--cache-max-mib":
            case "--storage-max-mib": {
                const keys = {
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
                if (value !== "full" && value !== "65816-disassembly" && value !== "65816-analysis") {
                    throw new Error("--trace-index must be full, 65816-disassembly, or 65816-analysis.");
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
            case "--comment-line-width":
                commentLineWidth = Number(value);
                if (!Number.isSafeInteger(commentLineWidth) || commentLineWidth < 20) {
                    throw new Error("--comment-line-width must be an integer of at least 20 columns.");
                }
                break;
            case "--struct-line-width":
                structLineWidth = Number(value);
                if (!Number.isSafeInteger(structLineWidth) || structLineWidth < 40) {
                    throw new Error("--struct-line-width must be an integer of at least 40 columns.");
                }
                break;
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
                const rawValue = value.slice(equals + 1);
                let optionValue = rawValue;
                // Accept JSON values while preserving unquoted strings as written.
                try {
                    optionValue = JSON.parse(rawValue);
                }
                catch {
                    // Non-JSON plugin options remain strings.
                }
                pluginOptions[plugin] = {
                    ...(pluginOptions[plugin] ?? {}),
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
        structLineWidth,
        commentLineWidth,
        wrapComments,
        maxCallDepth,
        verbose,
        force,
        allowCodeRegression,
        help,
    };
};
/**
 * Returns the default output path for a given input file and extension.
 * @param {string} inputFile The input file.
 * @param {string} extension The extension.
 * @returns {string} The default output path.
 */
const defaultOutputPath = (inputFile, extension) => {
    const parsed = path.parse(inputFile);
    return path.join(parsed.dir, `${parsed.name}${extension}`);
};
/**
 * Formats a failure message for a given error.
 * @param {unknown} error The error.
 * @returns {string} The formatted failure message.
 */
const formatFailure = (error) => {
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
 * Creates an analysis project from a ROM file.
 * @param {CliArguments} parsed The parsed CLI arguments.
 * @param {string} cwd The current working directory.
 * @returns {number} The exit code.
 */
const createAnalysisProject = (parsed, cwd) => {
    const inputFile = path.resolve(cwd, parsed.input);
    if (!fs.existsSync(inputFile)) {
        console.error(`Error: ROM file '${inputFile}' not found.`);
        return 1;
    }
    const outputDirectory = parsed.output
        ? path.resolve(cwd, parsed.output)
        : defaultOutputPath(inputFile, ".analysis");
    if (fs.existsSync(path.join(outputDirectory, ANALYSIS_PROJECT_MANIFEST))) {
        console.error(`Project creation failed: '${outputDirectory}' already contains an analysis project.`);
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
            console.log(`Import: ${result.importReport.imported.metadataBytes ?? 0} metadata bytes. ${result.importReport.unsupported.length} unsupported field group(s).`);
        }
        return 0;
    }
    catch (error) {
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
const validateProject = (parsed, cwd) => {
    const directory = path.resolve(cwd, parsed.input);
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
        console.log(`Success: Analysis project '${directory}' is valid${rom ? " and its ROM identity matches" : ""}.`);
        return 0;
    }
    catch (error) {
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
const importProjectEvidence = async (parsed, cwd) => {
    const directory = path.resolve(cwd, parsed.input);
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
            }
            finally {
                store.close();
            }
        })();
        const rom = RomImage.load(path.resolve(cwd, parsed.rom), {
            headerSize: manifest.rom.headerSize,
        });
        validateProjectRom(manifest, rom);
        if (!SNES_MAPPERS.includes(manifest.mapping.mapper)) {
            throw new Error(`Unsupported SNES mapper '${manifest.mapping.mapper}'.`);
        }
        const filename = path.resolve(cwd, parsed.instructionTrace);
        const result = await importRuntimeTraceIntoProject(filename, directory, {
            projectRomContentSha256: manifest.rom.contentSha256,
            sourceName: path.basename(filename),
            indexMode: parsed.traceIndex,
        }, {
            maxBytes: (parsed.traceMaxMiB ?? 2048) * 1024 * 1024,
            onStage: (stage) => console.log(stage),
            storagePolicy: parsed.storagePolicy,
        });
        console.log(`Storage: ${JSON.stringify(result.storage)}`);
        for (const warning of result.warnings) {
            console.warn(warning);
        }
        const action = result.changed ? "updated" : "no-op reimport for";
        console.log(`Success: ${action} '${directory}'. ${result.added.runtime} new runtime record(s).`);
        console.log(`Import: ${result.report.format}: ${Object.values(result.report.imported).reduce((sum, count) => sum + count, 0)} normalized item(s), ${result.report.unsupported.reduce((sum, item) => sum + item.count, 0)} unsupported.`);
        return 0;
    }
    catch (error) {
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
const reportProjectEvidence = (parsed, cwd) => {
    const directory = path.resolve(cwd, parsed.input);
    try {
        const store = openAnalysisProjectStore(directory);
        const inspection = (() => {
            try {
                return store.transaction(() => store.inspectEvidence(), false);
            }
            finally {
                store.close();
            }
        })();
        const text = canonicalJson(inspection);
        if (parsed.output) {
            const output = path.resolve(cwd, parsed.output);
            fs.mkdirSync(path.dirname(output), { recursive: true });
            fs.writeFileSync(output, text);
            console.log(`Success: Evidence report written to '${output}'.`);
        }
        else {
            console.log(text.trimEnd());
        }
        return 0;
    }
    catch (error) {
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
const analyzeProject = (parsed, cwd) => {
    const directory = path.resolve(cwd, parsed.input);
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
        console.log(`Success: ${result.status} 65816 analysis wrote ${result.instructions} instruction(s), ${result.functions} function candidate(s), ${result.conflicts} conflict(s), and ${result.unresolved} unresolved flow(s).`);
        console.log(`Runtime evidence: ${result.runtimeSeeds} observed PC(s) seeded as code. ${result.omittedRuntimeSeeds} omitted by the safety bound. Captured instruction variants: ${result.capturedInstructions}. Observed PCs without code: ${result.runtimePcsWithoutCode}. Heuristic findings: ${result.heuristicRoles}.`);
        if (result.status === "incomplete") {
            console.log(`Incomplete: ${result.incompleteReasons.map((reason) => reason.message).join(" ")}`);
        }
        return 0;
    }
    catch (error) {
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
const exportProjectSource = (parsed, cwd) => {
    const projectDirectory = path.resolve(cwd, parsed.input);
    if (!parsed.rom) {
        console.error("Export failed: --rom is required so project identity can be verified.");
        return 1;
    }
    try {
        const outputDirectory = parsed.output
            ? path.resolve(cwd, parsed.output)
            : defaultOutputPath(projectDirectory, ".source");
        const result = exportSnesProject({
            projectDirectory,
            romFile: path.resolve(cwd, parsed.rom),
            sourceDirectory: outputDirectory,
            force: parsed.force,
            allowCodeRegression: parsed.allowCodeRegression,
            structLineWidth: parsed.structLineWidth,
            commentLineWidth: parsed.commentLineWidth,
            wrapComments: parsed.wrapComments,
        });
        console.log(`Success: Exported ${result.manifest.files.length} generated file(s) covering ${result.manifest.rom.contentSize} content byte(s). ${result.codeBytes} byte(s) emitted as native 65816 source.`);
        console.log(`RAM map: ${result.manifest.inputs?.find((input) => input.path === "ram-map.json")?.records ?? 0} variable(s) applied from '${path.join(outputDirectory, "ram-map.json")}'.`);
        console.log(`Manifest: '${path.join(outputDirectory, SOURCE_EXPORT_MANIFEST)}'.`);
        return 0;
    }
    catch (error) {
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
const assemble = async (parsed, cwd) => {
    const inputFile = path.resolve(cwd, parsed.input);
    if (!fs.existsSync(inputFile)) {
        console.error(`Error: Input file '${inputFile}' not found.`);
        return 1;
    }
    const explicitConfig = parsed.configFile
        ? path.resolve(cwd, parsed.configFile)
        : path.resolve(cwd, PROJECT_CONFIG_FILENAME);
    const hasProjectConfiguration = fs.existsSync(explicitConfig);
    const pluginModules = parsed.plugins.map((module) => ({ module }));
    const overrides = {
        ...(parsed.target === undefined ? {} : { target: parsed.target }),
        ...(parsed.architecture === undefined ? {} : { architecture: parsed.architecture }),
        ...(parsed.includePaths.length === 0 ? {} : { includePaths: parsed.includePaths }),
        ...(Object.keys(parsed.pluginOptions).length === 0
            ? {}
            : { pluginOptions: parsed.pluginOptions }),
    };
    const useSnesHostDefault = !hasProjectConfiguration && pluginModules.length === 0;
    const bundledPlugins = new Map([
        ["@uttori/asm-plugin-snes", snesPlugin],
    ]);
    let loaded;
    let assembler;
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
            console.log(`Plugins: ${loaded.configuration.plugins.map((plugin) => plugin.pluginId).join(", ")}`);
            console.log(`Target: ${loaded.target}`);
            console.log(`Architecture: ${loaded.architecture}`);
        }
        const managedGeneration = findManagedSourceFile(inputFile);
        const generationIdentity = managedGeneration
            ? sourceGenerationIdentity(managedGeneration.directory)
            : undefined;
        const source = fileProvider.readTextFile(inputFile);
        assembler.assembleProgram(assembler.buildProgramModel(source, inputFile, 0));
        if (managedGeneration && generationIdentity) {
            assertSourceGeneration(managedGeneration.directory, generationIdentity);
        }
        const extension = loaded.environment.getTarget(loaded.target).defaultOutputExtension;
        const outputFile = parsed.output
            ? path.resolve(cwd, parsed.output)
            : defaultOutputPath(inputFile, extension);
        const output = assembler.getBinaryOutput();
        const outputs = [
            { file: outputFile, contents: output },
        ];
        let debugMapFile;
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
                }
                else {
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
            outputs.push({ file: debugMapFile, contents: canonicalDebugMapJson(debugMap) });
        }
        if (managedGeneration && generationIdentity) {
            assertSourceGeneration(managedGeneration.directory, generationIdentity);
        }
        publishOutputFiles(outputs, [inputFile, loaded.configuration.configFile ?? explicitConfig]);
        console.log(`Success: Output written to '${outputFile}'.`);
        if (debugMapFile) {
            console.log(`Debug map: '${debugMapFile}'.`);
        }
        return 0;
    }
    catch (error) {
        console.error(`Compilation failed: ${formatFailure(error)}`);
        return 1;
    }
    finally {
        // Session cleanup can throw too. The owned plugin environment still needs disposal.
        try {
            assembler?.dispose();
        }
        finally {
            await loaded?.dispose();
        }
    }
};
/**
 * Verifies that a source export round-trips byte-for-byte.
 * @param {CliArguments} parsed The parsed CLI arguments.
 * @param {string} cwd The current working directory.
 * @returns {Promise<number>} The exit code.
 */
const verifyRoundTrip = async (parsed, cwd) => {
    const directory = path.resolve(cwd, parsed.input);
    if (!parsed.rom) {
        console.error("Round-trip verification failed: --rom is required.");
        return 1;
    }
    try {
        const generationIdentity = sourceGenerationIdentity(directory);
        const manifest = loadSourceExportManifest(directory);
        validateSourceExportFiles(directory, manifest);
        validateSourceExportInputs(directory, manifest);
        const rom = RomImage.load(path.resolve(cwd, parsed.rom), {
            headerSize: manifest.rom.headerSize,
        });
        if (rom.identity.sha256 !== manifest.rom.sha256 ||
            rom.identity.contentSha256 !== manifest.rom.contentSha256) {
            throw new Error(`ROM identity mismatch: export expects ${manifest.rom.sha256}, received ${rom.identity.sha256}.`);
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
        if (exitCode !== 0) {
            throw new Error("Generated native source did not assemble successfully.");
        }
        const content = fs.readFileSync(contentOutput);
        const final = manifest.rom.headerSize === 0
            ? content
            : Buffer.concat([
                fs.readFileSync(path.join(directory, manifest.spans.find((span) => span.role === "copier-header").file)),
                content,
            ]);
        const comparison = compareByteImages(rom.fileBytes(), final);
        if (!comparison.equal) {
            const difference = comparison.firstDifference ?? 0;
            const contentOffset = difference - manifest.rom.headerSize;
            const identity = contentOffset < 0
                ? undefined
                : identifySnesFileOffset(contentOffset, createSnesAddressContext(manifest.mapper), manifest.rom.contentSize);
            let addressDetail = "copier header";
            if (contentOffset >= 0) {
                addressDetail = `content offset $${contentOffset.toString(16).toUpperCase().padStart(6, "0")}`;
                if (identity) {
                    addressDetail += ` / CPU $${identity.canonicalCpuAddress.toString(16).toUpperCase().padStart(6, "0")}`;
                }
            }
            console.error(`Round-trip mismatch: expected ${comparison.expectedLength} byte(s) / ${comparison.expectedSha256}, received ${comparison.actualLength} byte(s) / ${comparison.actualSha256}. First difference at file offset $${difference.toString(16).toUpperCase().padStart(6, "0")} (${addressDetail}).`);
            return 1;
        }
        assertSourceGeneration(directory, generationIdentity);
        validateSourceExportFiles(directory, manifest);
        // Keep a previously verified image intact when rebuilding or comparison fails.
        publishOutputFiles([{ file: finalOutput, contents: final }], [path.resolve(cwd, parsed.rom)]);
        console.log(`Success: Round trip is byte-identical (${comparison.actualLength} byte(s), SHA-256 ${comparison.actualSha256}).`);
        return 0;
    }
    catch (error) {
        console.error(`Round-trip verification failed: ${formatFailure(error)}`);
        return 1;
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
export const runCli = async (argv = process.argv.slice(2)) => {
    let parsed;
    try {
        parsed = parseCliArguments(argv);
    }
    catch (error) {
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
    try {
        return await runCommand(parsed, process.cwd());
    }
    catch (error) {
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
const runCommand = async (parsed, cwd) => {
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
    if (parsed.command === "export") {
        return exportProjectSource(parsed, cwd);
    }
    if (parsed.command === "project-validate") {
        return validateProject(parsed, cwd);
    }
    if (parsed.command === "project-storage") {
        let store;
        try {
            store = openAnalysisProjectStore(path.resolve(cwd, parsed.input));
            const active = store;
            store.transaction(() => {
                if (parsed.storagePolicy) {
                    active.setStoragePolicy(parsed.storagePolicy);
                }
            });
            const maintenance = store.maintainStorage();
            console.log(JSON.stringify({
                policy: store.storagePolicy(),
                storage: { ...store.storageSnapshot(), optionalCacheBytes: store.storageCacheBytes() },
                captures: store.captureCatalog(),
                maintenance,
            }, null, 2));
            return 0;
        }
        catch (error) {
            console.error(`Storage maintenance failed: ${formatFailure(error)}`);
            return 1;
        }
        finally {
            store?.close();
        }
    }
    if (parsed.command === "project-compact") {
        try {
            const result = compactAnalysisProject(path.resolve(cwd, parsed.input));
            console.log(`Success: compacted analysis storage. Freed ${(result.maintenance.removedBytes / 1024 / 1024).toFixed(1)} MiB.`);
            return result.maintenance.warnings.length ? 1 : 0;
        }
        catch (error) {
            console.error(`Project compaction failed: ${formatFailure(error)}`);
            return 1;
        }
    }
    if (parsed.command === "verify-roundtrip") {
        return verifyRoundTrip(parsed, cwd);
    }
    return assemble(parsed, cwd);
};
// Node resolves npm bin symlinks and platform path aliases before identifying the entry module.
// Comparing argv paths to import.meta.url would silently skip CLI execution in those installs.
if (import.meta.main) {
    process.exitCode = await runCli();
}
//# sourceMappingURL=index.js.map