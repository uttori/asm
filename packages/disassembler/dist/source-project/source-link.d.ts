import { AddressToLineMapping, type Assembler, type AssemblyLinkRecipe, type AssemblyModuleOptions } from "@uttori/asm-core";
import { type LinkResult } from "@uttori/asm-core/linker";
/** One generated source unit with independently replaceable placement; ordinary absolute builds omit this contract. */
export interface SourceLinkBuild {
    /** Single generated module identity and adapter selection from the portable manifest. */
    readonly module: AssemblyModuleOptions;
    /** Placement recipe validated before linking against the reviewed source graph. */
    readonly recipe: AssemblyLinkRecipe;
    /** Snapshot these host inputs alongside assembly/includes so watch and debugger freshness cover layout edits. */
    readonly dependencies?: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
}
/** Read the generated single-unit manifest through the caller's snapshot provider. Custom multi-unit builds use the ordinary build service. */
export declare function readSourceLinkBuild(configuration: Record<string, unknown>, configFile: string, entrySource: string, read: (file: string) => Uint8Array): SourceLinkBuild | undefined;
/** Preserve a reviewed source entry-point rename in both the immutable export and its portable manifest. */
export declare function sourceLinkEntry(configuration: unknown): string;
/** Generated configuration and portable recipe enter the same reviewed Git payload as the bank sources. */
export declare function sourceLinkFiles(configuration: Uint8Array, moduleId: string, recipe: AssemblyLinkRecipe, sourceRoot?: string): readonly {
    readonly path: string;
    readonly bytes: Uint8Array;
}[];
/** Serialize before linking so pristine verification exercises the same object boundary as standalone builds. */
export declare function linkSourceAssembly(assembler: Assembler, build: SourceLinkBuild, signal?: AbortSignal, references?: readonly string[]): LinkResult;
/** Rehydrate final linker provenance for existing layout/asset checks; outputBias is the container prefix size in bytes. */
export declare function sourceMappingFromLink(result: LinkResult, root: string, outputBias?: number): AddressToLineMapping;
//# sourceMappingURL=source-link.d.ts.map