import { assertSourcePath } from "@uttori/asm-disassembler/source-project";
import type { SourceCaptureIdentity } from "@uttori/asm-disassembler/source-project";
import type { AssetSourceConversionPlan } from "@uttori/asm-workflows/asset-source";
import type { SourceResearchResult, SourceResultMap } from "@uttori/asm-workflows/source";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function records(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(record);
}
const textFields = (value: Record<string, unknown>, fields: readonly string[]): boolean =>
  fields.every((field) => typeof value[field] === "string");

/** Worker results are checked before UI state, prompts or ordinary source edits consume them. */
function isResearchResult(value: unknown): value is SourceResearchResult {
  if (!record(value)) {
    return false;
  }
  if (value.kind === "edit") {
    return textFields(value, ["path", "beforeSha256", "before", "after"]);
  }
  if (value.kind === "symbols") {
    return (
      records(value.symbols) &&
      value.symbols.every(
        (symbol) =>
          textFields(symbol, ["id", "name", "path", "addressSpace"]) &&
          typeof symbol.address === "number" &&
          strings(symbol.aliases) &&
          typeof symbol.suppressed === "boolean" &&
          typeof symbol.entryPoint === "boolean",
      )
    );
  }
  if (
    value.kind !== "analysis" ||
    !records(value.documents) ||
    !records(value.addressSpaces) ||
    !records(value.records)
  ) {
    return false;
  }
  return (
    value.documents.every((document) => textFields(document, ["path", "sha256"])) &&
    value.addressSpaces.every(
      (space) =>
        textFields(space, ["id", "name"]) &&
        typeof space.addressBits === "number" &&
        ["file", "cpu", "memory"].includes(String(space.kind)),
    ) &&
    value.records.every((item) => {
      if (
        typeof item.path !== "string" ||
        !["annotations", "analysis"].includes(String(item.collection)) ||
        !record(item.value) ||
        !textFields(item.value, ["id", "addressSpace"]) ||
        !strings(item.value.evidence)
      ) {
        return false;
      }
      if (item.collection === "annotations") {
        return (
          textFields(item.value, ["architecture", "classification"]) &&
          typeof item.value.start === "number" &&
          typeof item.value.end === "number"
        );
      }
      if (
        !["target-set", "target-override"].includes(String(item.value.kind)) ||
        !Array.isArray(item.value.targets) ||
        !item.value.targets.every((target) => typeof target === "number")
      ) {
        return false;
      }
      if (item.value.kind === "target-set") {
        return typeof item.value.name === "string";
      }
      return typeof item.value.address === "number";
    })
  );
}
export function readResearchResult(value: unknown): SourceResearchResult {
  if (!isResearchResult(value)) {
    throw new Error("Invalid source research response.");
  }
  return value;
}

function isStatus(value: unknown): value is SourceResultMap["status"] {
  return (
    record(value) &&
    ["idle", "merging", "checkpoint", "committed", "verified", "diverged"].includes(
      String(value.phase),
    ) &&
    typeof value.head === "string" &&
    strings(value.conflicts) &&
    ["dirty", "unstaged", "candidateAccepted", "candidateStale", "analysisReady"].every(
      (field) => typeof value[field] === "boolean",
    ) &&
    (value.catalogReady === undefined || typeof value.catalogReady === "boolean") &&
    ["analysisReason", "catalogReason"].every(
      (field) => value[field] === undefined || typeof value[field] === "string",
    )
  );
}
/** Journal contents remain worker-owned; the UI only needs the validated status projection. */
export function readSourceStatus(value: unknown): SourceResultMap["status"] {
  if (!record(value)) {
    throw new Error("Invalid source status response.");
  }
  const projection = { ...value };
  delete projection.journal;
  if (!isStatus(projection)) {
    throw new Error("Invalid source status response.");
  }
  return projection;
}

function isCapture(value: unknown): value is SourceCaptureIdentity {
  return (
    record(value) &&
    textFields(value, ["sha256", "sourceName", "profile"]) &&
    typeof value.observedEvents === "number" &&
    typeof value.droppedEvents === "number" &&
    records(value.archives) &&
    value.archives.every(
      (archive) =>
        textFields(archive, ["name", "sha256"]) &&
        typeof archive.bytes === "number" &&
        (archive.companionSha256 === undefined || typeof archive.companionSha256 === "string"),
    )
  );
}
export function readGraphicsSelection(value: unknown): {
  captures: readonly SourceCaptureIdentity[];
} {
  if (!record(value) || !Array.isArray(value.captures) || !value.captures.every(isCapture)) {
    throw new Error("Invalid graphics capture selection.");
  }
  return { captures: value.captures };
}
/** Repository-relative physical call interval; line bounds are one-based and inclusive. */
export interface SourceMenuLocation {
  readonly file: string;
  readonly line: number;
  readonly endLine: number;
  readonly representation: string;
}
export function readSourceRepresentation(value: unknown):
  | {
      representation: string;
      inputs?: readonly { path: string; sha256: string }[];
      menus?: readonly SourceMenuLocation[];
    }
  | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!record(value) || typeof value.representation !== "string") {
    throw new Error("Invalid source representation.");
  }
  if (
    value.inputs !== undefined &&
    (!records(value.inputs) ||
      value.inputs.length > 65536 ||
      !value.inputs.every(
        (input): input is { path: string; sha256: string } =>
          typeof input.path === "string" &&
          typeof input.sha256 === "string" &&
          /^[\da-f]{64}$/.test(input.sha256),
      ))
  ) {
    throw new Error("Invalid source representation inputs.");
  }
  for (const input of value.inputs ?? []) {
    assertSourcePath(input.path);
  }
  if (
    value.menus !== undefined &&
    (!records(value.menus) ||
      value.menus.length > 65536 ||
      !value.menus.every(
        (row): row is SourceMenuLocation & Record<string, unknown> =>
          typeof row.file === "string" &&
          typeof row.representation === "string" &&
          Number.isSafeInteger(row.line) &&
          Number(row.line) >= 1 &&
          Number.isSafeInteger(row.endLine) &&
          Number(row.endLine) >= Number(row.line),
      ))
  ) {
    throw new Error("Invalid source menu index.");
  }
  for (const row of value.menus ?? []) {
    assertSourcePath(row.file);
  }
  return {
    representation: value.representation,
    ...(value.inputs === undefined ? {} : { inputs: value.inputs }),
    ...(value.menus === undefined ? {} : { menus: value.menus }),
  };
}

function isConversionPlan(
  value: unknown,
): value is AssetSourceConversionPlan & { transaction?: string } {
  return (
    record(value) &&
    textFields(value, ["source", "destination", "outputSha256"]) &&
    (value.transaction === undefined || typeof value.transaction === "string") &&
    records(value.changes) &&
    value.changes.every(
      (change) =>
        typeof change.path === "string" &&
        (change.before === null || change.before instanceof Uint8Array) &&
        (change.after === null || change.after instanceof Uint8Array),
    ) &&
    records(value.snapshots) &&
    value.snapshots.every((snapshot) => textFields(snapshot, ["path", "sha256"])) &&
    records(value.affected) &&
    value.affected.every(
      (item) => textFields(item, ["file", "format"]) && typeof item.line === "number",
    ) &&
    strings(value.retained) &&
    strings(value.unresolvedDeclarations) &&
    strings(value.assemblyInventory)
  );
}
export function readConversionPlan(
  value: unknown,
): AssetSourceConversionPlan & { transaction?: string } {
  if (!isConversionPlan(value)) {
    throw new Error("Invalid source conversion response.");
  }
  return value;
}

/** Validate the generation identity and byte-equality proof used by Prepare clients. */
export function readGenerationCommit(value: unknown): {
  generation: { commit: string; descriptor: { inputs: { romSha256: string } } };
  verification: { outputSha256: string };
} {
  if (
    !record(value) ||
    !record(value.generation) ||
    typeof value.generation.commit !== "string" ||
    !record(value.generation.descriptor) ||
    !record(value.generation.descriptor.inputs) ||
    typeof value.generation.descriptor.inputs.romSha256 !== "string" ||
    !record(value.verification) ||
    typeof value.verification.outputSha256 !== "string"
  ) {
    throw new Error("Invalid generation response.");
  }
  return {
    generation: {
      commit: value.generation.commit,
      descriptor: { inputs: { romSha256: value.generation.descriptor.inputs.romSha256 } },
    },
    verification: { outputSha256: value.verification.outputSha256 },
  };
}
export function readBuildOutput(value: unknown): { outputFile: string } {
  if (!record(value) || typeof value.outputFile !== "string") {
    throw new Error("Invalid build output response.");
  }
  return { outputFile: value.outputFile };
}
export function readMergePreview(value: unknown): { conflicts: string[]; resultTree: string } {
  if (!record(value) || !strings(value.conflicts) || typeof value.resultTree !== "string") {
    throw new Error("Invalid merge preview response.");
  }
  return { conflicts: value.conflicts, resultTree: value.resultTree };
}
