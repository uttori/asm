import fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { acquireFileLease, durableReplace } from "../internal/durable-files.js";
import { prunePriorSourceBuilds, pruneSourceBuilds } from "./build-cache.js";
import { type SourceBuildCoverage, type SourceBuildSummary } from "./build-coverage.js";

/** Target validation produces this identity before publication; paths name one immutable build pair. */
export interface SourceBuildReceipt {
  readonly coverage?: SourceBuildCoverage;
  readonly inputSha256: string;
  readonly outputFile: string;
  readonly debugMapFile: string;
}

/**
 * Publish a binary/map pair under one lease, selecting it only after its receipt is durable.
 * Interrupted outputs retain a pending receipt for bounded cleanup. Pruning failures become
 * warnings on the committed result; cancellation before publication leaves the current build intact.
 */
export function publishSourceBuild<T extends SourceBuildReceipt>(options: {
  readonly directory: string;
  readonly receipt: T;
  readonly output: Uint8Array;
  readonly debugMap: string;
  readonly signal?: AbortSignal;
}): T & { readonly cacheWarnings?: readonly string[] } {
  options.signal?.throwIfAborted();
  const { directory, receipt, output, debugMap } = options;
  const build = path.join(directory, receipt.inputSha256);
  const fileName = path.basename(receipt.outputFile);
  if (
    !/^[\da-f]{64}$/.test(receipt.inputSha256) ||
    !/^[\w.-]+$/.test(fileName) ||
    receipt.outputFile !== path.join(build, fileName) ||
    receipt.debugMapFile !== `${receipt.outputFile}.debug.json`
  ) {
    throw new Error("Build receipt paths must describe one content-addressed binary/map pair.");
  }
  const lease = acquireFileLease(path.join(directory, "publication.lock"));
  try {
    // Failed attempts must not accumulate until the next successful build. The
    // previous current pointer, not the incoming identity, protects the usable pair.
    const priorWarnings = prunePriorSourceBuilds(directory, receipt.inputSha256, fileName);
    if (fs.existsSync(build) && !fs.lstatSync(build).isDirectory()) {
      throw new Error("Build cache destination is not an owned directory.");
    }
    // The pointer moves last: interruption cannot select a binary from one build and another map.
    const record = canonicalJson(receipt);
    const completed = path.join(build, "build.json");
    if (fs.existsSync(completed) && fs.readFileSync(completed, "utf8") !== record) {
      throw new Error("Completed build identity cannot be republished with a different receipt.");
    }
    const identity = {
      inputSha256: receipt.inputSha256,
      outputFile: receipt.outputFile,
      debugMapFile: receipt.debugMapFile,
    };
    // Ownership stays bounded even when the public receipt lists a large source tree.
    // Publish it before any output so interrupted builds remain safely reclaimable.
    durableReplace(
      path.join(build, "owner.json"),
      canonicalJson({ format: "uttori-source-build-owner-v1", ...identity }),
    );
    durableReplace(path.join(build, "pending.json"), canonicalJson(identity));
    durableReplace(receipt.outputFile, output);
    durableReplace(receipt.debugMapFile, debugMap);
    durableReplace(path.join(build, "build.json"), record);
    fs.rmSync(path.join(build, "pending.json"));
    durableReplace(path.join(directory, "current.json"), record);
    // Readers obtain totals without parsing a debug map or the full dependency inventory.
    // Publish only after the complete build is selected; freshness checks bind both receipts.
    const summary: SourceBuildSummary = {
      version: 1,
      inputSha256: receipt.inputSha256,
      ...(receipt.coverage ? { coverage: receipt.coverage } : {}),
    };
    const summaryWarnings: string[] = [];
    try {
      durableReplace(path.join(directory, "summary.json"), canonicalJson(summary));
    } catch (error) {
      // Progress is an advisory projection. Its failure cannot undo the already selected ROM/map
      // pair; readers report a missing or stale summary until a later successful publication.
      summaryWarnings.push(`Could not publish build coverage summary: ${String(error)}`);
    }
    const cacheWarnings = [
      ...new Set([
        ...priorWarnings,
        ...summaryWarnings,
        ...pruneSourceBuilds(directory, receipt.inputSha256, fileName),
      ]),
    ];
    return cacheWarnings.length ? { ...receipt, cacheWarnings } : receipt;
  } finally {
    lease.release();
  }
}
