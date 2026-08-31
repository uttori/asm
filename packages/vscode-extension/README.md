# Uttori Assembly

Assembly language support powered by [uttori-asm](https://github.com/uttori/asm), currently bundled with the first-party SNES target and 65xx target.

Requires VS Code 1.128 or newer and implements the [Language Server Protocol 3.18 specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/).

## Features

- Diagnostics from the assembler analysis pipeline (recovers from local errors).
- Document and workspace symbols.
- Go-to-definition and find-references across `incsrc`/`include` boundaries.
- Target-filtered hover and completion from the active plugins, including bundled 65816 / SPC700 / Super FX support.
- Signature help, semantic tokens, and cross-file rename for user-defined symbols.
- **Uttori SNES** and **Uttori 65xx** language modes (status bar / Change Language Mode). SNES is the default for `.asm` and includes SPC700, Super FX, and mapper directives; 65xx is CPU-only.

## Commands

- **Assembly: Build Binary** (`asm.build`) - assembles the active file with the
  selected target. Available from the command palette and the editor title run
  menu when editing an Uttori Assembly file. Unsaved buffers are
  built as-is.
- **Assembly: Toggle Build on Save (Watch)** (`asm.toggleWatch`) - rebuilds the
  entry file (first `asm.entryPoints` value, else the active file) every time an
  assembly file is saved. A status bar item shows the
  watch state; click it to toggle.

## Settings

- `asm.configFile` - optional workspace-relative path to `uttori-asm.config.json`.
- `asm.plugins` - plugin module specifiers or `{ module, options }` objects.
- `asm.target` - target contribution ID or alias.
- `asm.architecture` - architecture contribution ID or alias.
- `asm.entryPoints` - project entry-point files analysed as include roots.
- `asm.includePaths` - extra include search paths relative to the workspace.
- `asm.buildOutput` - output path (defaults to the target's output extension).
- `asm.baseImage` - optional base image to patch when building.

Workspace plugin configuration is disabled in restricted workspaces. Trust the workspace to activate `uttori-asm.config.json` or `asm.plugins`; the bundled SNES target remains available before trust is granted.

## Building

From the repository root:

```
npm install
npm run lsp:build
npm run vscode:build
```

For debugging, open `packages/vscode-extension` as the VS Code workspace and press F5. The
included launch task builds both the language server and extension. Run
`npm run vscode:package` from the repository root to produce a `.vsix`.
