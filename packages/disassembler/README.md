# @uttori/asm-disassembler

Architecture-neutral ROM identity, SQLite analysis projects, evidence, transactions, asset codecs,
and source-export contracts. Target plugins supply decoding, mapping, and source syntax.

## Install

Requires Node.js 26 or newer, including built-in `node:sqlite`.
Exposes ESM JavaScript and TypeScript declarations. `./canonical-json` also supports `require()`.

```sh
npm install @uttori/asm-disassembler
```

## Usage

```js
import { readFileSync } from "node:fs";
import { RomImage } from "@uttori/asm-disassembler";

const rom = new RomImage(readFileSync("game.sfc"), { headerSize: 0 });
console.log(rom.identity.contentSha256);
```

Use `headerSize: 512` for a copier-headered ROM. Omit the option for automatic detection.
For a complete SNES create/analyze/export workflow, use `@uttori/asm-cli` or the SNES plugin.

## Project storage

`analysis.sqlite` owns the manifest, records, and revision. `analysis.json` is a small watcher
pointer. Current projects use semantic schema 3 and SQLite storage format 2. ROM images remain
external. Records can retain bounded instruction observations from captures.

Use revision-checked transaction APIs for edits and `SqliteAnalysisStore` queries for bounded views.
Full snapshot APIs materialize all requested records. Address spaces are explicit and ranges are
half-open. Conflicting evidence remains visible. Close stores when finished. Back up through
SQLite's backup facilities or close every connection before copying project files.

Static analysis is conservative. Missing evidence, ambiguous decoding, and resource limits cannot
establish code or function boundaries. Earlier development storage layouts are outside the support
baseline.

## Documentation and support

[Analysis API and storage](https://github.com/uttori/asm/blob/master/packages/disassembler/API.md) ·
[Edit, back up, and verify](https://github.com/uttori/asm/blob/master/packages/disassembler/PROJECTS.md) ·
[Trace import](https://github.com/uttori/asm/blob/master/packages/disassembler/TRACES.md) ·
[CLI workflow](https://github.com/uttori/asm/blob/master/packages/cli/GUIDE.md#analysis-projects) ·
[Architecture](https://github.com/uttori/asm/blob/master/packages/disassembler/ARCHITECTURE.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
