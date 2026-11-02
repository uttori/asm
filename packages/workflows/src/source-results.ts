import type {
  SourceBuildResult,
  SourceMergeStatus,
  SourceTargetDescriptor,
  prepareSourceGeneration,
  previewSourceGeneration,
  applySourceGeneration,
  finishSourceGeneration,
  abortSourceGeneration,
  pruneSourcePins,
  pruneSourceScratch,
} from "@uttori/asm-disassembler/source-project";

import type { SourceCaptureImportBatchResult } from "./source-capture-imports.js";
import type { SourceResearchResult } from "./source-research.js";
import type { SourceCaptureResult } from "./source-target.js";

/** Common action results. Optional target extensions retain their provider-owned result contract. */
export interface SourceResultMap {
  /** Initialize a source project from ROM inputs. */
  init: Awaited<ReturnType<SourceTargetDescriptor["initialize"]>>;
  /** Report workspace or generation status. */
  status: SourceMergeStatus & {
    readonly dirty: boolean;
    readonly unstaged: boolean;
    readonly candidateAccepted: boolean;
    readonly candidateStale: boolean;
    readonly analysisReady: boolean;
    readonly analysisReason?: string;
    readonly catalogReady?: boolean;
    readonly catalogReason?: string;
  };
  /** Prepare linked assembly migration. */
  prepare: Awaited<ReturnType<typeof prepareSourceGeneration>>;
  /** Preview a generation commit. */
  preview: Awaited<ReturnType<typeof previewSourceGeneration>>;
  /** Apply a previewed generation commit. */
  apply: Awaited<ReturnType<typeof applySourceGeneration>>;
  /** Finish a multi-step operation. */
  finish: Awaited<ReturnType<typeof finishSourceGeneration>>;
  /** Abort the active long-running operation. */
  abort: Awaited<ReturnType<typeof abortSourceGeneration>>;
  /** Discard a generation candidate. */
  discard: { readonly discarded: string };
  /** Remove transient generation artifacts. */
  clean: {
    readonly scratch: ReturnType<typeof pruneSourceScratch>;
    readonly pins: Awaited<ReturnType<typeof pruneSourcePins>>;
  };
  /** Build the working tree. */
  build: SourceBuildResult;
  /** Refresh disassembly indexes. */
  index: { readonly changed: boolean; readonly researchSha256: string };
  /** Run static analysis on the working tree. */
  analyze: ReturnType<SourceTargetDescriptor["analyze"]>;
  /** Rebuild research catalogs. */
  catalog: { readonly captures: number; readonly retainedEvidenceRequired: number };
  /** Query graphics evidence from captures. */
  graphics: ReturnType<NonNullable<SourceTargetDescriptor["graphics"]>>;
  /** Expand a declared object capacity. */
  expand: Awaited<ReturnType<NonNullable<SourceTargetDescriptor["expand"]>>>;
  /** Relocate a declared object. */
  relocate: Awaited<ReturnType<NonNullable<SourceTargetDescriptor["relocate"]>>>;
  /** Bounded research edit request payload. */
  research: SourceResearchResult;
  /** Import capture archives into the project. */
  import: SourceCaptureResult | SourceCaptureImportBatchResult;
}

export {
  SourceOperationError,
  type SourceFailureCode,
} from "@uttori/asm-disassembler/source-project";
