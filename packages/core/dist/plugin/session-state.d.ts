import type { AssemblyStageName, SessionCreationContext, SessionStateContribution, SessionStateKey, SessionStateStore } from "./contracts.js";
import type { OwnedContribution } from "./environment.js";
/**
 * Per-slot plugin values for one assembler session (or a cloned stage snapshot).
 * Keys are contribution ids. Values are whatever each plugin's `create`/`clone` returned.
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
     * @param contributions Owned session-state factories, in registration order.
     * @param context Target id and options passed to each `create`.
     * @throws {PluginError} If a slot factory throws (`PLUGIN_ACTIVATION_FAILED`).
     */
    constructor(contributions: readonly OwnedContribution<SessionStateContribution<unknown>>[], context: SessionCreationContext);
    /**
     * Returns the live value for a branded session-state slot.
     * @param slot The slot key registered by the owning plugin.
     * @returns The current value for this session.
     * @throws {PluginError} If the slot was not created for this session.
     */
    get<T>(slot: SessionStateKey<T>): T;
    /**
     * Copies every slot via its plugin `clone` hook. Each hook is responsible for copying
     * mutable descendants so later passes cannot mutate earlier stage snapshots.
     * @param [source] Values to clone. Defaults to the live store.
     * @returns A new map of cloned slot values.
     * @throws {PluginError} If `source` is missing a registered slot, or a `clone` hook throws.
     */
    cloneSnapshot(source?: ReadonlyMap<string, unknown>): PluginStateSnapshot;
    /**
     * Adopts a snapshot from {@link cloneSnapshot} as the live map without copying or validation.
     * Subsequent writes mutate this map. The previous snapshot is not individually disposed.
     * @param snapshot Previously cloned slot values.
     */
    restore(snapshot: PluginStateSnapshot): void;
    /**
     * Runs each slot's optional `resetForStage` hook (stage entry / pass boundary).
     * Slots without a hook are left unchanged.
     * @param stage The stage that is about to run.
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