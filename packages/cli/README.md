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

## Analysis Projects

Create a native analysis project from a user-supplied ROM:

```sh
uttori-asm disassemble game.sfc game.analysis
```

Mapper detection is conservative. If the scored header candidates are inconclusive, creation stops until `--mapper` is supplied. `--header-size 0|512` overrides copier-header detection. All supported mapper names are shown by `--help`.

An uncompressed DiztinGUIsh project can be imported while creating the project:

```sh
uttori-asm disassemble game.sfc game.analysis --dizraw game.dizraw --mapper hirom
```

The importer stores its deterministic loss report in `analysis/imports.json`. Compressed `.diz` input and `.dizraw` export are unsupported.

Validate shard hashes and schema compatibility, optionally checking the exact ROM identity:

```sh
uttori-asm project-validate game.analysis --rom game.sfc
```

Run conservative 65816 control-flow analysis and persist its CFG, state, evidence, conflicts, and coverage back into the project:

```sh
uttori-asm analyze game.analysis --rom game.sfc
```

Additional entry points can be supplied with repeatable `--entry` options using `$`, `0x`, or decimal notation. `--max-work-items` and `--max-call-depth` bound hostile or recursive control flow; hitting either bound writes an explicit incomplete result rather than silently truncating it.

Editable `target-set` and `target-override` records in `analysis/control-flow.json` are retained on subsequent runs and take precedence over unresolved static targets.

ROM bytes are never copied into the project.

## Offline Runtime Evidence

Import stock MesenCE CDL, default 65816 trace text, and labels into an existing project:

```sh
uttori-asm evidence-import game.analysis --rom game.sfc --mesen-cdl game.cdl
uttori-asm evidence-import game.analysis --rom game.sfc \
  --mesen-trace game.trace --trace-metadata game.trace.json
uttori-asm evidence-import game.analysis --rom game.sfc --mesen-labels game.mlb
uttori-asm evidence-import game.analysis --rom game.sfc \
  --instruction-trace instruction-trace.json
```

Multiple evidence options can be supplied in one command. Every import verifies the project's exact ROM identity and stored mapper first. `CDLv2` also verifies its embedded ROM CRC. Native instruction traces preserve ordered pull chunks and producer-loss metadata and use the same `snes.cpu` CPU-bus identity as native analysis projects. An identical reimport does not rewrite the project.

MesenCE trace text has no embedded ROM fingerprint, so its required identity sidecar is explicit:

```json
{
  "schemaVersion": 1,
  "architecture": "snes.65816",
  "romContentSha256": "<64 lowercase hex characters>",
  "mapper": "lorom",
  "mesenRevision": "<optional source revision>"
}
```

Inspect retained contradictions and runtime-derived explanations, or export native labels for MesenCE:

```sh
uttori-asm evidence-report game.analysis evidence-report.json
uttori-asm mesen-labels-export game.analysis game.mlb --rom game.sfc
```

## Native Source Export

Export analyzed bytes as deterministic native 65816 source, with conservative raw assets for
everything the analysis has not justified as code:

```sh
uttori-asm export game.analysis game.source --rom game.sfc
uttori-asm verify-roundtrip game.source --rom game.sfc
```

The export contains `main.asm`, mapper-bank sources under `banks/`, raw bytes under `assets/`, a
checksum-preserving `uttori-asm.config.json`, and a versioned `generated-files.json`. The manifest
assigns every content byte to exactly one code, raw, padding, SNES-header, or vector span. A copier
header is preserved as its own asset when present.

`verify-roundtrip` first rejects modified generated files, assembles `main.asm` through the normal
CLI project environment, restores any copier header, and compares the complete file length and
SHA-256. A mismatch reports its first differing file and content offset. Re-export refuses local
changes unless `--force` is explicit.

The opt-in local Secret of Mana gate validates the private ROM hash before using it and removes all
temporary analysis/source output afterward:

```sh
npm run fixture:som:roundtrip
# or: npm run fixture:som:roundtrip -- /path/to/Secret\ of\ Mana\ \(USA\).sfc
```

By default the gate reads `Local Only/Secret of Mana (USA).sfc`. A byte-identical result verifies
the conservative export/rebuild path, not the semantic completeness of imported Diz metadata:
unsupported, ambiguous, conflicting, and unreached bytes remain lossless raw assets.

## Assemble Options

| Option                             | Meaning                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `--config path`                    | Load a particular `uttori-asm.config.json`                        |
| `--plugin module`                  | Append a plugin module; repeatable                                |
| `--target id`                      | Override the configured target                                    |
| `--architecture id`                | Override the initial architecture                                 |
| `--base-image path`                | Read and patch an existing binary image                           |
| `--debug`                          | Collect source metadata and write `<output>.debug.json`           |
| `--debug-map path`                 | Collect source metadata and write the debug map at `path`         |
| `--include-path path`              | Add a source or binary lookup directory; repeatable               |
| `--plugin-option plugin:key=value` | Override one plugin option; values are JSON-decoded when possible |
| `--verbose`                        | Print the resolved plugins, target, and architecture              |
| `--help`                           | Print usage                                                       |

Examples:

```sh
uttori-asm patch.asm patched.sfc --base-image clean.sfc

uttori-asm main.asm build/main.sfc --debug-map build/main.debug.json

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

Contributor setup, ownership, tests, and release expectations are in the repository
[contributor guide](../../CONTRIBUTING.md) and [testing guide](../../docs/testing-and-release.md).
