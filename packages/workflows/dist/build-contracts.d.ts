export { readAssemblyBuildManifest, type AssemblyBuildManifest, } from "@uttori/asm-plugin-loader-node/build-configuration";
/** Shared CLI/worker request. Assembly never changes mode implicitly based on source text or file suffix. */
export type AssemblyBuildOperation = {
    readonly directory: string;
} & ({
    readonly action: "assemble-object";
    readonly source: string;
    readonly output: string;
    readonly module: string;
    readonly sourceAdapter?: "asar" | "ca65";
    readonly config?: string;
} | {
    readonly action: "library";
    readonly objects: readonly string[];
    readonly output: string;
} | {
    readonly action: "link" | "build-linked";
    readonly manifest: string;
    /** Host-selected parent configuration must still match the bytes that chose this manifest. */
    readonly selection?: {
        readonly file: string;
        readonly sha256: string;
    };
});
/** Small artifact receipt; the output itself is serialized and can be consumed in a different process. */
export interface AssemblyArtifactResult {
    readonly kind: "object" | "library";
    readonly outputFile: string;
    readonly sha256: string;
    readonly bytes: number;
    /** Replaceable source/target layout suggested by this module; payload ownership remains in the object. */
    readonly linkRecipe?: import("@uttori/asm-core").AssemblyLinkRecipe;
}
/** Editor-compatible artifact pair plus retained linker reports. Every path belongs to one immutable set. */
export interface AssemblyLinkedResult {
    readonly kind: "linked";
    readonly outputFile: string;
    readonly debugMapFile: string;
    readonly symbolsFile: string;
    readonly allocationFile: string;
    readonly recipeFile?: string;
    readonly inputSha256: string;
    readonly outputSha256: string;
    readonly debugMapFingerprint: string;
    readonly outputSize: number;
    readonly target: string;
    readonly architecture: string;
    readonly outputChanged: boolean;
    readonly debugMapChanged: boolean;
    /** Exact saved inputs used by the host, including manifest, recipe, configuration and serialized inputs. */
    readonly inputs: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
}
export type AssemblyBuildResult = AssemblyArtifactResult | AssemblyLinkedResult;
/** Return a validated receipt without retaining mutable data owned by an IPC caller. */
export declare function readAssemblyBuildResult(value: unknown): AssemblyBuildResult;
/** Copy the validated request so subsequent caller edits cannot change an asynchronous build. */
export declare function readAssemblyBuildOperation(value: unknown): AssemblyBuildOperation;
//# sourceMappingURL=build-contracts.d.ts.map