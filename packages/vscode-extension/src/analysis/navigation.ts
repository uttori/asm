/** Source-first navigation for persisted analysis locations with conservative disassembly fallback. */
import * as path from "node:path";

import { formatDebugAddress } from "@uttori/asm-debug-adapter";
import { Position, Selection, TextEditorRevealType, Uri, debug, window, workspace } from "vscode";

import {
  analysisDebugMapRanges,
  currentAnalysisSourcePath,
  findAnalysisDebugMapCandidates,
} from "./debug-maps.js";
import type { AnalysisNavigationProjection } from "./navigation-data.js";
import type { AnalysisNavigationTarget } from "./navigation-target.js";
import { analysisWorker } from "./worker-client.js";

/** Narrow command payloads to plain objects before validation. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate manifest identity fields required for navigation matching. */
function isNavigationManifest(value: unknown): value is {
  readonly target: string;
  readonly rom: { readonly contentSha256: string; readonly contentSize: number };
} {
  return (
    isRecord(value) &&
    typeof value.target === "string" &&
    isRecord(value.rom) &&
    typeof value.rom.contentSha256 === "string" &&
    typeof value.rom.contentSize === "number"
  );
}

/** Validate disassembly preview text returned by the analysis worker. */
function isNavigationProjection(value: unknown): value is AnalysisNavigationProjection {
  return (
    isRecord(value) &&
    typeof value.capturedRam === "boolean" &&
    Array.isArray(value.lines) &&
    value.lines.every((line) => typeof line === "string")
  );
}

/**
 * Hash-verified source mapping with a one-based line number and the exact
 * architecture/address-space identity.
 */
interface CurrentSourceLocation {
  readonly file: string;
  readonly line: number;
  readonly architecture: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly mapFile: string;
}

/**
 * Current navigable mappings, architecture candidates, and the count of matching ranges whose
 * source bytes could not be verified.
 */
interface DebugMapSearchResult {
  readonly locations: readonly CurrentSourceLocation[];
  readonly architectures: readonly string[];
  readonly staleSources: number;
}

/**
 * Deduplicate architecture candidates and sort them for a stable picker order.
 * @param values Candidate identity strings, possibly repeated.
 * @returns Unique strings sorted with localeCompare.
 */
const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].toSorted((left, right) => left.localeCompare(right));

/**
 * Find exact ROM-matched source ranges, exclude missing or changed source files, and retain
 * architecture hints for disassembly fallback.
 * @param target Exact analysis location and ROM identity.
 * @returns Verified source mappings, architecture hints, and stale-range count.
 */
const findDebugMapSources = async (
  target: AnalysisNavigationTarget,
): Promise<DebugMapSearchResult> => {
  const locations: CurrentSourceLocation[] = [];
  const architectures: string[] = [...target.architectureHints];
  let staleSources = 0;
  for (const candidate of await findAnalysisDebugMapCandidates(target)) {
    for (const range of analysisDebugMapRanges(candidate.map, target)) {
      architectures.push(range.architecture);
      const source = candidate.map.sources.find(({ id }) => id === range.sourceId);
      if (!source) {
        continue;
      }
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
    locations: [...unique.values()].toSorted(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        left.architecture.localeCompare(right.architecture),
    ),
    architectures: sortedUnique(architectures),
    staleSources,
  };
};

/**
 * Choose and reveal a verified source mapping, converting its one-based line to a VS Code
 * position.
 * Returns false only when there are no mappings; cancelling the picker returns true to suppress
 * fallback navigation.
 * @param locations Verified mappings with one-based source lines.
 * @returns True after navigation or picker cancellation; false only for no mappings.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showTextDocument
 * @see https://code.visualstudio.com/api/references/vscode-api#Position
 */
const openSourceLocation = async (
  locations: readonly CurrentSourceLocation[],
): Promise<boolean> => {
  if (locations.length === 0) {
    return false;
  }
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
  if (!selected) {
    return true;
  }
  const document = await workspace.openTextDocument(Uri.file(selected.file));
  const editor = await window.showTextDocument(document, { preview: true });
  const position = new Position(Math.max(0, selected.line - 1), 0);
  editor.selection = new Selection(position, position);
  editor.revealRange(editor.selection, TextEditorRevealType.InCenterIfOutsideViewport);
  return true;
};

/**
 * Use the sole persisted architecture or prompt when ambiguous; return undefined when none
 * exists or the picker is cancelled.
 * @param architectures Persisted candidates in picker order.
 * @returns Selected architecture, or undefined for no candidates/cancellation.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showQuickPick
 */
const chooseArchitecture = async (
  architectures: readonly string[],
): Promise<string | undefined> => {
  if (architectures.length === 0) {
    return undefined;
  }
  if (architectures.length === 1) {
    return architectures[0];
  }
  return window.showQuickPick(architectures, {
    title: "Open Virtual Disassembly",
    placeHolder: "Choose the persisted architecture identity",
  });
};

/**
 * Ask the active Uttori debugger for 32 instructions and display them in an untitled preview.
 * Returns false when no compatible session/architecture exists, selection is cancelled, or the
 * request fails or returns no rows.
 * @param target Qualified location requested from the debugger.
 * @param architectures Persisted architecture candidates for disambiguation.
 * @returns Whether a nonempty live disassembly preview was opened.
 * @see https://code.visualstudio.com/api/references/vscode-api#DebugSession.customRequest
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.openTextDocument
 */
const openLiveDisassembly = async (
  target: AnalysisNavigationTarget,
  architectures: readonly string[],
): Promise<boolean> => {
  const session = debug.activeDebugSession;
  if (!session || session.type !== "uttori-asm") {
    return false;
  }
  const architecture = await chooseArchitecture(architectures);
  if (!architecture) {
    return false;
  }
  try {
    const response: unknown = await session.customRequest("disassemble", {
      memoryReference: formatDebugAddress({
        architecture,
        addressSpace: target.addressSpace,
        address: target.address,
        ...(target.outputOffsets.length === 1 ? { outputOffset: target.outputOffsets[0] } : {}),
      }),
      instructionOffset: 0,
      instructionCount: 32,
    });
    const instructions =
      isRecord(response) && Array.isArray(response.instructions) ? response.instructions : [];
    if (instructions.length === 0 || !instructions.every(isRecord)) {
      return false;
    }
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

/**
 * Display accepted analysis rows in an untitled preview and select the target address when
 * present; missing bytes remain unknown.
 * @param target Qualified location to reveal in the preview.
 * @param projection Bounded rows prepared by the analysis worker.
 * @returns Completion after opening and selecting the persisted view.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.openTextDocument
 */
const openPersistedDisassembly = async (
  target: AnalysisNavigationTarget,
  projection: AnalysisNavigationProjection,
): Promise<void> => {
  const lines = projection.lines;
  const header = [
    "; Persisted analysis disassembly (read-only)",
    "; This view renders accepted CFG records. Unknown operand bytes remain ?? and are not decoded again.",
    `; Location: ${target.addressSpace}|0x${target.address.toString(16)}`,
    `; Records: ${target.recordIds.join(", ")}`,
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
 * @param target Qualified native analysis location.
 * @returns Resolves after an editor is opened or navigation is cancelled.
 */
export const navigateToAnalysisLocation = async (
  target: AnalysisNavigationTarget,
): Promise<void> => {
  try {
    const manifest = await analysisWorker().request(target.projectDirectory, "manifest");
    if (!isNavigationManifest(manifest)) {
      throw new Error("Analysis manifest is unavailable.");
    }
    if (
      manifest.target !== target.target ||
      manifest.rom.contentSha256 !== target.romContentSha256 ||
      manifest.rom.contentSize !== target.romContentSize
    ) {
      throw new Error("Navigation target no longer matches the current native analysis project.");
    }
    const search = await findDebugMapSources(target);
    if (await openSourceLocation(search.locations)) {
      return;
    }
    const projection = await analysisWorker().request(target.projectDirectory, "navigation", {
      navigationTarget: target,
    });
    if (!isNavigationProjection(projection)) {
      throw new Error("Analysis navigation is unavailable.");
    }
    // Captured RAM may have changed since recording. Show its saved variants before live memory.
    if (projection.capturedRam) {
      await openPersistedDisassembly(target, projection);
      return;
    }
    if (await openLiveDisassembly(target, search.architectures)) {
      return;
    }
    if (search.staleSources > 0) {
      await window.showWarningMessage(
        `Found ${search.staleSources} stale source mapping(s). Opening persisted analysis disassembly instead.`,
      );
    }
    await openPersistedDisassembly(target, projection);
  } catch (error) {
    await window.showErrorMessage(
      `Could not open analysis location: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
