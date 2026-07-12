# SNES Assembly (snes-asm-js)

Language support for SNES assembly powered by the [snes-asm-js](https://github.com/MatthewCallis/snes-asm-js) language server.

## Features

- Diagnostics from the assembler analysis pipeline (recovers from local errors).
- Document and workspace symbols.
- Go-to-definition and find-references across `incsrc`/`include` boundaries.
- Hover and completion for 65816 / SPC700 / Super FX instructions and directives.
- Signature help, semantic tokens, and rename (cross-file).

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
- `snesAsm.includePaths` — extra include search paths.
- `snesAsm.architecture` — default CPU architecture (`65816`, `spc700`, `superfx`).
- `snesAsm.buildOutput` — output path for the built ROM (defaults to the source's `.sfc` sibling).
- `snesAsm.targetRom` — optional base ROM to patch into when building.

## Building

From the repository root:

```
npm install
npm run lsp:build
npm run vscode:build
```

Then press F5 in VS Code (or run `npm run vscode:package` to produce a `.vsix`).
