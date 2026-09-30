import { validateSourceLabelName } from "./project-labels.js";
import type {
  AnalysisMetadataEditRecord,
  EditableMetadataRecord,
  MetadataRecordChange,
  MetadataShard,
} from "./project-types.js";

/**
 * Require the editable record shape before accessing it. General project validation supplements
 * these checks with address-space bounds, codec constraints, and evidence-reference validation.
 * @param {MetadataShard} shard Collection selected by the caller.
 * @param {EditableMetadataRecord} record Candidate native record.
 */
export const validateEditableMetadataRecord = (
  shard: MetadataShard,
  record: EditableMetadataRecord,
): void => {
  if (
    !record ||
    typeof record.id !== "string" ||
    !/^\w[\w./:-]*$/.test(record.id) ||
    !Array.isArray(record.evidence) ||
    record.evidence.some((id) => typeof id !== "string")
  ) {
    throw new Error("Metadata needs a stable record ID and evidence list.");
  }
  if ("address" in record && (!Number.isSafeInteger(record.address) || record.address < 0)) {
    throw new Error("Metadata needs a nonnegative integer address.");
  }
  if (typeof record.addressSpace !== "string") {
    throw new Error("Metadata needs a named address space.");
  }
  if (shard === "labels") {
    if (
      !("name" in record) ||
      typeof record.name !== "string" ||
      !record.name ||
      !("address" in record) ||
      "kind" in record
    ) {
      throw new Error("Invalid label metadata.");
    }
    const label = record;
    if (label.sourceName !== undefined) {
      validateSourceLabelName(label.sourceName);
    }
    if (label.suppressed !== undefined && typeof label.suppressed !== "boolean") {
      throw new Error("Invalid label suppression flag.");
    }
    for (const value of [label.comment, label.inlineComment]) {
      if (value !== undefined && (typeof value !== "string" || value.includes("\0"))) {
        throw new Error("Invalid label comment.");
      }
    }
  } else if (shard === "comments") {
    if (
      !("text" in record) ||
      typeof record.text !== "string" ||
      !record.text.trim() ||
      record.text.includes("\0") ||
      !("address" in record) ||
      "kind" in record
    ) {
      throw new Error("A standalone comment needs nonempty text.");
    }
  } else if (shard === "annotations") {
    if (
      !("classification" in record) ||
      ![
        "unreached",
        "opcode",
        "operand",
        "data8",
        "data16",
        "data24",
        "data32",
        "pointer16",
        "pointer24",
        "pointer32",
        "graphics",
        "music",
        "compressed",
        "asset",
        "empty",
        "text",
      ].includes(record.classification) ||
      typeof record.architecture !== "string" ||
      !record.architecture
    ) {
      throw new Error("Invalid classification metadata.");
    }
    if (
      !Number.isSafeInteger(record.start) ||
      !Number.isSafeInteger(record.end) ||
      record.start < 0 ||
      record.end <= record.start
    ) {
      throw new Error("Classification bounds must describe a nonempty half-open interval.");
    }
    for (const [field, value] of Object.entries(record.state ?? {})) {
      if (["e", "m", "x", "carry"].includes(field)) {
        if (typeof value !== "boolean") {
          throw new Error(`State ${field} must be true or false; omit it to clear the hint.`);
        }
      } else {
        const maximum = ["programBank", "dataBank"].includes(field) ? 255 : 65535;
        if (
          !["programBank", "dataBank", "directPage", "stackPointer"].includes(field) ||
          typeof value !== "number" ||
          !Number.isInteger(value) ||
          value < 0 ||
          value > maximum
        ) {
          throw new Error(`Invalid state field '${field}'.`);
        }
      }
    }
    if (record.points?.some((point) => !["in", "out", "end", "read"].includes(point))) {
      throw new Error("Invalid entry-point metadata.");
    }
  } else if (shard === "analysis") {
    if (
      !("kind" in record) ||
      !["target-override", "target-set"].includes(record.kind) ||
      !Array.isArray(record.targets) ||
      record.targets.some((value) => !Number.isSafeInteger(value) || value < 0)
    ) {
      throw new Error("Only target overrides and target sets are editable analysis records.");
    }
    if (record.kind === "target-set" && (typeof record.name !== "string" || !record.name.trim())) {
      throw new Error("A target set needs a name.");
    }
    if (record.kind === "target-override" && !Number.isSafeInteger(record.address)) {
      throw new Error("A target override needs an instruction anchor.");
    }
  } else {
    throw new Error("This collection is not editable metadata.");
  }
};

/**
 * Check saved receipts without recursively accepting arbitrary analysis payloads.
 * @param {AnalysisMetadataEditRecord} receipt Persisted manual decision.
 */
export const validateMetadataReceipt = (receipt: AnalysisMetadataEditRecord): void => {
  if (
    !Number.isSafeInteger(receipt.sequence) ||
    receipt.sequence < 1 ||
    typeof receipt.description !== "string" ||
    !Array.isArray(receipt.changes) ||
    !receipt.changes.length ||
    receipt.changes.length > 1000
  ) {
    throw new Error("Invalid metadata edit receipt.");
  }
  const seen = new Set<string>();
  for (const change of receipt.changes as readonly MetadataRecordChange[]) {
    const key = `${change.shard}:${change.id}`;
    if (seen.has(key) || (!change.before && !change.after)) {
      throw new Error("Invalid repeated or empty metadata change.");
    }
    seen.add(key);
    for (const record of [change.before, change.after]) {
      if (!record) {
        continue;
      }
      validateEditableMetadataRecord(change.shard, record);
      if (record.id !== change.id || record.evidence.some((id) => !receipt.evidence.includes(id))) {
        throw new Error("Receipt record identity or retained evidence is inconsistent.");
      }
    }
  }
};
