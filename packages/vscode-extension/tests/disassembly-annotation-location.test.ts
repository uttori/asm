import { createHash } from "node:crypto";

import { canonicalDebugMapJson, type DebugMap } from "@uttori/asm-core/debug-map";
import type { AnalysisProjectShards } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  annotationLocationsForSource,
  annotationReferenceAt,
  namedAnnotationLocations,
} from "../src/disassembly-annotation-location.js";

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const source = "; Generated bank\norg $C3002C\n\nFn_C3002C:\n.a16\n  PHB\n";
const emptyShards = {
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  imports: [],
  evidence: [],
  runtime: [],
} as unknown as AnalysisProjectShards;

const map = (): DebugMap => {
  const payload = {
    format: "uttori-asm-debug-map",
    schemaVersion: 1,
    target: "snes.sfc",
    output: { size: 16, sha256: "a".repeat(64) },
    sources: [{ id: 0, path: "bank.asm", size: source.length, crc32: 0, sha256: hash(source) }],
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
  return {
    ...payload,
    fingerprint: { algorithm: "sha256", value: hash(canonicalDebugMapJson(payload)) },
  } as DebugMap;
};

test("annotationReferenceAt ignores definitions and opcodes, keeping symbol operands", (t) => {
  t.is(annotationReferenceAt("Fn_C3002C:\n", 1, 0), undefined);
  t.is(annotationReferenceAt("  PHB\n", 1, 2), undefined);
  t.is(annotationReferenceAt("  JSL.l Fn_C3002C\n", 1, 10), "Fn_C3002C");
  t.is(annotationReferenceAt("  lda #$10 ; Fn_C3002C\n", 1, 16), undefined);
});

test("namedAnnotationLocations prefer labels and synthesize remaining function names", (t) => {
  t.deepEqual(
    namedAnnotationLocations({
      ...emptyShards,
      labels: [
        {
          id: "label",
          addressSpace: "snes.cpu",
          address: 0xc3002c,
          name: "Entry",
          sourceName: "Entry",
          evidence: [],
        },
      ],
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
          kind: "function",
          id: "other",
          addressSpace: "snes.cpu",
          address: 0xc31000,
          source: "call",
          evidence: [],
          evidencePath: [],
        },
      ],
    } as AnalysisProjectShards),
    [
      {
        addressSpace: "snes.cpu",
        address: 0xc3002c,
        labelId: "label",
        name: "Entry",
      },
      {
        addressSpace: "snes.cpu",
        address: 0xc31000,
        name: "Fn_C31000",
      },
    ],
  );
});

test("source selection preserves native file-space labels and mapped instruction identities", (t) => {
  const shards = {
    ...emptyShards,
    labels: [
      {
        id: "file-label",
        addressSpace: "rom.file",
        address: 0x3002c,
        name: "Entry",
        evidence: [],
      },
    ],
    analysis: [
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
  } as AnalysisProjectShards;
  t.deepEqual(
    annotationLocationsForSource(map(), 0, source, 4, 0, shards, new Map([[0, source]]), [
      "rom.file",
    ]),
    [{ labelId: "file-label", addressSpace: "rom.file", address: 0x3002c, name: "L_Entry" }],
  );
  t.deepEqual(
    annotationLocationsForSource(map(), 0, source, 6, 2, shards, new Map([[0, source]])),
    [{ addressSpace: "snes.cpu", address: 0xc3002c }],
  );
});

test("symbol references resolve through mapped definitions after names change or are reused", (t) => {
  const shards = {
    ...emptyShards,
    labels: [
      {
        id: "original",
        addressSpace: "snes.cpu",
        address: 0xc3002c,
        name: "APU_IPL_Bootstrap",
        sourceName: "APU_IPL_Bootstrap",
        evidence: [],
      },
      {
        id: "reused",
        addressSpace: "snes.cpu",
        address: 0xc31000,
        name: "Fn_C3002C",
        sourceName: "Fn_C3002C",
        evidence: [],
      },
    ],
  } as AnalysisProjectShards;
  const reference = "  JSL.l Fn_C3002C\n";
  t.deepEqual(
    annotationLocationsForSource(
      map(),
      1,
      reference,
      1,
      10,
      shards,
      new Map([
        [0, source],
        [1, reference],
      ]),
    ).map(({ address, labelId }) => ({ address, labelId })),
    [{ address: 0xc3002c, labelId: "original" }],
  );
  t.deepEqual(annotationLocationsForSource(map(), 1, reference, 1, 10, shards), []);
  const relocated = "Fn_C3002C:\norg $C31000\n  PHB\n";
  const moved = {
    ...map(),
    ranges: map().ranges.map((range) => ({ ...range, line: 3, start: 0xc31000, end: 0xc31001 })),
  };
  t.deepEqual(annotationLocationsForSource(moved, 0, relocated, 1, 0, shards), []);
});
