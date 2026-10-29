# Uttori ASM

A pluggable assembler, ROM-analysis toolkit, and VS Code extension for SNES and 6502-family CPUs.
Build binaries, inspect evidence, regenerate source, and verify byte-identical ROM rebuilds.

## Requirements

- Node.js 26 or newer for npm packages, standalone tools, and development.
- VS Code 1.140.0 or newer for the extension. It uses the editor's embedded runtime.
- Live debugging requires a separately installed, manifest-matched ares runtime.

Support starts at the versions currently declared in the package manifests and moves forward.
Earlier Node/editor releases and earlier development project formats are outside the support baseline.
See the [release gates](TESTING.md#release-candidate-evidence-checklist) and the ares sidecar runtime
setup for validation requirements and platform limits.

## Quick Start

```sh
npm install --save-dev @uttori/asm-cli
```

Create `main.asm`:

```asm
lorom
org $008000
sei
```

Then build it:

```sh
npx uttori-asm main.asm main.sfc --debug
```

This writes a one-byte assembly example and its debug map. It is not a bootable game.
The CLI defaults to SNES. Use [project configuration](packages/plugin-loader-node/CONFIGURATION.md) for other targets.
Packages expose compiled ESM and TypeScript declarations. No TypeScript loader is required.

For editor setup, see the [VS Code extension](packages/vscode-extension/README.md).

## Packages

| Package                                                         | Purpose                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| [asm-cli](packages/cli/README.md)                               | Assembly, evidence, Git source and saved asset workflows      |
| [asm-workflows](packages/workflows/README.md)                   | Shared source and asset operations for Node hosts             |
| [asm-capture](packages/capture/README.md)                       | ACT2 archive contracts, readers, recovery and target payloads |
| [asm-assets](packages/assets/README.md)                         | Standalone PNG, WAVE, data, and native conversion             |
| [asm-core](packages/core/README.md)                             | Assembly engine, analysis, and plugin contracts               |
| [asm-disassembler](packages/disassembler/README.md)             | SQLite projects, evidence, transactions, and declarations     |
| [asm-plugin-loader-node](packages/plugin-loader-node/README.md) | Project configuration and trusted plugin loading              |
| [asm-plugin-snes](packages/plugin-snes/README.md)               | SNES, 65816, SPC700, and Super FX                             |
| [asm-plugin-65xx](packages/plugin-65xx/README.md)               | 6502-family, raw, ca65-style, and NES targets                 |
| [asm-debug-adapter](packages/debug-adapter/README.md)           | Debugger contracts, DAP, replay, and sidecar protocol         |
| [asm-debug-sidecar-ares](packages/debug-sidecar-ares/README.md) | ares process host and debugger translator                     |

The [language server](packages/language-server/README.md),
[VS Code extension](packages/vscode-extension/README.md), and
[plugin example](packages/plugin-author/README.md), and
[Secret of Mana integration](packages/game-secret-of-mana/README.md) are private npm workspaces.
The extension is distributed separately as a VSIX/Marketplace extension.

## Documentation

[CLI guide](packages/cli/GUIDE.md) ·
[SNES](packages/plugin-snes/README.md) ·
[6502 / 65xx family](packages/plugin-65xx/README.md) ·
[Plugin authoring](packages/plugin-author/GUIDE.md) ·
[Project configuration](packages/plugin-loader-node/CONFIGURATION.md) ·
[Analysis projects](packages/disassembler/README.md).

Analysis projects store metadata in SQLite and keep the source ROM external. Analysis is conservative.
Unknown bytes remain raw assets. Asar/ca65 compatibility is partial. Emulator binaries and ROMs are
not included. See the relevant package guide for exact limits.

## Development & Support

```sh
npm ci
npm run verify
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for source development and checks.

[Report an issue](https://github.com/uttori/asm/issues).

Follow [SECURITY.md](SECURITY.md) for vulnerability reports.

Licensed under [MIT](LICENSE), with [65xx third-party notices](packages/plugin-65xx/THIRD_PARTY_NOTICES.md).
