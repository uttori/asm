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
  init: Awaited<ReturnType<SourceTargetDescriptor["initialize"]>>;
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
  prepare: Awaited<ReturnType<typeof prepareSourceGeneration>>;
  preview: Awaited<ReturnType<typeof previewSourceGeneration>>;
  apply: Awaited<ReturnType<typeof applySourceGeneration>>;
  finish: Awaited<ReturnType<typeof finishSourceGeneration>>;
  abort: Awaited<ReturnType<typeof abortSourceGeneration>>;
  discard: { readonly discarded: string };
  clean: {
    readonly scratch: ReturnType<typeof pruneSourceScratch>;
    readonly pins: Awaited<ReturnType<typeof pruneSourcePins>>;
  };
  build: SourceBuildResult;
  index: { readonly changed: boolean; readonly researchSha256: string };
  analyze: ReturnType<SourceTargetDescriptor["analyze"]>;
  catalog: { readonly captures: number; readonly retainedEvidenceRequired: number };
  graphics: ReturnType<NonNullable<SourceTargetDescriptor["graphics"]>>;
  expand: Awaited<ReturnType<NonNullable<SourceTargetDescriptor["expand"]>>>;
  relocate: Awaited<ReturnType<NonNullable<SourceTargetDescriptor["relocate"]>>>;
  research: SourceResearchResult;
  import: SourceCaptureResult | SourceCaptureImportBatchResult;
}

export {
  SourceOperationError,
  type SourceFailureCode,
} from "@uttori/asm-disassembler/source-project";
