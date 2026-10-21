import type { SourceResearchRequest } from "./source-research.js";
/** Physical-code selection is bounded and never implies a temporal join between capture streams. */
export interface SourceGraphicsQuery {
    readonly captureSha256: string;
    readonly pc?: number;
    readonly physicalOffset?: number;
    readonly limit?: number;
}
/** Action-specific fields cannot accidentally accompany an unrelated mutation. */
export interface SourceRequestMap {
    init: {
        readonly rom: string;
        readonly dizRawFile?: string;
        readonly mapper?: string;
    };
    status: {
        readonly candidate?: string;
    };
    prepare: Record<never, never>;
    preview: {
        readonly candidate: string;
    };
    apply: {
        readonly candidate: string;
    };
    finish: {
        readonly message?: string;
    };
    abort: Record<never, never>;
    discard: {
        readonly candidate: string;
    };
    clean: Record<never, never>;
    build: Record<never, never>;
    index: Record<never, never>;
    analyze: Record<never, never>;
    catalog: Record<never, never>;
    graphics: {
        readonly graphicsQuery?: SourceGraphicsQuery;
    };
    relocate: {
        readonly objectId: string;
    };
    expand: {
        readonly expansionSize: number;
    };
    research: {
        readonly research?: SourceResearchRequest;
    };
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
export type SourceAction = keyof SourceRequestMap;
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