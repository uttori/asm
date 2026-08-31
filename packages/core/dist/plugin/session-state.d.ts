import type { OwnedContribution } from "./environment.js";
import type { AssemblyStageName, SessionCreationContext, SessionStateContribution, SessionStateKey, SessionStateStore } from "./contracts.js";
/**
 * Per-slot plugin values for one assembler session (or a cloned stage snapshot).
 * Keys are contribution ids; values are whatever each plugin's `create`/`clone` returned.
 */
export type PluginStateSnapshot = Map<string, unknown>;
/**
 * Owns the mutable plugin state for exactly one assembler session.
 *
 * Values are created once per session, cloned into stage snapshots, restored when a
 * later pass resumes, reset between stages, and disposed in reverse registration order.
 */
export declare class PluginSessionStateStore implements SessionStateStore {
    #private;
    /**
     * Creates every registered session-state slot for this session.
     * @param {readonly OwnedContribution<SessionStateContribution<unknown>>[]} contributions Owned session-state factories, in registration order.
     * @param {SessionCreationContext} context Target id and options passed to each `create`.
     * @throws {PluginError} If a slot factory throws (`PLUGIN_ACTIVATION_FAILED`).
     */
    constructor(contributions: readonly OwnedContribution<SessionStateContribution<unknown>>[], context: SessionCreationContext);
    /**
     * Returns the live value for a branded session-state slot.
     * @param {SessionStateKey<T>} slot The slot key registered by the owning plugin.
     * @returns {T} The current value for this session.
     * @throws {PluginError} If the slot was not created for this session.
     */
    get<T>(slot: SessionStateKey<T>): T;
    /**
     * Deep-clones every slot via its plugin `clone` hook.
     * Used to seed stage snapshots so later passes cannot mutate earlier ones.
     * @param {ReadonlyMap<string, unknown>} [source] Values to clone. Defaults to the live store.
     * @returns {PluginStateSnapshot} A new map of cloned slot values.
     * @throws {PluginError} If `source` is missing a registered slot, or a `clone` hook throws.
     */
    cloneSnapshot(source?: ReadonlyMap<string, unknown>): PluginStateSnapshot;
    /**
     * Replaces the live slot map. Callers pass a snapshot from {@link cloneSnapshot}.
     * @param {PluginStateSnapshot} snapshot Previously cloned slot values.
     */
    restore(snapshot: PluginStateSnapshot): void;
    /**
     * Runs each slot's optional `resetForStage` hook (stage entry / pass boundary).
     * Slots without a hook are left unchanged.
     * @param {AssemblyStageName} stage The stage that is about to run.
     * @throws {PluginError} If a `resetForStage` hook throws (`PLUGIN_HOOK_FAILED`).
     */
    resetForStage(stage: AssemblyStageName): void;
    /**
     * Disposes every slot in reverse registration order, then clears the store.
     * Idempotent: a second call is a no-op. Slot `dispose` errors are collected and
     * rethrown as a single `AggregateError` after every slot has been attempted.
     * @throws {AggregateError} If one or more slot `dispose` hooks throw.
     */
    dispose(): void;
}
//# sourceMappingURL=session-state.d.ts.map