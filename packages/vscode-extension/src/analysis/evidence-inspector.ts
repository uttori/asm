/** Read-only evidence inspection; research edits belong to Git source declarations. */
import * as path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { window, workspace } from "vscode";

import { findAnalysisProjectDirectories } from "./project-discovery.js";
import { analysisWorker } from "./worker-client.js";

const EVIDENCE_SHARDS = [
  "analysis",
  "annotations",
  "labels",
  "comments",
  "regions",
  "runtime",
  "evidence",
  "imports",
] as const;

/** One persisted evidence shard kind exposed to the inspector picker. */
type EvidenceShard = (typeof EVIDENCE_SHARDS)[number];

/** Worker snapshot listing selectable record ids grouped by shard. */
interface EvidenceChoiceSnapshot {
  readonly shards: { readonly [K in EvidenceShard]: readonly { readonly id: string }[] };
}

/** Expanded explanation payload for one selected evidence record. */
interface EvidenceExplanationView {
  readonly shard: string;
  readonly record: object;
  readonly evidence: readonly unknown[];
  readonly referencedBy: readonly string[];
  readonly referencedByTotal?: number;
  readonly conflicts: readonly unknown[];
}

/** Narrow worker payloads to plain objects before validation. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Require a persisted string id on one catalog row. */
function isIdRecord(value: unknown): value is { readonly id: string } {
  return isRecord(value) && typeof value.id === "string";
}

/** Validate the evidence choice snapshot returned by the analysis worker. */
function isEvidenceChoices(value: unknown): value is EvidenceChoiceSnapshot {
  if (!isRecord(value) || !isRecord(value.shards)) {
    return false;
  }
  const shards = value.shards;
  return EVIDENCE_SHARDS.every(
    (kind) => Array.isArray(shards[kind]) && shards[kind].every(isIdRecord),
  );
}

/** Validate one explainEvidence response before rendering the document. */
function isEvidenceExplanation(value: unknown): value is EvidenceExplanationView {
  return (
    isRecord(value) &&
    typeof value.shard === "string" &&
    typeof value.record === "object" &&
    value.record !== null &&
    Array.isArray(value.evidence) &&
    Array.isArray(value.referencedBy) &&
    value.referencedBy.every((reference) => typeof reference === "string") &&
    Array.isArray(value.conflicts) &&
    (value.referencedByTotal === undefined || typeof value.referencedByTotal === "number")
  );
}

/** Render canonical JSON indented for read-only inspection documents. */
const indentedJson = (value: unknown): string =>
  canonicalJson(value)
    .trimEnd()
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

/** Bounded evidence queries rendered as ordinary read-only inspection documents. */
export class AnalysisEvidenceInspector {
  /** Prompt for a record and open a read-only explanation document. */
  async explainEvidence(): Promise<void> {
    try {
      const projectDirectory = await this.chooseProject("Explain Analysis Evidence");
      if (!projectDirectory) {
        return;
      }
      const snapshot = await analysisWorker().request(projectDirectory, "evidenceChoices");
      if (!isEvidenceChoices(snapshot)) {
        throw new Error("Analysis evidence choices are unavailable.");
      }
      const choices = this.evidenceChoices(snapshot.shards);
      if (choices.length === 0) {
        await window.showInformationMessage(
          "The selected project has no persisted record to explain.",
        );
        return;
      }
      const selected = await window.showQuickPick(choices, {
        title: "Explain Analysis Evidence",
        placeHolder: "Choose a record (up to 200 per collection)",
      });
      if (!selected) {
        return;
      }
      const explanation = await analysisWorker().request(projectDirectory, "explainEvidence", {
        evidenceRecord: { kind: selected.shard, id: selected.recordId },
      });
      if (!isEvidenceExplanation(explanation)) {
        throw new Error("Analysis evidence explanation is unavailable.");
      }
      const content = this.renderEvidenceExplanation(projectDirectory, explanation);
      const document = await workspace.openTextDocument({ language: "markdown", content });
      await window.showTextDocument(document, { preview: true });
    } catch (error) {
      await this.showFailure("Could not explain analysis evidence", error);
    }
  }

  /** Resolve evidence independently of the build conversion sidebar. */
  private async chooseProject(title: string): Promise<string | undefined> {
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
  private evidenceChoices(shards: EvidenceChoiceSnapshot["shards"]): Array<{
    readonly label: string;
    readonly description: string;
    readonly key: string;
    readonly shard: EvidenceShard;
    readonly recordId: string;
  }> {
    const kinds = EVIDENCE_SHARDS;
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
    explanation: EvidenceExplanationView,
  ): string {
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
