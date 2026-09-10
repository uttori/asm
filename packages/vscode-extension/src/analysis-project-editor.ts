/** Trusted-workspace commands for conflict-safe, reversible native project edits. */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  RANGE_CLASSIFICATIONS,
  applyLabelRenameEdit,
  applyDisassemblyAnnotationEdit,
  applyRangeClassificationEdit,
  applyStateEntryPointEdit,
  applyTargetResolutionEdit,
  canonicalJson,
  commitAnalysisProjectViewUpdate,
  explainProjectEvidence,
  loadAnalysisProjectSnapshot,
  loadAnalysisProjectViewSnapshot,
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

import { discoverAnalysisDebugMapFiles } from "./analysis-debug-maps.js";
import { analysisWorker } from "./analysis-worker-client.js";
import {
  findAnalysisProjectDirectories,
  type AnalysisCoverageEditTarget,
} from "./coverage-tree.js";
import type { AnnotationLookupResult } from "./disassembly-annotation-data.js";
import { openDisassemblyAnnotationForm } from "./disassembly-annotation-form.js";

/**
 * Editing changes metadata only; runtime remains in SQLite through edits and undo/redo.
 * @param {string} directory Selected project root.
 * @returns {AnalysisProjectSnapshot} Metadata in the editor's record shape, paired with its revision.
 */
const loadEditableSnapshot = (directory: string): AnalysisProjectSnapshot => {
  const loaded = loadAnalysisProjectViewSnapshot(directory);
  return { manifest: loaded.manifest, shards: loaded.view, revision: loaded.revision };
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
  const { runtime: _runtime, ...updates } = project.shards;
  commitAnalysisProjectViewUpdate(
    directory,
    { manifest: snapshot.manifest, view: snapshot.shards, revision: snapshot.revision },
    updates,
  );
};

interface RangeHistoryEntry {
  readonly kind: "range";
  readonly projectDirectory: string;
  readonly request: RangeClassificationEditRequest;
  readonly inverse: RangeClassificationInverse;
}

interface StateEntryHistoryEntry {
  readonly kind: "state-entry";
  readonly projectDirectory: string;
  readonly request: StateEntryPointEditRequest;
  readonly inverse: StateEntryPointInverse;
}

interface TargetHistoryEntry {
  readonly kind: "target";
  readonly projectDirectory: string;
  readonly request: TargetResolutionEditRequest;
  readonly inverse: TargetResolutionInverse;
}

interface LabelHistoryEntry {
  readonly kind: "label";
  readonly projectDirectory: string;
  readonly request: LabelRenameEditRequest;
  readonly inverse: LabelRenameInverse;
}

interface AnnotationHistoryEntry {
  readonly kind: "annotation";
  readonly projectDirectory: string;
  readonly request: DisassemblyAnnotationEditRequest;
  readonly inverse: DisassemblyAnnotationInverse;
}

type AnalysisEditHistoryEntry =
  | RangeHistoryEntry
  | StateEntryHistoryEntry
  | TargetHistoryEntry
  | LabelHistoryEntry
  | AnnotationHistoryEntry;

interface StateEntrySelection {
  readonly state?: ManualAnnotationState;
  readonly entryPoint: boolean;
}

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

type MutableManualState = {
  -readonly [Field in keyof ManualAnnotationState]?: ManualAnnotationState[Field];
};

const parseAddress = (input: string): number | undefined => {
  const value = input.trim();
  let parsed: number;
  if (/^\$[\da-f]+$/i.test(value)) parsed = Number.parseInt(value.slice(1), 16);
  else if (/^0x[\da-f]+$/i.test(value)) parsed = Number.parseInt(value.slice(2), 16);
  else if (/^\d+$/.test(value)) parsed = Number.parseInt(value, 10);
  else return undefined;
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const hexadecimal = (value: number): string =>
  `$${value.toString(16).toUpperCase().padStart(6, "0")}`;

const isLocalWorkspaceProject = (directory: string): boolean => {
  const folder = workspace.getWorkspaceFolder(Uri.file(directory));
  return folder?.uri.scheme === "file";
};

const parseStateEntrySelection = (input: string): StateEntrySelection => {
  const state: MutableManualState = {};
  const seen = new Set<string>();
  let entryPoint = false;
  for (const rawDirective of input.split(",")) {
    const directive = rawDirective.trim();
    if (directive === "") continue;
    if (["entry", "entrypoint", "entry-point"].includes(directive.toLowerCase())) {
      if (entryPoint) throw new Error("Entry point was specified more than once.");
      entryPoint = true;
      continue;
    }
    const separator = directive.indexOf("=");
    if (separator < 1) throw new Error(`State directive '${directive}' needs '='.`);
    const rawKey = directive.slice(0, separator).trim().toLowerCase();
    const rawValue = directive
      .slice(separator + 1)
      .trim()
      .toLowerCase();
    const key = STATE_FIELD_ALIASES[rawKey];
    if (!key) throw new Error(`Unknown state field '${rawKey}'.`);
    if (seen.has(key)) throw new Error(`State field '${key}' was specified more than once.`);
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
      if (value === undefined) throw new Error(`State field '${key}' needs an integer value.`);
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
      if (!projectDirectory) return;
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
        prompt: "Start address (inclusive; use $ or 0x for hexadecimal, otherwise decimal)",
        value: hexadecimal(suggestedStart),
        validateInput: (value) => {
          const parsed = parseAddress(value);
          return parsed === undefined || parsed < 0 || parsed >= maximum
            ? `Enter an address from 0 through ${hexadecimal(maximum - 1)}.`
            : undefined;
        },
      });
      if (startInput === undefined) return;
      const start = parseAddress(startInput)!;
      const suggestedEnd = target?.end ?? Math.min(start + 1, maximum);
      const endInput = await window.showInputBox({
        title: "Classify Analysis Range",
        prompt: "End address (exclusive; use $ or 0x for hexadecimal, otherwise decimal)",
        value: hexadecimal(suggestedEnd),
        validateInput: (value) => {
          const parsed = parseAddress(value);
          return parsed === undefined || parsed <= start || parsed > maximum
            ? `Enter an address greater than ${hexadecimal(start)} and no greater than ${hexadecimal(maximum)}.`
            : undefined;
        },
      });
      if (endInput === undefined) return;
      const end = parseAddress(endInput)!;
      const classificationChoice = await window.showQuickPick(
        RANGE_CLASSIFICATIONS.map((classification) => ({ label: classification, classification })),
        {
          title: "Classify Analysis Range",
          placeHolder: "Choose a native range classification",
        },
      );
      if (!classificationChoice) return;
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
      if (architectureInput === undefined) return;
      const detail = await window.showInputBox({
        title: "Classify Analysis Range",
        prompt: "Optional manual-evidence note (leave empty for none)",
      });
      if (detail === undefined) return;

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
        `Classified [${hexadecimal(start)}, ${hexadecimal(end)}) as ${classification}.${
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
      if (!projectDirectory) return;
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
          description: `${annotation.addressSpace} [${hexadecimal(annotation.start)}, ${hexadecimal(annotation.end)}) · ${annotation.classification} · ${annotation.architecture}`,
          annotation,
        })),
        {
          title: "Set Analysis State / Entry Point",
          placeHolder: "Choose the classified interval that should carry the manual overlay",
        },
      );
      if (!selected) return;
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
      if (directiveInput === undefined) return;
      const selection = parseStateEntrySelection(directiveInput);
      const detail = await window.showInputBox({
        title: "Set Analysis State / Entry Point",
        prompt: "Optional manual-evidence note (leave empty for none)",
      });
      if (detail === undefined) return;
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
            : `; preserved ${applied.inverse.conflicts.length} contradictory state record(s) as conflicts.`
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
      if (!projectDirectory) return;
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
        if (record.kind !== "unresolved" && record.kind !== "target-override") continue;
        const key = `${record.addressSpace}:${record.address}`;
        const site = sites.get(key) ?? {
          addressSpace: record.addressSpace,
          address: record.address,
          descriptions: [],
        };
        site.descriptions.push(
          record.kind === "unresolved"
            ? `${record.flowKind}: ${record.reason}`
            : `existing targets: ${record.targets.map(hexadecimal).join(", ")}`,
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
            label: `${site.addressSpace} ${hexadecimal(site.address)}`,
            description: site.descriptions.join(" · "),
            site,
          })),
        {
          title: "Resolve Indirect Target",
          placeHolder: "Choose an unresolved site or augment its existing observed targets",
        },
      );
      if (!selected) return;
      const prior = snapshot.shards.analysis.find(
        (record) =>
          record.kind === "target-override" &&
          record.addressSpace === selected.site.addressSpace &&
          record.address === selected.site.address,
      );
      const addressSpace = snapshot.manifest.addressSpaces.find(
        ({ id }) => id === selected.site.addressSpace,
      );
      if (!addressSpace)
        throw new Error(`Unknown analysis address space '${selected.site.addressSpace}'.`);
      // File offsets stop at the ROM size; CPU addresses use the full address width.
      const maximum =
        addressSpace.kind === "file"
          ? snapshot.manifest.rom.contentSize
          : 2 ** addressSpace.addressBits;
      const targetInput = await window.showInputBox({
        title: "Resolve Indirect Target",
        prompt: `Comma-separated targets in '${selected.site.addressSpace}' (use $ or 0x for hexadecimal)`,
        value: prior?.kind === "target-override" ? prior.targets.map(hexadecimal).join(", ") : "",
        validateInput: (value) => {
          try {
            const values = parseTargetList(value);
            return values.some((address) => address < 0 || address >= maximum)
              ? `Every target must be between 0 and ${hexadecimal(maximum - 1)}.`
              : undefined;
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
        },
      });
      if (targetInput === undefined) return;
      const targets = parseTargetList(targetInput);
      const detail = await window.showInputBox({
        title: "Resolve Indirect Target",
        prompt: "Optional manual-evidence note (leave empty for none)",
      });
      if (detail === undefined) return;
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
        `Resolved ${selected.label} to ${applied.inverse.after.targets.map(hexadecimal).join(", ")}; prior targets and evidence were retained.`,
      );
    } catch (error) {
      await this.showFailure("Could not resolve the indirect target", error);
    }
  }

  dispose(): void {
    for (const panel of this.#annotationPanels) panel.dispose();
    this.#annotationPanels.clear();
  }

  async editAnnotation(): Promise<void> {
    let form: ReturnType<typeof openDisassemblyAnnotationForm> | undefined;
    try {
      if (!workspace.isTrusted)
        throw new Error("Analysis project edits require a trusted local workspace.");
      const editor = window.activeTextEditor;
      const sourceEditor =
        editor && ["uttori-snes", "uttori-65xx"].includes(editor.document.languageId)
          ? editor
          : undefined;
      if (
        sourceEditor &&
        (sourceEditor.document.uri.scheme !== "file" || sourceEditor.document.isDirty)
      )
        throw new Error(
          "Use a saved, unchanged generated source file. Regenerate source if it was edited.",
        );
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
      const projectDirectory = await this.chooseProject(undefined, "Edit Disassembly Annotation");
      if (!projectDirectory) {
        panel.dispose();
        return;
      }
      if (form.disposed) return;
      const resolved = await analysisWorker().request<AnnotationLookupResult>(
        projectDirectory,
        "annotationLookup",
        {
          annotationLookup: { maps: source ? await discoverAnalysisDebugMapFiles() : [], source },
        },
      );
      if (form.disposed) return;
      const selected =
        resolved.choices.length === 1
          ? resolved.choices[0]
          : (
              await window.showQuickPick(
                resolved.choices.map((choice) => ({
                  label: choice.location.name ?? hexadecimal(choice.location.address),
                  description: `${choice.location.addressSpace} ${hexadecimal(choice.location.address)}`,
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
                  placeHolder: "Choose the comment to edit; other comments are preserved",
                },
              )
            )?.comment;
      if (inlineComments.length > 1 && !inline) {
        panel.dispose();
        return;
      }
      if (form.disposed) return;
      const identity = `${location.addressSpace}.${location.address.toString(16)}`;
      const initialFields = {
        name: label?.sourceName ?? location.name ?? "",
        comment: label?.comment ?? "",
        inlineComment: label?.inlineComment ?? "",
        instructionComment: inline?.text ?? "",
      };
      form.initialize(
        {
          location: `${path.basename(projectDirectory)} · ${location.addressSpace} ${hexadecimal(location.address)}`,
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
          )
            throw new Error(
              "The source changed while this form was open. Reopen the annotation from current generated source.",
            );
          if (canonicalJson(fields) === canonicalJson(initialFields)) return;
          if (label && !fields.name.trim())
            throw new Error(
              "Keep a name for the existing label; clear comment fields to remove comments.",
            );
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
          const inverse = await analysisWorker().request<DisassemblyAnnotationInverse>(
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
          this.#undo.push({ kind: "annotation", projectDirectory, request, inverse });
          this.#redo.length = 0;
          await this.updateContexts();
          this.#refresh();
          void window.showInformationMessage(
            `Saved annotation at ${location.addressSpace} ${hexadecimal(location.address)}. Regenerate disassembly to apply it to source.`,
          );
        },
        async () => {
          await commands.executeCommand("asm.disassembly.regenerate", {
            projectDirectory,
            ...(resolved.sourceDirectory ? { sourceDirectory: resolved.sourceDirectory } : {}),
          });
        },
      );
    } catch (error) {
      if (form) form.fail(error);
      else await this.showFailure("Could not edit the disassembly annotation", error);
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
      if (!projectDirectory) return;
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
            description: `${label.addressSpace} ${hexadecimal(label.address)} · ${label.id}`,
            projectLabel: label,
          })),
        { title: "Rename Analysis Label", placeHolder: "Choose a stable native label record" },
      );
      if (!selected) return;
      const name = await window.showInputBox({
        title: "Rename Analysis Label",
        prompt: `New native name for '${selected.projectLabel.id}'`,
        value: selected.projectLabel.name,
        validateInput: (value) => {
          if (value.trim() === "") return "A label name cannot be empty.";
          if (value.trim() === selected.projectLabel.name) return "Enter a different label name.";
          return undefined;
        },
      });
      if (name === undefined) return;
      const detail = await window.showInputBox({
        title: "Rename Analysis Label",
        prompt: "Optional manual-evidence note (leave empty for the generated rename explanation)",
      });
      if (detail === undefined) return;
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
      if (action === "Analyze and Regenerate")
        await commands.executeCommand("asm.disassembly.regenerate", { projectDirectory });
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
      if (!projectDirectory) return;
      const snapshot = loadAnalysisProjectSnapshot(projectDirectory);
      const preferred = new Set([
        ...(target?.annotationIds.map((id) => `annotations:${id}`) ?? []),
        ...(target?.analysisIds.map((id) => `analysis:${id}`) ?? []),
        ...(target?.runtimeIds.map((id) => `runtime:${id}`) ?? []),
        ...(target?.conflictIds.map((id) => `analysis:${id}`) ?? []),
        ...(target?.regionIds.map((id) => `regions:${id}`) ?? []),
      ]);
      const choices = this.evidenceChoices(snapshot.shards).filter(
        ({ key }) => preferred.size === 0 || preferred.has(key),
      );
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
        placeHolder: "Choose a persisted record to trace back to its evidence",
      });
      if (!selected) return;
      const explanation = explainProjectEvidence(
        snapshot.shards,
        selected.shard,
        selected.recordId,
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
      const snapshot = loadEditableSnapshot(entry.projectDirectory);
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
      const snapshot = loadEditableSnapshot(entry.projectDirectory);
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
      if (requiresTrust) this.assertTrustedProject(preferred);
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
    if (directories.length === 1) return directories[0];
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
        return `classification [${hexadecimal(entry.request.start)}, ${hexadecimal(entry.request.end)})`;
      case "state-entry":
        return `state/entry-point overlay on '${entry.request.baseAnnotationId}'`;
      case "target":
        return `target resolution at ${hexadecimal(entry.request.address)}`;
      case "label":
        return `label rename to '${entry.request.name}'`;
      case "annotation":
        return `annotation at ${entry.request.addressSpace} ${hexadecimal(entry.request.address)}`;
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
