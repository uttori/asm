import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { AddressStackDirectiveContext, ArchitectureDirectiveContext, AssemblerPolicyDirectiveContext, BaseLayoutDirectiveContext, DataDirectiveContext, FillPadDirectiveContext, FlowControlDirectiveContext, IncludeDirectiveContext, MapperDirectiveContext, MemoryDirectiveContext, NarrowDirectiveHandler, NamespaceDirectiveContext, OrgDirectiveContext, SpcDirectiveContext, StartposDirectiveContext, StructDirectiveContext, TableDirectiveContext, DiagnosticDirectiveContext } from "./types.js";
type BoundDirectiveHandler = (words: readonly string[], raw: string, command?: NormalizedCommand) => void;
export type DirectiveExecutionPhase = "preprocess" | "lowered";
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
    diagnostic: DiagnosticDirectiveContext;
}
export declare class DirectiveRegistry {
    readonly handlers: Map<string, BoundDirectiveHandler>;
    readonly phases: Map<string, DirectiveExecutionPhase>;
    /**
     * Registers the value.
     * @param {string | string[]} keyword The keyword.
     * @param {Context} context The context.
     * @param {NarrowDirectiveHandler<Context>} handler The handler.
     * @param {DirectiveExecutionPhase} [phase] The directive execution phase.
     */
    register<Context>(keyword: string | string[], context: Context, handler: NarrowDirectiveHandler<Context>, phase?: DirectiveExecutionPhase): void;
    /**
     * Registers a directive that can execute from durable lowered command data.
     * @param {string | string[]} keyword The directive keyword or aliases.
     * @param {Context} context The handler context.
     * @param {NarrowDirectiveHandler<Context>} handler The handler.
     */
    registerLowered<Context>(keyword: string | string[], context: Context, handler: NarrowDirectiveHandler<Context>): void;
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
    /**
     * Resolves a directive handler, including Asar's `@directive` file-header form.
     * @param {string} keyword The directive keyword.
     * @returns {BoundDirectiveHandler | undefined} The handler, if registered.
     */
    lookup(keyword: string): BoundDirectiveHandler | undefined;
    /**
     * Resolves the execution phase declared alongside a directive handler.
     * @param {string} keyword The directive keyword.
     * @returns {DirectiveExecutionPhase | undefined} The active directive phase.
     */
    getPhase(keyword: string): DirectiveExecutionPhase | undefined;
}
export declare const createDirectiveRegistry: (contexts: DirectiveRegistryContexts, activeSetIds?: ReadonlySet<string>) => DirectiveRegistry;
export {};
//# sourceMappingURL=registry.d.ts.map