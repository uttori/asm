/** source-project contracts. Node host operations own filesystem resources and must honor documented disposal/publication rules. */
export { assertSourcePath, type SourceRepository, acquireSourceOperationLease, type SourceGitResult, SourceGitError, sourceGit, sourceRepository, sourceStatus, sourceStatusPaths, assertNoSourceOperation, assertSourceCheckpoint, assertSourceObjectId, } from "./source-project/git.js";
export { readSourceBlobs } from "./source-project/blobs.js";
export { type SourceFileReplacement, type SourceFileChange, type SourceFileTransaction, readSourceFileTransaction, sourceFilePublicationEpoch, applySourceFileTransaction, recoverSourceFileTransaction, } from "./source-project/file-transaction.js";
export { sourceContentHash, SOURCE_GENERATION_FILE, type SourceGenerationInputs, type SourceGenerationFile, type SourceGenerationDescriptor, type SourceGeneration, type SourceGenerationEntry, verifySourceGeneration, sourceCandidateRef, pinSourceCandidate, parseSourceGeneration, generationAt, retainSourceGeneration, acceptedSourceGeneration, } from "./source-project/generation.js";
export { SOURCE_INPUT_SNAPSHOT_FILE, createSourceInputSnapshot, readSourceInputSnapshot, } from "./source-project/input-snapshot.js";
export { type SourceMergePreview, type SourceBuildVerification, type SourceMergeJournal, type SourceMergeStatus, prepareSourceGeneration, snapshotSourceTree, previewSourceGeneration, sourceMergeStatus, adoptSourceGeneration, applySourceGeneration, finishSourceGeneration, discardSourceGeneration, abortSourceGeneration, } from "./source-project/merge.js";
export { type SourceProjectConfiguration, type SourceProjectLocalInputs, type SourceProject, parseSourceProject, openSourceProject, sourceProjectLocalInputs, readSourceProjectLocalInputs, synchronizeSourceResearch, } from "./source-project/project.js";
export { type SourceCaptureArchive, type SourceCaptureIdentity, type SourceCaptureCatalog, parseSourceCaptureCatalog, readSourceCaptureCatalog, reconcileSourceCaptureCatalog, writeSourceCaptureCatalog, DEFAULT_SOURCE_CAPTURE_MAX_BYTES, fingerprintSourceCapture, } from "./source-project/captures.js";
export { type SourceScratchCleanup, pruneSourceScratch, createSourceScratch, } from "./source-project/scratch.js";
export { registerSourcePinOwner, pruneSourcePins } from "./source-project/pins.js";
export { durableReplace, syncDirectory, type FileLease, acquireFileLease, } from "./internal/durable-files.js";
export { lostCodeRanges } from "./source-project/code-preservation.js";
export { checkRawBlockConsumption, type RawBlockInput } from "./source-project/raw-consumption.js";
export { publishSourceBuild, type SourceBuildReceipt } from "./source-project/build-publication.js";
export type { SourceGenerationOptions, PreparedSourceGeneration, SourceInspection, } from "./source-project/generation-contracts.js";
export type { SourceInitializationResult, SourceTargetDescriptor, SourceTargetOperation, SourceWorkflowHost, InitializeSourceOptions, SourceBuildResult, SourceProjectInspection, SourceModuleInspection, SourceAnalysisOptions, SourceCaptureResult, SourceTargetCaptureOptions, } from "./source-project/target-contracts.js";
export { SourceOperationError, type SourceFailureCode } from "./source-project/errors.js";
export { buildLinkedObjects, publishLinkedBuild, type LinkedBuildReceipt, } from "./source-project/link-build.js";
export { type SourceLinkBuild, readSourceLinkBuild, sourceLinkFiles, sourceLinkEntry, linkSourceAssembly, sourceMappingFromLink, } from "./source-project/source-link.js";
export { sourceBuildCoverage, isSourceBuildCoverage, type SourceBuildCoverage, type SourceBuildSummary, } from "./source-project/build-coverage.js";
//# sourceMappingURL=source-project.d.ts.map