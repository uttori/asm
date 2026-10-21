import { type SourceResultMap } from "./source-results.js";
export { SourceOperationError, type SourceFailureCode, type SourceResultMap, } from "./source-results.js";
import { type SourceOperation, type SourceAction } from "./source-requests.js";
export { readSourceOperation, type SourceOperation, type SourceAction, type SourceRequestMap, } from "./source-requests.js";
import { type SourceWorkflowHost } from "./source-host.js";
export { createSourceWorkflowHost, type SourceWorkflowHost } from "./source-host.js";
export type { SourceTargetDescriptor } from "./source-target.js";
import type { SourceProjectInspection } from "./source-target.js";
export type { SourceCaptureImportBatchResult, SourceCaptureImportSummary, } from "./source-capture-imports.js";
export type { SourceResearchRequest, SourceResearchResult, SourceResearchSymbol, } from "./source-research.js";
export type { SourceProjectInspection } from "./source-target.js";
/** Inspect using the selected target and the host's exact plugin registration. */
export declare function inspectSourceProject(directory: string, overlays?: ReadonlyMap<string, Uint8Array | null>, signal?: AbortSignal, host?: SourceWorkflowHost): Promise<SourceProjectInspection>;
/** Execute one explicit operation. Long-running callers use a worker so the editor stays responsive. */
export declare function executeSourceOperation<Action extends SourceAction>(operation: SourceOperation<Action>, host?: SourceWorkflowHost): Promise<SourceResultMap[Action]>;
//# sourceMappingURL=source.d.ts.map