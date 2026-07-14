import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { AddressStackDirectiveContext, ArchitectureDirectiveContext, AssemblerPolicyDirectiveContext, BaseLayoutDirectiveContext, DataDirectiveContext, FillPadDirectiveContext, FlowControlDirectiveContext, IncludeDirectiveContext, MapperDirectiveContext, MemoryDirectiveContext, NarrowDirectiveHandler, NamespaceDirectiveContext, OrgDirectiveContext, SpcDirectiveContext, StartposDirectiveContext, StructDirectiveContext, TableDirectiveContext } from "./types.js";
type BoundDirectiveHandler = (words: string[], raw: string, command?: NormalizedCommand) => void;
export interface DirectiveRegistryContexts {
    data: DataDirectiveContext;
    fillPad: FillPadDirectiveContext;
    flowControl: FlowControlDirectiveContext;
    includeSource: IncludeDirectiveContext;
    layout: {
        addressStack: AddressStackDirectiveContext;
        architecture: ArchitectureDirectiveContext;
        base: BaseLayoutDirectiveContext;
        mapper: MapperDirectiveContext;
        org: OrgDirectiveContext;
        policy: AssemblerPolicyDirectiveContext;
        runtime: SpcDirectiveContext;
        startpos: StartposDirectiveContext;
    };
    memory: MemoryDirectiveContext;
    namespace: NamespaceDirectiveContext;
    spc: SpcDirectiveContext;
    struct: StructDirectiveContext;
    table: TableDirectiveContext;
}
export declare class DirectiveRegistry {
    readonly handlers: Map<string, BoundDirectiveHandler>;
    register<Context>(keyword: string | string[], context: Context, handler: NarrowDirectiveHandler<Context>): void;
    has(keyword: string): boolean;
    dispatch(keyword: string, words: string[], raw: string, command?: NormalizedCommand): boolean;
    dispatchCommand(command: NormalizedCommand): boolean;
}
export declare const createDirectiveRegistry: (contexts: DirectiveRegistryContexts) => DirectiveRegistry;
export {};
//# sourceMappingURL=registry.d.ts.map