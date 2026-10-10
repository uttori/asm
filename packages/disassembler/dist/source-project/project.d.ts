import { type ResearchInputLimits, type ResearchSnapshot } from "../research-inputs/inputs.js";
import { type SourceRepository } from "./git.js";
/** Portable project contract. Machine-specific input locations belong to ignored local settings. */
export interface SourceProjectConfiguration {
    readonly format: "uttori-source-project";
    readonly version: 1;
    readonly id: string;
    readonly target: string;
    /** Headerless original ROM identity; a modified ROM starts a separate evidence lineage. */
    readonly romSha256: string;
    readonly sourceRoots: readonly string[];
    readonly researchRoots: readonly string[];
    readonly buildConfig: string;
    readonly layout: string;
    readonly captures: string;
    /** Shared resource policy. Capture/analysis values use target defaults; research ceilings are opt-in. */
    readonly limits?: ResearchInputLimits & {
        /** Per input archive, including each graphics companion; defaults to 32 GiB and does not allocate that much memory. */
        readonly captureBytes?: number;
        readonly analysisWorkItems?: number;
        readonly analysisCallDepth?: number;
    };
}
/** Local locations may be absolute for private input bundles. They never enter generated history. */
export interface SourceProjectLocalInputs {
    readonly format: "uttori-source-local";
    readonly version: 1;
    readonly rom: string;
    readonly evidence: string;
}
/** Selected repository plus validated, branch-specific tracked configuration and research. */
export interface SourceProject {
    readonly repository: SourceRepository;
    readonly configuration: SourceProjectConfiguration;
    readonly configurationSha256: string;
    readonly research: ResearchSnapshot;
}
/** Validate portable paths and identity before running any project-specific tool. */
export declare function parseSourceProject(value: unknown): SourceProjectConfiguration;
/** Discover only the selected repository's project; nested repositories cannot inherit a parent's identity. */
export declare function openSourceProject(directory: string): Promise<SourceProject>;
/** Resolve private input locations without accepting them as tracked source configuration. */
export declare function sourceProjectLocalInputs(project: SourceProject): SourceProjectLocalInputs;
/** Read only the local bindings; research queries do not need to spawn Git or load the ROM. */
export declare function readSourceProjectLocalInputs(root: string): SourceProjectLocalInputs;
/** Refresh the rebuildable metadata index before research queries, imports, or pure generation. */
export declare function synchronizeSourceResearch(project: SourceProject): boolean;
//# sourceMappingURL=project.d.ts.map