# Trace import

Trace imports add runtime evidence to an existing analysis project. They do not prove that every
reachable instruction or data structure has been found. Keep the original capture if you need to
reprocess it. The importer reads it without modifying, moving, or deleting it.

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
      indexMode: "65816-analysis",
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
`uttori-asm-instruction-trace` JSON artifact with schema version 1. Its ROM hash must match the
project's headerless content hash. Architecture and address-space names must already match the project. The importer does not
translate recorder addresses.

For decoded capture streams, use `importRuntimeTraceSourceIntoProject(source, directory, context,
options)`. The source supplies validated metadata and `read(accept)`, calls `accept` synchronously
for each ordered chunk, and resolves only after terminal integrity checks. A late producer error
rejects the import. The importer owns and closes its database connection. It does not dispose the
source or retain its chunks.

## Limits and retained data

| Limit                                    | Default     | Meaning                                 |
| ---------------------------------------- | ----------- | --------------------------------------- |
| File `maxBytes`                          | 2 GiB       | Whole input file, positive safe integer |
| Context `maxIndexRecords`, full profile  | 8,000,000   | Distinct aggregate index records        |
| Context `maxIndexRecords`, 65816 profile | 2,000,000   | Distinct aggregate index records        |
| Explicit `maxIndexRecords`               | 1–8,000,000 | Record budget, not a heap-byte limit    |

A custom source must enforce its own input-byte budget. Chunk validation, sequence ordering,
cumulative loss counts, ROM identity, and index limits still apply. Progress callbacks run
synchronously and should return quickly.

The `65816-analysis` profile is the default for native SNES CPU captures. It normalizes aliases
and retains instruction bytes with P width bits, E, D, and DB. `65816-disassembly` retains the
selected decoding registers without that normalization. Both omit A/X/Y/S register history and
retain supported memory observations. `full` retains supplied registers and is the default for
other processors. None replaces the original chronological capture. Source identity hashes
canonical validated metadata and chunks, so JSON whitespace does not create a new capture.
Reimporting the same source does not double counts. An existing import under another profile is
reused with a warning. Keep separate projects when comparing profiles.

Storage policy controls retained SQLite import history and maintenance. It is separate from the
parser's input and index limits. Inspect storage before reducing retention, and back up a closed
project before destructive maintenance. See [project storage](API.md).

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
The default work budget is 100,000 items, and call-context depth defaults to 8. A result with
`status: "incomplete"` records a budget limit. Do not present it as complete coverage. Decoder state
must remain conservative at joins. Preserve ambiguous paths and unknown bytes when exporting source.
For SNES workflows and editable RAM/structure metadata, see the [SNES manual](../plugin-snes/MANUAL.md#65816-source-export).
