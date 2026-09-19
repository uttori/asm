# Uttori Assembly

SNES and 65xx assembly, ROM analysis, and debugging in VS Code.

## Requirements and installation

Requires VS Code 1.128.0 or newer. The extension uses VS Code's bundled runtime; no separate Node.js
installation is required. Live debugging needs a separately installed, manifest-matched emulator.

Install **Uttori Assembly** (`matthewcallis.uttori-asm-vscode`) from Extensions, or use
**Extensions: Install from VSIX** with the release VSIX.

## Quick start

1. Open a local project folder and create `main.asm`:

   ```asm
   lorom
   org $008000
   sei
   ```

2. Select **Uttori SNES** as the language mode if it was not detected.
3. Run **Assembly: Build Binary**. The default target writes `main.sfc` and `main.sfc.debug.json`.

This example demonstrates assembly; it is not a bootable game. For NES/6502 projects, configure the
65xx plugin and target in `uttori-asm.config.json`. Use `asm.configFile` when that file is nested.

## Features

- Diagnostics, completion, hover, symbols, navigation, rename, and semantic highlighting.
- Project builds, build on save, and configurable entry points and include paths.
- ROM disassembly, SQLite analysis views, persistent annotations, and verified source regeneration.
- Replay debugging and optional ares/MesenCE live debugging.
- Runtime capture and evidence import when supported by the selected native runtime.

Run **Assembly: Create Disassembly Project from ROM** to start analysis. Use **Edit Disassembly
Annotation** and **Open Disassembly RAM Map** for edits that survive regeneration. Generated source
is hash-checked; changing it directly can block regeneration.

## Source breakpoints

Click beside a line number or press **F9** in **Uttori SNES** or **Uttori 65xx** source.
Launch with the matching binary and debug map to verify the marker. Comments and labels move
to the next mapped executable line; unmapped locations remain unverified.

For supported SNES cartridge mappings, a source breakpoint covers every confirmed ROM alias,
so code mapped at `$C08005` can also stop when executed at `$008005`. Instruction breakpoints
keep the exact address requested. You can add or remove source breakpoints while ares runs;
the adapter briefly pauses execution to update its breakpoint table.

## Configuration and limits

Use `uttori-asm.config.json` for project plugins, target, architecture, and paths. VS Code's `asm.*`
settings override project values. See Settings under **Uttori Assembly** for all defaults.

Workspace plugins execute code and require Workspace Trust. Writes and live launch require a trusted
local filesystem workspace. Virtual workspaces are unsupported; remote native-emulator workflows
have not been validated. Replay is a snapshot viewer, not an emulator. MesenCE live integration is
experimental; ares capabilities depend on its separately verified runtime.

For build failures, check **Output → Uttori Assembly Language Server**; analysis and emulator operations have
**Uttori Analysis** and **Uttori Emulator** output channels. Rebuild stale debug maps or regenerate
stale source before retrying navigation/debugging.

## Documentation and support

[User guide](https://github.com/uttori/asm/blob/master/packages/vscode-extension/GUIDE.md) ·
[Project configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md) ·
[SNES manual](https://github.com/uttori/asm/blob/master/packages/plugin-snes/MANUAL.md) ·
[65xx manual](https://github.com/uttori/asm/blob/master/packages/plugin-65xx/MANUAL.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
