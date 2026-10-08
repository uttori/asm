import { type SnesSourceInspection, type SnesMapper } from "@uttori/asm-plugin-snes";
import { type SourceResearchRequest } from "./source-research.js";
export type { SourceCaptureImportBatchResult, SourceCaptureImportSummary, } from "./source-capture-imports.js";
export type { SourceResearchRequest, SourceResearchResult, SourceResearchSymbol, } from "./source-research.js";
/** Commands share one service with editor workers; no command performs an implicit source checkpoint. */
export type SourceAction = "init" | "status" | "prepare" | "preview" | "apply" | "finish" | "abort" | "discard" | "clean" | "build" | "index" | "analyze" | "catalog" | "graphics" | "relocate" | "expand" | "research" | "import";
/** Preview/build inputs may include unsaved editor text. Application still requires a committed checkpoint. */
export interface SourceOperation {
    readonly action: SourceAction;
    readonly directory: string;
    readonly candidate?: string;
    /** Read-only physical-code query; omitted returns the portable graphics capture selection. */
    readonly graphicsQuery?: {
        readonly captureSha256: string;
        readonly pc?: number;
        readonly physicalOffset?: number;
        readonly limit?: number;
    };
    /** Single archive path, resolved against the process working directory; exclusive with captures. */
    readonly capture?: string;
    /** Ordered bulk-import queue, exclusive with capture. Files commit separately; failure stops the queue. */
    readonly captures?: readonly string[];
    /** Initialization accepts a private original ROM and an optional explicit cartridge mapper. */
    readonly rom?: string;
    /** Optional research import for new source projects; imported records become Git inputs. */
    readonly dizRawFile?: string;
    readonly mapper?: SnesMapper;
    /** Relocation returns validated source/layout edits; applying them is an explicit editor operation. */
    readonly objectId?: string;
    /** Explicit power-of-two cartridge capacity in bytes; never chosen implicitly by the allocator. */
    readonly expansionSize?: number;
    /** Return a content-checked research proposal; applying/saving remains a normal source edit. */
    readonly research?: SourceResearchRequest;
    readonly message?: string;
    readonly signal?: AbortSignal;
    /** Worker hosts forward bounded phase messages without loading project records in the editor. */
    readonly onProgress?: (message: string) => void;
    readonly overlays?: readonly {
        readonly path: string;
        readonly bytes: Uint8Array;
    }[];
}
/** Unpublished current-source evidence plus the identities used by the normal build environment. */
export interface SourceProjectInspection extends SnesSourceInspection {
    readonly root: string;
    readonly configurationSha256: string;
    readonly toolchainSha256: string;
}
/** Inspect current or overlaid source with normal project checks, without publishing build artifacts. */
export declare function inspectSourceProject(directory: string, overlays?: ReadonlyMap<string, Uint8Array | null>, signal?: AbortSignal): Promise<SourceProjectInspection>;
/** Execute one explicit operation. Long-running callers use a worker so the editor stays responsive. */
export declare function executeSourceOperation(operation: SourceOperation): Promise<unknown>;
export declare const sourceUsage = "uttori-asm source <status|prepare|build|index|analyze|catalog|finish|abort|clean> <project>\nuttori-asm source init <new-folder> <original-rom> [--mapper <mapper>] [--dizraw <research.dizraw>]\nuttori-asm source <preview|apply|discard> <project> <generation-commit>\nuttori-asm source expand <project> <capacity-bytes>\nuttori-asm source relocate <project> <object-id>\nuttori-asm source import <project> <capture.act2-or-json> [more-captures...]\nuttori-asm source research <project> [<symbol-id> <aliases|suppress|restore|entry|no-entry> [aliases...]]\nuttori-asm source research <project> --analysis [<change.json>]\nuttori-asm source graphics <project> [<capture-sha256> [<cpu-pc> [<prg-offset>]]]\n\nPrepare and preview preserve source, staging and Git history. Commit your edits before apply.\nResolve conflicts with Git, stage the result, then finish to validate and commit the merge.";
/** Strict positional CLI adapter; structured service calls carry editor cancellation and buffers. */
export declare function runSourceCli(argv: readonly string[]): Promise<number>;
//# sourceMappingURL=source.d.ts.map