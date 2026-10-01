import { type InspectSnesSourceOptions } from "../source-build.js";
import type { SnesFixedExtent, SnesInstructionStateContract } from "./check.js";
import { type SnesFreeSpace, type SnesMovableObject, type SnesRelocationReference, type SnesRelocationPlan } from "./relocate.js";
/** A source block retains its original file position so later native merges still see its body. */
export interface SnesSourceObject extends SnesMovableObject {
    readonly file: string;
    readonly startSymbol: string;
    readonly endSymbol: string;
    /** Optional addressed dataStruct declaration. Its original research map remains unchanged. */
    readonly structure?: {
        readonly file: string;
        readonly recordSize: number;
    };
}
/** A reviewed raw storage pool has explicit source boundaries, never inferred from unused trace coverage. */
export interface SnesSourceFreeSpace extends SnesFreeSpace {
    readonly file: string;
    readonly startSymbol: string;
    readonly endSymbol: string;
}
/** One exact expression on the emitted field's source line, disambiguated by its declared ROM offset. */
export interface SnesSourceReference extends SnesRelocationReference {
    readonly expression: string;
}
/** Reviewable ordinary text edits. The host must check every before hash or document version before applying. */
export interface SnesSourceRelocation {
    readonly plan: SnesRelocationPlan;
    readonly object: SnesSourceObject;
    readonly references: readonly SnesSourceReference[];
    /** The host applies these layout changes with the source edits in the same review. */
    readonly extents: readonly SnesFixedExtent[];
    readonly states: readonly SnesInstructionStateContract[];
    readonly edits: readonly {
        readonly path: string;
        readonly beforeSha256: string;
        readonly before: string;
        readonly after: string;
    }[];
    readonly outputSha256: string;
}
/**
 * Plan and assemble an ordinary source transformation over explicit object/pool boundaries.
 * No filesystem write occurs. Unknown emissions, incomplete references, stale fields, bank limits
 * and unrelated byte changes fail before any edit can be applied by a CLI or WorkspaceEdit host.
 */
export declare function prepareSnesSourceRelocation(options: {
    readonly build: InspectSnesSourceOptions;
    readonly objects: readonly SnesSourceObject[];
    readonly freeSpace: readonly SnesSourceFreeSpace[];
    readonly references: readonly SnesSourceReference[];
    readonly objectId: string;
    /** Optional explicit destination, including the object's original extent after shrinking it. */
    readonly destination?: number;
    readonly logicalAddress: (offset: number) => number;
}): SnesSourceRelocation;
//# sourceMappingURL=source-relocation.d.ts.map