/** Native capture adapter for the isolated regeneration lab; original inputs remain read-only. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  importRuntimeTraceSourceIntoProject, loadAnalysisProjectViewSnapshot,
  commitAnalysisProjectViewUpdate,
} from "@uttori/asm-disassembler";
import { readCaptureFileHeader } from "../../packages/debug-adapter/src/capture-file.ts";
import { verifyCaptureContext } from "../../packages/debug-adapter/src/capture-context.ts";
import { createEditorRuntimeTraceSource } from "../../packages/vscode-extension/src/runtime/trace-source.ts";

/** Verify matching primary/context identities, then atomically import the complete ACT2 stream. */
async function importCapture(analysis, capture, rom, output) {
  const romContentSha256 = createHash("sha256").update(readFileSync(rom)).digest("hex");
  const header = await readCaptureFileHeader(capture);
  assert.equal(header.romContentSha256, romContentSha256);
  await verifyCaptureContext(`${capture}.context`, {
    romContentSha256, producer: header.producer,
  });
  const manifest = JSON.parse(readFileSync(`${capture}.context/manifest.json`, "utf8"));
  assert.equal(manifest.archive, path.basename(capture));
  assert.equal(manifest.boundaries.session, header.session);
  const boundaries = JSON.parse(readFileSync(`${capture}.context/boundaries.json`, "utf8"));
  assert.deepEqual(boundaries, manifest.boundaries);
  for (const endpoint of ["start", "end"]) {
    assert.equal(readFileSync(`${capture}.context/${endpoint}-clock.txt`, "utf8").trim(),
      boundaries[endpoint].masterClock);
  }
  const source = await createEditorRuntimeTraceSource(capture);
  let lastSequence = 0;
  const verifiedSource = {
    metadata: source.metadata,
    read: async accept => {
      await source.read(chunk => {
        lastSequence = chunk.sequenceStart + chunk.addresses.length - 1;
        accept(chunk);
      });
      // The importer publishes only after this reader returns successfully.
      assert.equal(String(lastSequence), manifest.boundaries.end.eventThrough);
    },
  };
  const result = await importRuntimeTraceSourceIntoProject(verifiedSource, analysis, {
    projectRomContentSha256: romContentSha256, sourceName: path.basename(capture), indexMode: "full",
  }, { onStage: message => console.log(message) });
  const { execution, ...compact } = result;
  writeFileSync(output, JSON.stringify({
    header, verifiedContext: true, eventThrough: String(lastSequence),
    executionSeeds: execution.length, ...compact,
  }, null, 2) + "\n");
  console.log(JSON.stringify({ added: result.added, executionSeeds: execution.length, warnings: result.warnings }));
}

/** Install only the independently bounded nine-word chest effect table as native data. */
function seedMetadata(analysis, romPath, output) {
  const snapshot = loadAnalysisProjectViewSnapshot(analysis);
  const rom = readFileSync(romPath);
  const start = 0x8e259, end = 0x8e26b;
  const evidence = {
    id: "lab.chest-effects", source: "manual", sourceId: "git-regeneration-experiment",
    confidence: "high",
    detail: "Nine near pointers bounded by the first target at C8E26B; prior chest research establishes the extent. The annotation declares data and does not change ROM bytes.",
  };
  assert(!snapshot.view.annotations.some(item => item.addressSpace === "rom.file" && item.start < end && item.end > start));
  const annotations = [...snapshot.view.annotations, {
    id: "lab.chest-effects.words", addressSpace: "rom.file", start, end,
    classification: "data16", architecture: "snes.65816", evidence: [evidence.id],
  }];
  const labels = [...snapshot.view.labels, {
    id: "lab.chest-effects.label", addressSpace: "rom.file", address: start,
    name: "LabChestEffectPointers", analysisEntryPoint: false, evidence: [evidence.id],
  }];
  const result = commitAnalysisProjectViewUpdate(analysis, snapshot, {
    annotations, labels, evidence: [...snapshot.view.evidence, evidence],
  });
  writeFileSync(output, JSON.stringify({ start, end, originalBytes: [...rom.subarray(start, end)], revision: result.revision }, null, 2) + "\n");
}

/** Add controlled presentation changes where local edits overlap or raw files must split. */
function stressMetadata(analysis) {
  const snapshot = loadAnalysisProjectViewSnapshot(analysis);
  const evidence = {
    id: "lab.presentation-stress", source: "manual", sourceId: "git-regeneration-experiment",
    confidence: "certain", detail: "Controlled merge fixture anchors; names describe positions only, not newly inferred game semantics.",
  };
  const labels = [...snapshot.view.labels];
  for (const [address, name] of [[0x8e261, "LabEffectEntry4"], [0x6358, "LabBombTextByte3"]]) {
    assert(!labels.some(label => label.addressSpace === "rom.file" && label.address === address));
    labels.push({ id: `lab.stress.${address}`, addressSpace: "rom.file", address,
      name, analysisEntryPoint: false, evidence: [evidence.id] });
  }
  commitAnalysisProjectViewUpdate(analysis, snapshot, {
    labels, evidence: [...snapshot.view.evidence, evidence],
    comments: [...snapshot.view.comments, {
      id: "lab.mask-comment", addressSpace: "rom.file", address: 0x8e13d,
      placement: "inline-instruction", text: "Mask operand retained from the ROM baseline.", evidence: [evidence.id],
    }],
  });
}

/** Retain the captured CPU width at the exact instruction used by the growth control. */
function widthEvidence(analysis, output) {
  const snapshot = loadAnalysisProjectViewSnapshot(analysis);
  const records = snapshot.view.analysis
    .filter(record => record.kind === "cfg-node" && record.fileOffset === 0x8e13d)
    .map(({ id, address, fileOffset, bytes, size, mnemonic, mode, incomingState }) =>
      ({ id, address, fileOffset, bytes, size, mnemonic, mode, incomingState }));
  assert(records.some(record => record.id.startsWith("runtime:") && record.incomingState.m.value === 1));
  writeFileSync(output, JSON.stringify(records, null, 2) + "\n");
}

const [operation, ...args] = process.argv.slice(2);
if (operation === "import") {
  assert.equal(args.length, 4);
  await importCapture(...args);
} else if (operation === "seed") {
  assert.equal(args.length, 3);
  seedMetadata(...args);
} else if (operation === "stress") {
  assert.equal(args.length, 1);
  stressMetadata(...args);
} else if (operation === "width-evidence") {
  assert.equal(args.length, 2);
  widthEvidence(...args);
} else {
  throw new Error(`Unknown operation: ${operation}`);
}
