import { sourceContentHash } from "../internal/source-inputs.js";
import type {
  AddressSpaceDescriptor,
  AnalysisTargetOverrideRecord,
  AnalysisTargetSetRecord,
  IntervalAnnotation,
} from "../model/project-types.js";
import {
  parseResearchDocument,
  validateResearchDecision,
  validateResearchSnapshot,
  type ResearchDocument,
  type ResearchSnapshot,
} from "./inputs.js";

/** These explicit inputs affect decoding; derived CFG and captured observations are never editable here. */
export type ResearchAnalysisRecord =
  | IntervalAnnotation
  | AnalysisTargetOverrideRecord
  | AnalysisTargetSetRecord;

/** Existing declarations stay in their file. New declarations select an existing subject/bank document. */
export type ResearchAnalysisChange = {
  /** Exact document selected before interactive prompts; prevents overwriting a concurrent decision. */
  readonly expectedDocumentSha256: string;
} & (
  | {
      readonly kind: "put";
      readonly path: string;
      readonly reason: string;
      readonly collection: "annotations";
      readonly value: IntervalAnnotation;
    }
  | {
      readonly kind: "put";
      readonly path: string;
      readonly reason: string;
      readonly collection: "analysis";
      readonly value: AnalysisTargetOverrideRecord | AnalysisTargetSetRecord;
    }
  | {
      /** Removing a decision restores any imported observation; it does not erase evidence. */
      readonly kind: "remove";
      readonly collection: "annotations" | "analysis";
      readonly id: string;
    }
);

/** A proposal is inert until the editor or terminal applies its exact before-content check. */
export interface ResearchAnalysisEdit {
  /** Source-relative research document path that receives the edit. */
  readonly path: string;
  /** SHA-256 of the document content the edit was prepared against. */
  readonly expectedSha256: string;
  /** Complete replacement document to write when the content check passes. */
  readonly document: ResearchDocument;
}

/** Reject out-of-space locations and impossible 65816 assumptions before offering an authoring edit. */
function validateLocations(
  record: ResearchAnalysisRecord,
  spaces: readonly AddressSpaceDescriptor[],
): void {
  const space = spaces.find((item) => item.id === record.addressSpace);
  if (
    !space ||
    !Number.isInteger(space.addressBits) ||
    space.addressBits < 1 ||
    space.addressBits > 53
  ) {
    throw new Error("Select a declared project address space.");
  }
  const limit = 2 ** space.addressBits;
  const addresses = "start" in record ? [record.start, record.end - 1] : [...record.targets];
  if ("address" in record) {
    addresses.push(record.address);
  }
  if (
    addresses.some((address) => !Number.isSafeInteger(address) || address < 0 || address >= limit)
  ) {
    throw new Error(
      `Research locations exceed the ${space.addressBits}-bit address space '${space.id}'.`,
    );
  }
  if (
    "targets" in record &&
    (record.targets.length > 4096 || new Set(record.targets).size !== record.targets.length)
  ) {
    throw new Error("Use at most 4096 distinct indirect targets.");
  }
  if (
    "state" in record &&
    record.state?.e &&
    (record.state.m === false || record.state.x === false)
  ) {
    throw new Error("65816 emulation mode requires 8-bit accumulator and index registers.");
  }
  if (
    "asset" in record &&
    record.asset &&
    !["asset", "compressed", "graphics", "music", "text"].includes(record.classification)
  ) {
    throw new Error(
      "Remove the asset recipe explicitly before changing to a non-asset classification.",
    );
  }
}

/**
 * Prepare one Git-backed analysis decision with manual provenance. Imported records remain in the
 * evidence store; removing this declaration reveals them again on the next projection refresh.
 */
export function changeResearchAnalysis(
  snapshot: ResearchSnapshot,
  change: ResearchAnalysisChange | null | undefined,
  spaces: readonly AddressSpaceDescriptor[],
): ResearchAnalysisEdit {
  validateResearchSnapshot(snapshot);
  if (
    !change ||
    !["annotations", "analysis"].includes(change.collection) ||
    !["put", "remove"].includes(change.kind)
  ) {
    throw new Error("Choose an annotation or indirect-target research action.");
  }
  const id = change.kind === "put" ? change.value.id : change.id;
  validateResearchDecision({ collection: change.collection, id, value: null });
  const previousFile = snapshot.files.find((file) =>
    file.document.decisions.some((item) => item.collection === change.collection && item.id === id),
  );
  if (change.kind === "remove") {
    if (!previousFile) {
      throw new Error("The selected research decision no longer exists.");
    }
    if (previousFile.sha256 !== change.expectedDocumentSha256) {
      throw new Error("Research changed since selection. Open the action again.");
    }
    return {
      path: previousFile.path,
      expectedSha256: previousFile.sha256,
      document: parseResearchDocument({
        ...previousFile.document,
        decisions: previousFile.document.decisions.filter(
          (item) => item.collection !== change.collection || item.id !== id,
        ),
      }),
    };
  }
  const file = previousFile ?? snapshot.files.find((input) => input.path === change.path);
  if (!file || file.path !== change.path) {
    throw new Error(
      "Select an existing research document; existing decisions keep their authoring location.",
    );
  }
  if (file.sha256 !== change.expectedDocumentSha256) {
    throw new Error("Research changed since selection. Open the action again.");
  }
  if (
    typeof change.reason !== "string" ||
    !change.reason.trim() ||
    change.reason.length > 4096 ||
    change.reason.includes("\0")
  ) {
    throw new Error("Describe the evidence or reasoning for this decision (1–4096 characters).");
  }
  validateResearchDecision({ collection: change.collection, id, value: change.value });
  validateLocations(change.value, spaces);
  const previous = previousFile?.document.decisions.find(
    (item) => item.collection === change.collection && item.id === id,
  )?.value;
  // A structural edit may add provenance but must not silently drop citations retained by an earlier decision.
  const evidence = new Set(change.value.evidence);
  if (previous && "evidence" in previous) {
    for (const reference of previous.evidence) {
      evidence.add(reference);
    }
  }
  const evidenceId = `manual.research.${sourceContentHash(JSON.stringify([change.collection, id, change.reason])).slice(0, 32)}`;
  const evidenceOwner = snapshot.files.find((input) =>
    input.document.decisions.some(
      (item) => item.collection === "evidence" && item.id === evidenceId,
    ),
  );
  if (evidenceOwner && evidenceOwner.path !== file.path) {
    throw new Error(
      "This manual evidence has another authoring location. Open that declaration to reconcile it.",
    );
  }
  evidence.add(evidenceId);
  const decisions = file.document.decisions.filter(
    (item) =>
      !(item.collection === change.collection && item.id === id) &&
      !(item.collection === "evidence" && item.id === evidenceId),
  );
  decisions.push(
    { collection: change.collection, id, value: { ...change.value, evidence: [...evidence] } },
    {
      collection: "evidence",
      id: evidenceId,
      value: {
        id: evidenceId,
        source: "manual",
        sourceId: "git-research",
        confidence: "unknown",
        detail: change.reason.trim(),
      },
    },
  );
  decisions.sort((a, b) =>
    Buffer.compare(Buffer.from(`${a.collection}:${a.id}`), Buffer.from(`${b.collection}:${b.id}`)),
  );
  return {
    path: file.path,
    expectedSha256: file.sha256,
    document: parseResearchDocument({ ...file.document, decisions }),
  };
}
