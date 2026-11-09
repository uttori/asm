import type { SourceResearchRequest } from "./source-research.js";
/** Physical-code selection is bounded and never implies a temporal join between capture streams. */
export interface SourceGraphicsQuery {
    /** Capture archive identity anchoring the graphics query. */
    readonly captureSha256: string;
    /** Optional CPU program counter within the capture address space. */
    readonly pc?: number;
    /** Optional physical ROM offset when querying by file position. */
    readonly physicalOffset?: number;
    /** Maximum number of graphics records to return. */
    readonly limit?: number;
}
/** Actions without arguments accept only the shared request context. */
type NoRequestFields = object;
/** Action-specific fields cannot accidentally accompany an unrelated mutation. */
export interface SourceRequestMap {
    /** Initialize a source project from an original ROM image. */
    init: {
        readonly rom: string;
        readonly dizRawFile?: string;
        readonly mapper?: string;
    };
    /** Report generation or workspace status for an optional candidate commit. */
    status: {
        readonly candidate?: string;
    };
    /** Migrate working assembly toward linked builds. */
    prepare: {
        readonly assembly?: "linked";
    };
    /** Preview a generation commit without applying it. */
    preview: {
        readonly candidate: string;
    };
    /** Apply a previewed generation commit to the working tree. */
    apply: {
        readonly candidate: string;
    };
    /** Complete a multi-step operation with an optional status message. */
    finish: {
        readonly message?: string;
    };
    /** Abort the current long-running source operation. */
    abort: NoRequestFields;
    /** Discard a generation candidate without applying it. */
    discard: {
        readonly candidate: string;
    };
    /** Remove transient generation artifacts from the workspace. */
    clean: NoRequestFields;
    /** Build the current source tree without applying regeneration. */
    build: NoRequestFields;
    /** Refresh disassembly indexes for the working tree. */
    index: NoRequestFields;
    /** Run static analysis passes on the working tree. */
    analyze: NoRequestFields;
    /** Rebuild research catalogs from saved inputs. */
    catalog: NoRequestFields;
    /** Query graphics evidence tied to an imported capture. */
    graphics: {
        readonly graphicsQuery?: SourceGraphicsQuery;
    };
    /** Relocate a declared object within the source layout. */
    relocate: {
        readonly objectId: string;
    };
    /** Expand a declared object by an explicit byte capacity. */
    expand: {
        readonly expansionSize: number;
    };
    /** Apply a bounded research edit proposal. */
    research: {
        readonly research?: SourceResearchRequest;
    };
    /** Import one or more capture archives into the project. */
    import: {
        readonly recoverPartial?: boolean;
    } & ({
        readonly capture: string;
        readonly captures?: never;
    } | {
        readonly captures: readonly string[];
        readonly capture?: never;
    });
}
/** Known source workflow action names keyed by request map entries. */
export type SourceAction = keyof SourceRequestMap;
/** Union of all action-specific request field names for excess-property checking. */
type RequestFields = {
    [Action in SourceAction]: keyof SourceRequestMap[Action];
}[SourceAction];
/** Overlays belong to inspection/proposal operations; saved builds continue to read saved inputs. */
interface SourceRequestContext {
    readonly directory: string;
    readonly signal?: AbortSignal;
    readonly onProgress?: (message: string) => void;
    readonly overlays?: readonly {
        readonly path: string;
        readonly bytes: Uint8Array;
    }[];
}
/** The optional-never fields preserve narrowing while rejecting unrelated request arguments. */
export type SourceOperation<Action extends SourceAction = SourceAction> = {
    [Key in Action]: SourceRequestContext & {
        readonly action: Key;
    } & SourceRequestMap[Key] & {
        readonly [Field in Exclude<RequestFields, keyof SourceRequestMap[Key]>]?: never;
    };
}[Action];
/** Parse commands and IPC before opening a project; the returned union keeps action/arguments paired. */
export declare function readSourceOperation(value: unknown): SourceOperation;
export {};
//# sourceMappingURL=source-requests.d.ts.map