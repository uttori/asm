/** source-project contracts. Node host operations own filesystem resources and must honor documented disposal/publication rules. */
export { assertSourcePath, acquireSourceOperationLease, SourceGitError, sourceGit, sourceRepository, sourceStatus, sourceStatusPaths, assertNoSourceOperation, assertSourceCheckpoint, assertSourceObjectId, } from "./source-project/git.js";
export { readSourceBlobs } from "./source-project/blobs.js";
export { readSourceFileTransaction, sourceFilePublicationEpoch, applySourceFileTransaction, recoverSourceFileTransaction, } from "./source-project/file-transaction.js";
export { sourceContentHash, SOURCE_GENERATION_FILE, verifySourceGeneration, sourceCandidateRef, pinSourceCandidate, parseSourceGeneration, generationAt, retainSourceGeneration, acceptedSourceGeneration, } from "./source-project/generation.js";
export { SOURCE_INPUT_SNAPSHOT_FILE, createSourceInputSnapshot, readSourceInputSnapshot, } from "./source-project/input-snapshot.js";
export { prepareSourceGeneration, snapshotSourceTree, previewSourceGeneration, sourceMergeStatus, adoptSourceGeneration, applySourceGeneration, finishSourceGeneration, discardSourceGeneration, abortSourceGeneration, } from "./source-project/merge.js";
export { parseSourceProject, openSourceProject, sourceProjectLocalInputs, readSourceProjectLocalInputs, synchronizeSourceResearch, } from "./source-project/project.js";
export { parseSourceCaptureCatalog, readSourceCaptureCatalog, reconcileSourceCaptureCatalog, writeSourceCaptureCatalog, DEFAULT_SOURCE_CAPTURE_MAX_BYTES, fingerprintSourceCapture, } from "./source-project/captures.js";
export { pruneSourceScratch, createSourceScratch, } from "./source-project/scratch.js";
export { registerSourcePinOwner, pruneSourcePins } from "./source-project/pins.js";
export { durableReplace, syncDirectory, acquireFileLease, } from "./internal/durable-files.js";
export { lostCodeRanges } from "./source-project/code-preservation.js";
export { checkRawBlockConsumption } from "./source-project/raw-consumption.js";
export { publishSourceBuild } from "./source-project/build-publication.js";
export { SourceOperationError } from "./source-project/errors.js";
export { buildLinkedObjects, publishLinkedBuild, } from "./source-project/link-build.js";
export { readSourceLinkBuild, sourceLinkFiles, sourceLinkEntry, linkSourceAssembly, sourceMappingFromLink, } from "./source-project/source-link.js";
export { sourceBuildCoverage, isSourceBuildCoverage, } from "./source-project/build-coverage.js";
//# sourceMappingURL=source-project.js.map