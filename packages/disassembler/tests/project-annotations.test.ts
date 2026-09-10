import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  applyDisassemblyAnnotationEdit,
  revertDisassemblyAnnotationEdit,
  commitAnalysisProjectTransaction,
  loadAnalysisProjectSnapshot,
  writeAnalysisProject,
  projectSourceLabelNames,
  type AnalysisProject,
  type DisassemblyAnnotationEditRequest,
} from "../src/index.js";

const fixture = (): AnalysisProject => ({
  manifest: {
    format: ANALYSIS_PROJECT_FORMAT,
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture",
    rom: new RomImage(new Uint8Array(0x8000)).identity,
    mapping: { mapper: "fixture", source: "override", candidates: [] },
    addressSpaces: [{ id: "cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
  },
  shards: {
    labels: [],
    comments: [
      {
        id: "handwritten",
        addressSpace: "cpu",
        address: 0xc3002c,
        text: "Preserve this",
        evidence: [],
      },
    ],
    annotations: [],
    evidence: [],
    regions: [],
    runtime: [],
    imports: [],
    analysis: [
      {
        id: "node",
        kind: "cfg-node",
        addressSpace: "cpu",
        address: 0xc3002c,
        fileOffset: 0,
        size: 1,
        opcode: 0x8b,
        specificationId: "test",
        mnemonic: "PHB",
        mode: "implied",
        context: [],
        incomingState: {},
        outgoingState: {},
        effectiveAddresses: [],
        entryPoint: "entry",
        evidencePath: [],
        evidence: [],
      },
    ],
  },
});
const request: DisassemblyAnnotationEditRequest = {
  addressSpace: "cpu",
  address: 0xc3002c,
  labelId: "manual.label.entry",
  name: "APU_IPL_Bootstrap",
  comment: "Initialize APU.\nKeep the caller state.",
  inlineComment: "Bootstrap entry",
  instructionCommentId: "manual.comment.entry",
  instructionComment: "Save data bank",
  evidenceId: "manual.evidence.first",
  sourceId: "test.editor",
};
const snapshotFor = (t: { teardown: (callback: () => void) => void }) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotations-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, fixture());
  return { directory, snapshot: loadAnalysisProjectSnapshot(directory) };
};

test("annotation creation, persistence, clearing, and undo preserve identities and prior evidence", (t) => {
  const { directory, snapshot } = snapshotFor(t);
  const applied = applyDisassemblyAnnotationEdit(snapshot, request);
  t.like(applied.project.shards.labels[0], {
    id: request.labelId,
    name: request.name,
    sourceName: request.name,
    analysisEntryPoint: false,
  });
  t.deepEqual(applied.project.shards.analysis, snapshot.shards.analysis);
  commitAnalysisProjectTransaction(directory, snapshot.revision, applied.project);
  const saved = loadAnalysisProjectSnapshot(directory);
  t.is(
    saved.shards.comments.find(({ id }) => id === request.instructionCommentId)?.placement,
    "inline-instruction",
  );
  const cleared = applyDisassemblyAnnotationEdit(saved, {
    ...request,
    name: "APU_Boot",
    comment: "",
    inlineComment: "",
    instructionComment: "",
    evidenceId: "manual.evidence.second",
  });
  t.deepEqual(cleared.project.shards.labels[0].evidence, [
    "manual.evidence.first",
    "manual.evidence.second",
  ]);
  t.deepEqual(cleared.project.shards.comments, snapshot.shards.comments);
  const restored = revertDisassemblyAnnotationEdit(cleared.project, cleared.inverse);
  t.deepEqual(restored.shards, saved.shards);
  t.deepEqual(revertDisassemblyAnnotationEdit(saved, applied.inverse).shards, snapshot.shards);
  t.throws(() => commitAnalysisProjectTransaction(directory, snapshot.revision, applied.project), {
    message: /changed|stale/i,
  });
});

test("annotations reject invalid names, collisions, inline injection, and non-instruction anchors", (t) => {
  const { snapshot } = snapshotFor(t);
  for (const name of ["", "two words", ".local", "0bad", "Foo:\ndb $00"]) {
    t.throws(() => applyDisassemblyAnnotationEdit(snapshot, { ...request, name }));
  }
  t.throws(
    () => applyDisassemblyAnnotationEdit(snapshot, { ...request, inlineComment: "note\ndb $00" }),
    { message: /one line/ },
  );
  t.throws(
    () =>
      applyDisassemblyAnnotationEdit(snapshot, {
        ...request,
        instructionComment: "note\u2028db $00",
      }),
    { message: /control characters/ },
  );
  t.throws(() => applyDisassemblyAnnotationEdit(snapshot, { ...request, address: 0xc3002d }), {
    message: /instruction boundary/,
  });
  t.throws(() => applyDisassemblyAnnotationEdit(snapshot, { ...request, addressSpace: "ram" }), {
    message: /Unknown/,
  });
  const first = applyDisassemblyAnnotationEdit(snapshot, request);
  t.throws(
    () =>
      applyDisassemblyAnnotationEdit(
        { ...snapshot, shards: first.project.shards },
        {
          ...request,
          labelId: "second",
          address: 0xc3002d,
          instructionComment: "",
          evidenceId: "second.evidence",
        },
      ),
    { message: /conflicts/ },
  );
  t.throws(
    () =>
      projectSourceLabelNames([
        { id: "old", name: "Foo", addressSpace: "cpu", address: 1, evidence: [] },
        {
          id: "new",
          name: "L_Foo",
          sourceName: "L_Foo",
          addressSpace: "cpu",
          address: 2,
          evidence: [],
        },
      ]),
    { message: /conflicts/ },
  );
});

test("annotation undo refuses later edits and reused provenance", (t) => {
  const { snapshot } = snapshotFor(t);
  const applied = applyDisassemblyAnnotationEdit(snapshot, request);
  t.throws(
    () =>
      revertDisassemblyAnnotationEdit(
        {
          ...applied.project,
          shards: {
            ...applied.project.shards,
            labels: applied.project.shards.labels.map((label) => ({
              ...label,
              comment: "Later edit",
            })),
          },
        },
        applied.inverse,
      ),
    { message: /records changed/ },
  );
  t.throws(
    () =>
      revertDisassemblyAnnotationEdit(
        {
          ...applied.project,
          shards: {
            ...applied.project.shards,
            comments: [
              ...applied.project.shards.comments,
              {
                id: "other",
                addressSpace: "cpu",
                address: 0,
                text: "Evidence reused",
                evidence: [request.evidenceId],
              },
            ],
          },
        },
        applied.inverse,
      ),
    { message: /another record/ },
  );
});

test("instruction-only annotations leave labels and handwritten comments intact", (t) => {
  const { snapshot } = snapshotFor(t);
  const applied = applyDisassemblyAnnotationEdit(snapshot, {
    addressSpace: request.addressSpace,
    address: request.address,
    instructionCommentId: request.instructionCommentId,
    instructionComment: "Only this instruction",
    evidenceId: request.evidenceId,
    sourceId: request.sourceId,
  });
  t.deepEqual(applied.project.shards.labels, []);
  t.deepEqual(
    revertDisassemblyAnnotationEdit(applied.project, applied.inverse).shards,
    snapshot.shards,
  );
});
