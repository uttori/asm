# Trace import

Trace imports add runtime evidence to an existing analysis project. They do not prove that every
reachable instruction or data structure has been found. The importer reads a capture without
modifying, moving, or deleting it. Retained evidence does not need the original afterward; keep it
only to reprocess information that was not imported, such as registers omitted by `analysis`.

## Import an instruction trace

Install `@uttori/asm-disassembler` and run this as `import-trace.mjs` with Node 26 or newer:

```js
import {
  importRuntimeTraceIntoProject,
  loadAnalysisProjectViewSnapshot,
} from "@uttori/asm-disassembler";

const [directory, file] = process.argv.slice(2);
const { manifest } = loadAnalysisProjectViewSnapshot(directory);
const controller = new AbortController();
const cancel = () => controller.abort(new Error("Import cancelled"));
process.once("SIGINT", cancel);
try {
  const result = await importRuntimeTraceIntoProject(
    file,
    directory,
    {
      projectRomContentSha256: manifest.rom.contentSha256,
      sourceName: file,
      indexMode: "analysis",
    },
    {
      signal: controller.signal,
      maxBytes: 2 * 1024 ** 3,
      onStage: (message) => console.error(message),
    },
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  process.removeListener("SIGINT", cancel);
}
```

Run `node import-trace.mjs /path/to/analysis /path/to/trace.json`. The input is an
`uttori-asm-instruction-trace` JSON artifact with schema version 1 or an ACT2 instruction archive.
Its ROM hash must match the project's headerless content hash. Architecture and address-space names
must already match the project. The importer does not translate recorder addresses.

A Git source project's evidence store has indexed research. Library imports into it must pass the
matching `research` snapshot; otherwise they are rejected. Use `uttori-asm source import <project>
<capture...>` instead, which pins research, uses `analysis` retention and records the archive identity
in the Git capture catalog.

For decoded capture streams, use `importRuntimeTraceSourceIntoProject(source, directory, context,
options)`. The source supplies validated metadata and `read(accept)`, calls `accept` synchronously
for each ordered chunk, and resolves only after terminal integrity checks. A late producer error
rejects the import. The importer owns and closes its database connection. It does not dispose the
source or retain its chunks.

## Limits and retained data

| Limit                                     | Default                   | Meaning                                                                           |
| ----------------------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| File `maxBytes`                           | 32 GiB                    | Whole input file, positive safe integer                                           |
| SQLite project `maxIndexRecords`          | `Number.MAX_SAFE_INTEGER` | No fixed record ceiling; storage and input budgets still apply                    |
| In-memory `maxIndexRecords`, full profile | 8,000,000                 | Distinct aggregate index records                                                  |
| Explicit `maxIndexRecords`                | Caller supplied           | Positive safe integer; maximum 8M when counters or final records remain in memory |

Records are derived facts, not input instructions: each distinct PC counts once, each joint
PC/bytes/state variant counts twice (instruction and CPU-state records), and each distinct bus
observation counts once. Repeated observations increment counts without consuming more records.
Full register snapshots can therefore produce millions of records even at a small set of PCs.
File size and invalid budget values are checked before reading the body. An explicit record budget
can only be enforced as distinct facts are discovered; exceeding it aborts the import without
publishing partial evidence. Raising the input-byte limit does not raise an explicit record budget.

A custom source must enforce its own input-byte budget. Chunk validation, sequence ordering,
cumulative loss counts, ROM identity, and index limits still apply. Progress callbacks run
synchronously and should return quickly.

`source import` always uses `analysis`; `evidence-import` defaults to it and accepts
`--trace-index full`. For SNES `analysis` retains joint PC/opcode-byte
variants with the decoder's P width bits, E, DB and D (including aliases and unknown values),
exact observation totals and all supported memory facts. It consolidates snapshots that differ
only in other registers or arithmetic flags. The versioned receipt is `65816-analysis-v3`.
Other architectures retain full snapshots. The library's omitted `indexMode` remains `full` for
compatibility; select `analysis` explicitly for compact retention.

`full` retains every supplied register. Both modes hash the complete validated input, including
omitted registers. JSON whitespace does not create a new capture, and repeating an import does not
double counts. Capture hashes identify historical input; retained analysis works without the archive.

Use `uttori-asm project-compact <analysis-directory> --analysis-only` to consolidate an existing
SNES database without its original archives. The operation verifies a staging database, then swaps
runtime tables in one transaction and VACUUMs live pages. It preserves metadata, research shadows,
memory evidence and exact counts, while discarding registers outside the analysis profile. It needs
temporary space for compact runtime tables and twice the remaining live database size. Refresh a Git
source project's capture catalog afterward with `uttori-asm source catalog <source-project>`.
An interrupted table publication rolls back; an interrupted post-commit VACUUM can be retried with
ordinary `project-compact` without repeating retention. Historical receipts remain readable.

Storage policy controls disposable projections and the live SQLite page ceiling independently of
parser input and index limits. Imports preserve prior evidence. Exact no-op imports do not run VACUUM. See [project storage](API.md).

## Cancellation and failure recovery

Cancellation is cooperative at read, chunk, record, and publication boundaries. It cannot preempt a
synchronous SQLite operation or callback. Before publication, cancellation, malformed input, stale
revisions, and conflicting records leave runtime facts and the semantic revision unchanged.
Instruction import saves an explicit storage-policy change before indexing. That change can remain
if the import fails. Bus import saves its policy with publication.

After the database commits, updating `analysis.json` can still fail. Reopen the project to inspect
its saved revision and evidence before retrying. Successful repeat imports preserve counts and the
semantic revision but refresh the import receipt. Post-commit maintenance failures are returned as
warnings. An error is not a promise that every file and setting stayed unchanged.

## Static analysis

Static analysis runs synchronously. It has no `AbortSignal` and does not perform file I/O.
The default work budget is 1,000,000 items, and call-context depth defaults to 16. A result with
`status: "incomplete"` records a budget limit. Do not present it as complete coverage. Decoder state
must remain conservative at joins. Preserve ambiguous paths and unknown bytes when exporting source.
For SNES workflows and editable RAM/structure metadata, see the [SNES manual](../plugin-snes/MANUAL.md#65816-source-export).
