import type { OwnedContribution } from "./environment.js";
import type { AssemblyStageName, SessionCreationContext, SessionStateContribution, SessionStateKey, SessionStateStore } from "./contracts.js";
export type PluginStateSnapshot = Map<string, unknown>;
/** Owns the mutable plugin state for exactly one assembler session. */
export declare class PluginSessionStateStore implements SessionStateStore {
    #private;
    constructor(contributions: readonly OwnedContribution<SessionStateContribution<unknown>>[], context: SessionCreationContext);
    get<T>(slot: SessionStateKey<T>): T;
    cloneSnapshot(source?: ReadonlyMap<string, unknown>): PluginStateSnapshot;
    restore(snapshot: PluginStateSnapshot): void;
    resetForStage(stage: AssemblyStageName): void;
    dispose(): void;
}
//# sourceMappingURL=session-state.d.ts.map