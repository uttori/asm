import type { ArchitectureContribution, AssemblerPluginManifest, DirectiveSetContribution, ExpressionSetContribution, LifecycleContribution, OutputFormatContribution, SessionStateContribution, TargetContribution, ToolingCatalog, AddressSpaceContribution } from "./contracts.js";
export interface OwnedContribution<T> {
    readonly pluginId: string;
    readonly contributionId: string;
    readonly registrationOrder: number;
    readonly value: Readonly<T>;
}
export interface EnvironmentContributions {
    readonly manifests: readonly AssemblerPluginManifest[];
    readonly sessionStates: readonly OwnedContribution<SessionStateContribution<unknown>>[];
    readonly architectures: readonly OwnedContribution<ArchitectureContribution>[];
    readonly addressSpaces: readonly OwnedContribution<AddressSpaceContribution>[];
    readonly outputFormats: readonly OwnedContribution<OutputFormatContribution>[];
    readonly directiveSets: readonly OwnedContribution<DirectiveSetContribution>[];
    readonly expressionSets: readonly OwnedContribution<ExpressionSetContribution>[];
    readonly lifecycles: readonly OwnedContribution<LifecycleContribution>[];
    readonly targets: readonly OwnedContribution<TargetContribution>[];
}
export declare class AssemblerEnvironment {
    #private;
    readonly manifests: readonly AssemblerPluginManifest[];
    readonly sessionStates: readonly OwnedContribution<SessionStateContribution<unknown>>[];
    constructor(contributions: EnvironmentContributions);
    resolveTargetId(idOrAlias: string): string | undefined;
    getTarget(idOrAlias: string): Readonly<TargetContribution> | undefined;
    resolveArchitectureId(targetId: string, idOrAlias: string): string | undefined;
    getArchitecture(id: string): Readonly<ArchitectureContribution> | undefined;
    getAddressSpace(id: string): Readonly<AddressSpaceContribution> | undefined;
    getOutputFormat(id: string): Readonly<OutputFormatContribution> | undefined;
    getDirectiveSet(id: string): Readonly<DirectiveSetContribution> | undefined;
    getExpressionSet(id: string): Readonly<ExpressionSetContribution> | undefined;
    getLifecycle(id: string): Readonly<LifecycleContribution> | undefined;
    getContributionOwner(id: string): string | undefined;
    getTargetLifecycles(targetId: string): readonly OwnedContribution<LifecycleContribution>[];
    getToolingCatalog(targetId: string): ToolingCatalog;
}
//# sourceMappingURL=environment.d.ts.map