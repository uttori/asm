# Create, edit, back up, and verify a Git source project

Requires Node.js 26+, Git with a configured author, and a SNES LoROM image you can use.
Install `@uttori/asm-cli`, `@uttori/asm-disassembler`, and `@uttori/asm-plugin-snes`.
Save the example as `analysis-workflow.mjs`, then run `node analysis-workflow.mjs game.sfc ./review`
with a new working directory. Change `mapper` for another supported mapping; copier headers are detected.

Research declarations and editable assembly live in Git. SQLite indexes those choices alongside
capture evidence. A pure generation proves original-ROM equality before native Git integration;
a build of edited source may deliberately differ from the original.

```js
import assert from "node:assert/strict";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { executeSourceOperation } from "@uttori/asm-cli/source";
import { loadAnalysisProjectViewSnapshot, sourceGit, RomImage } from "@uttori/asm-disassembler";

const [romArgument, directoryArgument] = process.argv.slice(2);
if (!romArgument || !directoryArgument) {
  throw new Error("Usage: node analysis-workflow.mjs ROM NEW_DIRECTORY");
}
const rom = path.resolve(romArgument);
const root = path.resolve(directoryArgument);
mkdirSync(root); // Refuse to replace an existing workspace.
const directory = path.join(root, "source");
await executeSourceOperation({ action: "init", directory, rom, mapper: "lorom" });
const file = path.join(directory, ".uttori/research/decisions.json");
const research = JSON.parse(readFileSync(file, "utf8"));
research.decisions.push(
  {
    collection: "evidence",
    id: "manual.review",
    value: {
      id: "manual.review",
      source: "manual",
      sourceId: "reviewed-entry",
      confidence: "certain",
      detail: "Reviewed the first ROM content byte.",
    },
  },
  {
    collection: "labels",
    id: "manual.reviewed-start",
    value: {
      id: "manual.reviewed-start",
      name: "ReviewedStart",
      sourceName: "ReviewedStart",
      addressSpace: "rom.file",
      address: 0,
      evidence: ["manual.review"],
    },
  },
);
writeFileSync(file, JSON.stringify(research, null, 2) + "\n");
await sourceGit(directory, ["add", ".uttori/research/decisions.json"]);
await sourceGit(directory, ["commit", "-m", "Name the reviewed entry"]);
await executeSourceOperation({ action: "analyze", directory });
const prepared = await executeSourceOperation({ action: "prepare", directory });
const candidate = prepared.generation.commit;
const preview = await executeSourceOperation({ action: "preview", directory, candidate });
assert.equal(preview.conflicts.length, 0, "Resolve conflicts through the normal Git workflow.");
await executeSourceOperation({ action: "apply", directory, candidate });
await executeSourceOperation({ action: "finish", directory });
const built = await executeSourceOperation({ action: "build", directory });
// Source builds contain cartridge bytes; a copier header is private input metadata.
assert.equal(built.verification.outputSha256, RomImage.load(rom).identity.contentSha256);

const evidence = path.join(directory, ".uttori-local/evidence");
assert.ok(
  loadAnalysisProjectViewSnapshot(evidence).view.labels.some(
    ({ name }) => name === "ReviewedStart",
  ),
);
// These operations close their connections. Stop every other database user before offline copying,
// and include the whole evidence directory, including any WAL. Use SQLite backup for a live store.
cpSync(evidence, path.join(root, "restored"), {
  recursive: true,
  errorOnExist: true,
  force: false,
});
console.log(`Byte-identical rebuild: ${built.outputFile}`);
```

Edit assembly and assets normally, review and commit them with Git, and repeat prepare/preview/apply/finish
when analysis changes. Preview accepts uncommitted edits; applying requires the reviewed checkpoint.
Use native conflict resolution and then `source finish` to validate. Pure generations are immutable.
VS Code's source commands, F2 and research actions produce ordinary files and native Undo operations.

Research documents have no implicit size, count or directory-depth budget. To impose resource ceilings,
set positive safe integers under `limits` in `.uttori/project.json`: `researchDocumentBytes` limits each
JSON document's UTF-8 bytes, `researchBytes` limits their combined bytes, and `researchFiles` limits
the selected JSON file count. Omit a field to leave it unrestricted. CLI commands, editor queries and
unsaved research buffers use the same policy. A limit error identifies the input path, actual amount,
configured ceiling and configuration field to adjust. Missing inputs and malformed documents report
separate errors. Grouping research by subject or bank remains an organizational choice.

A Git clone retains source, research and accepted generation ancestry. Back up the private original ROM
and imported evidence separately, outside the working disk. Rebind `.uttori-local/project.json` after
cloning. ACT2 archives and complete context directories are temporary import inputs; remove them
at your discretion after successful import. Analysis, generation and queries use the imported
evidence. Catalog hashes do not promise an archive is available, so preserve the evidence store
instead of assuming it can be reconstructed from original recordings.
Do not replace an open database or delete its WAL. [SQLite WAL handling](https://www.sqlite.org/wal.html#the_wal_file).

Cancellation is cooperative; interrupted generation leaves source and staging intact. `source clean`
reclaims proven-owned scratch. Database transactions must be synchronous; throwing rolls back SQLite,
not unrelated filesystem writes. See [transactions and recovery](API.md).
