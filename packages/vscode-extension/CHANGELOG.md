# Changelog

## 1.0.0

- SNES and 65xx syntax highlighting, completion, diagnostics, navigation, and builds.
- ROM analysis projects with SQLite storage, annotations, source regeneration, and rebuild checks.
- Replay debugging and external emulator integration with explicit processor capabilities.
- Instruction and bus capture import, runtime evidence views, and storage maintenance.

Requires VS Code 1.128.0 or newer. Bundled tools use the editor's runtime. Standalone npm tools
require Node.js 26 or newer. Live emulator support depends on a compatible external ares runtime.
See the
[guide](https://github.com/uttori/asm/blob/master/packages/vscode-extension/GUIDE.md) for setup and limitations.
