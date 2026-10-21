import type { AnalysisControlFlowNodeRecord, ProjectLabel } from "@uttori/asm-disassembler";

import { NesCartridge } from "../../src/nes/cartridge.js";
import { nesResearchMapper } from "../../src/nes/research.js";

/** Fixed NROM candidates with duplicate contexts, observed overlaps and displaced static decodes. */
export function sourceExportFixture(count: number): {
  rom: NesCartridge;
  nodes: AnalysisControlFlowNodeRecord[];
  labels: ProjectLabel[];
} {
  const bytes = new Uint8Array(16 + 32768).fill(0xea);
  bytes.fill(0, 0, 16);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 2]);
  const nodes: AnalysisControlFlowNodeRecord[] = [];
  const labels: ProjectLabel[] = [];
  const mapper = nesResearchMapper();
  for (let index = 0; index < count; index++) {
    const offset = index * 4;
    bytes.set([0xad, 0x00, 0x81], 16 + offset);
    const id = `nes:runtime:${index}`;
    const node: AnalysisControlFlowNodeRecord = {
      id,
      kind: "cfg-node",
      addressSpace: "nes.cpu",
      address: 0x8000 + offset,
      fileOffset: offset,
      size: 3,
      opcode: 0xad,
      specificationId: "65xx.2a03.lda.absolute",
      mnemonic: "LDA",
      mode: "absolute",
      context: [],
      incomingState: { mapper },
      outgoingState: {},
      effectiveAddresses: [],
      entryPoint: id,
      evidencePath: [],
      evidence: [],
    };
    nodes.push(node);
    if (index % 17 === 0) {
      nodes.push({ ...node, id: `${id}:alias`, context: [0x9000] });
    }
    if (index % 31 === 0) {
      nodes.push({ ...node, id: `static:${index}`, fileOffset: offset + 1, size: 1 });
    }
    if (index % 127 === 0) {
      nodes.push({ ...node, id: `${id}:overlap`, fileOffset: offset + 1, size: 1 });
    }
    if (index % 8 === 0) {
      labels.push({
        id: `label:${index}`,
        addressSpace: "nes.file",
        address: offset,
        name: `Routine${index}`,
        evidence: [],
        comment: `Original physical entry ${index}.`,
      });
    }
  }
  return { rom: new NesCartridge(bytes), nodes, labels };
}
