# Uttori Assembly

Assembly language support powered by [uttori-asm](https://github.com/MatthewCallis/uttori-asm), currently bundled with the first-party SNES target.

Requires VS Code 1.91 or newer and implements the [Language Server Protocol 3.18 specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/).

## Features

- Diagnostics from the assembler analysis pipeline (recovers from local errors).
- Document and workspace symbols.
- Go-to-definition and find-references across `incsrc`/`include` boundaries.
- Hover and completion for 65816 / SPC700 / Super FX instructions and directives.
- Signature help, semantic tokens, and cross-file rename for user-defined symbols.

## Commands

- **SNES Assembly: Build ROM** (`snesAsm.build`) — assembles the active file to a
  binary using the bundled assembler. Available from the command palette and the
  editor title run menu when editing a SNES assembly file. Unsaved buffers are
  built as-is.
- **SNES Assembly: Toggle Build on Save (Watch)** (`snesAsm.toggleWatch`) —
  rebuilds the entry file (first `snesAsm.entryPoints` value, else the active
  file) every time a SNES assembly file is saved. A status bar item shows the
  watch state; click it to toggle.

## Settings

- `snesAsm.entryPoints` — project entry-point files analysed as include roots.
- `snesAsm.includePaths` — extra include search paths (relative to the workspace).
- `snesAsm.architecture` — default CPU architecture (`65816`, `spc700`, `superfx`).
- `snesAsm.buildOutput` — workspace-relative or absolute output path for the built ROM (defaults to the source's `.sfc` sibling).
- `snesAsm.targetRom` — optional workspace-relative or absolute base ROM to patch into when building.

## Building

From the repository root:

```
npm install
npm run lsp:build
npm run vscode:build
```

For debugging, open `editors/vscode` as the VS Code workspace and press F5. The
included launch task builds both the language server and extension. Run
`npm run vscode:package` from the repository root to produce a `.vsix`.
