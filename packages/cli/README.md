# `@uttori/asm-cli`

The Uttori ASM command-line interface is the Node.js host for assembling projects from a terminal or build script. It composes the architecture-neutral core, project configuration loader, and bundled SNES plugin without adding host behavior to `@uttori/asm-core`.

## Installation

```sh
npm install --save-dev @uttori/asm-cli
```

Run the scoped package directly or install it globally to use the `uttori-asm` executable:

```sh
npx @uttori/asm-cli -- main.asm main.sfc
uttori-asm main.asm main.sfc
```

Inside this repository, the root command delegates to this workspace:

```sh
npm run cli -- main.asm main.sfc
```

## Default Behavior

When neither `uttori-asm.config.json` nor an explicit `--plugin` is present, the CLI activates the bundled `@uttori/asm-plugin-snes` package and selects its `snes.sfc` target. Core itself has no default target.

If the output path is omitted, the selected target supplies its default extension:

```sh
uttori-asm main.asm
# Writes main.sfc for the default SNES target.
```

Project configuration takes precedence over the host default. Command-line overrides take precedence over project configuration.

## Options

| Option                             | Meaning                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `--config path`                    | Load a particular `uttori-asm.config.json`                        |
| `--plugin module`                  | Append a plugin module; repeatable                                |
| `--target id`                      | Override the configured target                                    |
| `--architecture id`                | Override the initial architecture                                 |
| `--base-image path`                | Read and patch an existing binary image                           |
| `--include-path path`              | Add a source or binary lookup directory; repeatable               |
| `--plugin-option plugin:key=value` | Override one plugin option; values are JSON-decoded when possible |
| `--verbose`                        | Print the resolved plugins, target, and architecture              |
| `--help`                           | Print usage                                                       |

Examples:

```sh
uttori-asm patch.asm patched.sfc --base-image clean.sfc

uttori-asm packages/plugin-author/main.asm build/main.bin \
  --config packages/plugin-author/uttori-asm.config.json

uttori-asm main.asm --plugin ./plugin.js --target custom.raw \
  --architecture custom.cpu --include-path includes \
  --plugin-option custom.plugin:mode='"strict"' --verbose
```

## Programmatic Use

The package exports `parseCliArguments()`, `runCli()`, the `CliArguments` interface, and the generated usage text:

```ts
import { runCli } from "@uttori/asm-cli";

process.exitCode = await runCli(["main.asm", "main.sfc"]);
```

`runCli()` returns an exit code and writes user-facing status to the console. Plugin environments and assembler sessions are disposed before it returns.

If you are doing this, you are better off wrapping the assembly core itself instead of the CLI.

## Development

```sh
npm run typecheck --workspace @uttori/asm-cli
npm run build --workspace @uttori/asm-cli
npm run smoke --workspace @uttori/asm-cli
```

The distributable executable is generated at `out/cli.mjs`; declarations are generated under `dist/`.
