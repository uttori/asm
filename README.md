# Uttori ASM

A pluggable assembler, ROM-analysis toolkit, and VS Code extension for SNES and 6502-family CPUs.
Build binaries, inspect evidence, regenerate source, and verify byte-identical ROM rebuilds.

## Requirements

- Node.js 26 or newer for npm packages, standalone tools, and development.
- VS Code 1.128.0 or newer for the extension; it uses the editor's embedded runtime.
- Live debugging requires a separately installed, manifest-matched ares or MesenCE runtime.

Support starts at the versions currently declared in the package manifests and moves forward.
Earlier Node/editor releases and earlier development project formats are outside the support baseline.
See the [release gates](TESTING.md#release-candidate-evidence-checklist) and each sidecar's runtime
setup for validation requirements and platform limits.

## Quick start

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

This writes a one-byte assembly example and its debug map; it is not a bootable game.
The CLI defaults to SNES. Use [project configuration](packages/plugin-loader-node/CONFIGURATION.md) for other targets.
Packages expose compiled ESM and TypeScript declarations; no TypeScript loader is required.

For editor setup, see the [VS Code extension](packages/vscode-extension/README.md).

## Packages

| Package                                                               | Purpose                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| [asm-cli](packages/cli/README.md)                                     | Assembly, analysis, import, export, and verification commands |
| [asm-core](packages/core/README.md)                                   | Assembly engine, analysis, and plugin contracts               |
| [asm-disassembler](packages/disassembler/README.md)                   | SQLite projects, evidence, transactions, and assets           |
| [asm-plugin-loader-node](packages/plugin-loader-node/README.md)       | Project configuration and trusted plugin loading              |
| [asm-plugin-snes](packages/plugin-snes/README.md)                     | SNES, 65816, SPC700, and Super FX                             |
| [asm-plugin-65xx](packages/plugin-65xx/README.md)                     | 6502-family, raw, ca65-style, and NES targets                 |
| [asm-debug-adapter](packages/debug-adapter/README.md)                 | Debugger contracts, DAP, replay, and sidecar protocol         |
| [asm-debug-sidecar-ares](packages/debug-sidecar-ares/README.md)       | ares process host and debugger translator                     |
| [asm-debug-sidecar-mesence](packages/debug-sidecar-mesence/README.md) | Experimental MesenCE process host and translator              |

The [language server](packages/language-server/README.md),
[VS Code extension](packages/vscode-extension/README.md), and
[plugin example](packages/plugin-author/README.md) are private npm workspaces.
The extension is distributed separately as a VSIX/Marketplace extension.

## Documentation

[CLI reference](packages/cli/README.md) ·
[SNES manual](packages/plugin-snes/MANUAL.md) · [65xx manual](packages/plugin-65xx/MANUAL.md) ·
[Plugin authoring](packages/plugin-author/GUIDE.md) ·
[Project configuration](packages/plugin-loader-node/CONFIGURATION.md) ·
[Analysis projects](packages/disassembler/PROJECTS.md).

Public guides live in each package's README or other top-level Markdown files. Internal research
and bookkeeping are separate from these user-facing contracts.

Analysis projects store metadata in SQLite and keep the source ROM external. Analysis is conservative;
unknown bytes remain raw assets. Asar/ca65 compatibility is partial. Emulator binaries and ROMs are
not included. See the relevant package guide for exact limits.

## Development and support

```sh
npm ci
npm run verify
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for source development and checks.
[Report an issue](https://github.com/uttori/asm/issues); follow [SECURITY.md](SECURITY.md) for
vulnerability reports. Licensed under [MIT](LICENSE), with
[65xx third-party notices](packages/plugin-65xx/THIRD_PARTY_NOTICES.md).
