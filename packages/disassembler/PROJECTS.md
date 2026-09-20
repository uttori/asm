# Create, edit, back up, and verify an analysis project

Requires Node.js 26+ and a SNES LoROM image you can use. Install the published packages:

```sh
npm install @uttori/asm-disassembler @uttori/asm-plugin-snes
```

Save this example as `analysis-workflow.mjs`. Run it with a ROM path and a **new** working directory:

```sh
node analysis-workflow.mjs game.sfc ./review
```

The example explicitly selects LoROM. Change `mapper` for another supported mapping. Copier headers
are detected automatically. Analysis reports unresolved paths and resource limits. Byte-identical
reassembly proves byte preservation, not that every instruction or function was identified.

```js
import assert from "node:assert/strict";
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  RomImage,
  applyDisassemblyAnnotationEdit,
  commitAnalysisProjectAnnotationUpdate,
  loadAnalysisProjectViewSnapshot,
  validateProjectRom,
} from "@uttori/asm-disassembler";
import {
  analyzeSnesProject,
  createSnesAnalysisProject,
  exportSnesProject,
  verifySnesProjectRoundTrip,
} from "@uttori/asm-plugin-snes";

const [romArgument, directoryArgument] = process.argv.slice(2);
if (!romArgument || !directoryArgument) {
  throw new Error("Usage: node analysis-workflow.mjs ROM NEW_DIRECTORY");
}
const romFile = path.resolve(romArgument);
const root = path.resolve(directoryArgument);
mkdirSync(root); // Refuse to replace an existing workspace.
const projectDirectory = path.join(root, "analysis");
const sourceDirectory = path.join(root, "source");
const backupDirectory = path.join(root, "backup");
const restoredDirectory = path.join(root, "restored");

createSnesAnalysisProject({ romFile, projectDirectory, mapper: "lorom" });
const analysis = analyzeSnesProject({ romFile, projectDirectory });
console.log(analysis.status, analysis.incompleteReasons);
exportSnesProject({ romFile, projectDirectory, sourceDirectory });

const snapshot = loadAnalysisProjectViewSnapshot(projectDirectory);
const edit = applyDisassemblyAnnotationEdit(
  { manifest: snapshot.manifest, shards: snapshot.view },
  {
    addressSpace: "rom.file",
    address: 0, // First byte of ROM content, excluding a copier header.
    labelId: "manual.reviewed-start",
    name: "ReviewedStart",
    comment: "Reviewed entry bytes.",
    evidenceId: "manual.reviewed-start.evidence",
    sourceId: "manual-review",
  },
);
commitAnalysisProjectAnnotationUpdate(projectDirectory, snapshot.revision, {
  labels: edit.project.shards.labels,
  comments: edit.project.shards.comments,
  evidence: edit.project.shards.evidence,
});

// These high-level calls close their connections. Offline copying also requires every other
// process/editor using this project to be stopped. Copy the whole directory, including any WAL.
cpSync(projectDirectory, backupDirectory, { recursive: true, errorOnExist: true, force: false });
cpSync(backupDirectory, restoredDirectory, { recursive: true, errorOnExist: true, force: false });
const restored = loadAnalysisProjectViewSnapshot(restoredDirectory);
validateProjectRom(
  restored.manifest,
  RomImage.load(romFile, { headerSize: restored.manifest.rom.headerSize }),
);
assert.ok(restored.view.labels.some(({ name }) => name === "ReviewedStart"));

// Regenerate from the restored edit. Normal regeneration refuses changed generated files.
exportSnesProject({
  romFile,
  projectDirectory: restoredDirectory,
  sourceDirectory,
  expectedRevision: restored.revision.manifestSha256,
});
const verified = await verifySnesProjectRoundTrip({ romFile, sourceDirectory });
assert.equal(verified.comparison.equal, true);
console.log(`Byte-identical rebuild: ${verified.finalOutput}`);
```

For another edit, load a fresh snapshot and use new evidence IDs. `AnalysisProjectStaleError` means
another writer committed first: reload and reapply the intended edit. Never attach a new revision
token to an old replacement. A view omits runtime history. Annotation/view commits preserve it,
whereas full-project writes replace it.

The backup above protects the analysis directory and managed files inside it. Back up the external
ROM, original captures, configuration, and user-owned source/maps separately. Keep backups outside
the working disk for independent recovery. Restore into a new directory, validate the ROM identity,
then export and verify before resuming work. Do not replace an open database or delete its WAL.
[SQLite explains why the WAL must stay with the database](https://www.sqlite.org/wal.html#the_wal_file).

Cancellation is cooperative. SNES operations accept `signal`. Analysis checks it before committing.
Low-level SQLite callbacks must be synchronous: throw on cancellation to roll back database changes.
Database rollback does not undo filesystem writes. An interrupted export may need regeneration.

See [API ownership, transactions, and recovery](https://github.com/uttori/asm/blob/master/packages/disassembler/API.md) for complete versus
selected writes, store lifetime, pointer failures, and durability limits.
