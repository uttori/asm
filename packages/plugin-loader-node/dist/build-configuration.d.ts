import type { AssemblyLinkRecipe } from "@uttori/asm-core";
/** Resolve existing target/source layout after module production instead of duplicating it in the host manifest. */
export interface ModuleRecipeSelection {
    /** Discriminator selecting a recipe derived from the manifest's source modules. */
    readonly from: "modules";
    /** Target ID whose layout derives the recipe. */
    readonly target: string;
}
/** Recognize the exact data-only selector before activating plugins or interpreting portable recipe fields. */
export declare function isModuleRecipeSelection(value: unknown): value is ModuleRecipeSelection;
/** Explicit opt-in build graph. All paths are relative to the manifest, including configuration and output. */
export interface AssemblyBuildManifest {
    /** Format discriminator; any other value is rejected. */
    readonly format: "uttori-build";
    /** Manifest schema version; only 1 is accepted. */
    readonly version: 1;
    /** Optional plugin configuration; absent configuration uses the selected target's bundled defaults. */
    readonly config?: string;
    /** Ordered independently assembled contributions. IDs must remain stable across builds. */
    readonly modules?: readonly {
        readonly id: string;
        readonly source: string;
        readonly sourceAdapter?: "asar" | "ca65";
    }[];
    /** Prebuilt serialized object files linked with the assembled modules. */
    readonly objects?: readonly string[];
    /** Library files passed to the linker. */
    readonly libraries?: readonly string[];
    /** Portable recipe, config-derived module layout, or a recipe JSON path relative to this manifest. */
    readonly recipe: AssemblyLinkRecipe | ModuleRecipeSelection | string;
    /** Immutable artifact sets and current.json live here; defaults to .uttori-build. */
    readonly outputDirectory?: string;
    /** Plain filename; defaults to program plus the target's output extension. */
    readonly outputName?: string;
    /** Optional complete original container for exactness verification before publication. */
    readonly original?: string;
}
/** Return an owned host graph; external recipe files are validated after their snapshot is read. */
export declare function readAssemblyBuildManifest(value: unknown): AssemblyBuildManifest;
/** Data-only projection shared by module-aware indexing hosts; no plugin activation or assembly occurs. */
export declare function readAssemblyBuildConfiguration(manifestFile: string): {
    readonly directory: string;
    readonly configFile?: string;
    readonly target: string;
    readonly moduleRoots: Readonly<Record<string, import("@uttori/asm-core").AssemblyModuleOptions>>;
    readonly inputs: readonly string[];
};
//# sourceMappingURL=build-configuration.d.ts.map