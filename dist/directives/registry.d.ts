import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { AddressStackDirectiveContext, ArchitectureDirectiveContext, AssemblerPolicyDirectiveContext, BaseLayoutDirectiveContext, DataDirectiveContext, FillPadDirectiveContext, FlowControlDirectiveContext, IncludeDirectiveContext, MapperDirectiveContext, MemoryDirectiveContext, NarrowDirectiveHandler, NamespaceDirectiveContext, OrgDirectiveContext, SpcDirectiveContext, StartposDirectiveContext, StructDirectiveContext, TableDirectiveContext } from "./types.js";
type BoundDirectiveHandler = (words: readonly string[], raw: string, command?: NormalizedCommand) => void;
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
    /**
     * Registers the value.
     * @param {string | string[]} keyword The keyword.
     * @param {Context} context The context.
     * @param {NarrowDirectiveHandler<Context>} handler The handler.
     */
    register<Context>(keyword: string | string[], context: Context, handler: NarrowDirectiveHandler<Context>): void;
    /**
     * Checks whether it has the value.
     * @param {string} keyword The keyword.
     * @returns {boolean} The result.
     */
    has(keyword: string): boolean;
    /**
     * Dispatches the value.
     * @param {string} keyword The keyword.
     * @param {readonly string[]} words The words.
     * @param {string} raw The raw.
     * @param {NormalizedCommand} [command] The command.
     * @returns {boolean} The result.
     */
    dispatch(keyword: string, words: readonly string[], raw: string, command?: NormalizedCommand): boolean;
}
export declare const createDirectiveRegistry: (contexts: DirectiveRegistryContexts) => DirectiveRegistry;
export {};
//# sourceMappingURL=registry.d.ts.map