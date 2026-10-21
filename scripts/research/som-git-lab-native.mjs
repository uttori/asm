/** Native capture adapter for the isolated regeneration lab; original inputs remain read-only. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { verifyCaptureContext, readCaptureFileHeader } from "@uttori/asm-capture";
import {
  importRuntimeTraceSourceIntoProject,
  loadAnalysisProjectViewSnapshot,
  commitAnalysisProjectViewUpdate,
  createRuntimeCaptureSource,
} from "@uttori/asm-disassembler";

/** @typedef {{session:string,start:{masterClock:string},end:{masterClock:string,eventThrough:string}}} ContextBoundaries */

/** Reject arrays and primitives before reading parsed context metadata.
 * @param {unknown} value Parsed JSON value.
 * @returns {value is Record<string, unknown>} Whether named fields can be inspected safely.
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Check the exact boundary fields used to bind this import to the verified archive.
 * @param {unknown} value Parsed boundaries.
 * @returns {value is ContextBoundaries} Whether clocks and terminal sequence are available.
 */
function isBoundaries(value) {
  return (
    isRecord(value) &&
    typeof value.session === "string" &&
    isRecord(value.start) &&
    typeof value.start.masterClock === "string" &&
    isRecord(value.end) &&
    typeof value.end.masterClock === "string" &&
    typeof value.end.eventThrough === "string"
  );
}

/** Verify matching primary/context identities, then atomically import the complete ACT2 stream.
 * @param {string} analysis Native analysis-project directory.
 * @param {string} capture ACT2 archive with a matching context companion.
 * @param {string} rom Original ROM used to establish content identity.
 * @param {string} output Import receipt destination.
 * @returns {Promise<void>} Publishes analysis only after full archive verification.
 */
async function importCapture(analysis, capture, rom, output) {
  const romContentSha256 = createHash("sha256").update(readFileSync(rom)).digest("hex");
  const header = await readCaptureFileHeader(capture);
  assert.equal(header.romContentSha256, romContentSha256);
  await verifyCaptureContext(`${capture}.context`, {
    romContentSha256,
    producer: header.producer,
  });
  /** @type {unknown} Hash verification does not establish the shape of parsed JSON. */
  const manifest = JSON.parse(readFileSync(`${capture}.context/manifest.json`, "utf8"));
  assert(isRecord(manifest) && isBoundaries(manifest.boundaries));
  assert.equal(manifest.archive, path.basename(capture));
  assert.equal(manifest.boundaries.session, header.session);
  const expectedThrough = manifest.boundaries.end.eventThrough;
  /** @type {unknown} Boundary fields must be checked before clock comparisons. */
  const boundaries = JSON.parse(readFileSync(`${capture}.context/boundaries.json`, "utf8"));
  assert(isBoundaries(boundaries));
  assert.deepEqual(boundaries, manifest.boundaries);
  /** @type {Array<'start' | 'end'>} Both paused endpoints must match the independently stored clocks. */
  const endpoints = ["start", "end"];
  for (const endpoint of endpoints) {
    assert.equal(
      readFileSync(`${capture}.context/${endpoint}-clock.txt`, "utf8").trim(),
      boundaries[endpoint].masterClock,
    );
  }
  const source = await createRuntimeCaptureSource(capture);
  let lastSequence = 0;
  /** @type {import('../../packages/disassembler/src/runtime/runtime-trace.js').RuntimeTraceSource} */
  const verifiedSource = {
    metadata: source.metadata,
    read: async (accept) => {
      await source.read((chunk) => {
        // Reader contracts expose unknown chunks; verify the fields used for the terminal join.
        assert(
          isRecord(chunk) &&
            typeof chunk.sequenceStart === "number" &&
            Array.isArray(chunk.addresses),
        );
        lastSequence = chunk.sequenceStart + chunk.addresses.length - 1;
        accept(chunk);
      });
      // The importer publishes only after this reader returns successfully.
      assert.equal(String(lastSequence), expectedThrough);
    },
  };
  const result = await importRuntimeTraceSourceIntoProject(
    verifiedSource,
    analysis,
    {
      projectRomContentSha256: romContentSha256,
      sourceName: path.basename(capture),
      indexMode: "full",
    },
    { onStage: (message) => console.log(message) },
  );
  const { execution, ...compact } = result;
  writeFileSync(
    output,
    JSON.stringify(
      {
        header,
        verifiedContext: true,
        eventThrough: String(lastSequence),
        executionSeeds: execution.length,
        ...compact,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      added: result.added,
      executionSeeds: execution.length,
      warnings: result.warnings,
    }),
  );
}

/** Install only the independently bounded nine-word chest effect table as native data.
 * @param {string} analysis Native analysis-project directory.
 * @param {string} romPath Original ROM supplying receipt bytes.
 * @param {string} output Metadata receipt destination.
 * @returns {void} Commits declarations without changing ROM bytes.
 */
function seedMetadata(analysis, romPath, output) {
  const snapshot = loadAnalysisProjectViewSnapshot(analysis);
  const rom = readFileSync(romPath);
  const start = 0x8e259,
    end = 0x8e26b;
  /** @type {import('../../packages/disassembler/src/model/project-types.js').EvidenceRecord} */
  const evidence = {
    id: "lab.chest-effects",
    source: "manual",
    sourceId: "git-regeneration-experiment",
    confidence: "high",
    detail:
      "Nine near pointers bounded by the first target at C8E26B; prior chest research establishes the extent. The annotation declares data and does not change ROM bytes.",
  };
  assert(
    !snapshot.view.annotations.some(
      (item) => item.addressSpace === "rom.file" && item.start < end && item.end > start,
    ),
  );
  /** @type {import('../../packages/disassembler/src/model/project-types.js').IntervalAnnotation[]} */
  const annotations = [
    ...snapshot.view.annotations,
    {
      id: "lab.chest-effects.words",
      addressSpace: "rom.file",
      start,
      end,
      classification: "data16",
      architecture: "snes.65816",
      evidence: [evidence.id],
    },
  ];
  const labels = [
    ...snapshot.view.labels,
    {
      id: "lab.chest-effects.label",
      addressSpace: "rom.file",
      address: start,
      name: "LabChestEffectPointers",
      analysisEntryPoint: false,
      evidence: [evidence.id],
    },
  ];
  const result = commitAnalysisProjectViewUpdate(analysis, snapshot, {
    annotations,
    labels,
    evidence: [...snapshot.view.evidence, evidence],
  });
  writeFileSync(
    output,
    JSON.stringify(
      { start, end, originalBytes: [...rom.subarray(start, end)], revision: result.revision },
      null,
      2,
    ) + "\n",
  );
}

/** Add controlled presentation changes where local edits overlap or raw files must split.
 * @param {string} analysis Native analysis-project directory.
 * @returns {void} Commits label/comment anchors for merge validation.
 */
function stressMetadata(analysis) {
  const snapshot = loadAnalysisProjectViewSnapshot(analysis);
  /** @type {import('../../packages/disassembler/src/model/project-types.js').EvidenceRecord} */
  const evidence = {
    id: "lab.presentation-stress",
    source: "manual",
    sourceId: "git-regeneration-experiment",
    confidence: "certain",
    detail:
      "Controlled merge fixture anchors; names describe positions only, not newly inferred game semantics.",
  };
  const labels = [...snapshot.view.labels];
  /** @type {Array<[number, string]>} Exact ROM offsets and their presentation labels. */
  const anchors = [
    [0x8e261, "LabEffectEntry4"],
    [0x6358, "LabBombTextByte3"],
  ];
  for (const [address, name] of anchors) {
    assert(!labels.some((label) => label.addressSpace === "rom.file" && label.address === address));
    labels.push({
      id: `lab.stress.${address}`,
      addressSpace: "rom.file",
      address,
      name,
      analysisEntryPoint: false,
      evidence: [evidence.id],
    });
  }
  commitAnalysisProjectViewUpdate(analysis, snapshot, {
    labels,
    evidence: [...snapshot.view.evidence, evidence],
    comments: [
      ...snapshot.view.comments,
      {
        id: "lab.mask-comment",
        addressSpace: "rom.file",
        address: 0x8e13d,
        placement: "inline-instruction",
        text: "Mask operand retained from the ROM baseline.",
        evidence: [evidence.id],
      },
    ],
  });
}

/** Retain the captured CPU width at the exact instruction used by the growth control.
 * @param {string} analysis Native analysis-project directory.
 * @param {string} output Captured-width evidence destination.
 * @returns {void} Writes matching CFG records and requires an observed 8-bit accumulator.
 */
function widthEvidence(analysis, output) {
  const snapshot = loadAnalysisProjectViewSnapshot(analysis);
  const records = snapshot.view.analysis
    .filter((record) => record.kind === "cfg-node")
    .filter((record) => record.fileOffset === 0x8e13d)
    .map(({ id, address, fileOffset, bytes, size, mnemonic, mode, incomingState }) => ({
      id,
      address,
      fileOffset,
      bytes,
      size,
      mnemonic,
      mode,
      incomingState,
    }));
  assert(
    records.some(
      (record) =>
        record.id.startsWith("runtime:") &&
        isRecord(record.incomingState.m) &&
        record.incomingState.m.value === 1,
    ),
  );
  writeFileSync(output, JSON.stringify(records, null, 2) + "\n");
}

const [operation, ...args] = process.argv.slice(2);
if (operation === "import") {
  assert.equal(args.length, 4);
  await importCapture(args[0], args[1], args[2], args[3]);
} else if (operation === "seed") {
  assert.equal(args.length, 3);
  seedMetadata(args[0], args[1], args[2]);
} else if (operation === "stress") {
  assert.equal(args.length, 1);
  stressMetadata(args[0]);
} else if (operation === "width-evidence") {
  assert.equal(args.length, 2);
  widthEvidence(args[0], args[1]);
} else {
  throw new Error(`Unknown operation: ${operation}`);
}
