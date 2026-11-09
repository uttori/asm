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
    /** Record or result kind discriminator. */
    readonly kind: "object" | "library";
    /** Published binary path for this receipt. */
    readonly outputFile: string;
    /** Lowercase hex SHA-256 digest. */
    readonly sha256: string;
    /** Byte length or payload size bound. */
    readonly bytes: number;
    /** Replaceable source/target layout suggested by this module; payload ownership remains in the object. */
    readonly linkRecipe?: import("@uttori/asm-core").AssemblyLinkRecipe;
}
/** Editor-compatible artifact pair plus retained linker reports. Every path belongs to one immutable set. */
export interface AssemblyLinkedResult {
    /** Record or result kind discriminator. */
    readonly kind: "linked";
    /** Published binary path for this receipt. */
    readonly outputFile: string;
    /** Published debug-map path paired with the binary. */
    readonly debugMapFile: string;
    /** Published linker symbols path for the linked image. */
    readonly symbolsFile: string;
    /** Published allocation map path for the linked image. */
    readonly allocationFile: string;
    /** Optional link-recipe path retained with the receipt. */
    readonly recipeFile?: string;
    /** SHA-256 of the exact saved inputs that produced the binary. */
    readonly inputSha256: string;
    /** SHA-256 of the published linked image. */
    readonly outputSha256: string;
    /** Canonical fingerprint of the published debug map. */
    readonly debugMapFingerprint: string;
    /** Published binary size in bytes. */
    readonly outputSize: number;
    /** Selected build or link target identifier. */
    readonly target: string;
    /** CPU architecture identifier for the session. */
    readonly architecture: string;
    /** True when the published image differs from the previous output. */
    readonly outputChanged: boolean;
    /** True when the published debug map differs from the previous map. */
    readonly debugMapChanged: boolean;
    /** Exact saved inputs used by the host, including manifest, recipe, configuration and serialized inputs. */
    readonly inputs: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
}
/** Receipt from assemble-object, library, or a linked build. */
export type AssemblyBuildResult = AssemblyArtifactResult | AssemblyLinkedResult;
/** Return a validated receipt without retaining mutable data owned by an IPC caller. */
export declare function readAssemblyBuildResult(value: unknown): AssemblyBuildResult;
/** Copy the validated request so subsequent caller edits cannot change an asynchronous build. */
export declare function readAssemblyBuildOperation(value: unknown): AssemblyBuildOperation;
//# sourceMappingURL=build-contracts.d.ts.map