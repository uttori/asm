import { type SourceMergePreview } from "@uttori/asm-disassembler/source-project";
import type { SnesSourceBuild } from "@uttori/asm-plugin-snes/disassembler";
import { SNES_MAPPERS } from "@uttori/asm-plugin-snes/disassembler";
import { TreeItem, TreeItemCollapsibleState, window } from "vscode";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSnesMapper(value: string): value is (typeof SNES_MAPPERS)[number] {
  return (
    value === "lorom" ||
    value === "hirom" ||
    value === "exlorom" ||
    value === "exhirom" ||
    value === "sfxrom" ||
    value === "sa1rom" ||
    value === "bigsa1rom" ||
    value === "norom"
  );
}

export function isLayoutObject(
  value: unknown,
): value is { readonly id: string; readonly kind: string } {
  return isRecord(value) && typeof value.id === "string" && typeof value.kind === "string";
}

export function isSnesSourceBuild(value: unknown): value is SnesSourceBuild {
  return (
    isRecord(value) &&
    typeof value.outputFile === "string" &&
    typeof value.debugMapFile === "string" &&
    typeof value.inputSha256 === "string" &&
    Array.isArray(value.inputs) &&
    value.inputs.every(
      (input) =>
        isRecord(input) && typeof input.path === "string" && typeof input.sha256 === "string",
    ) &&
    typeof value.outputSize === "number" &&
    typeof value.debugMapFingerprint === "string" &&
    isRecord(value.verification) &&
    typeof value.verification.outputSha256 === "string" &&
    typeof value.verification.debugMapSha256 === "string" &&
    typeof value.verification.toolchainSha256 === "string" &&
    Array.isArray(value.verification.checks) &&
    value.verification.checks.every((check) => typeof check === "string") &&
    isRecord(value.contracts) &&
    typeof value.contracts.cpuStates === "number" &&
    typeof value.contracts.fixedExtents === "number" &&
    (value.cacheWarnings === undefined ||
      (Array.isArray(value.cacheWarnings) &&
        value.cacheWarnings.every((warning) => typeof warning === "string")))
  );
}

export function isSourceMergePreview(value: unknown): value is SourceMergePreview {
  return (
    isRecord(value) &&
    typeof value.head === "string" &&
    typeof value.sourceTree === "string" &&
    typeof value.candidate === "string" &&
    typeof value.base === "string" &&
    typeof value.resultTree === "string" &&
    typeof value.messages === "string" &&
    Array.isArray(value.conflicts) &&
    value.conflicts.every((conflict) => typeof conflict === "string") &&
    (value.ref === undefined || typeof value.ref === "string")
  );
}

export function isGenerationCommit(
  value: unknown,
): value is { readonly generation: { readonly commit: string } } {
  return (
    isRecord(value) &&
    isRecord(value.generation) &&
    typeof value.generation.commit === "string" &&
    value.generation.commit.length > 0
  );
}

export function isRelocationEdit(value: unknown): value is {
  readonly path: string;
  readonly beforeSha256: string;
  readonly before: string;
  readonly after: string;
} {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.beforeSha256 === "string" &&
    typeof value.before === "string" &&
    typeof value.after === "string"
  );
}

export function relocationEdits(value: unknown): readonly {
  readonly path: string;
  readonly beforeSha256: string;
  readonly before: string;
  readonly after: string;
}[] {
  if (!isRecord(value) || !Array.isArray(value.edits) || !value.edits.every(isRelocationEdit)) {
    throw new Error("Invalid source relocation.");
  }
  return value.edits;
}

/** Cached native tree rows keep rendering independent of database and filesystem scans. */
export class SourceRow extends TreeItem {
  constructor(
    label: string,
    readonly children: SourceRow[] = [],
    command?: string,
    args?: unknown[],
  ) {
    super(
      label,
      children.length ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
    );
    if (command) {
      this.command = { command, title: label, arguments: args };
    }
  }
}

/** A cancelled file picker leaves the asset operation untouched. */
export const chooseAssetFile = async (
  title: string,
  extensions: string[],
): Promise<string | undefined> =>
  (
    await window.showOpenDialog({ title, canSelectMany: false, filters: { Files: extensions } })
  )?.[0]?.fsPath;
