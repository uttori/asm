import * as fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Assembler, PluginError } from "@uttori/asm-core";
import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
import {
  loadProjectEnvironment,
  PROJECT_CONFIG_FILENAME,
  type PluginModuleRequest,
  type ProjectConfigurationOverrides,
} from "@uttori/asm-plugin-loader-node";
import snesPlugin, { SNES_TARGET_ID } from "@uttori/asm-plugin-snes";

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

export const usage = `Usage: uttori-asm <input> [output] [options]

Options:
  --config <uttori-asm.config.json>
  --plugin <module>              Repeatable; appended after configured plugins
  --target <target-id>
  --architecture <architecture-id>
  --base-image <path>
  --include-path <path>          Repeatable
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

const splitOption = (argument: string): { flag: string; inlineValue?: string } => {
  const equals = argument.indexOf("=");
  return equals < 0
    ? { flag: argument }
    : { flag: argument.slice(0, equals), inlineValue: argument.slice(equals + 1) };
};

export const parseCliArguments = (argv: readonly string[]): CliArguments => {
  const positional: string[] = [];
  const plugins: string[] = [];
  const includePaths: string[] = [];
  const pluginOptions: Record<string, Record<string, unknown>> = {};
  let configFile: string | undefined;
  let target: string | undefined;
  let architecture: string | undefined;
  let baseImage: string | undefined;
  let verbose = false;
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

  for (let index = 0; index < argv.length; index++) {
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
      case "--include-path":
        includePaths.push(value);
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
    input: positional[0],
    output: positional[1],
    configFile,
    plugins: Object.freeze(plugins),
    target,
    architecture,
    baseImage,
    includePaths: Object.freeze(includePaths),
    pluginOptions: Object.freeze(pluginOptions),
    verbose,
    help,
  };
};

const defaultOutputPath = (inputFile: string, extension: string): string => {
  const parsed = path.parse(inputFile);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
};

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
  const inputFile = path.resolve(cwd, parsed.input);
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
      collectSourceMetadata: false,
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
    fs.writeFileSync(outputFile, Buffer.from(assembler.getBinaryOutput()));
    console.log(`Success: Output written to '${outputFile}'.`);
    return 0;
  } catch (error) {
    console.error(`Compilation failed: ${formatFailure(error)}`);
    return 1;
  } finally {
    assembler?.dispose();
    await loaded?.dispose();
  }
};

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (entryPoint === import.meta.url) {
  process.exitCode = await runCli();
}
