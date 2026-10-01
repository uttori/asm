/** Read-only evidence inspection; research edits belong to Git source declarations. */
import * as path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";
import type {
  AnalysisProjectSnapshot,
  AnalysisProjectShards,
  ProjectEvidenceExplanation,
} from "@uttori/asm-disassembler";
import { window, workspace } from "vscode";

import {
  findAnalysisProjectDirectories,
  type AnalysisCoverageEditTarget,
} from "./coverage-tree.js";
import { analysisWorker } from "./worker-client.js";

/** Bounded evidence queries rendered as ordinary read-only inspection documents. */
export class AnalysisEvidenceInspector {
  async explainEvidence(target?: AnalysisCoverageEditTarget): Promise<void> {
    try {
      const projectDirectory = await this.chooseProject(
        target?.projectDirectory,
        "Explain Analysis Evidence",
      );
      if (!projectDirectory) {
        return;
      }
      const snapshot = await analysisWorker().request<
        Pick<AnalysisProjectSnapshot, "manifest" | "shards">
      >(projectDirectory, "evidenceChoices", (target
          ? {
              evidenceSelection: {
                annotations: target.annotationIds,
                analysis: [...target.analysisIds, ...target.conflictIds],
                runtime: target.runtimeIds,
                regions: target.regionIds,
              },
            }
          : {}));
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

  /** A selected coverage row keeps its exact store identity; otherwise use current project discovery. */
  private async chooseProject(
    preferred: string | undefined,
    title: string,
  ): Promise<string | undefined> {
    if (preferred) {
      return preferred;
    }
    const directories = await findAnalysisProjectDirectories();
    if (!directories.length) {
      await window.showErrorMessage("No native analysis project was found.");
      return undefined;
    }
    if (directories.length === 1) {
      return directories[0];
    }
    return (
      await window.showQuickPick(
        directories.map((directory) => ({
          label: path.basename(directory),
          description: directory,
          directory,
        })),
        { title, placeHolder: "Choose the native analysis project to inspect" },
      )
    )?.directory;
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

  private async showFailure(prefix: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await window.showErrorMessage(`${prefix}: ${message}`);
  }
}
