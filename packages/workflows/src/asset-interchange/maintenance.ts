import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  acquireSourceOperationLease,
  assertNoSourceOperation,
  readSourceFileTransaction,
  recoverSourceFileTransaction,
  sourceRepository,
} from "@uttori/asm-disassembler/source-project";

import type { AssetSourceHost } from "./contracts.js";
import {
  digest,
  locator,
  object,
  readAssetExportManifest,
  readAssetImportReview,
} from "./public-records.js";
import { assetHash, AssetRecordStore, readAssetStagingId } from "./record-store.js";

/** Explicit retirement list. Retained reviews continue to pin their export; no age-based or automatic pruning occurs. */
export interface AssetRetentionPolicy {
  /** Export locators explicitly selected to survive cleanup. */
  readonly exports: readonly string[];
  /** Review digests explicitly selected to survive cleanup. */
  readonly reviews: readonly string[];
  /** Optional explicit crash leftovers, named with their full `.staging-<uuid>` directory basenames in each store. */
  readonly staging?: {
    readonly exports: readonly string[];
    readonly reviews: readonly string[];
  };
}

/** Bound and canonicalize selections so ordering cannot change the cleanup review identity. */
function retirementIds(value: unknown, read: (value: unknown) => string): string[] {
  if (!Array.isArray(value) || value.length > 65536) {
    throw new Error("Invalid asset retirement inventory.");
  }
  const result = value.map(read);
  if (new Set(result).size !== result.length) {
    throw new Error("Duplicate asset retirement identity.");
  }
  return result.toSorted();
}

/** Validate private-record identifiers before any filesystem operation or cleanup plan is constructed. */
export function readAssetRetentionPolicy(value: unknown): AssetRetentionPolicy {
  const input = object(value);
  const policy = {
    exports: retirementIds(input.exports, locator),
    reviews: retirementIds(input.reviews, digest),
  };
  if (input.staging === undefined) {
    return policy;
  }
  const staging = object(input.staging);
  return {
    ...policy,
    staging: {
      exports: retirementIds(staging.exports, readAssetStagingId),
      reviews: retirementIds(staging.reviews, readAssetStagingId),
    },
  };
}

/** Review or execute exactly one explicit retention policy under the same per-project operation lease. */
export async function cleanupAssetInterchange(
  directory: string,
  value: unknown,
  applyPlan?: string,
) {
  const policy = readAssetRetentionPolicy(value),
    repository = await sourceRepository(directory);
  const lease = acquireSourceOperationLease(repository);
  try {
    assertNoSourceOperation(repository);
    const root = path.join(repository.root, ".uttori-local/asset-interchange");
    const exports = new AssetRecordStore(path.join(root, "exports")),
      reviews = new AssetRecordStore(path.join(root, "reviews"));
    const exported = exports.inventory((entry) => {
      const input = object(entry);
      if (input.format !== "uttori-asset-baseline" || input.version !== 2) {
        throw new Error("Unsupported asset baseline in cleanup inventory.");
      }
      return readAssetExportManifest(input.manifest);
    });
    const reviewed = reviews.inventory((entry) => {
      const input = object(entry);
      if (input.format !== "uttori-asset-reviewed-plan" || input.version !== 2) {
        throw new Error("Unsupported asset review in cleanup inventory.");
      }
      return readAssetImportReview(input.summary);
    });
    const exportIds = new Set(policy.exports),
      reviewIds = new Set(policy.reviews);
    const exportRecords = new Map(exported.map((record) => [record.id, record])),
      reviewRecords = new Map(reviewed.map((record) => [record.id, record]));
    for (const id of exportIds) {
      if (exportRecords.get(id)?.value.id !== id) {
        throw new Error(`Unknown asset export ${id}.`);
      }
    }
    for (const id of reviewIds) {
      if (reviewRecords.get(id)?.value.id !== id) {
        throw new Error(`Unknown asset review ${id}.`);
      }
    }
    // A saved review remains an explicit reference even when its source dependencies are now stale.
    for (const record of reviewed) {
      if (!reviewIds.has(record.id) && exportIds.has(record.value.exportId)) {
        throw new Error(
          `Export ${record.value.exportId} is still referenced by retained review ${record.id}.`,
        );
      }
    }
    const selectedExports = exported.filter((record) => exportIds.has(record.id));
    const selectedReviews = reviewed.filter((record) => reviewIds.has(record.id));
    // Completed locators/references cannot name staging directories; validating every retained record above
    // rejects that ambiguity. The operation lease also prevents retiring an active publisher's private stage.
    const staging = {
      exports: (policy.staging?.exports ?? []).map((id) => exports.stagingInventory(id)),
      reviews: (policy.staging?.reviews ?? []).map((id) => reviews.stagingInventory(id)),
    };
    for (const record of selectedReviews) {
      reviews.validateRetirement(record.id, record.hash);
    }
    for (const record of selectedExports) {
      exports.validateRetirement(record.id, record.hash);
    }
    const identity = assetHash(
      canonicalJson({
        policy,
        exports: exported.map(({ id, hash }) => ({ id, hash })),
        reviews: reviewed.map(({ id, hash }) => ({ id, hash })),
        staging,
      }),
    );
    if (applyPlan !== undefined) {
      if (digest(applyPlan) !== identity) {
        throw new Error("Asset cleanup inventory changed; preview cleanup again.");
      }
      // Retire references first. An interruption can retain extra records but cannot orphan a retained review.
      for (const record of selectedReviews) {
        reviews.retire(record.id, record.hash);
      }
      for (const record of selectedExports) {
        exports.retire(record.id, record.hash);
      }
      for (const record of staging.reviews) {
        reviews.retireStaging(record.id, record.hash);
      }
      for (const record of staging.exports) {
        exports.retireStaging(record.id, record.hash);
      }
    }
    return { id: identity, ...policy, stagingInventory: staging, applied: applyPlan !== undefined };
  } finally {
    lease.release();
  }
}

/** Recovery uses the journal's exact before/after bytes and rejects unknown external replacements. */
export async function recoverAssetInterchange(
  directory: string,
  direction: "before" | "after",
  host: Pick<AssetSourceHost, "beforePublish" | "completed"> = {},
  signal?: AbortSignal,
) {
  const repository = await sourceRepository(directory),
    journal = readSourceFileTransaction(repository);
  if (!journal || journal.state === "completed") {
    return journal;
  }
  signal?.throwIfAborted();
  await host.beforePublish?.(journal.files.map((file) => path.resolve(repository.root, file.path)));
  signal?.throwIfAborted();
  const result = recoverSourceFileTransaction(repository, direction, {
    signal,
    validate: (current) => {
      if (canonicalJson(current) !== canonicalJson(journal)) {
        throw new Error("Source recovery journal changed during editor validation; recover again.");
      }
    },
  });
  await host.completed?.();
  return result;
}
