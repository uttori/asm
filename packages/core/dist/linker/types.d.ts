import type { DebugMap } from "../debug-map.js";
import type { LinkExpression } from "../ir/link-expression.js";
import type { AssemblyLinkRecipe, AssemblyModule, RelocatableSource } from "../relocatable.js";
/** A contribution has distinct logical run/load addresses and optional physical container storage. */
export interface LinkAllocation {
    readonly module: string;
    readonly section: string;
    readonly kind: "code" | "data" | "bss";
    readonly addressSpace: string;
    readonly loadRegion: string;
    readonly runRegion: string;
    readonly loadAddress: number;
    readonly runAddress: number;
    readonly outputOffset?: number;
    readonly size: number;
    readonly alignment: number;
}
/** Bounds and used extents explain why a placement succeeded or exhausted a region. */
export interface LinkRegionReport {
    readonly name: string;
    readonly start: number;
    readonly size: number;
    readonly used: number;
}
/** Explicit runtime assumptions apply to one section; omitted bank/page state is never inferred from placement. */
export interface LinkAssumption {
    readonly module?: string;
    readonly section: string;
    readonly dataBank?: number | "program";
    readonly directPage?: number;
    readonly state?: Readonly<Record<string, number | boolean>>;
}
/** Final values include local names qualified by module identity and globally visible exports/recipe symbols. */
export interface LinkedSymbol {
    readonly name: string;
    readonly module?: string;
    readonly visibility: "local" | "export" | "recipe";
    readonly value: number;
    readonly source?: RelocatableSource;
}
/** Target hooks run after generic validation; revision/options participate in the input identity. */
export interface LinkTargetPolicy {
    readonly target: string;
    readonly revision: string;
    readonly options?: Readonly<Record<string, unknown>>;
    validate?(modules: readonly AssemblyModule[], recipe: AssemblyLinkRecipe, allocations: readonly LinkAllocation[]): void;
    /** Mutate owned linked bytes, without changing their extent or rereading source/assets. */
    finalize?(output: Uint8Array, recipe: AssemblyLinkRecipe): void;
}
/** Only serialized inputs enter the driver, making independent-process linking the ordinary path. */
export interface LinkOptions {
    /** Exact compiler/plugin bundle identity supplied by a caching host in addition to policy revisions. */
    readonly toolchainSha256?: string;
    readonly objects: readonly Uint8Array[];
    readonly libraries?: readonly Uint8Array[];
    readonly recipe: AssemblyLinkRecipe;
    readonly target?: LinkTargetPolicy;
    readonly signal?: AbortSignal;
}
/** Owned final artifacts; the driver performs no publication or source reads. */
export interface LinkResult {
    readonly output: Uint8Array;
    readonly debugMap: DebugMap;
    readonly inputSha256: string;
    readonly symbols: readonly LinkedSymbol[];
    readonly allocations: readonly LinkAllocation[];
    readonly regions: readonly LinkRegionReport[];
    readonly selectedMembers: readonly {
        readonly library: number;
        readonly name: string;
        readonly module: string;
        readonly sha256: string;
    }[];
    readonly dependencies: readonly {
        readonly module: string;
        readonly path: string;
        readonly sha256: string;
    }[];
}
/** Structured failures keep partial allocation evidence and original source occurrences available to hosts. */
export declare class LinkError extends Error {
    readonly code: string;
    readonly source?: RelocatableSource | undefined;
    readonly allocations: readonly LinkAllocation[];
    readonly name = "LinkError";
    constructor(code: string, message: string, source?: RelocatableSource | undefined, allocations?: readonly LinkAllocation[]);
}
/** A recipe assertion must evaluate to a nonzero integer after placement and symbol binding. */
export interface LinkAssertion {
    readonly expression: LinkExpression;
    readonly message: string;
}
//# sourceMappingURL=types.d.ts.map