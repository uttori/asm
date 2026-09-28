import fs from "node:fs";
import path from "node:path";

import {
  acquireFileLease,
  canonicalJson,
  durableReplace,
  optionalFileHash,
  sourceExportSha256,
  type AnalysisMetadataEditRecord,
  type AnalysisProjectRevision,
  type ProjectLabel,
  type SqliteAnalysisStore,
} from "@uttori/asm-disassembler";

import type { MetadataMapReceipt, MetadataWorkerInput } from "./metadata-data.js";

/** Serializable commit receipt; a recovered lost response may lack its original revision token. */
export interface EditOutcome {
  readonly receipt: AnalysisMetadataEditRecord | MetadataMapReceipt;
  readonly revision?: AnalysisProjectRevision;
  readonly receiptId?: string;
  readonly sha256?: string;
  readonly status: string;
  readonly reconciled?: boolean;
}

/** Raw form payload is intentionally opaque; malformed intermediate text must survive recovery. */
interface MetadataDraft {
  readonly id: string;
  readonly savedAt: string;
  readonly value: unknown;
}

/** Durable intent and outcome; a prepared intent is reconciled with authoritative receipts. */
export interface EditOperation {
  readonly id: string;
  readonly digest: string;
  readonly input: MetadataWorkerInput;
  readonly createdAt: string;
  readonly before: string;
  readonly effect: "metadata" | "analysis";
  readonly phase: "prepared" | "committed" | "failed" | "conflict";
  readonly result?: EditOutcome;
  readonly error?: string;
}

/** Shared per-project writer lease used by metadata and source publication.
 * @param {string} directory Native project root.
 * @returns {ReturnType<typeof acquireFileLease>} Lease requiring release in finally.
 */
export const acquireEditLease = (directory: string): ReturnType<typeof acquireFileLease> =>
  acquireFileLease(path.join(directory, ".editing", "writer.lock"));

/** Map arbitrary native IDs to private receipt filenames without allowing path traversal.
 * @param {string} directory Project directory.
 * @param {string} id Stable caller operation ID.
 * @returns {string} Durable intent path.
 */
const operationFile = (directory: string, id: string): string =>
  path.join(directory, ".editing", "operations", `${sourceExportSha256(id)}.json`);

/** Read compact operation history from disk; sorting survives editor and worker restarts.
 * @param {string} directory Project root.
 * @returns {EditOperation[]} Durable operations, newest first.
 */
export function editOperations(directory: string): EditOperation[] {
  const folder = path.join(directory, ".editing", "operations");
  if (!fs.existsSync(folder)) {
    return [];
  }
  return fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(folder, name), "utf8")) as EditOperation)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Reconcile one lost response from the actual SQLite/file receipt, never replay a write blindly.
 * @param {SqliteAnalysisStore} store Worker connection.
 * @param {string} directory Project root.
 * @param {EditOperation} operation Persisted intent.
 * @returns {EditOperation} Recorded outcome. Prepared means no write occurred and safe retry is possible.
 */
function reconcile(
  store: SqliteAnalysisStore,
  directory: string,
  operation: EditOperation,
): EditOperation {
  if (operation.phase !== "prepared") {
    return operation;
  }
  let result: EditOutcome | undefined;
  if (operation.input.request) {
    const receipt = store
      .analysisByKinds(["metadata-edit"])
      .find(
        (record): record is AnalysisMetadataEditRecord =>
          record.kind === "metadata-edit" && record.id === operation.input.request!.id,
      );
    if (receipt) {
      result = { receipt, status: "Metadata saved; regeneration pending.", reconciled: true };
    }
  } else {
    const file = path.join(directory, "metadata-map-history", `${operation.id}.json`);
    if (fs.existsSync(file)) {
      const receipt = JSON.parse(fs.readFileSync(file, "utf8")) as MetadataMapReceipt;
      const current =
        optionalFileHash(path.join(receipt.sourceDirectory, receipt.name)) ?? "missing";
      if (current === receipt.afterSha256) {
        result = {
          receiptId: receipt.id,
          receipt,
          sha256: current,
          status: "Map saved; regeneration pending.",
          reconciled: true,
        };
      } else if (current !== receipt.beforeSha256) {
        const conflict: EditOperation = {
          ...operation,
          phase: "conflict",
          error:
            "Map changed outside this interrupted operation; both original and candidate bytes remain in its receipt.",
        };
        durableReplace(operationFile(directory, operation.id), JSON.stringify(conflict));
        return conflict;
      }
    }
  }
  if (!result) {
    return operation;
  }
  // A recovered commit without its original revision cannot prove an uninterrupted revision
  // chain. Leave that token absent so regeneration conservatively performs full analysis.
  const committed: EditOperation = { ...operation, phase: "committed", result };
  durableReplace(operationFile(directory, operation.id), JSON.stringify(committed));
  return committed;
}

/** Serialize metadata commits and persist the intent before any SQLite or JSON write.
 * Same-ID retries return the first outcome; changed intent under that ID is rejected.
 * @param {SqliteAnalysisStore} store Worker connection.
 * @param {string} directory Project root.
 * @param {MetadataWorkerInput} input Exact reviewed operation.
 * @param {() => any} commit Existing validated commit path.
 * @param {(point: string) => void} [checkpoint] Test-only interruption boundary.
 * @returns {unknown} Committed or reconciled result.
 */
export function coordinateEdit(
  store: SqliteAnalysisStore,
  directory: string,
  input: MetadataWorkerInput,
  commit: () => unknown,
  checkpoint?: (point: string) => void,
): unknown {
  const id = input.operationId ?? input.request?.id;
  if (!id) {
    throw new Error("Saving requires a stable operation ID from the reviewed preview.");
  }
  if (!input.request && !/^[\dA-Za-z-]{1,100}$/.test(id)) {
    throw new Error("Invalid map operation identity.");
  }
  const lease = acquireEditLease(directory);
  let sourceLease: ReturnType<typeof acquireFileLease> | undefined;
  try {
    sourceLease = acquireFileLease(
      path.join(input.sourceDirectory ?? path.dirname(directory), ".uttori-publication.lock"),
    );
    const digest = sourceExportSha256(canonicalJson(input));
    const file = operationFile(directory, id);
    let operation: EditOperation | undefined;
    if (fs.existsSync(file)) {
      operation = reconcile(
        store,
        directory,
        JSON.parse(fs.readFileSync(file, "utf8")) as EditOperation,
      );
      if (operation.digest !== digest) {
        throw new Error(
          "This operation ID belongs to a different draft. Review the new draft first.",
        );
      }
      if (operation.phase === "committed") {
        return operation.result;
      }
      if (operation.phase !== "prepared") {
        throw new Error(
          operation.error ?? "This operation did not commit. Review the retained draft again.",
        );
      }
    }
    operation ??= {
      id,
      digest,
      input,
      createdAt: new Date().toISOString(),
      before: input.revision?.manifestSha256 ?? "unknown",
      effect: "analysis",
      phase: "prepared",
    };
    durableReplace(file, JSON.stringify(operation));
    checkpoint?.("intent");
    try {
      const result = commit() as EditOutcome;
      checkpoint?.("committed");
      const changes = "changes" in result.receipt ? result.receipt.changes : undefined;
      const metadataOnly =
        changes?.every((change) => {
          if (change.shard === "comments") {
            return true;
          }
          if (change.shard !== "labels") {
            return false;
          }
          // Legacy labels are analysis seeds unless explicitly disabled. Changing only their
          // presentation is cheap; adding/removing a seed requires the analyzer to run again.
          const seed = (record: ProjectLabel | undefined): boolean =>
            Boolean(record && record.analysisEntryPoint !== false);
          return (
            seed(change.before as ProjectLabel | undefined) ===
            seed(change.after as ProjectLabel | undefined)
          );
        }) ?? false;
      durableReplace(
        file,
        JSON.stringify({
          ...operation,
          phase: "committed",
          effect: metadataOnly ? "metadata" : "analysis",
          result,
        }),
      );
      return result;
    } catch (error) {
      const recovered = reconcile(store, directory, operation);
      if (recovered.phase === "prepared") {
        durableReplace(
          file,
          JSON.stringify({ ...operation, phase: "failed", error: String(error) }),
        );
      }
      throw error;
    }
  } finally {
    sourceLease?.release();
    lease.release();
  }
}

/** Prove every revision since export came only from presentation edits. Unknown gaps reanalyze.
 * @param {string} directory Native project root.
 * @param {string} before Last exported revision.
 * @param {string} after Current SQLite revision.
 * @returns {boolean} Whether saved analysis can be reused for all pending changes together.
 */
export function metadataRefreshEligible(directory: string, before: string, after: string): boolean {
  const operations = editOperations(directory);
  const seen = new Set<string>();
  let current = after;
  while (current !== before) {
    if (seen.has(current)) {
      return false;
    }
    seen.add(current);
    const item = operations.find(
      (operation) =>
        operation.phase === "committed" && operation.result?.revision?.manifestSha256 === current,
    );
    if (!item || item.effect !== "metadata") {
      return false;
    }
    current = item.before;
  }
  // Map changes do not advance SQLite, so their pending hashes are checked independently.
  return true;
}

/** Store bounded arbitrary form text separately from committed operations; no validation drops text.
 * @param {string} directory Native project root.
 * @param {string} id Host-owned draft identity.
 * @param {unknown} value Exact serializable form and its original revision.
 */
export function saveMetadataDraft(directory: string, id: string, value: unknown): void {
  const text = JSON.stringify({ id, savedAt: new Date().toISOString(), value });
  if (Buffer.byteLength(text) > 10 * 1024 * 1024) {
    throw new Error("Draft exceeds the 10 MiB recovery limit.");
  }
  durableReplace(
    path.join(directory, ".editing", "drafts", `${sourceExportSha256(id)}.json`),
    text,
  );
}

/** Load newest drafts for explicit recovery; never auto-apply a draft to newer metadata.
 * @param {string} directory Native project root.
 * @returns {unknown[]} At most twenty retained form snapshots.
 */
export function metadataDrafts(directory: string): unknown[] {
  const folder = path.join(directory, ".editing", "drafts");
  if (!fs.existsSync(folder)) {
    return [];
  }
  return fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(folder, name), "utf8")) as MetadataDraft)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, 20);
}
