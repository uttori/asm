import { test } from "../../../../tests/ava-helper.js";
import {
  buildRomCoverageMap,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
} from "../../src/index.js";

const manifest = (contentSize = 16): Pick<AnalysisProjectManifest, "addressSpaces" | "rom"> => ({
  addressSpaces: [
    { id: "rom.file", name: "ROM", addressBits: 24, kind: "file" },
    { id: "snes.cpu", name: "SNES CPU", addressBits: 24, kind: "cpu" },
  ],
  rom: {
    sha256: "0".repeat(64),
    contentSha256: "1".repeat(64),
    fileSize: contentSize,
    contentSize,
    headerSize: 0,
  },
});

const emptyShards = (): AnalysisProjectShards => ({
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  runtime: [],
  evidence: [],
  imports: [],
});

test("ROM coverage coalesces classifications, conflicts, regions, and runtime overlays", (t) => {
  const shards = emptyShards();
  const map = buildRomCoverageMap(manifest(), {
    ...shards,
    annotations: [
      {
        id: "annotation:data",
        addressSpace: "rom.file",
        start: 8,
        end: 13,
        classification: "data8",
        architecture: "snes.65816",
        evidence: [],
      },
      {
        id: "annotation:asset",
        addressSpace: "rom.file",
        start: 12,
        end: 16,
        classification: "graphics",
        architecture: "snes.65816",
        evidence: [],
      },
    ],
    regions: [
      {
        id: "region:bank",
        addressSpace: "rom.file",
        start: 8,
        end: 16,
        name: "Bank",
        evidence: [],
      },
    ],
    analysis: [
      {
        id: "node:2",
        kind: "cfg-node",
        addressSpace: "snes.cpu",
        address: 0x808002,
        fileOffset: 2,
        size: 3,
        opcode: 0xa9,
        specificationId: "snes.65816.lda-immediate",
        mnemonic: "LDA",
        mode: "immediate",
        context: [],
        incomingState: {},
        outgoingState: {},
        effectiveAddresses: [],
        entryPoint: "fixture",
        evidencePath: [],
        evidence: [],
      },
      {
        id: "conflict:9",
        kind: "conflict",
        addressSpace: "rom.file",
        address: 9,
        conflictKind: "fixture",
        message: "Conflicting evidence",
        nodes: [],
        evidence: [],
      },
    ],
    runtime: [
      {
        id: "runtime:execution",
        kind: "runtime-execution",
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        address: 0x808002,
        fileOffset: 2,
        size: 3,
        count: 2,
        evidence: [],
      },
      {
        id: "runtime:read",
        kind: "runtime-coverage",
        architecture: "snes.65816",
        addressSpace: "rom.file",
        start: 10,
        end: 14,
        coverage: "read",
        count: 1,
        evidence: [],
      },
    ],
  });

  t.deepEqual(
    map.segments.map(({ start, end, status, classifications, runtime }) => ({
      start,
      end,
      status,
      classifications,
      runtime,
    })),
    [
      { start: 0, end: 2, status: "unknown", classifications: ["unknown"], runtime: [] },
      {
        start: 2,
        end: 3,
        status: "classified",
        classifications: ["opcode"],
        runtime: ["executed"],
      },
      {
        start: 3,
        end: 5,
        status: "classified",
        classifications: ["operand"],
        runtime: ["operand"],
      },
      { start: 5, end: 8, status: "unknown", classifications: ["unknown"], runtime: [] },
      { start: 8, end: 9, status: "classified", classifications: ["data"], runtime: [] },
      { start: 9, end: 10, status: "conflict", classifications: ["data"], runtime: [] },
      {
        start: 10,
        end: 12,
        status: "classified",
        classifications: ["data"],
        runtime: ["read"],
      },
      {
        start: 12,
        end: 13,
        status: "conflict",
        classifications: ["data", "asset"],
        runtime: ["read"],
      },
      {
        start: 13,
        end: 14,
        status: "classified",
        classifications: ["asset"],
        runtime: ["read"],
      },
      { start: 14, end: 16, status: "classified", classifications: ["asset"], runtime: [] },
    ],
  );
  t.deepEqual(map.summary, {
    totalBytes: 16,
    classifiedBytes: 9,
    unknownBytes: 5,
    conflictBytes: 2,
    segmentCount: 10,
    bytesByClassification: { opcode: 1, operand: 2, data: 5, asset: 4, unknown: 5 },
    bytesByRuntimeCoverage: { executed: 1, operand: 2, read: 4, written: 0 },
  });
  t.deepEqual(map.segments.find(({ start }) => start === 12)?.regionIds, ["region:bank"]);
  t.deepEqual(map.segments.find(({ start }) => start === 9)?.conflictIds, ["conflict:9"]);
  t.deepEqual(map.unprojected, []);
  t.deepEqual(map.diagnostics, []);
});

test("ROM coverage reports unprojectable records and clips explicit file offsets", (t) => {
  const shards = emptyShards();
  const map = buildRomCoverageMap(manifest(), {
    ...shards,
    annotations: [
      {
        id: "annotation:cpu",
        addressSpace: "snes.cpu",
        start: 0x808000,
        end: 0x808001,
        classification: "opcode",
        architecture: "snes.65816",
        evidence: [],
      },
      {
        id: "annotation:clipped",
        addressSpace: "rom.file",
        start: 14,
        end: 20,
        classification: "text",
        architecture: "snes.65816",
        evidence: [],
      },
    ],
    analysis: [
      {
        id: "conflict:cpu",
        kind: "conflict",
        addressSpace: "snes.cpu",
        address: 0x808000,
        conflictKind: "fixture",
        message: "No projected node",
        nodes: ["missing"],
        evidence: [],
      },
    ],
    runtime: [
      {
        id: "runtime:no-offset",
        kind: "runtime-execution",
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        address: 0x808000,
        count: 1,
        evidence: [],
      },
      {
        id: "runtime:cpu-coverage",
        kind: "runtime-coverage",
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        start: 0x808000,
        end: 0x808001,
        coverage: "executed",
        count: 1,
        evidence: [],
      },
    ],
  });

  t.deepEqual(
    map.unprojected.map(({ kind, id, reason }) => ({ kind, id, reason })),
    [
      { kind: "analysis", id: "conflict:cpu", reason: "missing-file-offset" },
      { kind: "annotation", id: "annotation:cpu", reason: "non-file-address-space" },
      { kind: "runtime", id: "runtime:cpu-coverage", reason: "non-file-address-space" },
      { kind: "runtime", id: "runtime:no-offset", reason: "missing-file-offset" },
    ],
  );
  t.deepEqual(map.diagnostics, [
    {
      recordId: "annotation:clipped",
      message: "Clipped coverage range [14, 20) to ROM content [14, 16).",
    },
  ]);
  t.deepEqual(
    map.segments.map(({ start, end, status, classifications }) => ({
      start,
      end,
      status,
      classifications,
    })),
    [
      { start: 0, end: 14, status: "unknown", classifications: ["unknown"] },
      { start: 14, end: 16, status: "classified", classifications: ["data"] },
    ],
  );
});

test("ROM coverage rejects invalid content sizes and handles empty images", (t) => {
  t.throws(
    () =>
      buildRomCoverageMap(
        { ...manifest(), rom: { ...manifest().rom, contentSize: Number.NaN } },
        emptyShards(),
      ),
    { message: "ROM coverage requires a non-negative safe content size." },
  );
  const empty = buildRomCoverageMap(manifest(0), emptyShards());
  t.deepEqual(empty.segments, []);
  t.deepEqual(empty.summary, {
    totalBytes: 0,
    classifiedBytes: 0,
    unknownBytes: 0,
    conflictBytes: 0,
    segmentCount: 0,
    bytesByClassification: { opcode: 0, operand: 0, data: 0, asset: 0, unknown: 0 },
    bytesByRuntimeCoverage: { executed: 0, operand: 0, read: 0, written: 0 },
  });
});
