import { PluginError } from "./diagnostics.js";
/**
 * Owns the mutable plugin state for exactly one assembler session.
 *
 * Values are created once per session, cloned into stage snapshots, restored when a
 * later pass resumes, reset between stages, and disposed in reverse registration order.
 */
export class PluginSessionStateStore {
    #contributions;
    #values;
    #disposed = false;
    /**
     * Creates every registered session-state slot for this session.
     * @param {readonly OwnedContribution<SessionStateContribution<unknown>>[]} contributions Owned session-state factories, in registration order.
     * @param {SessionCreationContext} context Target id and options passed to each `create`.
     * @throws {PluginError} If a slot factory throws (`PLUGIN_ACTIVATION_FAILED`).
     */
    constructor(contributions, context) {
        this.#contributions = contributions;
        this.#values = new Map();
        for (const record of contributions) {
            try {
                this.#values.set(record.contributionId, record.value.create(context));
            }
            catch (cause) {
                throw new PluginError(`Session state factory '${record.contributionId}' from '${record.pluginId}' failed.`, {
                    code: "PLUGIN_ACTIVATION_FAILED",
                    pluginId: record.pluginId,
                    contributionId: record.contributionId,
                    targetId: context.targetId,
                    cause,
                });
            }
        }
    }
    /**
     * Returns the live value for a branded session-state slot.
     * @param {SessionStateKey<T>} slot The slot key registered by the owning plugin.
     * @returns {T} The current value for this session.
     * @throws {PluginError} If the slot was not created for this session.
     */
    get(slot) {
        if (!this.#values.has(slot.id)) {
            throw new PluginError(`Session state slot '${slot.id}' is not active.`, {
                code: "PLUGIN_CONFIGURATION_INVALID",
                contributionId: slot.id,
            });
        }
        return this.#values.get(slot.id);
    }
    /**
     * Deep-clones every slot via its plugin `clone` hook.
     * Used to seed stage snapshots so later passes cannot mutate earlier ones.
     * @param {ReadonlyMap<string, unknown>} [source] Values to clone. Defaults to the live store.
     * @returns {PluginStateSnapshot} A new map of cloned slot values.
     * @throws {PluginError} If `source` is missing a registered slot, or a `clone` hook throws.
     */
    cloneSnapshot(source = this.#values) {
        const snapshot = new Map();
        for (const record of this.#contributions) {
            if (!source.has(record.contributionId)) {
                throw new PluginError(`Session state snapshot is missing '${record.contributionId}'.`, {
                    code: "PLUGIN_CONFIGURATION_INVALID",
                    pluginId: record.pluginId,
                    contributionId: record.contributionId,
                });
            }
            try {
                snapshot.set(record.contributionId, record.value.clone(source.get(record.contributionId)));
            }
            catch (cause) {
                throw new PluginError(`Session state clone '${record.contributionId}' failed.`, {
                    code: "PLUGIN_HOOK_FAILED",
                    pluginId: record.pluginId,
                    contributionId: record.contributionId,
                    cause,
                });
            }
        }
        return snapshot;
    }
    /**
     * Replaces the live slot map. Callers pass a snapshot from {@link cloneSnapshot}.
     * @param {PluginStateSnapshot} snapshot Previously cloned slot values.
     */
    restore(snapshot) {
        this.#values = snapshot;
    }
    /**
     * Runs each slot's optional `resetForStage` hook (stage entry / pass boundary).
     * Slots without a hook are left unchanged.
     * @param {AssemblyStageName} stage The stage that is about to run.
     * @throws {PluginError} If a `resetForStage` hook throws (`PLUGIN_HOOK_FAILED`).
     */
    resetForStage(stage) {
        for (const record of this.#contributions) {
            const reset = record.value.resetForStage;
            if (!reset)
                continue;
            try {
                reset(this.#values.get(record.contributionId), stage);
            }
            catch (cause) {
                throw new PluginError(`Session state reset '${record.contributionId}' failed.`, {
                    code: "PLUGIN_HOOK_FAILED",
                    pluginId: record.pluginId,
                    contributionId: record.contributionId,
                    cause,
                });
            }
        }
    }
    /**
     * Disposes every slot in reverse registration order, then clears the store.
     * Idempotent: a second call is a no-op. Slot `dispose` errors are collected and
     * rethrown as a single `AggregateError` after every slot has been attempted.
     * @throws {AggregateError} If one or more slot `dispose` hooks throw.
     */
    dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        const errors = [];
        for (const record of [...this.#contributions].reverse()) {
            try {
                record.value.dispose?.(this.#values.get(record.contributionId));
            }
            catch (error) {
                errors.push(error);
            }
        }
        this.#values.clear();
        if (errors.length > 0) {
            throw new AggregateError(errors, "One or more plugin session-state slots failed to dispose.");
        }
    }
}
//# sourceMappingURL=session-state.js.map