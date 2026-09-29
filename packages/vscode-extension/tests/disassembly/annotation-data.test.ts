import { createHash } from "node:crypto";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  loadAnalysisProjectSnapshot,
  RomImage,
  publishAnalysisProject,
  type AnalysisProject,
} from "@uttori/asm-disassembler";

import { test } from "../../../../tests/ava-helper.js";
import {
  annotationFileSignature,
  lookupDisassemblyAnnotation,
  saveDisassemblyAnnotation,
} from "../../src/disassembly/annotation-data.js";

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const emptyShards = {
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  imports: [],
  evidence: [],
  runtime: [],
} as const;

const sourceText = "; Generated bank\norg $C3002C\n\nFn_C3002C:\n.a16\n  PHB\n";

const fixtureProject = (): AnalysisProject => ({
  manifest: {
    format: ANALYSIS_PROJECT_FORMAT,
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "snes.sfc",
    rom: new RomImage(new Uint8Array(0x40000)).identity,
    mapping: { mapper: "hirom", source: "override", candidates: [] },
    addressSpaces: [
      { id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 },
      { id: "rom.file", name: "ROM", kind: "file", addressBits: 24 },
    ],
  },
  shards: {
    ...emptyShards,
    analysis: [
      {
        kind: "function",
        id: "function",
        addressSpace: "snes.cpu",
        address: 0xc3002c,
        source: "call",
        evidence: [],
        evidencePath: [],
      },
      {
        kind: "cfg-node",
        id: "node",
        addressSpace: "snes.cpu",
        address: 0xc3002c,
        fileOffset: 0x3002c,
        size: 1,
        opcode: 0x8b,
        specificationId: "snes.65816.phb.implied",
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

test("annotationFileSignature is a filesystem identity and changes when rewritten", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-signature-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "note.txt");
  fs.writeFileSync(file, "one");
  const first = annotationFileSignature(file);
  t.regex(first, /^\d+:\d+:3:\d+:\d+$/);
  fs.writeFileSync(file, "rewritten");
  t.not(annotationFileSignature(file), first);
});

test("lookupDisassemblyAnnotation uses named locations or a current debug map", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-lookup-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = fixtureProject();
  publishAnalysisProject(directory, project);
  const snapshot = loadAnalysisProjectSnapshot(directory);
  const named = lookupDisassemblyAnnotation(snapshot, { maps: [] });
  t.true(named.choices.some((choice) => choice.location.address === 0xc3002c));
  t.throws(
    () =>
      lookupDisassemblyAnnotation(
        { ...snapshot, shards: { ...snapshot.shards, ...emptyShards } },
        { maps: [] },
      ),
    { message: /No native labels or function candidates exist/ },
  );

  const source = path.join(directory, "bank.asm");
  fs.writeFileSync(source, sourceText);
  const payload = {
    format: "uttori-asm-debug-map",
    schemaVersion: 1,
    target: project.manifest.target,
    output: { size: project.manifest.rom.contentSize, sha256: project.manifest.rom.contentSha256 },
    sources: [
      { id: 0, path: "bank.asm", size: sourceText.length, crc32: 0, sha256: hash(sourceText) },
    ],
    ranges: [
      {
        sourceId: 0,
        line: 6,
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        start: 0xc3002c,
        end: 0xc3002d,
        outputStart: 0x3002c,
        outputEnd: 0x3002d,
      },
    ],
  };
  const mapFile = path.join(directory, "main.debug.json");
  fs.writeFileSync(
    mapFile,
    JSON.stringify({
      ...payload,
      fingerprint: { algorithm: "sha256", value: hash(canonicalJson(payload)) },
    }),
  );
  const mapped = lookupDisassemblyAnnotation(snapshot, {
    maps: [{ file: mapFile, sourceRoots: [directory] }],
    source: { file: source, sha256: hash(sourceText), line: 6, column: 2 },
  });
  t.true(mapped.choices.some((choice) => choice.location.address === 0xc3002c));
  t.is(mapped.sourceFile, source);
});

test("saveDisassemblyAnnotation rejects stale revisions and changed source bytes", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-save-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  publishAnalysisProject(directory, fixtureProject());
  const snapshot = loadAnalysisProjectSnapshot(directory);
  const source = path.join(directory, "bank.asm");
  fs.writeFileSync(source, sourceText);
  const request = {
    addressSpace: "snes.cpu",
    address: 0xc3002c,
    evidenceId: "manual.annotation",
    sourceId: "test",
  };
  t.throws(
    () =>
      saveDisassemblyAnnotation(directory, snapshot, {
        revision: { ...snapshot.revision, manifestSha256: "f".repeat(64) },
        request,
      }),
    { message: /analysis project changed/ },
  );
  t.throws(
    () =>
      saveDisassemblyAnnotation(directory, snapshot, {
        revision: snapshot.revision,
        request,
        sourceFile: source,
        sourceHash: "0".repeat(64),
      }),
    { message: /source changed/ },
  );
});
