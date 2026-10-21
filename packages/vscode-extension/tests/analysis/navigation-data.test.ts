import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  type AnalysisControlFlowNodeRecord,
  type AnalysisProjectSnapshot,
} from "@uttori/asm-disassembler";

import { test } from "../../../../tests/ava-helper.js";
import { projectAnalysisNavigation } from "../../src/analysis/navigation-data.js";

test("navigation projects a bounded window with exact architecture, saved bytes and visible memory evidence", (t) => {
  const nodes: AnalysisControlFlowNodeRecord[] = Array.from({ length: 100 }, (_, address) => ({
    id: `node:${address}`,
    kind: "cfg-node",
    addressSpace: "cpu",
    address,
    fileOffset: address,
    size: 2,
    opcode: 0xa9,
    specificationId: "fixture.lda",
    mnemonic: "LDA",
    mode: "immediate",
    context: [],
    incomingState: {},
    outgoingState: {},
    effectiveAddresses: [],
    entryPoint: "fixture",
    evidencePath: [],
    evidence: [],
  }));
  const project: Pick<AnalysisProjectSnapshot, "manifest" | "shards"> = {
    manifest: {
      format: ANALYSIS_PROJECT_FORMAT,
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: "fixture",
      rom: new RomImage(new Uint8Array(1024), { headerSize: 0 }).identity,
      mapping: { mapper: "fixture", source: "override", candidates: [] },
      addressSpaces: [
        { id: "cpu", name: "CPU", kind: "cpu", addressBits: 24 },
        { id: "ram", name: "RAM", kind: "memory", addressBits: 16 },
        { id: "rom.file", name: "ROM", kind: "file", addressBits: 24 },
      ],
    },
    shards: {
      analysis: [
        ...nodes,
        {
          ...nodes[50],
          id: "foreign-architecture",
          specificationId: "foreign.lda",
          mnemonic: "WRONG_CPU",
        },
        { ...nodes[50], id: "foreign-space", addressSpace: "ram", mnemonic: "WRONG_SPACE" },
      ],
      annotations: [
        {
          id: "file-state",
          addressSpace: "rom.file",
          start: 50,
          end: 52,
          classification: "opcode",
          architecture: "fixture",
          state: { m: true },
          evidence: [],
        },
      ],
      labels: [],
      comments: [],
      regions: [],
      imports: [],
      evidence: [],
      runtime: [
        {
          id: "captured",
          kind: "runtime-instruction",
          architecture: "fixture",
          addressSpace: "cpu",
          address: 50,
          bytes: [0xa9, 0x42],
          state: {},
          count: 2,
          evidence: [],
        },
        {
          id: "memory",
          kind: "runtime-memory-access",
          architecture: "fixture",
          instructionAddressSpace: "cpu",
          instructionAddress: 50,
          accessedAddressSpace: "ram",
          accessedAddress: 0x10,
          access: "write",
          width: 1,
          count: 3,
          value: 0x42,
          evidence: [],
        },
      ],
    },
  };
  const target = {
    projectDirectory: "/fixture",
    target: "fixture",
    romContentSha256: project.manifest.rom.contentSha256,
    romContentSize: 1024,
    addressSpace: "cpu",
    address: 50,
    outputOffsets: [50],
    architectureHints: ["fixture"],
    recordIds: [],
  };
  const projection = projectAnalysisNavigation(project, target);
  t.is(projection.lines.length, 34, "32 CFG instructions and one saved variant with its heading");
  t.false(projection.capturedRam);
  const content = projection.lines.join("\n");
  t.false(content.includes("WRONG_"));
  t.true(content.includes("A9 ??"), "unknown operands are never invented from the ROM");
  t.true(content.includes("A9 42"), "execution-time byte values remain visible");
  t.regex(content, /W ram:\$0010=\$0042/, "memory evidence survives the bounded projection");
  t.throws(() => projectAnalysisNavigation(project, { ...target, romContentSize: 1 }), {
    message: /no longer matches/,
  });
  const ram = projectAnalysisNavigation(
    {
      ...project,
      shards: {
        ...project.shards,
        analysis: [],
        runtime: [
          {
            id: "ram",
            kind: "runtime-instruction",
            architecture: "fixture",
            addressSpace: "ram",
            address: 50,
            bytes: [0x60],
            state: {},
            count: 1,
            evidence: [],
          },
        ],
      },
    },
    { ...target, addressSpace: "ram", outputOffsets: [] },
  );
  t.true(ram.capturedRam, "saved RAM instructions must be preferred to changed live memory");
  t.regex(ram.lines.join("\n"), /ram\|0x32  60/);
});
