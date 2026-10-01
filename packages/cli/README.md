# @uttori/asm-cli

Command-line assembly, ROM analysis, evidence import, and Git source editing for Uttori ASM.
Includes the SNES plugin. Other targets use installed plugins and project configuration.

## Install

Requires Node.js 26 or newer. Exposes an executable, ESM JavaScript, and TypeScript declarations.

```sh
npm install --save-dev @uttori/asm-cli
npx uttori-asm --help
```

## Usage

```sh
npx uttori-asm main.asm output.sfc
npx uttori-asm main.asm output.sfc --debug
npx uttori-asm patch.asm patched.sfc --base-image original.sfc
```

An omitted output path uses the target's extension. `--debug` adds `<output>.debug.json`.
A base-image build preserves bytes the patch does not replace. Output paths cannot overwrite inputs.
Use `uttori-asm.config.json` for plugins, target, architecture, and include paths. Command-line options
override configuration. Workspace plugins execute code, so load only plugins you trust.

Create a Git source project, then edit assembly, assets, and research as ordinary files:

```sh
npx uttori-asm source init game-source game.sfc --mapper lorom
# Optional creation import: --dizraw research.dizraw
npx uttori-asm source import game-source capture.act2
npx uttori-asm source analyze game-source
npx uttori-asm source prepare game-source
npx uttori-asm source preview game-source <candidate-commit>
git -C game-source add <reviewed-paths>
git -C game-source commit -m "Checkpoint source edits"
npx uttori-asm source apply game-source <candidate-commit>
# Resolve any conflicts in Git/VS Code and stage the resolutions.
npx uttori-asm source finish game-source
npx uttori-asm source build game-source
```

Git must have an author configured. Creation verifies an exact original-ROM build before adopting
an immutable generation commit. Preparation and preview preserve uncommitted edits; applying a
candidate requires a clean committed checkpoint. `source abort` returns an active merge to that
checkpoint. `source finish` validates the resolved build before committing the merge.

Tracked research under `.uttori/research/` retains original identities and preferred names.
SQLite indexes those choices alongside capture evidence. Private ROM/evidence bindings live in
ignored `.uttori-local/`; a clone needs its own local binding and retained evidence before generation.
Working source may intentionally differ from the ROM; only pure generations require original-ROM
equality. ROMs and emulator binaries are not distributed.

The executable exits with 0 on success or 1 on failure. Check stderr for diagnostics and stdout for
command results. For embedding, import `parseCliArguments` or `runCli` from the package root.
See the guide for output channels, defaults, overwrite rules, and interruption behavior.

## Documentation and support

[CLI guide](https://github.com/uttori/asm/blob/master/packages/cli/GUIDE.md) ·
[Configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md) ·
[Trace import](https://github.com/uttori/asm/blob/master/packages/disassembler/TRACES.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
