/** Trusted-workspace commands for conflict-safe, reversible native project edits. */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { canonicalEquals, canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  RANGE_CLASSIFICATIONS,
  applyLabelRenameEdit,
  applyDisassemblyAnnotationEdit,
  applyRangeClassificationEdit,
  applyStateEntryPointEdit,
  applyTargetResolutionEdit,
  findManagedSourceFile,
  commitAnalysisProjectSelectedEdit,
  openAnalysisProjectStore,
  analysisProjectRevision,
  revertLabelRenameEdit,
  revertDisassemblyAnnotationEdit,
  revertRangeClassificationEdit,
  revertStateEntryPointEdit,
  revertTargetResolutionEdit,
  type AnalysisProject,
  type AnalysisProjectSnapshot,
  type AnalysisProjectShards,
  type LabelRenameEditRequest,
  type LabelRenameInverse,
  type DisassemblyAnnotationEditRequest,
  type DisassemblyAnnotationInverse,
  type ManualAnnotationState,
  type ProjectEvidenceExplanation,
  type RangeClassificationEditRequest,
  type RangeClassificationInverse,
  type StateEntryPointEditRequest,
  type StateEntryPointInverse,
  type TargetResolutionEditRequest,
  type TargetResolutionInverse,
} from "@uttori/asm-disassembler";
import { commands, Uri, window, workspace, type Disposable } from "vscode";

import type {
  AnnotationLookupResult,
  AnnotationRefresh,
  AnnotationSaveResult,
} from "../disassembly/annotation-data.js";
import { openDisassemblyAnnotationForm } from "../disassembly/annotation-form.js";
import { owningProject } from "../disassembly/ownership-data.js";
import { readOwnershipProjects } from "../disassembly/ownership-projects.js";
import { informationHex } from "../editor-info/format.js";
import {
  findAnalysisProjectDirectories,
  type AnalysisCoverageEditTarget,
} from "./coverage-tree.js";
import { discoverAnalysisDebugMapFiles } from "./debug-maps.js";
import { analysisWorker } from "./worker-client.js";

/**
 * Editing changes metadata only. Runtime remains in SQLite through edits and undo/redo.
 * @param {string} directory Selected project root.
 * @param {Pick<DisassemblyAnnotationEditRequest, "addressSpace" | "address">} [location] Instruction boundary needed to replay an annotation edit.
 * @returns {AnalysisProjectSnapshot} Metadata in the editor's record shape, paired with its revision.
 */
const loadEditableSnapshot = (
  directory: string,
  location?: Pick<DisassemblyAnnotationEditRequest, "addressSpace" | "address">,
): AnalysisProjectSnapshot => {
  const store = openAnalysisProjectStore(directory);
  try {
    if (location) {
      store.prepareAnnotationQueries();
    }
    return store.transaction(() => {
      const manifest = store.manifest();
      const shards = {
        labels: store.loadTable("labels"),
        comments: store.loadTable("comments"),
        annotations: store.loadTable("annotations"),
        regions: store.loadTable("regions"),
        evidence: store.loadTable("evidence"),
        imports: [],
        runtime: [],
        analysis: store.analysisByKinds([
          "function",
          "conflict",
          "unresolved",
          "target-override",
          "target-set",
        ]),
      };
      if (location) {
        const output = manifest.addressSpaces.some(
          (space) => space.id === location.addressSpace && space.kind === "file",
        )
          ? location.address
          : undefined;
        shards.analysis.push(
          ...store.annotationNodesAt(location.addressSpace, location.address, output),
        );
      }
      store.validateView(shards);
      return { manifest, shards, revision: analysisProjectRevision(manifest) };
    }, false);
  } finally {
    store.close();
  }
};

/**
 * Publish metadata edits without replacing the runtime history omitted from the editor snapshot.
 * @param {string} directory Selected project root.
 * @param {AnalysisProjectSnapshot} snapshot Original metadata and optimistic token.
 * @param {AnalysisProject} project Edited metadata from an edit or inverse operation.
 */
const commitEditableSnapshot = (
  directory: string,
  snapshot: AnalysisProjectSnapshot,
  project: AnalysisProject,
): void => {
  commitAnalysisProjectSelectedEdit(directory, snapshot, project);
};

/** Committed ROM-range classification edit and its guarded inverse for session undo/redo. */
interface RangeHistoryEntry {
  readonly kind: "range";
  readonly projectDirectory: string;
  readonly request: RangeClassificationEditRequest;
  readonly inverse: RangeClassificationInverse;
}

/** Committed processor-state or entry-point edit and its guarded inverse for session undo/redo. */
interface StateEntryHistoryEntry {
  readonly kind: "state-entry";
  readonly projectDirectory: string;
  readonly request: StateEntryPointEditRequest;
  readonly inverse: StateEntryPointInverse;
}

/** Committed branch/call target resolution and its guarded inverse for session undo/redo. */
interface TargetHistoryEntry {
  readonly kind: "target";
  readonly projectDirectory: string;
  readonly request: TargetResolutionEditRequest;
  readonly inverse: TargetResolutionInverse;
}

/** Committed label rename and its guarded inverse for session undo/redo. */
interface LabelHistoryEntry {
  readonly kind: "label";
  readonly projectDirectory: string;
  readonly request: LabelRenameEditRequest;
  readonly inverse: LabelRenameInverse;
}

/** Committed disassembly label/comment edit and its guarded inverse for session undo/redo. */
interface AnnotationHistoryEntry {
  readonly kind: "annotation";
  readonly projectDirectory: string;
  readonly request: DisassemblyAnnotationEditRequest;
  readonly inverse: DisassemblyAnnotationInverse;
}

/**
 * Discriminated history record pairing each edit request with the matching inverse and owning
 * project directory.
 */
type AnalysisEditHistoryEntry =
  | RangeHistoryEntry
  | StateEntryHistoryEntry
  | TargetHistoryEntry
  | LabelHistoryEntry
  | AnnotationHistoryEntry;

/**
 * Parsed processor-state assignments and an independent request to mark the address as an entry
 * point.
 */
interface StateEntrySelection {
  readonly state?: ManualAnnotationState;
  readonly entryPoint: boolean;
}

/**
 * Case-normalized editor input names mapped to native state fields; aliases share one
 * duplicate-assignment check.
 */
const STATE_FIELD_ALIASES: Readonly<Record<string, keyof ManualAnnotationState>> = {
  e: "e",
  m: "m",
  x: "x",
  carry: "carry",
  c: "carry",
  programbank: "programBank",
  pbr: "programBank",
  databank: "dataBank",
  dbr: "dataBank",
  directpage: "directPage",
  d: "directPage",
  stackpointer: "stackPointer",
  s: "stackPointer",
};

/**
 * Writable partial state used only while parsing input before returning the readonly
 * manual-state contract.
 */
type MutableManualState = {
  -readonly [Field in keyof ManualAnnotationState]?: ManualAnnotationState[Field];
};

/**
 * Parse a nonnegative safe integer from decimal, $-prefixed hex, or 0x-prefixed hex; return
 * undefined for invalid or unsafe input.
 * @param {string} input Decimal or $/0x-prefixed hexadecimal text.
 * @returns {number | undefined} Nonnegative safe integer, or undefined for malformed/unsafe input.
 */
const parseAddress = (input: string): number | undefined => {
  const value = input.trim();
  let parsed: number;
  if (/^\$[\da-f]+$/i.test(value)) {
    parsed = Number.parseInt(value.slice(1), 16);
  } else if (/^0x[\da-f]+$/i.test(value)) {
    parsed = Number.parseInt(value.slice(2), 16);
  } else if (/^\d+$/.test(value)) {
    parsed = Number.parseInt(value, 10);
  } else {
    return undefined;
  }
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

/**
 * Require the project directory to belong to a file-backed workspace before permitting local
 * filesystem edits.
 * @param {string} directory Native project directory to edit.
 * @returns {boolean} Whether a file-backed workspace contains the directory.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getWorkspaceFolder
 */
const isLocalWorkspaceProject = (directory: string): boolean => {
  const folder = workspace.getWorkspaceFolder(Uri.file(directory));
  return folder?.uri.scheme === "file";
};

/**
 * Parse comma-separated state assignments and an optional entry marker, accepting processor
 * aliases and boolean/width spellings.
 * Throws for empty selections, unknown fields, duplicate canonical fields, or malformed values;
 * native edits perform range validation.
 * @param {string} input Comma-separated field assignments and optional entry marker.
 * @returns {StateEntrySelection} Parsed state and entry-point selection; invalid directives throw.
 */
const parseStateEntrySelection = (input: string): StateEntrySelection => {
  const state: MutableManualState = {};
  const seen = new Set<string>();
  let entryPoint = false;
  for (const rawDirective of input.split(",")) {
    const directive = rawDirective.trim();
    if (directive === "") {
      continue;
    }
    if (["entry", "entrypoint", "entry-point"].includes(directive.toLowerCase())) {
      if (entryPoint) {
        throw new Error("Entry point was specified more than once.");
      }
      entryPoint = true;
      continue;
    }
    const separator = directive.indexOf("=");
    if (separator < 1) {
      throw new Error(`State directive '${directive}' needs '='.`);
    }
    const rawKey = directive.slice(0, separator).trim().toLowerCase();
    const rawValue = directive
      .slice(separator + 1)
      .trim()
      .toLowerCase();
    const key = STATE_FIELD_ALIASES[rawKey];
    if (!key) {
      throw new Error(`Unknown state field '${rawKey}'.`);
    }
    if (seen.has(key)) {
      throw new Error(`State field '${key}' was specified more than once.`);
    }
    seen.add(key);
    if (key === "e") {
      if (!["emulation", "native", "true", "false", "1", "0"].includes(rawValue)) {
        throw new Error("E must be emulation/native or true/false.");
      }
      state.e = ["emulation", "true", "1"].includes(rawValue);
    } else if (key === "m" || key === "x") {
      if (!["8", "16", "true", "false"].includes(rawValue)) {
        throw new Error(`${key.toUpperCase()} must be 8/16 or true/false.`);
      }
      state[key] = ["8", "true"].includes(rawValue);
    } else if (key === "carry") {
      if (!["set", "clear", "true", "false", "1", "0"].includes(rawValue)) {
        throw new Error("Carry must be set/clear or true/false.");
      }
      state.carry = ["set", "true", "1"].includes(rawValue);
    } else {
      const value = parseAddress(rawValue);
      if (value === undefined) {
        throw new Error(`State field '${key}' needs an integer value.`);
      }
      state[key] = value;
    }
  }
  if (!entryPoint && Object.keys(state).length === 0) {
    throw new Error("Enter at least one state field or 'entry'.");
  }
  return {
    ...(Object.keys(state).length > 0 ? { state } : {}),
    entryPoint,
  };
};

/**
 * Parse comma-separated nonnegative decimal/hex addresses into sorted unique targets; throw when
 * the list is empty or any address is invalid.
 * @param {string} input Comma-separated decimal or prefixed hexadecimal addresses.
 * @returns {readonly number[]} Sorted unique safe addresses; empty or malformed input throws.
 */
const parseTargetList = (input: string): readonly number[] => {
  const values = input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(parseAddress);
  if (values.length === 0 || values.some((value) => value === undefined)) {
    throw new Error("Enter one or more comma-separated addresses.");
  }
  return [...new Set(values as number[])].sort((left, right) => left - right);
};

/** Session-scoped undo/redo coordinator over the library's optimistic project transactions. */
export class AnalysisProjectEditor {
  readonly #annotationPanels = new Set<Disposable>();
  readonly #refresh: () => void;
  readonly #undo: AnalysisEditHistoryEntry[] = [];
  readonly #redo: AnalysisEditHistoryEntry[] = [];

  constructor(
    refresh: () => void,
    private readonly extensionUri: Uri,
  ) {
    this.#refresh = refresh;
    void this.updateContexts();
  }

  async classifyRange(target?: AnalysisCoverageEditTarget): Promise<void> {
    try {
      if (!workspace.isTrusted) {
        await window.showErrorMessage(
          "Analysis project edits require a trusted local workspace. The coverage view remains read-only.",
        );
        return;
      }
      const projectDirectory = await this.chooseProject(
        target?.projectDirectory,
        "Classify Analysis Range",
      );
      if (!projectDirectory) {
        return;
      }
      const snapshot = loadEditableSnapshot(projectDirectory);
      if (snapshot.manifest.rom.contentSize === 0) {
        await window.showErrorMessage(
          "The selected analysis project has no ROM content to classify.",
        );
        return;
      }
      const fileAddressSpaces = snapshot.manifest.addressSpaces.filter(
        ({ kind }) => kind === "file",
      );
      const addressSpace =
        fileAddressSpaces.length === 1
          ? fileAddressSpaces[0]
          : (
              await window.showQuickPick(
                fileAddressSpaces.map((candidate) => ({
                  label: candidate.name,
                  description: candidate.id,
                  addressSpace: candidate,
                })),
                {
                  title: "Classify Analysis Range",
                  placeHolder: "Choose the ROM file address space",
                },
              )
            )?.addressSpace;
      if (!addressSpace) {
        if (fileAddressSpaces.length === 0) {
          await window.showErrorMessage(
            "The selected analysis project does not declare a ROM file address space.",
          );
        }
        return;
      }

      const maximum = snapshot.manifest.rom.contentSize;
      const suggestedStart = target?.start ?? 0;
      const startInput = await window.showInputBox({
        title: "Classify Analysis Range",
        prompt: "Start address (inclusive, use $ or 0x for hexadecimal, otherwise decimal)",
        value: informationHex(suggestedStart, 6),
        validateInput: (value) => {
          const parsed = parseAddress(value);
          return parsed === undefined || parsed < 0 || parsed >= maximum
            ? `Enter an address from 0 through ${informationHex(maximum - 1, 6)}.`
            : undefined;
        },
      });
      if (startInput === undefined) {
        return;
      }
      const start = parseAddress(startInput)!;
      const suggestedEnd = target?.end ?? Math.min(start + 1, maximum);
      const endInput = await window.showInputBox({
        title: "Classify Analysis Range",
        prompt: "End address (exclusive, use $ or 0x for hexadecimal, otherwise decimal)",
        value: informationHex(suggestedEnd, 6),
        validateInput: (value) => {
          const parsed = parseAddress(value);
          return parsed === undefined || parsed <= start || parsed > maximum
            ? `Enter an address greater than ${informationHex(start, 6)} and no greater than ${informationHex(maximum, 6)}.`
            : undefined;
        },
      });
      if (endInput === undefined) {
        return;
      }
      const end = parseAddress(endInput)!;
      const classificationChoice = await window.showQuickPick(
        RANGE_CLASSIFICATIONS.map((classification) => ({ label: classification, classification })),
        {
          title: "Classify Analysis Range",
          placeHolder: "Choose a native range classification",
        },
      );
      if (!classificationChoice) {
        return;
      }
      const { classification } = classificationChoice;

      const configuredArchitecture = workspace
        .getConfiguration("asm")
        .get<string>("architecture", "")
        .trim();
      const overlappingArchitectures = [
        ...new Set(
          snapshot.shards.annotations
            .filter(
              (annotation) =>
                annotation.addressSpace === addressSpace.id &&
                annotation.start < end &&
                start < annotation.end,
            )
            .map(({ architecture }) => architecture),
        ),
      ];
      const architectureInput = await window.showInputBox({
        title: "Classify Analysis Range",
        prompt: "Architecture id to attach to this annotation",
        value:
          configuredArchitecture ||
          (overlappingArchitectures.length === 1 ? overlappingArchitectures[0] : ""),
        validateInput: (value) => (value.trim() === "" ? "Enter an architecture id." : undefined),
      });
      if (architectureInput === undefined) {
        return;
      }
      const detail = await window.showInputBox({
        title: "Classify Analysis Range",
        prompt: "Optional manual-evidence note (leave empty for none)",
      });
      if (detail === undefined) {
        return;
      }

      const architecture = architectureInput.trim();
      const suffix = createHash("sha256")
        .update(
          canonicalJson({
            revision: snapshot.revision.manifestSha256,
            addressSpace: addressSpace.id,
            start,
            end,
            classification,
            architecture,
          }),
        )
        .digest("hex")
        .slice(0, 20);
      const request: RangeClassificationEditRequest = {
        annotationId: `manual.range.${suffix}`,
        evidenceId: `manual.evidence.${suffix}`,
        addressSpace: addressSpace.id,
        start,
        end,
        classification,
        architecture,
        sourceId: "vscode.analysis-coverage",
        ...(detail.trim() ? { detail: detail.trim() } : {}),
      };
      const applied = applyRangeClassificationEdit(snapshot, request);
      commitEditableSnapshot(projectDirectory, snapshot, applied.project);
      this.#undo.push({ kind: "range", projectDirectory, request, inverse: applied.inverse });
      this.#redo.length = 0;
      await this.updateContexts();
      this.#refresh();
      const conflictCount = applied.inverse.conflicts.length;
      await window.showInformationMessage(
        `Classified [${informationHex(start, 6)}, ${informationHex(end, 6)}) as ${classification}.${
          conflictCount === 0
            ? ""
            : ` Preserved ${conflictCount} contradictory overlap${conflictCount === 1 ? "" : "s"} as conflict records.`
        }`,
      );
    } catch (error) {
      await this.showFailure("Could not classify the analysis range", error);
    }
  }

  async setStateEntryPoint(target?: AnalysisCoverageEditTarget): Promise<void> {
    try {
      if (!workspace.isTrusted) {
        await window.showErrorMessage(
          "Analysis project edits require a trusted local workspace. The coverage view remains read-only.",
        );
        return;
      }
      const projectDirectory = await this.chooseProject(
        target?.projectDirectory,
        "Set Analysis State / Entry Point",
      );
      if (!projectDirectory) {
        return;
      }
      const snapshot = loadEditableSnapshot(projectDirectory);
      const targetIds = new Set(target?.annotationIds ?? []);
      const candidates = snapshot.shards.annotations
        .filter((annotation) => !target || targetIds.has(annotation.id))
        .sort(
          (left, right) =>
            left.addressSpace.localeCompare(right.addressSpace) ||
            left.start - right.start ||
            left.id.localeCompare(right.id),
        );
      if (candidates.length === 0) {
        await window.showErrorMessage(
          target
            ? "This ROM-map segment has no classified annotation. Classify it before adding state or an entry point."
            : "The selected project has no annotation to carry state or an entry point.",
        );
        return;
      }
      const selected = await window.showQuickPick(
        candidates.map((annotation) => ({
          label: annotation.id,
          description: `${annotation.addressSpace} [${informationHex(annotation.start, 6)}, ${informationHex(annotation.end, 6)}) · ${annotation.classification} · ${annotation.architecture}`,
          annotation,
        })),
        {
          title: "Set Analysis State / Entry Point",
          placeHolder: "Choose the classified interval that should carry the manual overlay",
        },
      );
      if (!selected) {
        return;
      }
      const directiveInput = await window.showInputBox({
        title: "Set Analysis State / Entry Point",
        prompt:
          "Comma-separated: entry, e=native|emulation, m=8|16, x=8|16, carry=set|clear, pbr=, dbr=, d=, s=",
        value: "entry",
        validateInput: (value) => {
          try {
            parseStateEntrySelection(value);
            return undefined;
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
        },
      });
      if (directiveInput === undefined) {
        return;
      }
      const selection = parseStateEntrySelection(directiveInput);
      const detail = await window.showInputBox({
        title: "Set Analysis State / Entry Point",
        prompt: "Optional manual-evidence note (leave empty for none)",
      });
      if (detail === undefined) {
        return;
      }
      const suffix = this.editSuffix(snapshot, {
        kind: "state-entry",
        baseAnnotationId: selected.annotation.id,
        ...selection,
      });
      const request: StateEntryPointEditRequest = {
        annotationId: `manual.state.${suffix}`,
        evidenceId: `manual.evidence.state.${suffix}`,
        baseAnnotationId: selected.annotation.id,
        ...(selection.state ? { state: selection.state } : {}),
        entryPoint: selection.entryPoint,
        sourceId: "vscode.analysis-coverage",
        ...(detail.trim() ? { detail: detail.trim() } : {}),
      };
      const applied = applyStateEntryPointEdit(snapshot, request);
      commitEditableSnapshot(projectDirectory, snapshot, applied.project);
      this.#undo.push({
        kind: "state-entry",
        projectDirectory,
        request,
        inverse: applied.inverse,
      });
      this.#redo.length = 0;
      await this.updateContexts();
      this.#refresh();
      await window.showInformationMessage(
        `Added manual ${selection.entryPoint ? "entry point and " : ""}state overlay to '${selected.annotation.id}'${
          applied.inverse.conflicts.length === 0
            ? "."
            : `. Preserved ${applied.inverse.conflicts.length} contradictory state record(s) as conflicts.`
        }`,
      );
    } catch (error) {
      await this.showFailure("Could not set analysis state / entry point", error);
    }
  }

  async resolveTarget(target?: AnalysisCoverageEditTarget): Promise<void> {
    try {
      if (!workspace.isTrusted) {
        await window.showErrorMessage(
          "Analysis project edits require a trusted local workspace. The coverage view remains read-only.",
        );
        return;
      }
      const projectDirectory = await this.chooseProject(
        target?.projectDirectory,
        "Resolve Indirect Target",
      );
      if (!projectDirectory) {
        return;
      }
      const snapshot = loadEditableSnapshot(projectDirectory);
      const sites = new Map<
        string,
        {
          readonly addressSpace: string;
          readonly address: number;
          readonly descriptions: string[];
        }
      >();
      for (const record of snapshot.shards.analysis) {
        if (record.kind !== "unresolved" && record.kind !== "target-override") {
          continue;
        }
        const key = `${record.addressSpace}:${record.address}`;
        const site = sites.get(key) ?? {
          addressSpace: record.addressSpace,
          address: record.address,
          descriptions: [],
        };
        site.descriptions.push(
          record.kind === "unresolved"
            ? `${record.flowKind}: ${record.reason}`
            : `existing targets: ${record.targets.map((value) => informationHex(value, 6)).join(", ")}`,
        );
        sites.set(key, site);
      }
      if (sites.size === 0) {
        await window.showErrorMessage(
          "The selected project has no unresolved or previously overridden control-flow site.",
        );
        return;
      }
      const selected = await window.showQuickPick(
        [...sites.values()]
          .sort(
            (left, right) =>
              left.addressSpace.localeCompare(right.addressSpace) || left.address - right.address,
          )
          .map((site) => ({
            label: `${site.addressSpace} ${informationHex(site.address, 6)}`,
            description: site.descriptions.join(" · "),
            site,
          })),
        {
          title: "Resolve Indirect Target",
          placeHolder: "Choose an unresolved site or augment its existing observed targets",
        },
      );
      if (!selected) {
        return;
      }
      const prior = snapshot.shards.analysis.find(
        (record) =>
          record.kind === "target-override" &&
          record.addressSpace === selected.site.addressSpace &&
          record.address === selected.site.address,
      );
      const addressSpace = snapshot.manifest.addressSpaces.find(
        ({ id }) => id === selected.site.addressSpace,
      );
      if (!addressSpace) {
        throw new Error(`Unknown analysis address space '${selected.site.addressSpace}'.`);
      }
      // File offsets stop at the ROM size. CPU addresses use the full address width.
      const maximum =
        addressSpace.kind === "file"
          ? snapshot.manifest.rom.contentSize
          : 2 ** addressSpace.addressBits;
      const targetInput = await window.showInputBox({
        title: "Resolve Indirect Target",
        prompt: `Comma-separated targets in '${selected.site.addressSpace}' (use $ or 0x for hexadecimal)`,
        value:
          prior?.kind === "target-override"
            ? prior.targets.map((value) => informationHex(value, 6)).join(", ")
            : "",
        validateInput: (value) => {
          try {
            const values = parseTargetList(value);
            return values.some((address) => address < 0 || address >= maximum)
              ? `Every target must be between 0 and ${informationHex(maximum - 1, 6)}.`
              : undefined;
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
        },
      });
      if (targetInput === undefined) {
        return;
      }
      const targets = parseTargetList(targetInput);
      const detail = await window.showInputBox({
        title: "Resolve Indirect Target",
        prompt: "Optional manual-evidence note (leave empty for none)",
      });
      if (detail === undefined) {
        return;
      }
      const suffix = this.editSuffix(snapshot, {
        kind: "target",
        addressSpace: selected.site.addressSpace,
        address: selected.site.address,
        targets,
      });
      const request: TargetResolutionEditRequest = {
        overrideId: prior?.id ?? `manual.target.${suffix}`,
        evidenceId: `manual.evidence.target.${suffix}`,
        addressSpace: selected.site.addressSpace,
        address: selected.site.address,
        targets,
        sourceId: "vscode.analysis-coverage",
        ...(detail.trim() ? { detail: detail.trim() } : {}),
      };
      const applied = applyTargetResolutionEdit(snapshot, request);
      commitEditableSnapshot(projectDirectory, snapshot, applied.project);
      this.#undo.push({ kind: "target", projectDirectory, request, inverse: applied.inverse });
      this.#redo.length = 0;
      await this.updateContexts();
      this.#refresh();
      await window.showInformationMessage(
        `Resolved ${selected.label} to ${applied.inverse.after.targets.map((value) => informationHex(value, 6)).join(", ")}. Prior targets and evidence were retained.`,
      );
    } catch (error) {
      await this.showFailure("Could not resolve the indirect target", error);
    }
  }

  dispose(): void {
    for (const panel of this.#annotationPanels) {
      panel.dispose();
    }
    this.#annotationPanels.clear();
  }

  /**
   * Open the persistent annotation form, preferring ownership inferred from the selected source.
   * @param {string} [preferredProject] Directory already resolved by a semantic ownership action.
   */
  async editAnnotation(preferredProject?: string): Promise<void> {
    let form: ReturnType<typeof openDisassemblyAnnotationForm> | undefined;
    try {
      if (!workspace.isTrusted) {
        throw new Error("Analysis project edits require a trusted local workspace.");
      }
      const editor = window.activeTextEditor;
      const sourceEditor =
        editor && ["uttori-snes", "uttori-65xx"].includes(editor.document.languageId)
          ? editor
          : undefined;
      if (
        sourceEditor &&
        (sourceEditor.document.uri.scheme !== "file" || sourceEditor.document.isDirty)
      ) {
        throw new Error(
          "Use a saved, unchanged generated source file. Regenerate source if it was edited.",
        );
      }
      // Capture the original cursor before opening the beside panel changes focus.
      const source = sourceEditor
        ? {
            file: path.resolve(sourceEditor.document.uri.fsPath),
            sha256: createHash("sha256").update(sourceEditor.document.getText()).digest("hex"),
            line: sourceEditor.selection.active.line + 1,
            column: sourceEditor.selection.active.character,
          }
        : undefined;
      form = openDisassemblyAnnotationForm(this.extensionUri);
      const { panel } = form;
      this.#annotationPanels.add(panel);
      panel.onDidDispose(() => this.#annotationPanels.delete(panel));
      const managed = source && findManagedSourceFile(source.file);
      const inferred = managed && owningProject(managed, await readOwnershipProjects()).project;
      const projectDirectory = await this.chooseProject(
        preferredProject ?? inferred?.directory,
        "Edit Disassembly Annotation",
      );
      if (!projectDirectory) {
        panel.dispose();
        return;
      }
      if (form.disposed) {
        return;
      }
      const resolved = await analysisWorker().request<AnnotationLookupResult>(
        projectDirectory,
        "annotationLookup",
        {
          annotationLookup: {
            maps:
              source && !managed?.manifest.ownershipFile
                ? await discoverAnalysisDebugMapFiles()
                : [],
            source,
          },
        },
      );
      if (form.disposed) {
        return;
      }
      const selected =
        resolved.choices.length === 1
          ? resolved.choices[0]
          : (
              await window.showQuickPick(
                resolved.choices.map((choice) => ({
                  label: choice.location.name ?? informationHex(choice.location.address, 6),
                  description: `${choice.location.addressSpace} ${informationHex(choice.location.address, 6)}`,
                  choice,
                })),
                {
                  title: "Edit Disassembly Annotation",
                  placeHolder: "Choose the exact label or address to annotate",
                },
              )
            )?.choice;
      if (!selected) {
        panel.dispose();
        return;
      }
      const { location, label, inlineComments, hasInstruction } = selected;
      const inline =
        inlineComments.length < 2
          ? inlineComments[0]
          : (
              await window.showQuickPick(
                inlineComments.map((comment) => ({
                  label: comment.text,
                  description: comment.id,
                  comment,
                })),
                {
                  title: "Edit Instruction Comment",
                  placeHolder: "Choose the comment to edit. Other comments are preserved",
                },
              )
            )?.comment;
      if (inlineComments.length > 1 && !inline) {
        panel.dispose();
        return;
      }
      if (form.disposed) {
        return;
      }
      const identity = `${location.addressSpace}.${location.address.toString(16)}`;
      const initialFields = {
        name: label?.sourceName ?? location.name ?? "",
        comment: label?.comment ?? "",
        inlineComment: label?.inlineComment ?? "",
        instructionComment: inline?.text ?? "",
      };
      let annotationRefresh: AnnotationRefresh = { after: resolved.revision.manifestSha256 };
      form.initialize(
        {
          location: `${path.basename(projectDirectory)} · ${location.addressSpace} ${informationHex(location.address, 6)}`,
          fields: initialFields,
          hasInstruction: hasInstruction || Boolean(inline),
        },
        async (fields) => {
          this.assertTrustedProject(projectDirectory);
          if (
            source &&
            (createHash("sha256")
              .update(await fs.promises.readFile(source.file))
              .digest("hex") !== resolved.sourceHash ||
              sourceEditor?.document.isDirty)
          ) {
            throw new Error(
              "The source changed while this form was open. Reopen the annotation from current generated source.",
            );
          }
          if (canonicalEquals(fields, initialFields)) {
            return;
          }
          if (label && !fields.name.trim()) {
            throw new Error(
              "Keep a name for the existing label. Clear comment fields to remove comments.",
            );
          }
          const request: DisassemblyAnnotationEditRequest = {
            addressSpace: location.addressSpace,
            address: location.address,
            ...(fields.name.trim()
              ? {
                  labelId: label?.id ?? `manual.label.${identity}`,
                  name: fields.name,
                  comment: fields.comment,
                  inlineComment: fields.inlineComment,
                }
              : { comment: fields.comment, inlineComment: fields.inlineComment }),
            instructionCommentId: inline?.id ?? `manual.comment.instruction.${identity}`,
            instructionComment: fields.instructionComment,
            evidenceId: `manual.evidence.annotation.${this.editSuffix(resolved, { ...location, ...fields })}`,
            sourceId: "vscode.disassembly-annotation",
          };
          const { refresh, ...inverse } = await analysisWorker().request<AnnotationSaveResult>(
            projectDirectory,
            "annotationSave",
            {
              annotationSave: {
                revision: resolved.revision,
                request,
                sourceFile: resolved.sourceFile,
                sourceHash: resolved.sourceHash,
                sourceDirectory: resolved.sourceDirectory,
              },
            },
          );
          annotationRefresh = refresh;
          this.#undo.push({ kind: "annotation", projectDirectory, request, inverse });
          this.#redo.length = 0;
          await this.updateContexts();
          this.#refresh();
          void window.showInformationMessage(
            `Saved annotation at ${location.addressSpace} ${informationHex(location.address, 6)}. Regenerate disassembly to apply it to source.`,
          );
        },
        async () => {
          await commands.executeCommand("asm.disassembly.regenerate", {
            projectDirectory,
            annotationRefresh,
            ...(resolved.sourceDirectory ? { sourceDirectory: resolved.sourceDirectory } : {}),
          });
        },
      );
    } catch (error) {
      if (form) {
        form.fail(error);
      } else {
        await this.showFailure("Could not edit the disassembly annotation", error);
      }
    }
  }

  async renameLabel(target?: AnalysisCoverageEditTarget): Promise<void> {
    try {
      if (!workspace.isTrusted) {
        await window.showErrorMessage(
          "Analysis project edits require a trusted local workspace. The coverage view remains read-only.",
        );
        return;
      }
      const projectDirectory = await this.chooseProject(
        target?.projectDirectory,
        "Rename Analysis Label",
      );
      if (!projectDirectory) {
        return;
      }
      const snapshot = loadEditableSnapshot(projectDirectory);
      if (snapshot.shards.labels.length === 0) {
        await window.showErrorMessage("The selected project has no label to rename.");
        return;
      }
      const selected = await window.showQuickPick(
        [...snapshot.shards.labels]
          .sort(
            (left, right) =>
              left.addressSpace.localeCompare(right.addressSpace) ||
              left.address - right.address ||
              left.id.localeCompare(right.id),
          )
          .map((label) => ({
            label: label.name,
            description: `${label.addressSpace} ${informationHex(label.address, 6)} · ${label.id}`,
            projectLabel: label,
          })),
        { title: "Rename Analysis Label", placeHolder: "Choose a stable native label record" },
      );
      if (!selected) {
        return;
      }
      const name = await window.showInputBox({
        title: "Rename Analysis Label",
        prompt: `New native name for '${selected.projectLabel.id}'`,
        value: selected.projectLabel.name,
        validateInput: (value) => {
          if (value.trim() === "") {
            return "A label name cannot be empty.";
          }
          if (value.trim() === selected.projectLabel.name) {
            return "Enter a different label name.";
          }
          return undefined;
        },
      });
      if (name === undefined) {
        return;
      }
      const detail = await window.showInputBox({
        title: "Rename Analysis Label",
        prompt: "Optional manual-evidence note (leave empty for the generated rename explanation)",
      });
      if (detail === undefined) {
        return;
      }
      const suffix = this.editSuffix(snapshot, {
        kind: "label",
        labelId: selected.projectLabel.id,
        name: name.trim(),
      });
      const request: LabelRenameEditRequest = {
        labelId: selected.projectLabel.id,
        evidenceId: `manual.evidence.label.${suffix}`,
        name: name.trim(),
        sourceId: "vscode.analysis-coverage",
        ...(detail.trim() ? { detail: detail.trim() } : {}),
      };
      const applied = applyLabelRenameEdit(snapshot, request);
      commitEditableSnapshot(projectDirectory, snapshot, applied.project);
      this.#undo.push({ kind: "label", projectDirectory, request, inverse: applied.inverse });
      this.#redo.length = 0;
      await this.updateContexts();
      this.#refresh();
      const action = await window.showInformationMessage(
        `Renamed '${applied.inverse.before.name}' to '${applied.inverse.after.name}' with manual provenance.`,
        "Analyze and Regenerate",
      );
      if (action === "Analyze and Regenerate") {
        await commands.executeCommand("asm.disassembly.regenerate", { projectDirectory });
      }
    } catch (error) {
      await this.showFailure("Could not rename the analysis label", error);
    }
  }

  async explainEvidence(target?: AnalysisCoverageEditTarget): Promise<void> {
    try {
      const projectDirectory = await this.chooseProject(
        target?.projectDirectory,
        "Explain Analysis Evidence",
        false,
      );
      if (!projectDirectory) {
        return;
      }
      const snapshot = await analysisWorker().request<
        Pick<AnalysisProjectSnapshot, "manifest" | "shards">
      >(projectDirectory, "evidenceChoices", {
        ...(target
          ? {
              evidenceSelection: {
                annotations: target.annotationIds,
                analysis: [...target.analysisIds, ...target.conflictIds],
                runtime: target.runtimeIds,
                regions: target.regionIds,
              },
            }
          : {}),
      });
      const choices = this.evidenceChoices(snapshot.shards);
      if (choices.length === 0) {
        await window.showInformationMessage(
          target
            ? "This ROM-map segment has no persisted record with explainable evidence."
            : "The selected project has no persisted record to explain.",
        );
        return;
      }
      const selected = await window.showQuickPick(choices, {
        title: "Explain Analysis Evidence",
        placeHolder:
          "Choose a record (up to 200 per collection). Open a coverage segment to narrow the list",
      });
      if (!selected) {
        return;
      }
      const explanation = await analysisWorker().request<ProjectEvidenceExplanation>(
        projectDirectory,
        "explainEvidence",
        { evidenceRecord: { kind: selected.shard, id: selected.recordId } },
      );
      const content = this.renderEvidenceExplanation(projectDirectory, explanation);
      const document = await workspace.openTextDocument({ language: "markdown", content });
      await window.showTextDocument(document, { preview: true });
    } catch (error) {
      await this.showFailure("Could not explain analysis evidence", error);
    }
  }

  async undo(): Promise<void> {
    const entry = this.#undo.at(-1);
    if (!entry) {
      await window.showInformationMessage("There is no analysis-project edit to undo.");
      return;
    }
    try {
      this.assertTrustedProject(entry.projectDirectory);
      const snapshot = loadEditableSnapshot(
        entry.projectDirectory,
        entry.kind === "annotation" ? entry.request : undefined,
      );
      const project = this.revertEdit(snapshot, entry);
      commitEditableSnapshot(entry.projectDirectory, snapshot, project);
      this.#undo.pop();
      this.#redo.push(entry);
      await this.updateContexts();
      this.#refresh();
      await window.showInformationMessage(`Undid ${this.editDescription(entry)}.`);
    } catch (error) {
      await this.showFailure("Could not undo the analysis-project edit", error);
    }
  }

  async redo(): Promise<void> {
    const entry = this.#redo.at(-1);
    if (!entry) {
      await window.showInformationMessage("There is no analysis-project edit to redo.");
      return;
    }
    try {
      this.assertTrustedProject(entry.projectDirectory);
      const snapshot = loadEditableSnapshot(
        entry.projectDirectory,
        entry.kind === "annotation" ? entry.request : undefined,
      );
      const reapplied = this.reapplyEdit(snapshot, entry);
      commitEditableSnapshot(entry.projectDirectory, snapshot, reapplied.project);
      this.#redo.pop();
      this.#undo.push(reapplied.history);
      await this.updateContexts();
      this.#refresh();
      await window.showInformationMessage(`Redid ${this.editDescription(entry)}.`);
    } catch (error) {
      await this.showFailure("Could not redo the analysis-project edit", error);
    }
  }

  private async chooseProject(
    preferred: string | undefined,
    title: string,
    requiresTrust = true,
  ): Promise<string | undefined> {
    if (preferred) {
      if (requiresTrust) {
        this.assertTrustedProject(preferred);
      }
      return preferred;
    }
    const found = await findAnalysisProjectDirectories();
    const directories = requiresTrust ? found.filter(isLocalWorkspaceProject) : found;
    if (directories.length === 0) {
      await window.showErrorMessage(
        requiresTrust
          ? "No native analysis project was found inside this trusted local workspace."
          : "No native analysis project was found.",
      );
      return undefined;
    }
    if (directories.length === 1) {
      return directories[0];
    }
    const selected = await window.showQuickPick(
      directories.map((directory) => ({
        label: path.basename(directory),
        description: directory,
        directory,
      })),
      {
        title,
        placeHolder: requiresTrust
          ? "Choose the native analysis project to edit"
          : "Choose the native analysis project to inspect",
      },
    );
    return selected?.directory;
  }

  private editSuffix(
    snapshot: Pick<AnalysisProjectSnapshot, "revision">,
    input: Readonly<Record<string, unknown>>,
  ): string {
    return createHash("sha256")
      .update(canonicalJson({ revision: snapshot.revision.manifestSha256, ...input }))
      .digest("hex")
      .slice(0, 20);
  }

  private revertEdit(
    snapshot: AnalysisProjectSnapshot,
    entry: AnalysisEditHistoryEntry,
  ): AnalysisProject {
    switch (entry.kind) {
      case "range":
        return revertRangeClassificationEdit(snapshot, entry.inverse);
      case "state-entry":
        return revertStateEntryPointEdit(snapshot, entry.inverse);
      case "target":
        return revertTargetResolutionEdit(snapshot, entry.inverse);
      case "label":
        return revertLabelRenameEdit(snapshot, entry.inverse);
      case "annotation":
        return revertDisassemblyAnnotationEdit(snapshot, entry.inverse);
    }
    throw new Error("Unknown analysis edit history entry.");
  }

  private reapplyEdit(
    snapshot: AnalysisProjectSnapshot,
    entry: AnalysisEditHistoryEntry,
  ): { readonly project: AnalysisProject; readonly history: AnalysisEditHistoryEntry } {
    switch (entry.kind) {
      case "range": {
        const applied = applyRangeClassificationEdit(snapshot, entry.request);
        return { project: applied.project, history: { ...entry, inverse: applied.inverse } };
      }
      case "state-entry": {
        const applied = applyStateEntryPointEdit(snapshot, entry.request);
        return { project: applied.project, history: { ...entry, inverse: applied.inverse } };
      }
      case "target": {
        const applied = applyTargetResolutionEdit(snapshot, entry.request);
        return { project: applied.project, history: { ...entry, inverse: applied.inverse } };
      }
      case "label": {
        const applied = applyLabelRenameEdit(snapshot, entry.request);
        return { project: applied.project, history: { ...entry, inverse: applied.inverse } };
      }
      case "annotation": {
        const applied = applyDisassemblyAnnotationEdit(snapshot, entry.request);
        return { project: applied.project, history: { ...entry, inverse: applied.inverse } };
      }
    }
    throw new Error("Unknown analysis edit history entry.");
  }

  private editDescription(entry: AnalysisEditHistoryEntry): string {
    switch (entry.kind) {
      case "range":
        return `classification [${informationHex(entry.request.start, 6)}, ${informationHex(entry.request.end, 6)})`;
      case "state-entry":
        return `state/entry-point overlay on '${entry.request.baseAnnotationId}'`;
      case "target":
        return `target resolution at ${informationHex(entry.request.address, 6)}`;
      case "label":
        return `label rename to '${entry.request.name}'`;
      case "annotation":
        return `annotation at ${entry.request.addressSpace} ${informationHex(entry.request.address, 6)}`;
    }
    throw new Error("Unknown analysis edit history entry.");
  }

  private evidenceChoices(shards: AnalysisProjectShards): Array<{
    readonly label: string;
    readonly description: string;
    readonly key: string;
    readonly shard: keyof AnalysisProjectShards;
    readonly recordId: string;
  }> {
    const kinds: readonly (keyof AnalysisProjectShards)[] = [
      "analysis",
      "annotations",
      "labels",
      "comments",
      "regions",
      "runtime",
      "evidence",
      "imports",
    ];
    return kinds.flatMap((shard) =>
      shards[shard].map((record) => ({
        label: record.id,
        description: shard,
        key: `${shard}:${record.id}`,
        shard,
        recordId: record.id,
      })),
    );
  }

  private renderEvidenceExplanation(
    projectDirectory: string,
    explanation: ProjectEvidenceExplanation,
  ): string {
    const indentedJson = (value: unknown): string =>
      canonicalJson(value)
        .trimEnd()
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
    const sections = [
      "# Analysis evidence explanation",
      "",
      "Project:",
      "",
      `    ${projectDirectory}`,
      "",
      `Record (${explanation.shard}):`,
      "",
      indentedJson(explanation.record),
      "",
      "## Direct evidence",
      "",
      explanation.evidence.length === 0
        ? "No direct evidence ids are attached to this record."
        : explanation.evidence.map(indentedJson).join("\n\n"),
      "",
      "## Reverse references",
      ...(explanation.referencedByTotal === undefined
        ? []
        : [
            `Showing ${explanation.referencedBy.length} of ${explanation.referencedByTotal} references.`,
            "",
          ]),
      "",
      explanation.referencedBy.length === 0
        ? "No project records reference this evidence."
        : explanation.referencedBy.map((reference) => `    ${reference}`).join("\n"),
      "",
      "## Related persisted conflicts",
      "",
      explanation.conflicts.length === 0
        ? "No persisted conflict shares this record or its evidence."
        : explanation.conflicts.map(indentedJson).join("\n\n"),
      "",
    ];
    return sections.join("\n");
  }

  private assertTrustedProject(directory: string): void {
    if (!workspace.isTrusted || !isLocalWorkspaceProject(directory)) {
      throw new Error("Analysis project edits require a trusted local workspace project.");
    }
  }

  private async updateContexts(): Promise<void> {
    await Promise.all([
      commands.executeCommand("setContext", "asm.coverage.canUndo", this.#undo.length > 0),
      commands.executeCommand("setContext", "asm.coverage.canRedo", this.#redo.length > 0),
    ]);
  }

  private async showFailure(prefix: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await window.showErrorMessage(`${prefix}: ${message}`);
  }
}
