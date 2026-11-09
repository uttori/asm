import type { DebugMap } from "../debug-map.js";
import type { LinkExpression } from "../ir/link-expression.js";
import type { AssemblyLinkRecipe, AssemblyModule, RelocatableSource } from "../relocatable.js";
/** A contribution has distinct logical run/load addresses and optional physical container storage. */
export interface LinkAllocation {
    /** Owning relocatable module name for this section slice. */
    readonly module: string;
    /** Section name within the module that produced the allocation. */
    readonly section: string;
    /** Whether the slice holds executable code, initialized data, or zero-filled bss. */
    readonly kind: "code" | "data" | "bss";
    /** Address-space identifier selecting bus width and placement rules. */
    readonly addressSpace: string;
    /** Load-region name where image bytes are stored in the output file. */
    readonly loadRegion: string;
    /** Run-region name where the section executes or is accessed at runtime. */
    readonly runRegion: string;
    /** Byte offset within the load region where image bytes begin. */
    readonly loadAddress: number;
    /** Runtime byte address where the section is mapped for execution or access. */
    readonly runAddress: number;
    /** Zero-based offset in the linked output image when the slice is physically placed. */
    readonly outputOffset?: number;
    /** Total byte extent of the allocation after alignment padding. */
    readonly size: number;
    /** Required alignment boundary in bytes for this slice. */
    readonly alignment: number;
}
/** Bounds and used extents explain why a placement succeeded or exhausted a region. */
export interface LinkRegionReport {
    /** Recipe region name referenced by allocations. */
    readonly name: string;
    /** Inclusive start address of the region window. */
    readonly start: number;
    /** Total span of the region in bytes. */
    readonly size: number;
    /** Bytes consumed by placed sections within the region. */
    readonly used: number;
}
/** Explicit runtime assumptions apply to one section; omitted bank/page state is never inferred from placement. */
export interface LinkAssumption {
    /** Optional module qualifier when the assumption applies to one contributor. */
    readonly module?: string;
    /** Section name receiving the assumed processor or mapper state. */
    readonly section: string;
    /** Data bank register value or the sentinel meaning follow the program bank. */
    readonly dataBank?: number | "program";
    /** Direct-page base address assumed for indexed addressing in this section. */
    readonly directPage?: number;
    /** Additional target-specific register or flag values keyed by stable names. */
    readonly state?: Readonly<Record<string, number | boolean>>;
}
/** Final values include local names qualified by module identity and globally visible exports/recipe symbols. */
export interface LinkedSymbol {
    /** Final bound name, possibly module-qualified for locals. */
    readonly name: string;
    /** Defining module when the symbol remains file- or unit-local. */
    readonly module?: string;
    /** Whether the symbol stays local, is exported, or comes from the link recipe. */
    readonly visibility: "local" | "export" | "recipe";
    /** Resolved numeric value after placement and relocation. */
    readonly value: number;
    /** Original source occurrence when the symbol originated from assembly text. */
    readonly source?: RelocatableSource;
}
/** Target hooks run after generic validation; revision/options participate in the input identity. */
export interface LinkTargetPolicy {
    /** Target contribution identifier selecting validation and finalize hooks. */
    readonly target: string;
    /** Policy revision hashed with inputs so behavior changes invalidate caches. */
    readonly revision: string;
    /** Target-specific options forwarded to validate and finalize hooks. */
    readonly options?: Readonly<Record<string, unknown>>;
    /** Reject incompatible modules, recipes, or allocations before bytes are finalized. */
    validate?(modules: readonly AssemblyModule[], recipe: AssemblyLinkRecipe, allocations: readonly LinkAllocation[]): void;
    /** Mutate owned linked bytes, without changing their extent or rereading source/assets. */
    finalize?(output: Uint8Array, recipe: AssemblyLinkRecipe): void;
}
/** Only serialized inputs enter the driver, making independent-process linking the ordinary path. */
export interface LinkOptions {
    /** Exact compiler/plugin bundle identity supplied by a caching host in addition to policy revisions. */
    readonly toolchainSha256?: string;
    /** Relocatable object payloads in link order before library resolution. */
    readonly objects: readonly Uint8Array[];
    /** Static library archives searched after explicit objects. */
    readonly libraries?: readonly Uint8Array[];
    /** Recipe describing regions, assertions, and member selection. */
    readonly recipe: AssemblyLinkRecipe;
    /** Optional target policy overriding default validation and finalize behavior. */
    readonly target?: LinkTargetPolicy;
    /** Abort signal cooperative hosts may use to cancel long links. */
    readonly signal?: AbortSignal;
}
/** Owned final artifacts; the driver performs no publication or source reads. */
export interface LinkResult {
    /** Final linked image bytes ready for publication or inspection. */
    readonly output: Uint8Array;
    /** Deterministic debug map covering sources, ranges, and optional instruction metadata. */
    readonly debugMap: DebugMap;
    /** Hash of serialized link inputs excluding output bytes. */
    readonly inputSha256: string;
    /** Bound symbols after relocation, including exports and recipe-provided names. */
    readonly symbols: readonly LinkedSymbol[];
    /** Per-section placement records explaining load/run mapping. */
    readonly allocations: readonly LinkAllocation[];
    /** Region utilization reports for diagnostics and assertion context. */
    readonly regions: readonly LinkRegionReport[];
    /** Library members pulled into the link after archive selection. */
    readonly selectedMembers: readonly {
        /** Index of the library archive that supplied the member. */
        readonly library: number;
        /** Archive member name as stored in the library index. */
        readonly name: string;
        /** Module identity embedded in the selected object. */
        readonly module: string;
        /** Content hash of the extracted member bytes. */
        readonly sha256: string;
    }[];
    /** Input modules or assets recorded as link-time dependencies. */
    readonly dependencies: readonly {
        /** Module name recorded for the dependency edge. */
        readonly module: string;
        /** Resolved filesystem or logical path of the dependency. */
        readonly path: string;
        /** Content hash of the dependency payload at link time. */
        readonly sha256: string;
    }[];
}
/** Structured failures keep partial allocation evidence and original source occurrences available to hosts. */
export declare class LinkError extends Error {
    readonly code: string;
    readonly source?: RelocatableSource | undefined;
    readonly allocations: readonly LinkAllocation[];
    /** Stable error name for instanceof checks across bundle boundaries. */
    readonly name = "LinkError";
    /**
     * Captures a link failure with optional source anchoring and partial placement state.
     * @param code Stable machine-readable failure code.
     * @param message Human-readable explanation prefixed with source location when present.
     * @param source Optional source occurrence tied to the failure.
     * @param allocations Partial allocations computed before the failure.
     */
    constructor(code: string, message: string, source?: RelocatableSource | undefined, allocations?: readonly LinkAllocation[]);
}
/** A recipe assertion must evaluate to a nonzero integer after placement and symbol binding. */
export interface LinkAssertion {
    /** Expression evaluated against final symbols and placement after linking. */
    readonly expression: LinkExpression;
    /** Message reported when the assertion evaluates to zero. */
    readonly message: string;
}
//# sourceMappingURL=types.d.ts.map