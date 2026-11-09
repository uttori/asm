import type { AssemblyLinkRecipe } from "@uttori/asm-core";
import { type LinkOptions, type LinkResult } from "@uttori/asm-core/linker";
/** Paths select one immutable artifact set. Consumers open current.json once and use only these paths. */
export interface LinkedBuildReceipt {
    /** Receipt format discriminator. */
    readonly format: "uttori-linked-build-v1";
    /** Lowercase SHA-256 link input identity; names the immutable build directory. */
    readonly inputSha256: string;
    /** Linked binary inside the build directory. */
    readonly outputFile: string;
    /** Validated debug map for `outputFile` (`<output>.debug.json`). */
    readonly debugMapFile: string;
    /** Exported linker symbols (`<output>.symbols.json`). */
    readonly symbolsFile: string;
    /** Allocations, regions, selected members and dependencies (`<output>.link.json`). */
    readonly allocationFile: string;
    /** Present when the publishing host supplies the resolved recipe for source-free relinking. */
    readonly recipeFile?: string;
    /** Artifact hash keyed by file name within the build directory, covering every listed artifact. */
    readonly hashes: Readonly<Record<string, string>>;
}
/** A composed Node driver reads only serialized object/archive/recipe inputs, never the original source/asset paths. */
export declare function buildLinkedObjects(options: LinkOptions & {
    readonly directory: string;
    readonly outputName?: string;
    /** Original complete container supplied only for pristine-generation verification. */
    readonly original?: Uint8Array;
}): LinkedBuildReceipt;
/** Publish all artifacts as one renamed directory, then durably switch the pointer; failures preserve the selected build. */
export declare function publishLinkedBuild(result: LinkResult, directory: string, outputName?: string, signal?: AbortSignal, recipe?: AssemblyLinkRecipe): LinkedBuildReceipt;
//# sourceMappingURL=link-build.d.ts.map