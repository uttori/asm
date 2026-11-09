import { type ResearchInputLimits, type ResearchSnapshot } from "../research-inputs/inputs.js";
import { type SourceRepository } from "./git.js";
/** Portable project contract. Machine-specific input locations belong to ignored local settings. */
export interface SourceProjectConfiguration {
    /** Configuration format discriminator. */
    readonly format: "uttori-source-project";
    /** Configuration schema version. */
    readonly version: 1;
    /** Project identity of word characters, dots and hyphens; scopes research and generation inputs. */
    readonly id: string;
    /** Non-empty source target descriptor ID that owns build, generation and capture policy. */
    readonly target: string;
    /** Headerless original ROM identity; a modified ROM starts a separate evidence lineage. */
    readonly romSha256: string;
    /** Non-empty repository-relative source directories. */
    readonly sourceRoots: readonly string[];
    /** Non-empty repository-relative directories holding Git-tracked research declarations. */
    readonly researchRoots: readonly string[];
    /** Repository-relative build configuration file. */
    readonly buildConfig: string;
    /** Repository-relative layout file. */
    readonly layout: string;
    /** Repository-relative capture catalog file. */
    readonly captures: string;
    /** Shared resource policy. Capture/analysis values use target defaults; research ceilings are opt-in. */
    readonly limits?: ResearchInputLimits & {
        /** Optional byte ceiling per archive, including each graphics companion; omitted limits allow streamed inputs of any safely counted size. */
        readonly captureBytes?: number;
        /** Positive static-analysis work-item budget; omitted uses the target default. */
        readonly analysisWorkItems?: number;
        /** Non-negative static-analysis call depth; omitted uses the target default. */
        readonly analysisCallDepth?: number;
    };
}
/** Local locations may be absolute for private input bundles. They never enter generated history. */
export interface SourceProjectLocalInputs {
    /** Local settings format discriminator. */
    readonly format: "uttori-source-local";
    /** Local settings schema version. */
    readonly version: 1;
    /** Original ROM path; resolved against the repository root when read. */
    readonly rom: string;
    /** Analysis evidence project directory; resolved against the repository root when read. */
    readonly evidence: string;
}
/** Selected repository plus validated, branch-specific tracked configuration and research. */
export interface SourceProject {
    /** Git repository and worktree state directories that own this project. */
    readonly repository: SourceRepository;
    /** Validated `.uttori/project.json`. */
    readonly configuration: SourceProjectConfiguration;
    /** Content hash of the canonical JSON configuration. */
    readonly configurationSha256: string;
    /** Research declarations read from `researchRoots` under the configured limits. */
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