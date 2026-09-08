/** Source-first navigation for persisted analysis locations with conservative disassembly fallback. */
import * as path from "node:path";
import { formatDebugAddress } from "@uttori/asm-debug-adapter";
import {
  buildInstructionAnalysisAnnotations,
  loadAnalysisProject,
  type AnalysisControlFlowNodeRecord,
  type InstructionAnalysisAnnotations,
} from "@uttori/asm-disassembler";
import { Position, Selection, TextEditorRevealType, Uri, debug, window, workspace } from "vscode";
import {
  analysisDebugMapRanges,
  currentAnalysisSourcePath,
  findAnalysisDebugMapCandidates,
} from "./analysis-debug-maps.js";
import { formatInstructionAnnotationSummary } from "./analysis-annotation-format.js";
import type { AnalysisGraphNavigationTarget } from "./analysis-graph-tree.js";

interface CurrentSourceLocation {
  readonly file: string;
  readonly line: number;
  readonly architecture: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly mapFile: string;
}

interface DebugMapSearchResult {
  readonly locations: readonly CurrentSourceLocation[];
  readonly architectures: readonly string[];
  readonly staleSources: number;
}

const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const findDebugMapSources = async (
  target: AnalysisGraphNavigationTarget,
): Promise<DebugMapSearchResult> => {
  const locations: CurrentSourceLocation[] = [];
  const architectures: string[] = [...target.architectureHints];
  let staleSources = 0;
  for (const candidate of await findAnalysisDebugMapCandidates(target)) {
    for (const range of analysisDebugMapRanges(candidate.map, target)) {
      architectures.push(range.architecture);
      const source = candidate.map.sources.find(({ id }) => id === range.sourceId);
      if (!source) continue;
      const file = currentAnalysisSourcePath(source, candidate);
      if (!file) {
        staleSources++;
        continue;
      }
      locations.push({
        file,
        line: range.line,
        architecture: range.architecture,
        addressSpace: range.addressSpace,
        address: range.start,
        mapFile: candidate.file,
      });
    }
  }
  const unique = new Map(
    locations.map((location) => [
      `${location.file}:${location.line}:${location.architecture}:${location.addressSpace}:${location.address}`,
      location,
    ]),
  );
  return {
    locations: [...unique.values()].sort(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        left.architecture.localeCompare(right.architecture),
    ),
    architectures: sortedUnique(architectures),
    staleSources,
  };
};

const openSourceLocation = async (
  locations: readonly CurrentSourceLocation[],
): Promise<boolean> => {
  if (locations.length === 0) return false;
  const selected =
    locations.length === 1
      ? locations[0]
      : (
          await window.showQuickPick(
            locations.map((location) => ({
              label: `${path.basename(location.file)}:${location.line}`,
              description: `${location.architecture} · ${location.addressSpace} · ${location.mapFile}`,
              location,
            })),
            {
              title: "Open Analysis Location",
              placeHolder: "Choose an exact current source mapping",
            },
          )
        )?.location;
  if (!selected) return true;
  const document = await workspace.openTextDocument(Uri.file(selected.file));
  const editor = await window.showTextDocument(document, { preview: true });
  const position = new Position(Math.max(0, selected.line - 1), 0);
  editor.selection = new Selection(position, position);
  editor.revealRange(editor.selection, TextEditorRevealType.InCenterIfOutsideViewport);
  return true;
};

const chooseArchitecture = async (
  architectures: readonly string[],
): Promise<string | undefined> => {
  if (architectures.length === 0) return undefined;
  if (architectures.length === 1) return architectures[0];
  return window.showQuickPick(architectures, {
    title: "Open Virtual Disassembly",
    placeHolder: "Choose the persisted architecture identity",
  });
};

const annotationSummaries = (
  projection: InstructionAnalysisAnnotations,
  addressSpace: string,
  address: number,
  outputOffset?: number,
  architecture?: string,
): string =>
  [
    ...new Set(
      projection.instructions
        .filter(
          (annotation) =>
            ((annotation.addressSpace === addressSpace && annotation.address === address) ||
              (outputOffset !== undefined && annotation.outputOffsets.includes(outputOffset))) &&
            (architecture === undefined ||
              annotation.architectures.length === 0 ||
              annotation.architectures.includes(architecture)),
        )
        .map((annotation) => formatInstructionAnnotationSummary(annotation))
        .filter(Boolean),
    ),
  ].join(" | ");

const openLiveDisassembly = async (
  target: AnalysisGraphNavigationTarget,
  architectures: readonly string[],
): Promise<boolean> => {
  const session = debug.activeDebugSession;
  if (!session || session.type !== "uttori-asm") return false;
  const architecture = await chooseArchitecture(architectures);
  if (!architecture) return false;
  try {
    const response = (await session.customRequest("disassemble", {
      memoryReference: formatDebugAddress({
        architecture,
        addressSpace: target.addressSpace,
        address: target.address,
        ...(target.outputOffsets.length === 1 ? { outputOffset: target.outputOffsets[0] } : {}),
      }),
      instructionOffset: 0,
      instructionCount: 32,
    })) as { readonly instructions?: readonly Record<string, unknown>[] };
    const instructions = response.instructions ?? [];
    if (instructions.length === 0) return false;
    const lines = instructions.map((instruction) => {
      const address = typeof instruction.address === "string" ? instruction.address : "?";
      const bytes =
        typeof instruction.instructionBytes === "string" ? instruction.instructionBytes : "";
      const text = typeof instruction.instruction === "string" ? instruction.instruction : "";
      const symbol = typeof instruction.symbol === "string" ? ` ; ${instruction.symbol}` : "";
      return `${address.padEnd(42)} ${bytes.padEnd(16)} ${text}${symbol}`;
    });
    const document = await workspace.openTextDocument({
      language: "uttori-snes",
      content: `; Live virtual disassembly from the active Uttori ASM debug backend\n${lines.join("\n")}\n`,
    });
    await window.showTextDocument(document, { preview: true });
    return true;
  } catch {
    return false;
  }
};

const openPersistedDisassembly = async (
  target: AnalysisGraphNavigationTarget,
  project: ReturnType<typeof loadAnalysisProject>,
  projection: InstructionAnalysisAnnotations,
): Promise<void> => {
  const nodes = project.shards.analysis
    .filter(
      (record): record is AnalysisControlFlowNodeRecord =>
        record.kind === "cfg-node" && record.addressSpace === target.addressSpace,
    )
    .sort((left, right) => left.address - right.address || left.id.localeCompare(right.id));
  let index = nodes.findIndex(({ address }) => address >= target.address);
  if (index < 0) index = Math.max(0, nodes.length - 1);
  const start = Math.max(0, index - 4);
  const visible = nodes.slice(start, start + 32);
  const lines = visible.map((node) => {
    const bytes = node.bytes
      ? node.bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ")
      : [node.opcode.toString(16).toUpperCase().padStart(2, "0")]
          .concat(Array.from({ length: Math.max(0, node.size - 1) }, () => "??"))
          .join(" ");
    const context =
      node.context.length > 0
        ? ` context=${node.context.map((value) => `0x${value.toString(16)}`).join("/")}`
        : "";
    const annotations = annotationSummaries(
      projection,
      node.addressSpace,
      node.address,
      node.fileOffset,
    );
    return `${node.addressSpace}|0x${node.address.toString(16)}  ${bytes.padEnd(16)}  ${node.mnemonic} <${node.mode}> ; ${node.id}${context}${annotations ? ` ; ${annotations}` : ""}`;
  });
  const related = project.shards.analysis.filter(
    (record) =>
      "address" in record &&
      record.addressSpace === target.addressSpace &&
      record.address === target.address &&
      target.recordIds.includes(record.id),
  );
  const header = [
    "; Persisted analysis disassembly (read-only)",
    "; This view renders accepted CFG records; unknown operand bytes remain ?? and are not decoded again.",
    `; Location: ${target.addressSpace}|0x${target.address.toString(16)}`,
    `; Records: ${target.recordIds.join(", ")}`,
    ...(related.length > 0
      ? related.map((record) => `; ${record.kind}: ${JSON.stringify(record)}`)
      : []),
  ];
  const content = `${header.join("\n")}\n${lines.length > 0 ? lines.join("\n") : "; No accepted CFG node exists near this address."}\n`;
  const document = await workspace.openTextDocument({ language: "uttori-snes", content });
  const editor = await window.showTextDocument(document, { preview: true });
  const matchingLine = lines.findIndex((line) =>
    line.startsWith(`${target.addressSpace}|0x${target.address.toString(16)} `),
  );
  if (matchingLine >= 0) {
    const position = new Position(header.length + matchingLine, 0);
    editor.selection = new Selection(position, position);
    editor.revealRange(editor.selection, TextEditorRevealType.InCenterIfOutsideViewport);
  }
};

/**
 * Opens an exact current source line, live virtual disassembly, or persisted CFG view in that order.
 * @param {AnalysisGraphNavigationTarget} target Qualified native analysis location.
 * @returns {Promise<void>} Resolves after an editor is opened or navigation is cancelled.
 */
export const navigateToAnalysisLocation = async (
  target: AnalysisGraphNavigationTarget,
): Promise<void> => {
  try {
    const project = loadAnalysisProject(target.projectDirectory);
    if (
      project.manifest.target !== target.target ||
      project.manifest.rom.contentSha256 !== target.romContentSha256 ||
      project.manifest.rom.contentSize !== target.romContentSize
    ) {
      throw new Error("Navigation target no longer matches the current native analysis project.");
    }
    const projection = buildInstructionAnalysisAnnotations(project.manifest, project.shards);
    const search = await findDebugMapSources(target);
    if (await openSourceLocation(search.locations)) return;
    // Captured RAM may have changed since recording. Show its saved variants before live memory.
    if (
      project.shards.analysis.some(
        (record) =>
          record.kind === "cfg-node" &&
          record.fileOffset === undefined &&
          record.bytes &&
          record.addressSpace === target.addressSpace &&
          record.address === target.address,
      )
    ) {
      await openPersistedDisassembly(target, project, projection);
      return;
    }
    if (await openLiveDisassembly(target, search.architectures)) return;
    if (search.staleSources > 0) {
      await window.showWarningMessage(
        `Found ${search.staleSources} stale source mapping(s); opening persisted analysis disassembly instead.`,
      );
    }
    await openPersistedDisassembly(target, project, projection);
  } catch (error) {
    await window.showErrorMessage(
      `Could not open analysis location: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
