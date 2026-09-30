import { canonicalEquals } from "@uttori/asm-core/canonical-json";

import {
  validateEditableMetadataRecord,
  validateMetadataReceipt,
} from "../model/metadata-validation.js";
export {
  validateEditableMetadataRecord,
  validateMetadataReceipt,
} from "../model/metadata-validation.js";
import { projectSourceLabelNames } from "../model/project-labels.js";
import type {
  AnalysisProject,
  AnalysisProjectManifest,
  AnalysisProjectShards,
  AnalysisMetadataEditRecord,
  EditableMetadataRecord,
  EvidenceRecord,
  IntervalAnnotation,
  MetadataRecordChange,
  MetadataShard,
  ProjectLabel,
} from "../model/project-types.js";
import { validateLoadedShards } from "../model/project-validation.js";

/** Semantic operations always address stable native IDs, never generated source spelling. */
export type MetadataOperation =
  | { readonly kind: "put"; readonly shard: MetadataShard; readonly record: EditableMetadataRecord }
  | { readonly kind: "remove"; readonly shard: MetadataShard; readonly id: string }
  | {
      readonly kind: "remove-label";
      readonly id: string;
      readonly preserveComments?: boolean;
      readonly preserveEntryPoint?: boolean;
    }
  | { readonly kind: "reset-label"; readonly id: string }
  | {
      readonly kind: "split-classification";
      readonly id: string;
      readonly at: number;
      readonly rightId: string;
    }
  | { readonly kind: "restore"; readonly receiptId: string };

/** Caller-created stable IDs make a reviewed request repeatable; duplicate submission is rejected. */
export interface MetadataEditRequest {
  readonly id: string;
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly description: string;
  readonly operations: readonly MetadataOperation[];
}

type MetadataProject = {
  readonly manifest: AnalysisProjectManifest | Omit<AnalysisProjectManifest, "shards">;
  readonly shards: AnalysisProjectShards;
};

/**
 * Latest manual decisions pin affected imported IDs, including deleted records. Other imported
 * evidence remains untouched; a new artifact with new IDs is a separate claim requiring review.
 * @param {AnalysisProjectShards} shards Current raw records and persisted edit receipts.
 * @returns {ReadonlySet<string>} Collection-qualified IDs protected from import replacement.
 */
export const manuallyOwnedMetadata = (shards: AnalysisProjectShards): ReadonlySet<string> =>
  new Set(
    shards.analysis
      .filter((record): record is AnalysisMetadataEditRecord => record.kind === "metadata-edit")
      .flatMap((receipt) => receipt.changes.map((change) => `${change.shard}:${change.id}`)),
  );

/**
 * Apply reviewed operations and retain an exact durable inverse. Existing imported evidence is
 * never removed. Restoring a receipt creates another receipt and rejects changed touched records.
 * @param {MetadataProject} project Revision-bound metadata view, with no runtime required.
 * @param {MetadataEditRequest} request Stable operation identity and explicit semantic intent.
 * @returns {{ project: AnalysisProject; receipt: AnalysisMetadataEditRecord }} Uncommitted replacement and review receipt.
 */
export const applyMetadataEdit = (
  project: MetadataProject,
  request: MetadataEditRequest,
): { project: AnalysisProject; receipt: AnalysisMetadataEditRecord } => {
  for (const id of [request.id, request.evidenceId, request.sourceId]) {
    if (typeof id !== "string" || !/^\w[\w./:-]*$/.test(id)) {
      throw new Error("Metadata edits need stable operation and evidence IDs.");
    }
  }
  if (
    !request.description?.trim() ||
    !request.operations.length ||
    request.operations.length > 1000
  ) {
    throw new Error("Choose metadata operations and a description.");
  }
  if (
    project.shards.analysis.some(({ id }) => id === request.id) ||
    project.shards.evidence.some(({ id }) => id === request.evidenceId)
  ) {
    throw new Error(
      "This metadata operation was already submitted. Refresh its status before retrying.",
    );
  }
  const changes = new Map<string, MetadataRecordChange>();
  const history = project.shards.analysis
    .filter((record): record is AnalysisMetadataEditRecord => record.kind === "metadata-edit")
    .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  const existing = (shard: MetadataShard, id: string): EditableMetadataRecord | undefined =>
    project.shards[shard].find((record) => record.id === id) as EditableMetadataRecord | undefined;
  const put = (shard: MetadataShard, id: string, after?: EditableMetadataRecord): void => {
    const key = `${shard}:${id}`;
    if (changes.has(key)) {
      throw new Error("A preview must change each metadata record only once.");
    }
    const before = existing(shard, id);
    if (before) {
      validateEditableMetadataRecord(shard, before);
    }
    if (after) {
      validateEditableMetadataRecord(shard, after);
    }
    if (
      before &&
      after &&
      (before.addressSpace !== after.addressSpace ||
        ("address" in before && "address" in after && before.address !== after.address))
    ) {
      throw new Error("Moving an existing metadata anchor requires creating a new record.");
    }
    const content = (record: EditableMetadataRecord | undefined): unknown => {
      if (!record) {
        return null;
      }
      const { evidence: ignored, ...value } = record;
      void ignored;
      return value;
    };
    if (canonicalEquals(content(before), content(after))) {
      return;
    }
    if (after) {
      const space = project.manifest.addressSpaces.find(({ id }) => id === after.addressSpace);
      if (!space) {
        throw new Error("Choose a known metadata address space.");
      }
      const maximum =
        space.kind === "file" ? project.manifest.rom.contentSize : 2 ** space.addressBits;
      const addresses: number[] = [];
      if ("address" in after) {
        addresses.push(after.address);
      }
      if ("start" in after) {
        addresses.push(after.start, after.end - 1);
      }
      if ("targets" in after) {
        for (const address of after.targets) {
          addresses.push(address);
        }
      }
      if (
        addresses.some(
          (address) => !Number.isSafeInteger(address) || address < 0 || address >= maximum,
        )
      ) {
        throw new Error("Metadata addresses exceed their named space or ROM bounds.");
      }
    }
    changes.set(key, { shard, id, ...(before ? { before } : {}), ...(after ? { after } : {}) });
  };
  let restores: string | undefined;
  for (const operation of request.operations) {
    if (operation.kind === "put") {
      const previous = existing(operation.shard, operation.record.id);
      put(operation.shard, operation.record.id, {
        ...operation.record,
        evidence: [
          ...new Set([
            ...(previous?.evidence ?? []),
            ...operation.record.evidence,
            request.evidenceId,
          ]),
        ].sort(),
      });
    } else if (operation.kind === "remove") {
      if (operation.shard === "labels") {
        throw new Error("Use Remove Label to choose comment and analysis-seed preservation.");
      }
      if (!existing(operation.shard, operation.id)) {
        throw new Error("The selected metadata no longer exists.");
      }
      put(operation.shard, operation.id);
    } else if (operation.kind === "remove-label" || operation.kind === "reset-label") {
      const label = existing("labels", operation.id) as ProjectLabel | undefined;
      if (!label) {
        throw new Error("The selected label no longer exists.");
      }
      if (operation.kind === "remove-label") {
        put("labels", label.id, {
          ...label,
          suppressed: true,
          ...(operation.preserveComments === false
            ? { comment: undefined, inlineComment: undefined }
            : {}),
          ...(operation.preserveEntryPoint === false ? { analysisEntryPoint: false } : {}),
          evidence: [...new Set([...label.evidence, request.evidenceId])].sort(),
        });
      } else {
        const original = history
          .flatMap((receipt) => receipt.changes)
          .find((change) => change.shard === "labels" && change.id === label.id);
        if (original && !original.before) {
          put("labels", label.id);
        } else {
          const imported = original?.before as ProjectLabel | undefined;
          put("labels", label.id, {
            ...label,
            name: imported?.name ?? label.name,
            sourceName: imported?.sourceName,
            suppressed: undefined,
            evidence: [...new Set([...label.evidence, request.evidenceId])].sort(),
          });
        }
      }
    } else if (operation.kind === "split-classification") {
      const base = existing("annotations", operation.id) as IntervalAnnotation | undefined;
      if (
        !base ||
        !Number.isSafeInteger(operation.at) ||
        operation.at <= base.start ||
        operation.at >= base.end ||
        existing("annotations", operation.rightId)
      ) {
        throw new Error("Choose a split strictly inside the interval and an unused right-side ID.");
      }
      const evidence = [...new Set([...base.evidence, request.evidenceId])].sort();
      put("annotations", base.id, { ...base, end: operation.at, evidence });
      put("annotations", operation.rightId, {
        ...base,
        id: operation.rightId,
        start: operation.at,
        points: base.points?.filter((point) => point !== "in"),
        evidence,
      });
    } else if (operation.kind === "restore") {
      if (request.operations.length !== 1) {
        throw new Error("Restore one receipt at a time.");
      }
      const receipt = history.find(({ id }) => id === operation.receiptId);
      if (!receipt) {
        throw new Error("The saved metadata receipt no longer exists.");
      }
      restores = receipt.id;
      for (const change of receipt.changes) {
        if (!canonicalEquals(existing(change.shard, change.id) ?? null, change.after ?? null)) {
          throw new Error(
            `Cannot restore changed ${change.shard} record '${change.id}'. Review the newer edit first.`,
          );
        }
        put(change.shard, change.id, change.before);
      }
    } else {
      throw new Error("Unknown metadata operation.");
    }
  }
  if (!changes.size) {
    throw new Error("The metadata has no changes to save.");
  }
  const evidence: EvidenceRecord = {
    id: request.evidenceId,
    source: "manual",
    sourceId: request.sourceId,
    confidence: "certain",
    detail: request.description,
  };
  const receipt: AnalysisMetadataEditRecord = {
    id: request.id,
    kind: "metadata-edit",
    sequence: Math.max(project.manifest.revision ?? 0, history.at(-1)?.sequence ?? 0) + 1,
    description: request.description,
    changes: [...changes.values()],
    ...(restores ? { restores } : {}),
    evidence: [
      ...new Set([
        request.evidenceId,
        ...[...changes.values()].flatMap(({ before, after }) => [
          ...(before?.evidence ?? []),
          ...(after?.evidence ?? []),
        ]),
      ]),
    ].sort(),
  };
  const replace = (shard: MetadataShard): EditableMetadataRecord[] => [
    ...(project.shards[shard] as readonly EditableMetadataRecord[]).filter(
      ({ id }) => !changes.has(`${shard}:${id}`),
    ),
    ...receipt.changes
      .filter((change) => change.shard === shard)
      .flatMap((change) => (change.after ? [change.after] : [])),
  ];
  const shards: AnalysisProjectShards = {
    ...project.shards,
    labels: replace("labels") as AnalysisProjectShards["labels"],
    comments: replace("comments") as AnalysisProjectShards["comments"],
    annotations: replace("annotations") as AnalysisProjectShards["annotations"],
    analysis: [...(replace("analysis") as AnalysisProjectShards["analysis"]), receipt],
    evidence: [...project.shards.evidence, evidence],
  };
  validateMetadataReceipt(receipt);
  validateLoadedShards(shards, project.manifest);
  projectSourceLabelNames(shards.labels);
  const { shards: ignored, ...manifest } = project.manifest as AnalysisProjectManifest;
  void ignored;
  return { project: { manifest, shards }, receipt };
};
