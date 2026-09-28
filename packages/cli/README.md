# @uttori/asm-cli

Command-line assembly, ROM analysis, evidence import, and source export for Uttori ASM.
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

SNES analysis workflow:

```sh
npx uttori-asm disassemble game.sfc game.analysis --mapper lorom
npx uttori-asm analyze game.analysis --rom game.sfc
npx uttori-asm export game.analysis source --rom game.sfc
# Optional preferred width for generated dataStruct declarations and table rows (default 100).
npx uttori-asm export game.analysis source --rom game.sfc --struct-line-width 80 --comment-line-width 80
npx uttori-asm export game.analysis source --rom game.sfc --no-wrap-comments
npx uttori-asm verify-roundtrip source --rom game.sfc
```

Keep the original ROM outside the analysis project. Generated source is hash-checked. Store lasting
edits in project annotations and user-owned RAM/struct maps, then regenerate and verify.
ROMs and emulator binaries are not included. Analysis is conservative and can report incomplete work.

The executable exits with 0 on success or 1 on failure. Check stderr for diagnostics and stdout for
command results. For embedding, import `parseCliArguments` or `runCli` from the package root.
See the guide for output channels, defaults, overwrite rules, and interruption behavior.

## Documentation and support

[CLI guide](https://github.com/uttori/asm/blob/master/packages/cli/GUIDE.md) ·
[Configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md) ·
[Trace import](https://github.com/uttori/asm/blob/master/packages/disassembler/TRACES.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
