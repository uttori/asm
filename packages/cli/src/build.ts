import path from "node:path";

import somPlugin from "@uttori/asm-game-secret-of-mana";
import {
  createAssemblyBuildHost,
  executeAssemblyBuildOperation,
  type AssemblyBuildOperation,
} from "@uttori/asm-workflows/build";

/** New workflows are explicit commands; bare source invocations and assemble retain absolute Asar semantics. */
export const assemblyBuildUsage = `uttori-asm assemble-object <source.asm> [output.uobj] --module <id> [--config <config.json>] [--source-adapter <asar|ca65>]
uttori-asm library <output.ulib> <object.uobj> [more-objects...]
uttori-asm link <build.json>
uttori-asm build <build.json>

Build manifests use {"format":"uttori-build","version":1,"recipe":...,"modules":[{"id":"main","source":"main.asm"}]}.
Paths resolve beside the manifest. link accepts serialized objects/libraries only; build also assembles modules.
Linked ROM, debug map, symbols and allocation report publish together under outputDirectory/current.json.
Object assembly uses the normal plugin configuration. -- ends option parsing for paths beginning with --.`;

/** Strict adapter for the shared Node service; no host-specific assembly or linking occurs here. */
export function parseAssemblyBuildArguments(
  argv: readonly string[],
  directory: string,
): AssemblyBuildOperation {
  const [action, ...tokens] = argv;
  if (action === "link" || action === "build") {
    const paths = tokens[0] === "--" ? tokens.slice(1) : tokens;
    if (paths.length !== 1 || (tokens[0] !== "--" && paths[0].startsWith("--"))) {
      throw new Error(`${action} requires one build manifest path.`);
    }
    return { action: action === "build" ? "build-linked" : "link", directory, manifest: paths[0] };
  }
  const positionals: string[] = [];
  const flags = new Map<string, string>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === "--") {
      positionals.push(...tokens.slice(index + 1));
      break;
    }
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const equals = token.indexOf("=");
    const flag = equals < 0 ? token : token.slice(0, equals);
    const value = equals < 0 ? tokens[++index] : token.slice(equals + 1);
    if (
      action !== "assemble-object" ||
      !["--module", "--config", "--source-adapter"].includes(flag) ||
      !value ||
      value.startsWith("--") ||
      flags.has(flag)
    ) {
      throw new Error(`Invalid or repeated ${flag} option.`);
    }
    flags.set(flag, value);
  }
  if (action === "library" && positionals.length >= 2) {
    return { action, directory, output: positionals[0], objects: positionals.slice(1) };
  }
  if (
    action === "assemble-object" &&
    positionals.length >= 1 &&
    positionals.length <= 2 &&
    flags.has("--module")
  ) {
    const source = positionals[0];
    const parsed = path.parse(source);
    const sourceAdapter = flags.get("--source-adapter");
    if (sourceAdapter !== undefined && sourceAdapter !== "asar" && sourceAdapter !== "ca65") {
      throw new Error("--source-adapter must be asar or ca65.");
    }
    return {
      action,
      directory,
      source,
      output: positionals[1] ?? path.join(parsed.dir, `${parsed.name}.uobj`),
      module: flags.get("--module")!,
      ...(sourceAdapter ? { sourceAdapter } : {}),
      ...(flags.has("--config") ? { config: flags.get("--config") } : {}),
    };
  }
  throw new Error("Choose a valid assembly build command and its required arguments.");
}

const host = createAssemblyBuildHost([["@uttori/asm-game-secret-of-mana", somPlugin]]);

/** Emit a compact structured receipt for scripts; failures preserve the previously selected linked build. */
export async function runAssemblyBuildCli(argv: readonly string[]): Promise<number> {
  const delimiter = argv.indexOf("--");
  const help = argv.indexOf("--help");
  if (help >= 0 && (delimiter < 0 || help < delimiter)) {
    console.log(assemblyBuildUsage);
    return 0;
  }
  try {
    const operation = parseAssemblyBuildArguments(argv, process.cwd());
    const result = await executeAssemblyBuildOperation(
      operation,
      {
        onProgress: (message) => console.error(message),
      },
      host,
    );
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
